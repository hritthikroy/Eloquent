/**
 * Conversation State Controller (Renderer Process)
 * Synchronizes conversational state and turns with the Electron StateManager
 * via window.electronAPI.requestState() and commitState().
 */

export interface TurnContext {
  speaker: string;
  text: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface RateLimitInfo {
  requestsRemaining: number;
  resetTimestamp: number;
  isThrottled: boolean;
  backoffMs?: number;
}

export interface ConversationalState {
  turnId: string;
  participants: string[];
  lastMessageTimestamp: number;
  contextBuffer: TurnContext[];
  rateLimitInfo: RateLimitInfo;
}

// Global declaration for electronAPI on window
declare global {
  interface Window {
    electronAPI?: {
      requestState: () => Promise<ConversationalState>;
      commitState: (state: Partial<ConversationalState>) => Promise<{ success: boolean; state: ConversationalState }>;
      onStateUpdate: (callback: (state: ConversationalState) => void) => () => void;
      send?: (channel: string, data?: any) => void;
      receive?: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}

export class ConversationController {
  private currentState: ConversationalState | null = null;
  private listeners: Array<(state: ConversationalState) => void> = [];
  private unsubscribeIpc: (() => void) | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initializes state retrieval and attaches listeners
   */
  public async init(): Promise<ConversationalState | null> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      if (typeof window.electronAPI.onStateUpdate === 'function') {
        this.unsubscribeIpc = window.electronAPI.onStateUpdate((state: ConversationalState) => {
          this.currentState = state;
          this.notifyListeners(state);
        });
      }
      return this.syncFromBackend();
    }
    return null;
  }

  /**
   * Requests latest state from the main process StateManager
   */
  public async syncFromBackend(): Promise<ConversationalState | null> {
    if (typeof window !== 'undefined' && window.electronAPI?.requestState) {
      try {
        const state = await window.electronAPI.requestState();
        this.currentState = state;
        this.notifyListeners(state);
        return state;
      } catch (err) {
        console.error('Failed to request state from Electron backend:', err);
      }
    }
    return null;
  }

  /**
   * Commits an updated turn to the backend StateManager
   */
  public async appendTurn(turn: TurnContext): Promise<ConversationalState | null> {
    const updatedBuffer = this.currentState
      ? [...this.currentState.contextBuffer, { ...turn, timestamp: turn.timestamp || Date.now() }]
      : [{ ...turn, timestamp: turn.timestamp || Date.now() }];

    const payload: Partial<ConversationalState> = {
      contextBuffer: updatedBuffer,
      lastMessageTimestamp: Date.now()
    };

    if (typeof window !== 'undefined' && window.electronAPI?.commitState) {
      try {
        const res = await window.electronAPI.commitState(payload);
        if (res && res.success) {
          this.currentState = res.state;
          this.notifyListeners(res.state);
          return res.state;
        }
      } catch (err) {
        console.error('Failed to commit state to Electron backend:', err);
      }
    }

    return this.currentState;
  }

  /**
   * Gets currently cached conversational turn data
   */
  public getCurrentState(): ConversationalState | null {
    return this.currentState;
  }

  /**
   * Subscribes UI components to state changes
   */
  public subscribe(callback: (state: ConversationalState) => void): () => void {
    this.listeners.push(callback);
    if (this.currentState) {
      callback(this.currentState);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(state: ConversationalState) {
    this.listeners.forEach(fn => fn(state));
  }

  public destroy() {
    if (this.unsubscribeIpc) {
      this.unsubscribeIpc();
    }
    this.listeners = [];
  }
}

export const conversationController = new ConversationController();
export default conversationController;
