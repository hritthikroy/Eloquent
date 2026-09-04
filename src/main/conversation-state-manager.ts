/**
 * Conversation State Manager Subsystem
 * Enforces non-blocking state reconciliation, semantic gap detection,
 * and zero-drift alignment between Electron frontend and Go audio backend.
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as crypto from 'crypto';

export interface TurnContext {
  speaker: string;
  text: string;
  timestamp: number;
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

/**
 * Strict type checking for SyncCheckpoint interface shared between
 * Go audio backend (JSON) and TypeScript.
 */
export interface SyncCheckpoint {
  eventType?: string; // "SYNC_CHECKPOINT"
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

export type SyncStatusType = 'synchronized' | 'lagging' | 'stale' | 'reconciling' | 'paused';

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

/**
 * Validates deserialized raw JSON to ensure strict compliance with SyncCheckpoint.
 */
export function validateSyncCheckpoint(raw: any): raw is SyncCheckpoint {
  return (
    raw !== null &&
    typeof raw === 'object' &&
    typeof raw.timestamp === 'number' &&
    typeof raw.sequenceNumber === 'number' &&
    typeof raw.bufferHash === 'string' &&
    typeof raw.bufferLength === 'number' &&
    typeof raw.lastProcessedToken === 'string' &&
    typeof raw.lastTokenTimestamp === 'number' &&
    typeof raw.isPaused === 'boolean' &&
    typeof raw.cpuLoad === 'number'
  );
}

/**
 * Core Pure Reconciliation Algorithm.
 * Executed in Worker thread to guarantee zero main-thread freezing.
 */
export function executeReconciliation(
  uiState: ConversationalState,
  checkpoint: SyncCheckpoint | null,
  now: number = Date.now()
): StateAuditReport {
  const discontinuities: SemanticDiscontinuity[] = [];
  let patchedCount = 0;

  // Clone UI state to preserve immutability
  const reconciledState: ConversationalState = {
    turnId: uiState.turnId || `turn-${now}`,
    participants: [...(uiState.participants || ['user', 'Tuk Tuk', 'Andrew'])],
    lastMessageTimestamp: uiState.lastMessageTimestamp || now,
    contextBuffer: Array.isArray(uiState.contextBuffer)
      ? uiState.contextBuffer.map(t => ({ ...t }))
      : [],
    rateLimitInfo: { ...(uiState.rateLimitInfo || {
      requestsRemaining: 60,
      resetTimestamp: now + 60000,
      isThrottled: false
    })}
  };

  // Edge Case 1: Audio backend not yet connected or network unstable -> default to safe "stale" state
  if (!checkpoint) {
    return {
      isValid: false,
      syncLagMs: 9999,
      syncStatus: 'stale',
      detectedGapsCount: 0,
      discontinuities: [],
      timestamp: now,
      patchedTurnsCount: 0,
      reconciledState
    };
  }

  // Edge Case 2: Audio backend is paused
  if (checkpoint.isPaused) {
    return {
      isValid: true,
      syncLagMs: Math.max(0, now - checkpoint.timestamp),
      syncStatus: 'paused',
      detectedGapsCount: 0,
      discontinuities: [],
      timestamp: now,
      patchedTurnsCount: 0,
      reconciledState
    };
  }

  const syncLagMs = Math.max(0, now - checkpoint.timestamp);

  // Edge Case 3: Heartbeat missing > 500ms -> mark "stale" without crashing
  let syncStatus: SyncStatusType = 'synchronized';
  if (syncLagMs > 500) {
    syncStatus = 'stale';
  } else if (syncLagMs > 65) {
    syncStatus = 'lagging';
  }

  // Gap Detection & Semantic Alignment Logic
  const backendToken = (checkpoint.lastProcessedToken || '').trim();
  const bufferLen = reconciledState.contextBuffer.length;

  if (backendToken.length > 0) {
    if (bufferLen === 0) {
      // Missing turn: Audio backend has processed token but UI context buffer is empty
      const gapId = `disc-${now}-${Math.random().toString(36).substring(2, 7)}`;
      discontinuities.push({
        id: gapId,
        detectedAt: now,
        gapType: 'dropped_turn',
        expectedToken: backendToken,
        actualToken: '',
        lagMs: syncLagMs,
        patchApplied: true,
        patchDescription: `Patched missing turn context from audio backend token: "${backendToken}"`
      });

      reconciledState.contextBuffer.push({
        speaker: 'user',
        text: backendToken,
        timestamp: checkpoint.lastTokenTimestamp || now
      });
      reconciledState.lastMessageTimestamp = checkpoint.lastTokenTimestamp || now;
      patchedCount++;
    } else {
      const lastTurn = reconciledState.contextBuffer[bufferLen - 1];
      const lastText = (lastTurn.text || '').trim();

      // Check for token divergence / semantic discontinuity
      if (lastText.length > 0 && !lastText.toLowerCase().includes(backendToken.toLowerCase())) {
        // Only trigger token mismatch if backend token was produced within last 3 seconds
        const tokenAgeMs = Math.abs(now - checkpoint.lastTokenTimestamp);
        if (tokenAgeMs < 3000) {
          const gapId = `disc-${now}-${Math.random().toString(36).substring(2, 7)}`;
          discontinuities.push({
            id: gapId,
            detectedAt: now,
            gapType: 'token_mismatch',
            expectedToken: backendToken,
            actualToken: lastText.slice(-30),
            lagMs: syncLagMs,
            patchApplied: true,
            patchDescription: `Aligned UI turn text with audio buffer token "${backendToken}"`
          });

          // Patch: seamlessly append/merge diverging backend token into turn
          lastTurn.text = `${lastTurn.text} ${backendToken}`.trim();
          lastTurn.timestamp = checkpoint.lastTokenTimestamp || now;
          reconciledState.lastMessageTimestamp = lastTurn.timestamp;
          patchedCount++;
        }
      }
    }
  }

  // Buffer hash validation for audio continuity
  if (checkpoint.bufferLength > 0 && checkpoint.bufferHash) {
    const expectedPrefix = checkpoint.bufferHash.substring(0, 8);
    if (!expectedPrefix || expectedPrefix === '00000000') {
      discontinuities.push({
        id: `disc-buf-${now}`,
        detectedAt: now,
        gapType: 'buffer_drift',
        expectedToken: 'valid_hash',
        actualToken: checkpoint.bufferHash,
        lagMs: syncLagMs,
        patchApplied: false,
        patchDescription: 'Audio buffer hash indicates potential dropped frames in Go pipeline'
      });
    }
  }

  return {
    isValid: discontinuities.length === 0,
    syncLagMs,
    syncStatus,
    detectedGapsCount: discontinuities.length,
    discontinuities,
    timestamp: now,
    patchedTurnsCount: patchedCount,
    reconciledState
  };
}

/**
 * Worker Thread Execution Script
 */
const WORKER_SCRIPT = `
  const { parentPort } = require('worker_threads');

  function executeReconciliation(uiState, checkpoint, now) {
    const discontinuities = [];
    let patchedCount = 0;

    const reconciledState = {
      turnId: uiState.turnId || ('turn-' + now),
      participants: [...(uiState.participants || ['user', 'Tuk Tuk', 'Andrew'])],
      lastMessageTimestamp: uiState.lastMessageTimestamp || now,
      contextBuffer: Array.isArray(uiState.contextBuffer)
        ? uiState.contextBuffer.map(t => ({ ...t }))
        : [],
      rateLimitInfo: { ...(uiState.rateLimitInfo || {
        requestsRemaining: 60,
        resetTimestamp: now + 60000,
        isThrottled: false
      })}
    };

    if (!checkpoint) {
      return {
        isValid: false,
        syncLagMs: 9999,
        syncStatus: 'stale',
        detectedGapsCount: 0,
        discontinuities: [],
        timestamp: now,
        patchedTurnsCount: 0,
        reconciledState
      };
    }

    if (checkpoint.isPaused) {
      return {
        isValid: true,
        syncLagMs: Math.max(0, now - checkpoint.timestamp),
        syncStatus: 'paused',
        detectedGapsCount: 0,
        discontinuities: [],
        timestamp: now,
        patchedTurnsCount: 0,
        reconciledState
      };
    }

    const syncLagMs = Math.max(0, now - checkpoint.timestamp);
    let syncStatus = 'synchronized';
    if (syncLagMs > 500) {
      syncStatus = 'stale';
    } else if (syncLagMs > 65) {
      syncStatus = 'lagging';
    }

    const backendToken = (checkpoint.lastProcessedToken || '').trim();
    const bufferLen = reconciledState.contextBuffer.length;

    if (backendToken.length > 0) {
      if (bufferLen === 0) {
        const gapId = 'disc-' + now + '-' + Math.random().toString(36).substring(2, 7);
        discontinuities.push({
          id: gapId,
          detectedAt: now,
          gapType: 'dropped_turn',
          expectedToken: backendToken,
          actualToken: '',
          lagMs: syncLagMs,
          patchApplied: true,
          patchDescription: 'Patched missing turn context from audio backend token: "' + backendToken + '"'
        });
        reconciledState.contextBuffer.push({
          speaker: 'user',
          text: backendToken,
          timestamp: checkpoint.lastTokenTimestamp || now
        });
        reconciledState.lastMessageTimestamp = checkpoint.lastTokenTimestamp || now;
        patchedCount++;
      } else {
        const lastTurn = reconciledState.contextBuffer[bufferLen - 1];
        const lastText = (lastTurn.text || '').trim();
        if (lastText.length > 0 && !lastText.toLowerCase().includes(backendToken.toLowerCase())) {
          const tokenAgeMs = Math.abs(now - checkpoint.lastTokenTimestamp);
          if (tokenAgeMs < 3000) {
            const gapId = 'disc-' + now + '-' + Math.random().toString(36).substring(2, 7);
            discontinuities.push({
              id: gapId,
              detectedAt: now,
              gapType: 'token_mismatch',
              expectedToken: backendToken,
              actualToken: lastText.slice(-30),
              lagMs: syncLagMs,
              patchApplied: true,
              patchDescription: 'Aligned UI turn text with audio buffer token "' + backendToken + '"'
            });
            lastTurn.text = (lastTurn.text + ' ' + backendToken).trim();
            lastTurn.timestamp = checkpoint.lastTokenTimestamp || now;
            reconciledState.lastMessageTimestamp = lastTurn.timestamp;
            patchedCount++;
          }
        }
      }
    }

    return {
      isValid: discontinuities.length === 0,
      syncLagMs,
      syncStatus,
      detectedGapsCount: discontinuities.length,
      discontinuities,
      timestamp: now,
      patchedTurnsCount: patchedCount,
      reconciledState
    };
  }

  parentPort.on('message', (task) => {
    try {
      const result = executeReconciliation(task.uiState, task.checkpoint, task.now);
      parentPort.postMessage({ id: task.id, success: true, result });
    } catch (err) {
      parentPort.postMessage({ id: task.id, success: false, error: err.message });
    }
  });
`;

/**
 * ConversationStateManager
 * Main-process singleton managing continuous state synchronization.
 */
export class ConversationStateManager {
  private static instance: ConversationStateManager | null = null;

  private latestCheckpoint: SyncCheckpoint | null = null;
  private currentSyncStatus: StateSyncStatus;
  private listeners: Array<(status: StateSyncStatus) => void> = [];
  private worker: Worker | null = null;
  private pendingTasks: Map<string, { resolve: (val: StateAuditReport) => void; reject: (err: any) => void }> = new Map();
  private isReconciling: boolean = false;
  private lastAuditReport: StateAuditReport | null = null;

  constructor() {
    this.currentSyncStatus = {
      status: 'stale',
      syncLagMs: 0,
      lastCheckpointTimestamp: 0,
      lastReconciledTimestamp: 0,
      gapDetected: false,
      sequenceNumber: 0,
      cpuLoad: 0
    };

    this.initWorker();
  }

  public static getInstance(): ConversationStateManager {
    if (!ConversationStateManager.instance) {
      ConversationStateManager.instance = new ConversationStateManager();
    }
    return ConversationStateManager.instance;
  }

  /**
   * Initializes non-blocking worker thread for CPU-heavy diffing
   */
  private initWorker(): void {
    try {
      this.worker = new Worker(WORKER_SCRIPT, { eval: true });
      this.worker.on('message', (msg: { id: string; success: boolean; result?: StateAuditReport; error?: string }) => {
        const task = this.pendingTasks.get(msg.id);
        if (task) {
          this.pendingTasks.delete(msg.id);
          if (msg.success && msg.result) {
            task.resolve(msg.result);
          } else {
            task.reject(new Error(msg.error || 'Worker reconciliation failed'));
          }
        }
      });

      this.worker.on('error', (err) => {
        console.warn('⚠️ [ConversationStateManager] Worker thread warning:', err.message);
        // Worker will recover on next task via inline fallback
      });
    } catch (workerErr: any) {
      console.warn('⚠️ [ConversationStateManager] Worker threads unavailable, using async inline fallback:', workerErr.message);
      this.worker = null;
    }
  }

  /**
   * Ingests a new SYNC_CHECKPOINT from the Go audio backend (emitted every ~50ms).
   */
  public onSyncCheckpoint(checkpoint: SyncCheckpoint): void {
    if (!validateSyncCheckpoint(checkpoint)) {
      console.warn('⚠️ [ConversationStateManager] Invalid SyncCheckpoint dropped:', checkpoint);
      return;
    }

    this.latestCheckpoint = checkpoint;
    const now = Date.now();
    const syncLagMs = Math.max(0, now - checkpoint.timestamp);

    let status: SyncStatusType = 'synchronized';
    if (checkpoint.isPaused) {
      status = 'paused';
    } else if (syncLagMs > 500) {
      status = 'stale';
    } else if (syncLagMs > 65) {
      status = 'lagging';
    }

    this.currentSyncStatus = {
      status,
      syncLagMs,
      lastCheckpointTimestamp: checkpoint.timestamp,
      lastReconciledTimestamp: this.currentSyncStatus.lastReconciledTimestamp,
      gapDetected: this.currentSyncStatus.gapDetected,
      gapDescription: this.currentSyncStatus.gapDescription,
      sequenceNumber: checkpoint.sequenceNumber,
      cpuLoad: checkpoint.cpuLoad
    };

    this.notifyStatusListeners();
  }

  /**
   * Reconciles UI state with audio backend processing state non-blockingly.
   */
  public async reconcileState(
    uiState: ConversationalState,
    checkpoint?: SyncCheckpoint
  ): Promise<StateAuditReport> {
    const activeCheckpoint = checkpoint || this.latestCheckpoint;
    const now = Date.now();
    const taskId = `rec-${now}-${Math.random().toString(36).substring(2, 8)}`;

    this.isReconciling = true;
    this.currentSyncStatus.status = 'reconciling';
    this.notifyStatusListeners();

    try {
      let report: StateAuditReport;

      if (this.worker) {
        // Execute non-blockingly on worker thread
        report = await new Promise<StateAuditReport>((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (this.pendingTasks.has(taskId)) {
              this.pendingTasks.delete(taskId);
              // Fallback to inline on 200ms timeout
              resolve(executeReconciliation(uiState, activeCheckpoint, now));
            }
          }, 200);

          this.pendingTasks.set(taskId, {
            resolve: (res) => {
              clearTimeout(timeout);
              resolve(res);
            },
            reject: (_err) => {
              clearTimeout(timeout);
              resolve(executeReconciliation(uiState, activeCheckpoint, now));
            }
          });

          this.worker?.postMessage({ id: taskId, uiState, checkpoint: activeCheckpoint, now });
        });
      } else {
        // Inline execution fallback
        report = executeReconciliation(uiState, activeCheckpoint, now);
      }

      this.lastAuditReport = report;
      this.currentSyncStatus = {
        status: report.syncStatus,
        syncLagMs: report.syncLagMs,
        lastCheckpointTimestamp: activeCheckpoint?.timestamp || 0,
        lastReconciledTimestamp: now,
        gapDetected: report.detectedGapsCount > 0,
        gapDescription: report.discontinuities.length > 0 ? report.discontinuities[0].patchDescription : undefined,
        sequenceNumber: activeCheckpoint?.sequenceNumber || 0,
        cpuLoad: activeCheckpoint?.cpuLoad || 0
      };

      this.notifyStatusListeners();
      return report;
    } catch (err: any) {
      console.warn('⚠️ [ConversationStateManager] Reconciliation error, falling back to safe state:', err.message);
      const safeReport = executeReconciliation(uiState, null, now);
      this.lastAuditReport = safeReport;
      return safeReport;
    } finally {
      this.isReconciling = false;
    }
  }

  /**
   * Performs full state audit, returning diff report of semantic discontinuities.
   */
  public async verifyIntegrity(uiState?: ConversationalState): Promise<StateAuditReport> {
    const stateToVerify: ConversationalState = uiState || {
      turnId: `turn-${Date.now()}`,
      participants: ['user', 'Tuk Tuk', 'Andrew'],
      lastMessageTimestamp: Date.now(),
      contextBuffer: [],
      rateLimitInfo: {
        requestsRemaining: 60,
        resetTimestamp: Date.now() + 60000,
        isThrottled: false
      }
    };

    return this.reconcileState(stateToVerify, this.latestCheckpoint || undefined);
  }

  /**
   * Retrieves current synchronization status.
   */
  public getSyncStatus(): StateSyncStatus {
    return { ...this.currentSyncStatus };
  }

  /**
   * Retrieves last generated audit report.
   */
  public getLastAuditReport(): StateAuditReport | null {
    return this.lastAuditReport;
  }

  /**
   * Subscribes listener to stateSyncStatus changes.
   */
  public onSyncStatus(listener: (status: StateSyncStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.getSyncStatus());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyStatusListeners(): void {
    const status = this.getSyncStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (e) {}
    }
  }

  public destroy(): void {
    if (this.worker) {
      this.worker.terminate().catch(() => {});
      this.worker = null;
    }
    this.pendingTasks.clear();
    this.listeners = [];
  }
}
