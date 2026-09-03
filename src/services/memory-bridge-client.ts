/**
 * MemoryBridgeClient - Node.js client for Go memory bridge service
 * 
 * Provides interface to communicate with Go audio backend via Unix socket
 * for low-latency agent state synchronization.
 */

import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * Message types matching Go backend protocol
 */
export enum MessageType {
  ReadRequest = 0x01,
  ReadResponse = 0x02,
  WriteRequest = 0x03,
  WriteResponse = 0x04,
  ListRequest = 0x05,
  ListResponse = 0x06,
  Error = 0xFF,
}

/**
 * Protocol message structure
 */
export interface BridgeMessage {
  type: MessageType;
  agent_id?: string;
  state?: Record<string, unknown>;
  version?: number;
  error?: string;
  agents?: AgentMetadataResponse[];
}

export interface AgentMetadataResponse {
  id: string;
  name: string;
  version: number;
  last_updated: number;
  data_length: number;
}

/**
 * Client options
 */
export interface MemoryBridgeClientOptions {
  socketPath?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  requestTimeout?: number;
}

/**
 * MemoryBridgeClient class
 */
export class MemoryBridgeClient extends EventEmitter {
  private socketPath: string;
  private socket: net.Socket | null = null;
  private connected: boolean = false;
  private autoReconnect: boolean;
  private reconnectDelay: number;
  private requestTimeout: number;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private requestIdCounter: number = 0;
  private receiveBuffer: Buffer = Buffer.alloc(0);

  constructor(options: MemoryBridgeClientOptions = {}) {
    super();
    
    this.socketPath = options.socketPath || 
      path.join(os.tmpdir(), 'eloquent-memory-bridge.sock');
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.requestTimeout = options.requestTimeout || 5000;
  }

  /**
   * Connect to the memory bridge service
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath);

      const onConnect = () => {
        this.connected = true;
        this.emit('connected');
        resolve();
      };

      const onError = (error: Error) => {
        this.socket?.removeListener('connect', onConnect);
        this.socket?.removeListener('error', onError);
        
        if (this.autoReconnect && !this.connected) {
          setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
        }
        
        reject(error);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('error', onError);

      // Setup data handler
      this.socket.on('data', (data) => this.handleData(data));

      // Setup close handler
      this.socket.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
        
        // Reject all pending requests
        const pendingArray = Array.from(this.pendingRequests.entries());
        for (const [id, request] of pendingArray) {
          request.reject(new Error('Connection closed'));
          this.pendingRequests.delete(id);
        }

        if (this.autoReconnect) {
          setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
        }
      });
    });
  }

  /**
   * Disconnect from the memory bridge service
   */
  public disconnect(): void {
    this.autoReconnect = false;
    
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    
    this.connected = false;
  }

  /**
   * Read agent state from Go backend
   */
  public async readAgentState(agentId: string): Promise<Record<string, unknown> | null> {
    const message: BridgeMessage = {
      type: MessageType.ReadRequest,
      agent_id: agentId,
    };

    const response = await this.sendRequest(message);

    if (response.type === MessageType.Error) {
      throw new Error(response.error || 'Unknown error');
    }

    return response.state || null;
  }

  /**
   * Write agent state to Go backend
   */
  public async writeAgentState(
    agentId: string,
    state: Record<string, unknown>,
    version?: number
  ): Promise<number> {
    const message: BridgeMessage = {
      type: MessageType.WriteRequest,
      agent_id: agentId,
      state,
      version,
    };

    const response = await this.sendRequest(message);

    if (response.type === MessageType.Error) {
      throw new Error(response.error || 'Unknown error');
    }

    return response.version || 0;
  }

  /**
   * List all agents in Go backend cache
   */
  public async listAgents(): Promise<AgentMetadataResponse[]> {
    const message: BridgeMessage = {
      type: MessageType.ListRequest,
    };

    const response = await this.sendRequest(message);

    if (response.type === MessageType.Error) {
      throw new Error(response.error || 'Unknown error');
    }

    return response.agents || [];
  }

  /**
   * Send request and wait for response
   */
  private async sendRequest(message: BridgeMessage): Promise<BridgeMessage> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to memory bridge');
    }

    return new Promise((resolve, reject) => {
      const requestId = this.requestIdCounter++;
      
      // Setup timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: (response: BridgeMessage) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          reject(error);
        },
      });

      // Serialize and send message
      const payload = Buffer.from(JSON.stringify(message), 'utf-8');
      const length = Buffer.alloc(4);
      length.writeUInt32LE(payload.length, 0);

      this.socket!.write(Buffer.concat([length, payload]));
    });
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    // Append to receive buffer
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);

    // Process complete messages
    while (this.receiveBuffer.length >= 4) {
      // Read length prefix
      const length = this.receiveBuffer.readUInt32LE(0);

      // Check if we have complete message
      if (this.receiveBuffer.length < 4 + length) {
        break; // Wait for more data
      }

      // Extract message payload
      const payload = this.receiveBuffer.slice(4, 4 + length);
      this.receiveBuffer = this.receiveBuffer.slice(4 + length);

      // Parse message
      try {
        const message: BridgeMessage = JSON.parse(payload.toString('utf-8'));
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    }
  }

  /**
   * Handle received message
   */
  private handleMessage(message: BridgeMessage): void {
    // For now, resolve the first pending request
    // In production, would use request IDs to match requests/responses
    const [requestId, request] = this.pendingRequests.entries().next().value || [];
    
    if (request) {
      request.resolve(message);
    } else {
      // Unsolicited message (could be a push notification)
      this.emit('message', message);
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get socket path
   */
  public getSocketPath(): string {
    return this.socketPath;
  }
}

interface PendingRequest {
  resolve: (message: BridgeMessage) => void;
  reject: (error: Error) => void;
}

/**
 * Export singleton instance
 */
let clientInstance: MemoryBridgeClient | null = null;

export function getMemoryBridgeClient(options?: MemoryBridgeClientOptions): MemoryBridgeClient {
  if (!clientInstance) {
    clientInstance = new MemoryBridgeClient(options);
  }
  return clientInstance;
}
