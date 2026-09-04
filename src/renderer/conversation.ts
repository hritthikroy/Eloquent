/**
 * Conversation State Controller (Renderer Process)
 * Synchronizes conversational state and turns with the Electron StateManager
 * via window.electronAPI.requestState() and commitState().
 */

export type ConversationPhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'rehydrating';

export type AudioStreamState = 'inactive' | 'capturing' | 'buffering' | 'processing' | 'synthesizing' | 'draining';

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
  currentPhase?: ConversationPhase;
  activeSpeaker?: string;
  audioStreamState?: AudioStreamState;
  turnSequence?: number;
}

export interface StateChangeEvent {
  sessionId: string;
  prevPhase: ConversationPhase;
  newPhase: ConversationPhase;
  speaker: string;
  audioState: AudioStreamState;
  timestamp: number;
  turnSeq: number;
  rateLimited: boolean;
}

export interface RateLimitWarning {
  isThrottled: boolean;
  backoffMs: number;
  resetTimestamp: number;
  attempt: number;
}

export type SyncStatusType = 'synchronized' | 'lagging' | 'stale' | 'reconciling' | 'paused';

export interface SyncCheckpoint {
  eventType?: string;
  timestamp: number;
  sequenceNumber: number;
  bufferHash: string;
  bufferLength: number;
  lastProcessedToken: string;
  lastTokenTimestamp: number;
  isPaused: boolean;
  cpuLoad: number;
  stateVersion?: number;
}

export interface StateSyncStatus {
  status: SyncStatusType;
  syncLagMs: number;
  lastCheckpointTimestamp: number;
  lastReconciledTimestamp: number;
  gapDetected: boolean;
  gapDescription?: string;
  sequenceNumber: number;
  cpuLoad: number;
}

export interface SemanticDiscontinuity {
  id: string;
  detectedAt: number;
  gapType: 'token_mismatch' | 'dropped_turn' | 'timestamp_skew' | 'buffer_drift';
  expectedToken: string;
  actualToken: string;
  lagMs: number;
  patchApplied: boolean;
  patchDescription: string;
}

export interface StateAuditReport {
  isValid: boolean;
  syncLagMs: number;
  syncStatus: SyncStatusType;
  detectedGapsCount: number;
  discontinuities: SemanticDiscontinuity[];
  timestamp: number;
  patchedTurnsCount: number;
  reconciledState: ConversationalState;
}

// Global declaration for electronAPI and conversationBridge on window
declare global {
  interface Window {
    conversationBridge?: {
      getState: () => Promise<ConversationalState>;
      appendTurn: (turn: TurnContext) => Promise<{ success: boolean; turnSeq: number; state: ConversationalState; deduplicated?: boolean }>;
      transitionPhase: (phase: ConversationPhase) => Promise<{ success: boolean; prevPhase: ConversationPhase; newPhase: ConversationPhase; error?: string }>;
      reportRateLimit: (backoffMs?: number) => Promise<RateLimitInfo>;
      resetRateLimit: () => Promise<RateLimitInfo>;
      rehydrate: () => Promise<ConversationalState>;
      setAudioState: (state: AudioStreamState) => Promise<{ success: boolean; audioState: AudioStreamState }>;
      onStateChanged: (callback: (state: ConversationalState) => void) => () => void;
      onTurnIndicator: (callback: (event: StateChangeEvent) => void) => () => void;
      onPhaseChanged: (callback: (event: StateChangeEvent) => void) => () => void;
      onRateLimitWarning: (callback: (warning: RateLimitWarning) => void) => () => void;
    };
    electronAPI?: {
      requestState: () => Promise<ConversationalState>;
      commitState: (state: Partial<ConversationalState>) => Promise<{ success: boolean; state: ConversationalState }>;
      onStateUpdate: (callback: (state: ConversationalState) => void) => () => void;
      verifyIntegrity: (uiState?: Partial<ConversationalState>) => Promise<{ success: boolean; report: StateAuditReport }>;
      reconcileState: (uiState?: Partial<ConversationalState>) => Promise<{ success: boolean; report: StateAuditReport; state: ConversationalState }>;
      getSyncStatus: () => Promise<StateSyncStatus>;
      ingestCheckpoint?: (checkpoint: SyncCheckpoint) => Promise<{ success: boolean }>;
      onStateSyncStatus: (callback: (status: StateSyncStatus) => void) => () => void;
      send?: (channel: string, data?: any) => void;
      receive?: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}

export class ConversationController {
  private currentState: ConversationalState | null = null;
  private listeners: Array<(state: ConversationalState) => void> = [];
  private turnIndicatorListeners: Array<(event: StateChangeEvent) => void> = [];
  private phaseListeners: Array<(event: StateChangeEvent) => void> = [];
  private rateLimitListeners: Array<(warning: RateLimitWarning) => void> = [];

  private unsubscribeIpc: (() => void) | null = null;
  private unsubscribeBridgeState: (() => void) | null = null;
  private unsubscribeTurnIndicator: (() => void) | null = null;
  private unsubscribePhaseChanged: (() => void) | null = null;
  private unsubscribeRateLimit: (() => void) | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initializes state retrieval and attaches listeners
   */
  public async init(): Promise<ConversationalState | null> {
    if (typeof window !== 'undefined') {
      if (window.conversationBridge) {
        this.unsubscribeBridgeState = window.conversationBridge.onStateChanged((state: ConversationalState) => {
          this.currentState = state;
          this.notifyListeners(state);
        });

        this.unsubscribeTurnIndicator = window.conversationBridge.onTurnIndicator((event: StateChangeEvent) => {
          this.turnIndicatorListeners.forEach(fn => fn(event));
        });

        this.unsubscribePhaseChanged = window.conversationBridge.onPhaseChanged((event: StateChangeEvent) => {
          this.phaseListeners.forEach(fn => fn(event));
        });

        this.unsubscribeRateLimit = window.conversationBridge.onRateLimitWarning((warning: RateLimitWarning) => {
          this.rateLimitListeners.forEach(fn => fn(warning));
        });
      } else if (window.electronAPI && typeof window.electronAPI.onStateUpdate === 'function') {
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
   * Requests latest state from the main process StateManager or ConversationManager
   */
  public async syncFromBackend(): Promise<ConversationalState | null> {
    if (typeof window !== 'undefined') {
      try {
        if (window.conversationBridge?.getState) {
          const state = await window.conversationBridge.getState();
          this.currentState = state;
          this.notifyListeners(state);
          return state;
        } else if (window.electronAPI?.requestState) {
          const state = await window.electronAPI.requestState();
          this.currentState = state;
          this.notifyListeners(state);
          return state;
        }
      } catch (err) {
        console.error('Failed to request state from Electron backend:', err);
      }
    }
    return null;
  }

  /**
   * Commits an updated turn to the backend ConversationManager
   */
  public async appendTurn(turn: TurnContext): Promise<ConversationalState | null> {
    if (typeof window !== 'undefined') {
      try {
        if (window.conversationBridge?.appendTurn) {
          const res = await window.conversationBridge.appendTurn(turn);
          if (res && res.success && res.state) {
            this.currentState = res.state;
            this.notifyListeners(res.state);
            return res.state;
          }
        } else if (window.electronAPI?.commitState) {
          const updatedBuffer = this.currentState
            ? [...this.currentState.contextBuffer, { ...turn, timestamp: turn.timestamp || Date.now() }]
            : [{ ...turn, timestamp: turn.timestamp || Date.now() }];

          const payload: Partial<ConversationalState> = {
            contextBuffer: updatedBuffer,
            lastMessageTimestamp: Date.now()
          };

          const res = await window.electronAPI.commitState(payload);
          if (res && res.success) {
            this.currentState = res.state;
            this.notifyListeners(res.state);
            return res.state;
          }
        }
      } catch (err) {
        console.error('Failed to commit state to Electron backend:', err);
      }
    }

    return this.currentState;
  }

  /**
   * Transitions conversation phase in FSM
   */
  public async transitionPhase(phase: ConversationPhase): Promise<{ success: boolean; prevPhase?: ConversationPhase; newPhase?: ConversationPhase; error?: string }> {
    if (typeof window !== 'undefined' && window.conversationBridge?.transitionPhase) {
      return window.conversationBridge.transitionPhase(phase);
    }
    return { success: false, error: 'conversationBridge not available' };
  }

  /**
   * Updates audio stream state
   */
  public async setAudioStreamState(audioState: AudioStreamState): Promise<{ success: boolean; audioState?: AudioStreamState }> {
    if (typeof window !== 'undefined' && window.conversationBridge?.setAudioState) {
      return window.conversationBridge.setAudioState(audioState);
    }
    return { success: false };
  }

  /**
   * Reports rate limit hit
   */
  public async reportRateLimit(backoffMs?: number): Promise<RateLimitInfo | null> {
    if (typeof window !== 'undefined' && window.conversationBridge?.reportRateLimit) {
      return window.conversationBridge.reportRateLimit(backoffMs);
    }
    return null;
  }

  /**
   * Resets rate limit throttling
   */
  public async resetRateLimit(): Promise<RateLimitInfo | null> {
    if (typeof window !== 'undefined' && window.conversationBridge?.resetRateLimit) {
      return window.conversationBridge.resetRateLimit();
    }
    return null;
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

  public subscribeTurnIndicator(callback: (event: StateChangeEvent) => void): () => void {
    this.turnIndicatorListeners.push(callback);
    return () => {
      this.turnIndicatorListeners = this.turnIndicatorListeners.filter(l => l !== callback);
    };
  }

  public subscribePhaseChanged(callback: (event: StateChangeEvent) => void): () => void {
    this.phaseListeners.push(callback);
    return () => {
      this.phaseListeners = this.phaseListeners.filter(l => l !== callback);
    };
  }

  public subscribeRateLimitWarning(callback: (warning: RateLimitWarning) => void): () => void {
    this.rateLimitListeners.push(callback);
    return () => {
      this.rateLimitListeners = this.rateLimitListeners.filter(l => l !== callback);
    };
  }

  private syncStatusListeners: Array<(status: StateSyncStatus) => void> = [];
  private unsubscribeSyncIpc: (() => void) | null = null;

  public subscribeSyncStatus(callback: (status: StateSyncStatus) => void): () => void {
    this.syncStatusListeners.push(callback);
    
    if (!this.unsubscribeSyncIpc && typeof window !== 'undefined' && window.electronAPI?.onStateSyncStatus) {
      this.unsubscribeSyncIpc = window.electronAPI.onStateSyncStatus((status: StateSyncStatus) => {
        this.syncStatusListeners.forEach(fn => fn(status));
      });
    }

    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter(l => l !== callback);
      if (this.syncStatusListeners.length === 0 && this.unsubscribeSyncIpc) {
        this.unsubscribeSyncIpc();
        this.unsubscribeSyncIpc = null;
      }
    };
  }

  /**
   * Verifies dialogue history integrity against audio backend buffer state
   */
  public async verifyIntegrity(): Promise<StateAuditReport | null> {
    if (typeof window !== 'undefined' && window.electronAPI?.verifyIntegrity) {
      try {
        const res = await window.electronAPI.verifyIntegrity(this.currentState || undefined);
        if (res && res.success) {
          return res.report;
        }
      } catch (err) {
        console.error('Failed to verify state integrity:', err);
      }
    }
    return null;
  }

  /**
   * Reconciles dialogue history and patches detected semantic discontinuities
   */
  public async reconcileState(): Promise<StateAuditReport | null> {
    if (typeof window !== 'undefined' && window.electronAPI?.reconcileState) {
      try {
        const res = await window.electronAPI.reconcileState(this.currentState || undefined);
        if (res && res.success) {
          if (res.state) {
            this.currentState = res.state;
            this.notifyListeners(res.state);
          }
          return res.report;
        }
      } catch (err) {
        console.error('Failed to reconcile conversational state:', err);
      }
    }
    return null;
  }

  private notifyListeners(state: ConversationalState) {
    this.listeners.forEach(fn => fn(state));
  }

  public destroy() {
    if (this.unsubscribeIpc) {
      this.unsubscribeIpc();
      this.unsubscribeIpc = null;
    }
    if (this.unsubscribeBridgeState) {
      this.unsubscribeBridgeState();
      this.unsubscribeBridgeState = null;
    }
    if (this.unsubscribeTurnIndicator) {
      this.unsubscribeTurnIndicator();
      this.unsubscribeTurnIndicator = null;
    }
    if (this.unsubscribePhaseChanged) {
      this.unsubscribePhaseChanged();
      this.unsubscribePhaseChanged = null;
    }
    if (this.unsubscribeRateLimit) {
      this.unsubscribeRateLimit();
      this.unsubscribeRateLimit = null;
    }
    if (this.unsubscribeSyncIpc) {
      this.unsubscribeSyncIpc();
      this.unsubscribeSyncIpc = null;
    }
    this.listeners = [];
    this.turnIndicatorListeners = [];
    this.phaseListeners = [];
    this.rateLimitListeners = [];
    this.syncStatusListeners = [];
  }
}

export const conversationController = new ConversationController();
export default conversationController;
