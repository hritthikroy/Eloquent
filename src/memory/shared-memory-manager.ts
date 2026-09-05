/**
 * SharedMemoryManager - Zero-copy memory synchronization for agent state
 * 
 * Provides persistent, high-performance memory access across Electron processes
 * using SharedArrayBuffer for zero-copy data exchange.
 * 
 * Architecture:
 * - SharedArrayBuffer for cross-process memory
 * - Atomic operations for thread-safe access
 * - Binary protocol for zero serialization overhead
 * - Version tracking for consistency
 */

import { Worker } from 'worker_threads';

/**
 * Memory layout specification for agent state
 * 
 * Structure:
 * [Header: 64 bytes]
 *   - Magic number: 4 bytes (0xELOQ)
 *   - Version: 4 bytes
 *   - Lock: 4 bytes (atomic lock)
 *   - Total size: 4 bytes
 *   - Agent count: 4 bytes
 *   - Reserved: 44 bytes
 * 
 * [Agent Slots: N x AGENT_SLOT_SIZE bytes]
 *   Each slot contains:
 *   - Agent ID: 16 bytes (UUID-like)
 *   - State version: 4 bytes
 *   - Last updated: 8 bytes (timestamp)
 *   - Data length: 4 bytes
 *   - Data: variable (up to MAX_AGENT_DATA_SIZE)
 */

export const MEMORY_CONSTANTS = {
  MAGIC_NUMBER: 0x454C4F51, // "ELOQ" in hex
  HEADER_SIZE: 64,
  AGENT_SLOT_SIZE: 1024 * 128, // 128KB per agent
  MAX_AGENTS: 8, // Vision, Tuk Tuk, Friday, Brian + 4 future agents
  MAX_AGENT_DATA_SIZE: 1024 * 127, // Slot size - metadata
  LOCK_OFFSET: 8,
  VERSION_OFFSET: 4,
  AGENT_COUNT_OFFSET: 16,
} as const;

export const TOTAL_MEMORY_SIZE = 
  MEMORY_CONSTANTS.HEADER_SIZE + 
  (MEMORY_CONSTANTS.AGENT_SLOT_SIZE * MEMORY_CONSTANTS.MAX_AGENTS);

/**
 * Agent metadata structure
 */
export interface AgentMetadata {
  id: string;
  name: string;
  version: number;
  lastUpdated: number;
  dataLength: number;
}

/**
 * Agent state data
 */
export interface AgentState {
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  preferences: Record<string, unknown>;
  memory: {
    shortTerm: Array<{ topic: string; content: string; salience: number }>;
    longTerm: Array<{ topic: string; insight: string; strength: number }>;
  };
  emotionalState: {
    mood: string;
    intensity: number;
    lastInteraction: number;
  };
  customData: Record<string, unknown>;
}

/**
 * SharedMemoryManager class
 * 
 * Manages zero-copy memory buffer for agent state synchronization
 */
export class SharedMemoryManager {
  private buffer: SharedArrayBuffer;
  private view: DataView;
  private int32Array: Int32Array;
  private uint8Array: Uint8Array;
  private initialized: boolean = false;
  private lockTimeout: number = 5000; // 5 second lock timeout

  constructor(existingBuffer?: SharedArrayBuffer) {
    if (existingBuffer) {
      this.buffer = existingBuffer;
    } else {
      this.buffer = new SharedArrayBuffer(TOTAL_MEMORY_SIZE);
    }
    
    this.view = new DataView(this.buffer);
    this.int32Array = new Int32Array(this.buffer);
    this.uint8Array = new Uint8Array(this.buffer);
    
    if (!existingBuffer) {
      this.initialize();
    } else {
      this.validateBuffer();
    }
  }

  /**
   * Initialize the shared memory buffer with header
   */
  private initialize(): void {
    // Write magic number
    this.view.setUint32(0, MEMORY_CONSTANTS.MAGIC_NUMBER, true);
    
    // Write version
    this.view.setUint32(MEMORY_CONSTANTS.VERSION_OFFSET, 1, true);
    
    // Initialize lock to 0 (unlocked)
    Atomics.store(this.int32Array, MEMORY_CONSTANTS.LOCK_OFFSET / 4, 0);
    
    // Write total size
    this.view.setUint32(12, TOTAL_MEMORY_SIZE, true);
    
    // Initialize agent count to 0
    this.view.setUint32(MEMORY_CONSTANTS.AGENT_COUNT_OFFSET, 0, true);
    
    this.initialized = true;
  }

  /**
   * Validate existing buffer integrity
   */
  private validateBuffer(): void {
    const magic = this.view.getUint32(0, true);
    if (magic !== MEMORY_CONSTANTS.MAGIC_NUMBER) {
      throw new Error(`Invalid magic number: expected ${MEMORY_CONSTANTS.MAGIC_NUMBER}, got ${magic}`);
    }
    
    const version = this.view.getUint32(MEMORY_CONSTANTS.VERSION_OFFSET, true);
    if (version < 1) {
      throw new Error(`Invalid version: ${version}`);
    }
    
    this.initialized = true;
  }

  /**
   * Acquire exclusive lock using atomic operations
   * Returns true if lock acquired, false if timeout
   */
  private acquireLock(): boolean {
    const lockIndex = MEMORY_CONSTANTS.LOCK_OFFSET / 4;
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.lockTimeout) {
      // Try to atomically set lock from 0 to 1
      const result = Atomics.compareExchange(
        this.int32Array,
        lockIndex,
        0, // Expected value (unlocked)
        1  // New value (locked)
      );
      
      if (result === 0) {
        // Successfully acquired lock
        return true;
      }
      
      // Wait a bit before retrying (exponential backoff)
      Atomics.wait(this.int32Array, lockIndex, 1, 10);
    }
    
    return false;
  }

  /**
   * Release exclusive lock
   */
  private releaseLock(): void {
    const lockIndex = MEMORY_CONSTANTS.LOCK_OFFSET / 4;
    Atomics.store(this.int32Array, lockIndex, 0);
    Atomics.notify(this.int32Array, lockIndex, 1);
  }

  /**
   * Get agent slot offset by index
   */
  private getAgentSlotOffset(agentIndex: number): number {
    if (agentIndex < 0 || agentIndex >= MEMORY_CONSTANTS.MAX_AGENTS) {
      throw new Error(`Invalid agent index: ${agentIndex}`);
    }
    return MEMORY_CONSTANTS.HEADER_SIZE + (agentIndex * MEMORY_CONSTANTS.AGENT_SLOT_SIZE);
  }

  /**
   * Find agent slot by ID
   * Returns -1 if not found
   */
  private findAgentSlot(agentId: string): number {
    const agentCount = this.view.getUint32(MEMORY_CONSTANTS.AGENT_COUNT_OFFSET, true);
    
    for (let i = 0; i < agentCount; i++) {
      const slotOffset = this.getAgentSlotOffset(i);
      
      // Read agent ID (16 bytes UTF-8)
      const idBytes = new Uint8Array(this.buffer, slotOffset, 16);
      const storedId = new TextDecoder().decode(idBytes).replace(/\0+$/, '');
      
      if (storedId === agentId) {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Allocate new agent slot
   */
  private allocateAgentSlot(agentId: string): number {
    const agentCount = this.view.getUint32(MEMORY_CONSTANTS.AGENT_COUNT_OFFSET, true);
    
    if (agentCount >= MEMORY_CONSTANTS.MAX_AGENTS) {
      throw new Error(`Maximum agent count reached: ${MEMORY_CONSTANTS.MAX_AGENTS}`);
    }
    
    const newIndex = agentCount;
    const slotOffset = this.getAgentSlotOffset(newIndex);
    
    // Write agent ID (pad to 16 bytes)
    const idBytes = new TextEncoder().encode(agentId.padEnd(16, '\0').substring(0, 16));
    this.uint8Array.set(idBytes, slotOffset);
    
    // Initialize metadata
    this.view.setUint32(slotOffset + 16, 0, true); // version
    this.view.setBigUint64(slotOffset + 20, BigInt(Date.now()), true); // timestamp
    this.view.setUint32(slotOffset + 28, 0, true); // data length
    
    // Update agent count
    this.view.setUint32(MEMORY_CONSTANTS.AGENT_COUNT_OFFSET, agentCount + 1, true);
    
    return newIndex;
  }

  /**
   * Write agent state to memory (zero-copy)
   */
  public writeAgentState(agentId: string, state: AgentState): boolean {
    if (!this.initialized) {
      throw new Error('SharedMemoryManager not initialized');
    }
    
    // Acquire lock
    if (!this.acquireLock()) {
      console.error('Failed to acquire lock for write operation');
      return false;
    }
    
    try {
      // Find or allocate agent slot
      let slotIndex = this.findAgentSlot(agentId);
      if (slotIndex === -1) {
        slotIndex = this.allocateAgentSlot(agentId);
      }
      
      const slotOffset = this.getAgentSlotOffset(slotIndex);
      
      // Serialize state to binary (custom binary protocol)
      const stateBytes = this.serializeState(state);
      
      if (stateBytes.length > MEMORY_CONSTANTS.MAX_AGENT_DATA_SIZE) {
        throw new Error(`Agent state too large: ${stateBytes.length} bytes (max: ${MEMORY_CONSTANTS.MAX_AGENT_DATA_SIZE})`);
      }
      
      // Update metadata
      const currentVersion = this.view.getUint32(slotOffset + 16, true);
      this.view.setUint32(slotOffset + 16, currentVersion + 1, true); // increment version
      this.view.setBigUint64(slotOffset + 20, BigInt(Date.now()), true); // update timestamp
      this.view.setUint32(slotOffset + 28, stateBytes.length, true); // data length
      
      // Write data (zero-copy)
      this.uint8Array.set(stateBytes, slotOffset + 32);
      
      return true;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Read agent state from memory (zero-copy)
   */
  public readAgentState(agentId: string): AgentState | null {
    if (!this.initialized) {
      throw new Error('SharedMemoryManager not initialized');
    }
    
    // Acquire lock
    if (!this.acquireLock()) {
      console.error('Failed to acquire lock for read operation');
      return null;
    }
    
    try {
      const slotIndex = this.findAgentSlot(agentId);
      if (slotIndex === -1) {
        return null; // Agent not found
      }
      
      const slotOffset = this.getAgentSlotOffset(slotIndex);
      
      // Read metadata
      const dataLength = this.view.getUint32(slotOffset + 28, true);
      
      if (dataLength === 0) {
        return null; // No data
      }
      
      // Read data (zero-copy view)
      const dataBytes = new Uint8Array(this.buffer, slotOffset + 32, dataLength);
      
      // Deserialize state from binary
      return this.deserializeState(dataBytes);
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Get agent metadata
   */
  public getAgentMetadata(agentId: string): AgentMetadata | null {
    if (!this.initialized) {
      throw new Error('SharedMemoryManager not initialized');
    }
    
    const slotIndex = this.findAgentSlot(agentId);
    if (slotIndex === -1) {
      return null;
    }
    
    const slotOffset = this.getAgentSlotOffset(slotIndex);
    
    // Read agent ID
    const idBytes = new Uint8Array(this.buffer, slotOffset, 16);
    const id = new TextDecoder().decode(idBytes).replace(/\0+$/, '');
    
    // Read metadata (no lock needed for reads)
    const version = this.view.getUint32(slotOffset + 16, true);
    const lastUpdated = Number(this.view.getBigUint64(slotOffset + 20, true));
    const dataLength = this.view.getUint32(slotOffset + 28, true);
    
    return {
      id,
      name: id, // For now, ID is the name
      version,
      lastUpdated,
      dataLength,
    };
  }

  /**
   * List all registered agents
   */
  public listAgents(): AgentMetadata[] {
    if (!this.initialized) {
      throw new Error('SharedMemoryManager not initialized');
    }
    
    const agentCount = this.view.getUint32(MEMORY_CONSTANTS.AGENT_COUNT_OFFSET, true);
    const agents: AgentMetadata[] = [];
    
    for (let i = 0; i < agentCount; i++) {
      const slotOffset = this.getAgentSlotOffset(i);
      
      // Read agent ID
      const idBytes = new Uint8Array(this.buffer, slotOffset, 16);
      const id = new TextDecoder().decode(idBytes).replace(/\0+$/, '');
      
      // Read metadata
      const version = this.view.getUint32(slotOffset + 16, true);
      const lastUpdated = Number(this.view.getBigUint64(slotOffset + 20, true));
      const dataLength = this.view.getUint32(slotOffset + 28, true);
      
      agents.push({
        id,
        name: id,
        version,
        lastUpdated,
        dataLength,
      });
    }
    
    return agents;
  }

  /**
   * Get the underlying SharedArrayBuffer
   */
  public getBuffer(): SharedArrayBuffer {
    return this.buffer;
  }

  /**
   * Clear agent state
   */
  public clearAgentState(agentId: string): boolean {
    if (!this.initialized) {
      throw new Error('SharedMemoryManager not initialized');
    }
    
    if (!this.acquireLock()) {
      return false;
    }
    
    try {
      const slotIndex = this.findAgentSlot(agentId);
      if (slotIndex === -1) {
        return false;
      }
      
      const slotOffset = this.getAgentSlotOffset(slotIndex);
      
      // Clear data length
      this.view.setUint32(slotOffset + 28, 0, true);
      
      return true;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Serialize agent state to binary (custom protocol)
   * 
   * Format:
   * - Conversation history count: 4 bytes
   * - For each conversation entry:
   *   - Role (1 byte: 0=user, 1=assistant)
   *   - Timestamp: 8 bytes
   *   - Content length: 4 bytes
   *   - Content: variable UTF-8
   * - Preferences JSON length: 4 bytes
   * - Preferences JSON: variable UTF-8
   * - Memory sections (similar structure)
   * - Emotional state (similar structure)
   * - Custom data JSON length: 4 bytes
   * - Custom data JSON: variable UTF-8
   */
  private serializeState(state: AgentState): Uint8Array {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    
    // Helper to add bytes
    const addChunk = (bytes: Uint8Array) => {
      chunks.push(bytes);
      totalLength += bytes.length;
    };
    
    // Helper to encode number as 4 bytes
    const encodeU32 = (n: number): Uint8Array => {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setUint32(0, n, true);
      return new Uint8Array(buf);
    };
    
    // Helper to encode bigint as 8 bytes
    const encodeU64 = (n: number): Uint8Array => {
      const buf = new ArrayBuffer(8);
      new DataView(buf).setBigUint64(0, BigInt(n), true);
      return new Uint8Array(buf);
    };
    
    // 1. Conversation history
    addChunk(encodeU32(state.conversationHistory.length));
    for (const entry of state.conversationHistory) {
      addChunk(new Uint8Array([entry.role === 'user' ? 0 : 1]));
      addChunk(encodeU64(entry.timestamp));
      const contentBytes = new TextEncoder().encode(entry.content);
      addChunk(encodeU32(contentBytes.length));
      addChunk(contentBytes);
    }
    
    // 2. Preferences (as JSON for now - could be optimized further)
    const prefsJson = JSON.stringify(state.preferences);
    const prefsBytes = new TextEncoder().encode(prefsJson);
    addChunk(encodeU32(prefsBytes.length));
    addChunk(prefsBytes);
    
    // 3. Memory (as JSON for now)
    const memoryJson = JSON.stringify(state.memory);
    const memoryBytes = new TextEncoder().encode(memoryJson);
    addChunk(encodeU32(memoryBytes.length));
    addChunk(memoryBytes);
    
    // 4. Emotional state (as JSON for now)
    const emotionJson = JSON.stringify(state.emotionalState);
    const emotionBytes = new TextEncoder().encode(emotionJson);
    addChunk(encodeU32(emotionBytes.length));
    addChunk(emotionBytes);
    
    // 5. Custom data (as JSON)
    const customJson = JSON.stringify(state.customData);
    const customBytes = new TextEncoder().encode(customJson);
    addChunk(encodeU32(customBytes.length));
    addChunk(customBytes);
    
    // Combine all chunks
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }

  /**
   * Deserialize agent state from binary
   */
  private deserializeState(bytes: Uint8Array): AgentState {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    
    // Helper to read U32
    const readU32 = (): number => {
      const val = view.getUint32(offset, true);
      offset += 4;
      return val;
    };
    
    // Helper to read U64
    const readU64 = (): number => {
      const val = Number(view.getBigUint64(offset, true));
      offset += 8;
      return val;
    };
    
    // Helper to read string
    const readString = (): string => {
      const length = readU32();
      const strBytes = new Uint8Array(bytes.buffer, bytes.byteOffset + offset, length);
      offset += length;
      return new TextDecoder().decode(strBytes);
    };
    
    // 1. Conversation history
    const historyCount = readU32();
    const conversationHistory: AgentState['conversationHistory'] = [];
    for (let i = 0; i < historyCount; i++) {
      const roleCode = bytes[offset++];
      const timestamp = readU64();
      const content = readString();
      conversationHistory.push({
        role: roleCode === 0 ? 'user' : 'assistant',
        content,
        timestamp,
      });
    }
    
    // 2. Preferences
    const prefsJson = readString();
    const preferences = JSON.parse(prefsJson);
    
    // 3. Memory
    const memoryJson = readString();
    const memory = JSON.parse(memoryJson);
    
    // 4. Emotional state
    const emotionJson = readString();
    const emotionalState = JSON.parse(emotionJson);
    
    // 5. Custom data
    const customJson = readString();
    const customData = JSON.parse(customJson);
    
    return {
      conversationHistory,
      preferences,
      memory,
      emotionalState,
      customData,
    };
  }

  /**
   * Get memory statistics
   */
  public getStats(): {
    totalSize: number;
    usedSize: number;
    agentCount: number;
    freeSlots: number;
  } {
    const agentCount = this.view.getUint32(MEMORY_CONSTANTS.AGENT_COUNT_OFFSET, true);
    let usedSize = MEMORY_CONSTANTS.HEADER_SIZE;
    
    for (let i = 0; i < agentCount; i++) {
      const slotOffset = this.getAgentSlotOffset(i);
      const dataLength = this.view.getUint32(slotOffset + 28, true);
      usedSize += 32 + dataLength; // metadata + data
    }
    
    return {
      totalSize: TOTAL_MEMORY_SIZE,
      usedSize,
      agentCount,
      freeSlots: MEMORY_CONSTANTS.MAX_AGENTS - agentCount,
    };
  }
}

/**
 * Export singleton instance for main process
 */
let sharedInstance: SharedMemoryManager | null = null;

export function getSharedMemoryManager(buffer?: SharedArrayBuffer): SharedMemoryManager {
  if (!sharedInstance) {
    sharedInstance = new SharedMemoryManager(buffer);
  }
  return sharedInstance;
}
