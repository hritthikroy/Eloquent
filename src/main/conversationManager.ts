/**
 * Eloquent Desktop Conversation Manager
 * 
 * Implements persistent conversational state management, fault-tolerant rehydration,
 * rapid audio-text race condition mitigation via sequential turn locking,
 * and robust exponential backoff rate-limit mitigation across Node.js, Electron,
 * and the Go audio backend.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

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
  currentPhase: ConversationPhase;
  activeSpeaker: string;
  audioStreamState: AudioStreamState;
  turnSequence: number;
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

export interface RateLimitOptions {
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  operationName?: string;
  jitter?: boolean;
}

export interface Broadcaster {
  broadcast: (channel: string, data: any) => void;
}

/**
 * Valid FSM phase transitions matching Go audio backend state machine
 */
export const VALID_PHASE_TRANSITIONS: Record<ConversationPhase, ConversationPhase[]> = {
  idle: ['listening', 'thinking', 'rehydrating'],
  listening: ['thinking', 'idle', 'error'],
  thinking: ['speaking', 'idle', 'error'],
  speaking: ['idle', 'listening', 'error'],
  error: ['idle'],
  rehydrating: ['idle']
};

export class ConversationManager extends EventEmitter {
  private static instance: ConversationManager | null = null;
  private stateFilePath: string;
  private fallbackStateFilePath: string;
  private broadcaster: Broadcaster | null = null;
  private maxTurns: number = 50;
  private state: ConversationalState;
  private sessionId: string;
  private inputQueue: Promise<any> = Promise.resolve();
  private lastTurnKey: string = '';
  private lastTurnTimestamp: number = 0;
  private dedupWindowMs: number = 500;
  private backoffAttempts: number = 0;

  constructor(userDataDir?: string, broadcaster?: Broadcaster) {
    super();
    const baseDir = userDataDir || path.join(process.cwd(), 'userData');
    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
      } catch (err) {
        // Directory may already exist
      }
    }

    this.stateFilePath = path.join(baseDir, 'conversation-state.json');
    this.fallbackStateFilePath = path.join(baseDir, 'state.json');
    this.broadcaster = broadcaster || null;
    this.sessionId = `session-${Date.now()}`;

    // Default initial state
    this.state = {
      turnId: `turn-${Date.now()}`,
      participants: ['user', 'Tuk Tuk', 'Vision'],
      lastMessageTimestamp: Date.now(),
      contextBuffer: [],
      rateLimitInfo: {
        requestsRemaining: 60,
        resetTimestamp: Date.now() + 60000,
        isThrottled: false,
        backoffMs: 0
      },
      currentPhase: 'idle',
      activeSpeaker: 'user',
      audioStreamState: 'inactive',
      turnSequence: 0
    };

    this.rehydrate();
  }

  public static getInstance(userDataDir?: string, broadcaster?: Broadcaster): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager(userDataDir, broadcaster);
    }
    return ConversationManager.instance;
  }

  public static resetInstance(): void {
    ConversationManager.instance = null;
  }

  public setBroadcaster(broadcaster: Broadcaster): void {
    this.broadcaster = broadcaster;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getState(): ConversationalState {
    this.checkAndResetRateLimits();
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Fault-tolerant rehydration: loads state from conversation-state.json or fallback state.json.
   * Resets transient phase to 'idle' and audioStreamState to 'inactive' upon boot to prevent
   * deadlocks or stuck states after unexpected shutdown.
   */
  public rehydrate(): ConversationalState {
    let loaded: Partial<ConversationalState> | null = null;

    if (fs.existsSync(this.stateFilePath)) {
      try {
        const raw = fs.readFileSync(this.stateFilePath, 'utf8');
        if (raw.trim()) {
          loaded = JSON.parse(raw);
        }
      } catch (err) {
        console.warn('⚠️ Could not parse primary conversation state file:', err);
      }
    }

    if (!loaded && fs.existsSync(this.fallbackStateFilePath)) {
      try {
        const raw = fs.readFileSync(this.fallbackStateFilePath, 'utf8');
        if (raw.trim()) {
          loaded = JSON.parse(raw);
        }
      } catch (err) {
        console.warn('⚠️ Could not parse fallback state file:', err);
      }
    }

    if (loaded) {
      if (Array.isArray(loaded.contextBuffer)) {
        this.state.contextBuffer = loaded.contextBuffer.slice(-this.maxTurns);
      }
      if (Array.isArray(loaded.participants) && loaded.participants.length > 0) {
        this.state.participants = loaded.participants;
      }
      if (typeof loaded.turnSequence === 'number') {
        this.state.turnSequence = loaded.turnSequence;
      } else if (this.state.contextBuffer.length > 0) {
        this.state.turnSequence = this.state.contextBuffer.length;
      }
      if (typeof loaded.lastMessageTimestamp === 'number') {
        this.state.lastMessageTimestamp = loaded.lastMessageTimestamp;
      }
    }

    // Always reset operational lifecycle states to idle upon restart
    this.state.currentPhase = 'idle';
    this.state.audioStreamState = 'inactive';
    this.state.activeSpeaker = 'user';
    this.backoffAttempts = 0;
    this.checkAndResetRateLimits();

    this.persistStateAtomic();
    this.broadcastChange('conversation:rehydrated', this.getState());
    return this.getState();
  }

  /**
   * Appends an active conversational turn with sequential locking to prevent
   * race conditions between simultaneous live speech and text submissions.
   */
  public async appendTurn(turn: TurnContext): Promise<{ success: boolean; turnSeq: number; state: ConversationalState; deduplicated?: boolean }> {
    return new Promise((resolve, reject) => {
      this.inputQueue = this.inputQueue.then(async () => {
        try {
          const now = Date.now();
          const turnTimestamp = turn.timestamp || now;
          const turnKey = `${turn.speaker.toLowerCase()}:${turn.text.trim().toLowerCase()}`;

          // Deduplication window: drop identical consecutive turns arriving within 500ms
          if (turnKey === this.lastTurnKey && (now - this.lastTurnTimestamp) < this.dedupWindowMs) {
            resolve({
              success: true,
              turnSeq: this.state.turnSequence,
              state: this.getState(),
              deduplicated: true
            });
            return;
          }

          this.lastTurnKey = turnKey;
          this.lastTurnTimestamp = now;

          this.state.turnSequence++;
          const seq = this.state.turnSequence;
          this.state.activeSpeaker = turn.speaker;
          this.state.lastMessageTimestamp = turnTimestamp;
          this.state.turnId = `turn-${turnTimestamp}`;

          const turnEntry: TurnContext = {
            speaker: turn.speaker,
            text: turn.text,
            timestamp: turnTimestamp,
            metadata: {
              ...(turn.metadata || {}),
              turnSeq: seq
            }
          };

          this.state.contextBuffer.push(turnEntry);
          if (this.state.contextBuffer.length > this.maxTurns) {
            this.state.contextBuffer = this.state.contextBuffer.slice(-this.maxTurns);
          }

          this.persistStateAtomic();

          const event: StateChangeEvent = {
            sessionId: this.sessionId,
            prevPhase: this.state.currentPhase,
            newPhase: this.state.currentPhase,
            speaker: turn.speaker,
            audioState: this.state.audioStreamState,
            timestamp: turnTimestamp,
            turnSeq: seq,
            rateLimited: this.state.rateLimitInfo.isThrottled
          };

          this.emit('turn', turnEntry);
          this.emit('state-changed', this.state);
          this.broadcastChange('conversation:turn-indicator', event);
          this.broadcastChange('conversation:state-changed', this.getState());

          resolve({
            success: true,
            turnSeq: seq,
            state: this.getState()
          });
        } catch (err) {
          reject(err);
        }
      }).catch(reject);
    });
  }

  /**
   * Enforces legal conversation phase transitions against finite state machine.
   */
  public transitionPhase(newPhase: ConversationPhase): { success: boolean; prevPhase: ConversationPhase; newPhase: ConversationPhase } {
    const prev = this.state.currentPhase;
    if (prev === newPhase) {
      return { success: true, prevPhase: prev, newPhase };
    }

    const allowed = VALID_PHASE_TRANSITIONS[prev];
    if (!allowed || !allowed.includes(newPhase)) {
      throw new Error(`Invalid conversation phase transition from '${prev}' to '${newPhase}'`);
    }

    this.state.currentPhase = newPhase;
    this.persistStateAtomic();

    const event: StateChangeEvent = {
      sessionId: this.sessionId,
      prevPhase: prev,
      newPhase,
      speaker: this.state.activeSpeaker,
      audioState: this.state.audioStreamState,
      timestamp: Date.now(),
      turnSeq: this.state.turnSequence,
      rateLimited: this.state.rateLimitInfo.isThrottled
    };

    this.emit('phase-changed', event);
    this.emit('state-changed', this.state);
    this.broadcastChange('conversation:phase-changed', event);
    this.broadcastChange('conversation:state-changed', this.getState());

    return { success: true, prevPhase: prev, newPhase };
  }

  /**
   * Updates audio stream hardware/buffer state and broadcasts telemetry.
   */
  public setAudioStreamState(newState: AudioStreamState): { success: boolean; audioState: AudioStreamState } {
    this.state.audioStreamState = newState;
    this.persistStateAtomic();

    const event: StateChangeEvent = {
      sessionId: this.sessionId,
      prevPhase: this.state.currentPhase,
      newPhase: this.state.currentPhase,
      speaker: this.state.activeSpeaker,
      audioState: newState,
      timestamp: Date.now(),
      turnSeq: this.state.turnSequence,
      rateLimited: this.state.rateLimitInfo.isThrottled
    };

    this.emit('audio-state-changed', event);
    this.broadcastChange('conversation:turn-indicator', event);
    this.broadcastChange('conversation:state-changed', this.getState());

    return { success: true, audioState: newState };
  }

  /**
   * Exponential backoff calculation:
   * delay = min(maxMs, baseMs * 2^(attempt - 1) + jitter)
   */
  public calculateBackoff(attempt: number, baseMs: number = 500, maxMs: number = 30000, jitter: boolean = true): number {
    const exponent = Math.max(0, attempt - 1);
    let delay = Math.min(maxMs, baseMs * Math.pow(2, exponent));
    if (jitter) {
      const jitterAmount = Math.floor(Math.random() * (baseMs * 0.5));
      delay = Math.min(maxMs, delay + jitterAmount);
    }
    return delay;
  }

  /**
   * Reports an API rate limit hit (e.g. HTTP 429) and triggers backoff lock.
   */
  public reportRateLimit(customBackoffMs?: number): RateLimitInfo {
    this.backoffAttempts++;
    const backoffMs = customBackoffMs || this.calculateBackoff(this.backoffAttempts);
    const now = Date.now();

    this.state.rateLimitInfo.isThrottled = true;
    this.state.rateLimitInfo.backoffMs = backoffMs;
    this.state.rateLimitInfo.resetTimestamp = now + backoffMs;
    this.state.rateLimitInfo.requestsRemaining = 0;

    this.persistStateAtomic();

    const warningPayload = {
      isThrottled: true,
      backoffMs,
      resetTimestamp: this.state.rateLimitInfo.resetTimestamp,
      attempt: this.backoffAttempts
    };

    this.emit('rate-limit', warningPayload);
    this.broadcastChange('conversation:rate-limit-warning', warningPayload);
    this.broadcastChange('conversation:state-changed', this.getState());

    return { ...this.state.rateLimitInfo };
  }

  /**
   * Resets rate limit throttling after successful API responses.
   */
  public resetRateLimit(): RateLimitInfo {
    this.backoffAttempts = 0;
    this.state.rateLimitInfo.isThrottled = false;
    this.state.rateLimitInfo.backoffMs = 0;
    this.state.rateLimitInfo.requestsRemaining = 60;
    this.state.rateLimitInfo.resetTimestamp = Date.now() + 60000;

    this.persistStateAtomic();

    const resetPayload = {
      isThrottled: false,
      backoffMs: 0,
      resetTimestamp: this.state.rateLimitInfo.resetTimestamp,
      attempt: 0
    };

    this.emit('rate-limit-reset', resetPayload);
    this.broadcastChange('conversation:rate-limit-warning', resetPayload);
    this.broadcastChange('conversation:state-changed', this.getState());

    return { ...this.state.rateLimitInfo };
  }

  /**
   * Executes an asynchronous operation with automatic rate-limit detection,
   * exponential backoff, and transparent retry orchestration.
   */
  public async executeWithRateLimitRetry<T>(operation: () => Promise<T>, options: RateLimitOptions = {}): Promise<T> {
    const maxRetries = options.maxRetries ?? 4;
    const baseBackoffMs = options.baseBackoffMs ?? 500;
    const maxBackoffMs = options.maxBackoffMs ?? 30000;
    const jitter = options.jitter ?? true;
    const opName = options.operationName || 'AI operation';

    let attempt = 0;

    while (true) {
      try {
        const result = await operation();
        // Successful response - reset backoff throttle
        if (this.state.rateLimitInfo.isThrottled || this.backoffAttempts > 0) {
          this.resetRateLimit();
        }
        return result;
      } catch (err: any) {
        attempt++;
        const isRateLimit = this.isRateLimitError(err);

        if (!isRateLimit || attempt > maxRetries) {
          throw err;
        }

        const backoffMs = this.calculateBackoff(attempt, baseBackoffMs, maxBackoffMs, jitter);
        this.reportRateLimit(backoffMs);

        console.warn(`⏳ [RateLimit] ${opName} throttled (attempt ${attempt}/${maxRetries}). Retrying in ${backoffMs}ms...`);
        await new Promise(res => setTimeout(res, backoffMs));
      }
    }
  }

  private isRateLimitError(err: any): boolean {
    if (!err) return false;
    const status = err.status || err.statusCode || (err.response && err.response.status);
    if (status === 429) return true;

    const msg = String(err.message || err.error || err).toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('too many requests') ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted')
    );
  }

  private checkAndResetRateLimits(): void {
    const now = Date.now();
    if (this.state.rateLimitInfo.isThrottled && now >= this.state.rateLimitInfo.resetTimestamp) {
      this.state.rateLimitInfo.isThrottled = false;
      this.state.rateLimitInfo.backoffMs = 0;
      this.state.rateLimitInfo.requestsRemaining = 60;
      this.state.rateLimitInfo.resetTimestamp = now + 60000;
      this.backoffAttempts = 0;
    }
  }

  private persistStateAtomic(): void {
    try {
      const serialized = JSON.stringify(this.state, null, 2);
      const tempPath = `${this.stateFilePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
      fs.writeFileSync(tempPath, serialized, 'utf8');
      fs.renameSync(tempPath, this.stateFilePath);

      // Also mirror to legacy fallback path if accessible
      try {
        const fallbackTemp = `${this.fallbackStateFilePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
        fs.writeFileSync(fallbackTemp, serialized, 'utf8');
        fs.renameSync(fallbackTemp, this.fallbackStateFilePath);
      } catch (fallbackErr) {
        // Non-fatal if fallback mirror fails
      }
    } catch (err) {
      console.error('❌ Failed to atomically persist conversation state:', err);
    }
  }

  private broadcastChange(channel: string, data: any): void {
    if (this.broadcaster && typeof this.broadcaster.broadcast === 'function') {
      try {
        this.broadcaster.broadcast(channel, data);
      } catch (err) {
        // Renderer windows may be closed or refreshing
      }
    }
  }
}

/**
 * Registers conversation IPC bridge channels in Electron main process.
 */
export function registerConversationIpc(
  ipcMain: any,
  options: { manager?: ConversationManager; userDataDir?: string; broadcaster?: Broadcaster } = {}
): ConversationManager {
  const manager = options.manager || ConversationManager.getInstance(options.userDataDir, options.broadcaster);

  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    return manager;
  }

  ipcMain.handle('conversation:get-state', async () => {
    return manager.getState();
  });

  ipcMain.handle('conversation:append-turn', async (_event: any, turn: TurnContext) => {
    return manager.appendTurn(turn);
  });

  ipcMain.handle('conversation:transition-phase', async (_event: any, newPhase: ConversationPhase) => {
    try {
      return manager.transitionPhase(newPhase);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('conversation:report-rate-limit', async (_event: any, backoffMs?: number) => {
    return manager.reportRateLimit(backoffMs);
  });

  ipcMain.handle('conversation:reset-rate-limit', async () => {
    return manager.resetRateLimit();
  });

  ipcMain.handle('conversation:rehydrate', async () => {
    return manager.rehydrate();
  });

  ipcMain.handle('conversation:set-audio-state', async (_event: any, audioState: AudioStreamState) => {
    return manager.setAudioStreamState(audioState);
  });

  return manager;
}

export default ConversationManager;
