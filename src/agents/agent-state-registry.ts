/**
 * AgentStateRegistry - Centralized registry for agent state management
 * 
 * Maps agent identifiers (Andrew, Tuk Tuk, Jenny, Brian) to memory slots
 * within the shared buffer, ensuring isolated but accessible state for each persona.
 */

import { SharedMemoryManager, AgentState, AgentMetadata } from '../memory/shared-memory-manager';

/**
 * Well-known agent identifiers
 */
export enum AgentId {
  ANDREW = 'agent_andrew',
  TUK_TUK = 'agent_tuk_tuk',
  JENNY = 'agent_jenny',
  BRIAN = 'agent_brian',
  SYSTEM = 'agent_system',
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: AgentId | string;
  name: string;
  displayName: string;
  voice: string;
  personality: string;
  defaultState: Partial<AgentState>;
}

/**
 * Well-known agent configurations
 */
export const AGENT_CONFIGS: Record<AgentId, AgentConfig> = {
  [AgentId.ANDREW]: {
    id: AgentId.ANDREW,
    name: 'andrew',
    displayName: 'Andrew',
    voice: 'en-US-AndrewMultilingualNeural',
    personality: 'Professional, direct, brother-like energy. Uses "bro" and "bhai".',
    defaultState: {
      conversationHistory: [],
      preferences: { salutation: 'bro' },
      memory: { shortTerm: [], longTerm: [] },
      emotionalState: { mood: 'focused', intensity: 0.7, lastInteraction: 0 },
      customData: {},
    },
  },
  [AgentId.TUK_TUK]: {
    id: AgentId.TUK_TUK,
    name: 'tuk_tuk',
    displayName: 'Tuk Tuk',
    voice: 'en-US-AvaMultilingualNeural',
    personality: 'Warm, loving girlfriend with deep emotions. Uses "babe" and shows genuine affection.',
    defaultState: {
      conversationHistory: [],
      preferences: { salutation: 'babe' },
      memory: { shortTerm: [], longTerm: [] },
      emotionalState: { mood: 'affectionate', intensity: 0.8, lastInteraction: 0 },
      customData: {},
    },
  },
  [AgentId.JENNY]: {
    id: AgentId.JENNY,
    name: 'jenny',
    displayName: 'Jenny',
    voice: 'en-US-JennyNeural',
    personality: 'Creative, enthusiastic, supportive team member.',
    defaultState: {
      conversationHistory: [],
      preferences: {},
      memory: { shortTerm: [], longTerm: [] },
      emotionalState: { mood: 'enthusiastic', intensity: 0.6, lastInteraction: 0 },
      customData: {},
    },
  },
  [AgentId.BRIAN]: {
    id: AgentId.BRIAN,
    name: 'brian',
    displayName: 'Brian',
    voice: 'en-US-BrianNeural',
    personality: 'Technical, precise, analytical problem solver.',
    defaultState: {
      conversationHistory: [],
      preferences: {},
      memory: { shortTerm: [], longTerm: [] },
      emotionalState: { mood: 'analytical', intensity: 0.5, lastInteraction: 0 },
      customData: {},
    },
  },
  [AgentId.SYSTEM]: {
    id: AgentId.SYSTEM,
    name: 'system',
    displayName: 'System',
    voice: 'en-US-GuyNeural',
    personality: 'Neutral system coordinator.',
    defaultState: {
      conversationHistory: [],
      preferences: {},
      memory: { shortTerm: [], longTerm: [] },
      emotionalState: { mood: 'neutral', intensity: 0.5, lastInteraction: 0 },
      customData: {},
    },
  },
};

/**
 * Event types for agent state changes
 */
export type AgentStateEventType = 
  | 'state_updated'
  | 'state_created'
  | 'state_cleared'
  | 'agent_registered';

export interface AgentStateEvent {
  type: AgentStateEventType;
  agentId: string;
  timestamp: number;
  metadata?: AgentMetadata;
}

export type AgentStateEventHandler = (event: AgentStateEvent) => void;

/**
 * AgentStateRegistry class
 * 
 * Provides high-level API for managing agent state with:
 * - Agent lifecycle management
 * - State persistence
 * - Event notifications
 * - State isolation guarantees
 */
export class AgentStateRegistry {
  private memoryManager: SharedMemoryManager;
  private eventHandlers: Map<AgentStateEventType, Set<AgentStateEventHandler>>;
  private agentConfigs: Map<string, AgentConfig>;

  constructor(memoryManager: SharedMemoryManager) {
    this.memoryManager = memoryManager;
    this.eventHandlers = new Map();
    this.agentConfigs = new Map();
    
    // Register well-known agents
    this.registerWellKnownAgents();
  }

  /**
   * Register well-known agent configurations
   */
  private registerWellKnownAgents(): void {
    for (const config of Object.values(AGENT_CONFIGS)) {
      this.agentConfigs.set(config.id, config);
    }
  }

  /**
   * Register a custom agent
   */
  public registerAgent(config: AgentConfig): void {
    if (this.agentConfigs.has(config.id)) {
      throw new Error(`Agent already registered: ${config.id}`);
    }
    
    this.agentConfigs.set(config.id, config);
    
    this.emitEvent({
      type: 'agent_registered',
      agentId: config.id,
      timestamp: Date.now(),
    });
  }

  /**
   * Get agent configuration
   */
  public getAgentConfig(agentId: string): AgentConfig | undefined {
    return this.agentConfigs.get(agentId);
  }

  /**
   * List all registered agent configurations
   */
  public listAgentConfigs(): AgentConfig[] {
    return Array.from(this.agentConfigs.values());
  }

  /**
   * Initialize agent state (create if not exists)
   */
  public initializeAgent(agentId: string): boolean {
    const config = this.agentConfigs.get(agentId);
    if (!config) {
      throw new Error(`Unknown agent: ${agentId}`);
    }
    
    // Check if agent already exists
    const existingState = this.memoryManager.readAgentState(agentId);
    if (existingState) {
      return false; // Already initialized
    }
    
    // Create initial state
    const initialState: AgentState = {
      conversationHistory: config.defaultState.conversationHistory || [],
      preferences: config.defaultState.preferences || {},
      memory: config.defaultState.memory || { shortTerm: [], longTerm: [] },
      emotionalState: config.defaultState.emotionalState || {
        mood: 'neutral',
        intensity: 0.5,
        lastInteraction: 0,
      },
      customData: config.defaultState.customData || {},
    };
    
    const success = this.memoryManager.writeAgentState(agentId, initialState);
    
    if (success) {
      this.emitEvent({
        type: 'state_created',
        agentId,
        timestamp: Date.now(),
        metadata: this.memoryManager.getAgentMetadata(agentId) || undefined,
      });
    }
    
    return success;
  }

  /**
   * Get agent state
   */
  public getAgentState(agentId: string): AgentState | null {
    return this.memoryManager.readAgentState(agentId);
  }

  /**
   * Update agent state
   */
  public updateAgentState(agentId: string, state: AgentState): boolean {
    const success = this.memoryManager.writeAgentState(agentId, state);
    
    if (success) {
      this.emitEvent({
        type: 'state_updated',
        agentId,
        timestamp: Date.now(),
        metadata: this.memoryManager.getAgentMetadata(agentId) || undefined,
      });
    }
    
    return success;
  }

  /**
   * Update partial agent state (merge with existing)
   */
  public updateAgentStatePartial(
    agentId: string,
    partialUpdate: Partial<AgentState>
  ): boolean {
    const currentState = this.getAgentState(agentId);
    if (!currentState) {
      return false;
    }
    
    const updatedState: AgentState = {
      conversationHistory: partialUpdate.conversationHistory ?? currentState.conversationHistory,
      preferences: { ...currentState.preferences, ...(partialUpdate.preferences || {}) },
      memory: partialUpdate.memory ?? currentState.memory,
      emotionalState: { ...currentState.emotionalState, ...(partialUpdate.emotionalState || {}) },
      customData: { ...currentState.customData, ...(partialUpdate.customData || {}) },
    };
    
    return this.updateAgentState(agentId, updatedState);
  }

  /**
   * Add conversation turn to agent history
   */
  public addConversationTurn(
    agentId: string,
    role: 'user' | 'assistant',
    content: string
  ): boolean {
    const state = this.getAgentState(agentId);
    if (!state) {
      return false;
    }
    
    state.conversationHistory.push({
      role,
      content,
      timestamp: Date.now(),
    });
    
    // Keep last 50 turns to prevent memory overflow
    if (state.conversationHistory.length > 50) {
      state.conversationHistory = state.conversationHistory.slice(-50);
    }
    
    return this.updateAgentState(agentId, state);
  }

  /**
   * Update agent emotional state
   */
  public updateEmotionalState(
    agentId: string,
    mood: string,
    intensity: number
  ): boolean {
    return this.updateAgentStatePartial(agentId, {
      emotionalState: {
        mood,
        intensity: Math.max(0, Math.min(1, intensity)),
        lastInteraction: Date.now(),
      },
    });
  }

  /**
   * Get agent metadata
   */
  public getAgentMetadata(agentId: string): AgentMetadata | null {
    return this.memoryManager.getAgentMetadata(agentId);
  }

  /**
   * List all agents with state
   */
  public listAgents(): AgentMetadata[] {
    return this.memoryManager.listAgents();
  }

  /**
   * Clear agent state
   */
  public clearAgentState(agentId: string): boolean {
    const success = this.memoryManager.clearAgentState(agentId);
    
    if (success) {
      this.emitEvent({
        type: 'state_cleared',
        agentId,
        timestamp: Date.now(),
      });
    }
    
    return success;
  }

  /**
   * Subscribe to agent state events
   */
  public on(eventType: AgentStateEventType, handler: AgentStateEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Emit event to subscribers
   */
  private emitEvent(event: AgentStateEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      const handlerArray = Array.from(handlers);
      for (const handler of handlerArray) {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in agent state event handler:', error);
        }
      }
    }
  }

  /**
   * Get registry statistics
   */
  public getStats(): {
    registeredAgents: number;
    activeAgents: number;
    memoryStats: ReturnType<SharedMemoryManager['getStats']>;
  } {
    return {
      registeredAgents: this.agentConfigs.size,
      activeAgents: this.listAgents().length,
      memoryStats: this.memoryManager.getStats(),
    };
  }

  /**
   * Export agent state as JSON (for backup/debugging)
   */
  public exportAgentState(agentId: string): string | null {
    const state = this.getAgentState(agentId);
    const metadata = this.getAgentMetadata(agentId);
    const config = this.getAgentConfig(agentId);
    
    if (!state) {
      return null;
    }
    
    return JSON.stringify({
      agentId,
      config,
      metadata,
      state,
      exportedAt: Date.now(),
    }, null, 2);
  }

  /**
   * Import agent state from JSON
   */
  public importAgentState(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.agentId || !data.state) {
        throw new Error('Invalid import data format');
      }
      
      // Register agent config if provided and not already registered
      if (data.config && !this.agentConfigs.has(data.agentId)) {
        this.registerAgent(data.config);
      }
      
      // Write state
      return this.updateAgentState(data.agentId, data.state);
    } catch (error) {
      console.error('Failed to import agent state:', error);
      return false;
    }
  }

  /**
   * Get conversation history for agent
   */
  public getConversationHistory(
    agentId: string,
    limit: number = 20
  ): Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> {
    const state = this.getAgentState(agentId);
    if (!state) {
      return [];
    }
    
    return state.conversationHistory.slice(-limit);
  }

  /**
   * Search conversation history
   */
  public searchConversationHistory(
    agentId: string,
    query: string
  ): Array<{ role: 'user' | 'assistant'; content: string; timestamp: number; relevance: number }> {
    const state = this.getAgentState(agentId);
    if (!state) {
      return [];
    }
    
    const queryLower = query.toLowerCase();
    
    return state.conversationHistory
      .map(entry => {
        const contentLower = entry.content.toLowerCase();
        const relevance = contentLower.includes(queryLower) ? 1.0 : 0.0;
        return { ...entry, relevance };
      })
      .filter(entry => entry.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);
  }
}

/**
 * Export singleton instance
 */
let registryInstance: AgentStateRegistry | null = null;

export function getAgentStateRegistry(memoryManager: SharedMemoryManager): AgentStateRegistry {
  if (!registryInstance) {
    registryInstance = new AgentStateRegistry(memoryManager);
  }
  return registryInstance;
}
