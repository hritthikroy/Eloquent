/**
 * Conversation IPC Handlers Module
 * Exposes the 'conversation:verify-integrity' and state reconciliation IPC channels,
 * allowing the renderer process to request full state audits and receive real-time
 * sync status telemetry.
 */

import {
  ConversationStateManager,
  StateAuditReport,
  StateSyncStatus,
  ConversationalState,
  SyncCheckpoint,
  validateSyncCheckpoint
} from './conversation-state-manager';
import { ClipboardManager, clipboardManager } from './clipboard-manager';
import { AudioManager, audioManager } from './audio-manager';
import { ExecutionEngine, executionEngine } from './execution-engine';
import {
  IpcChannels,
  ClipboardSyncPayload,
  ClipboardSyncResponse,
  AudioCaptureConfig,
  AudioCommandRecognizedPayload,
  ExecutionResult,
  ExecutionStatusPayload
} from '../shared/types';

export interface VerifyIntegrityPayload {
  uiState?: ConversationalState;
  auditScope?: 'full' | 'recent';
}

export interface VerifyIntegrityResponse {
  success: boolean;
  report: StateAuditReport | null;
  error?: string;
}

export interface BanglaValidationResponse {
  success: boolean;
  text: string;
  original: string;
  modified: boolean;
  error?: string;
}

/**
 * Normalizes Bengali (Bangla) text according to standard orthography,
 * correcting split matras, duplicate vowel signs, zero-width characters,
 * and canonical precomposed consonants.
 */
export function normalizeBanglaText(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // 1. Unicode NFC canonical decomposition & precomposition
  let text = input.normalize('NFC');

  // 2. Khanda-Ta legacy encodings
  text = text.replace(/\u09A4\u09CD\u200D/g, '\u09CE'); // Ta + Hasant + ZWJ -> ৎ
  text = text.replace(/\u09A4\u09CD\u200C/g, '\u09CE'); // Ta + Hasant + ZWNJ -> ৎ
  text = text.replace(/\u09A4\u09CD(?=[\s।\.,!?;:]|$)/g, '\u09CE'); // Word-final Ta + Hasant -> ৎ

  // 3. Remove zero-width characters (ZWSP, ZWNJ, ZWJ, BOM)
  text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // 4. Normalize Nukta combinations into canonical precomposed consonants
  text = text.replace(/\u09A1\u09BC/g, '\u09DC'); // ড়
  text = text.replace(/\u09A2\u09BC/g, '\u09DD'); // ঢ়
  text = text.replace(/\u09AF\u09BC/g, '\u09DF'); // য়

  // 5. Correct split matras (O-kar, Ou-kar, Ai-kar)
  text = text.replace(/\u09C7\u09BE/g, '\u09CB'); // e-kar + aa-kar -> o-kar (ো)
  text = text.replace(/\u09BE\u09C7/g, '\u09CB'); // aa-kar + e-kar -> o-kar (ো)
  text = text.replace(/\u09C7\u09D7/g, '\u09CC'); // e-kar + ou-length-mark -> ou-kar (ৌ)
  text = text.replace(/\u09C7\u09CC/g, '\u09CC'); // e-kar + ou-kar -> ou-kar (ৌ)
  text = text.replace(/\u09CC\u09C7/g, '\u09CC'); // ou-kar + e-kar -> ou-kar (ৌ)
  text = text.replace(/\u09C7\u09C8/g, '\u09C8'); // e-kar + ai-kar -> ai-kar (ৈ)
  text = text.replace(/\u09C8\u09C7/g, '\u09C8'); // ai-kar + e-kar -> ai-kar (ৈ)

  // 6. Deduplicate repeated vowel signs (matras), hasants, and modifiers
  text = text.replace(/\u09BE{2,}/g, '\u09BE');
  text = text.replace(/\u09BF{2,}/g, '\u09BF');
  text = text.replace(/\u09C0{2,}/g, '\u09C0');
  text = text.replace(/\u09C1{2,}/g, '\u09C1');
  text = text.replace(/\u09C2{2,}/g, '\u09C2');
  text = text.replace(/\u09C3{2,}/g, '\u09C3');
  text = text.replace(/\u09C7{2,}/g, '\u09C7');
  text = text.replace(/\u09C8{2,}/g, '\u09C8');
  text = text.replace(/\u09CB{2,}/g, '\u09CB');
  text = text.replace(/\u09CC{2,}/g, '\u09CC');
  text = text.replace(/\u09CD{2,}/g, '\u09CD');
  text = text.replace(/\u0981{2,}/g, '\u0981');
  text = text.replace(/\u0982{2,}/g, '\u0982');
  text = text.replace(/\u0983{2,}/g, '\u0983');

  // 7. Normalize Dari (।) spacing without altering sentence flow
  text = text.replace(/[ \t]+\u0964/g, '\u0964');
  text = text.replace(/\u0964([^\s\u0964\.,!?;:\)\]\}])/g, '\u0964 $1');

  // 8. Collapse duplicate horizontal spaces
  text = text.replace(/[ \t]{2,}/g, ' ');

  return text.trim();
}

/**
 * Registers conversation integrity and state reconciliation IPC handlers.
 *
 * @param ipcMain - Electron ipcMain module or mock handler object.
 * @param stateManager - ConversationStateManager instance.
 * @param broadcastTargets - Function returning target BrowserWindows for telemetry broadcast.
 */
export function registerConversationIpcHandlers(
  ipcMain: any,
  stateManager?: ConversationStateManager,
  broadcastTargets?: () => any[]
): { unregister: () => void } {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new Error('Invalid ipcMain instance provided to registerConversationIpcHandlers');
  }

  const manager = stateManager || ConversationStateManager.getInstance();

  // Channel 1: 'conversation:verify-integrity'
  // Allows renderer to request a full state audit from the main process
  ipcMain.handle('conversation:verify-integrity', async (_event: any, payload: VerifyIntegrityPayload = {}): Promise<VerifyIntegrityResponse> => {
    try {
      console.log('🔍 [IPCHandlers] Processing conversation:verify-integrity request...');
      const report = await manager.verifyIntegrity(payload.uiState);
      
      console.log(`📊 [IPCHandlers] Audit completed: isValid=${report.isValid}, gapsDetected=${report.detectedGapsCount}, syncLag=${report.syncLagMs}ms`);
      return {
        success: true,
        report
      };
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in conversation:verify-integrity:', err.message);
      return {
        success: false,
        report: null,
        error: err.message || 'Unknown integrity verification error'
      };
    }
  });

  // Channel 2: 'conversation:reconcile'
  // Directly reconcile UI state against a specific backend checkpoint
  ipcMain.handle('conversation:reconcile', async (_event: any, payload: { uiState: ConversationalState; checkpoint?: SyncCheckpoint }): Promise<VerifyIntegrityResponse> => {
    try {
      if (!payload || !payload.uiState) {
        throw new Error('Missing uiState in conversation:reconcile payload');
      }
      const report = await manager.reconcileState(payload.uiState, payload.checkpoint);
      return {
        success: true,
        report
      };
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in conversation:reconcile:', err.message);
      return {
        success: false,
        report: null,
        error: err.message || 'Unknown reconciliation error'
      };
    }
  });

  // Channel 3: 'conversation:get-sync-status'
  // Fast synchronous snapshot of synchronization status
  ipcMain.handle('conversation:get-sync-status', async (): Promise<StateSyncStatus> => {
    return manager.getSyncStatus();
  });

  // Channel 4: 'conversation:ingest-checkpoint'
  // Allows the Go audio backend bridge to push SYNC_CHECKPOINT events
  ipcMain.handle('conversation:ingest-checkpoint', async (_event: any, checkpoint: any): Promise<{ success: boolean }> => {
    if (validateSyncCheckpoint(checkpoint)) {
      manager.onSyncCheckpoint(checkpoint);
      return { success: true };
    }
    return { success: false };
  });

  // Channel 5: 'validate-bangla-text'
  // Normalizes Bengali (Bangla) text according to standard orthography
  ipcMain.handle('validate-bangla-text', async (_event: any, payload: any): Promise<BanglaValidationResponse> => {
    try {
      const rawText = typeof payload === 'string' ? payload : (payload?.text || '');
      const normalized = normalizeBanglaText(rawText);
      return {
        success: true,
        text: normalized,
        original: rawText,
        modified: normalized !== rawText
      };
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in validate-bangla-text:', err.message);
      return {
        success: false,
        text: typeof payload === 'string' ? payload : (payload?.text || ''),
        original: typeof payload === 'string' ? payload : (payload?.text || ''),
        modified: false,
        error: err.message || 'Unknown normalization error'
      };
    }
  });

  // Channel: 'clipboard:sync' (IpcChannels.CLIPBOARD_SYNC)
  // Handles automatic and manual prompt clipboard synchronization requests
  ipcMain.handle(IpcChannels.CLIPBOARD_SYNC, async (_event: any, payload: string | ClipboardSyncPayload): Promise<ClipboardSyncResponse> => {
    try {
      console.log('📋 [IPCHandlers] Processing clipboard:sync request...');
      const response = await clipboardManager.syncPromptToClipboard(payload);
      return response;
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in clipboard:sync channel:', err?.message || err);
      return {
        success: false,
        length: 0,
        timestamp: Date.now(),
        error: err?.message || 'Unhandled clipboard sync IPC error'
      };
    }
  });

  // Channel: 'audio:start-capture' (IpcChannels.AUDIO_START_CAPTURE)
  ipcMain.handle(IpcChannels.AUDIO_START_CAPTURE, async (_event: any, config: AudioCaptureConfig = {}): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🎙️ [IPCHandlers] Processing audio:start-capture request...');
      return await audioManager.startCapture(config);
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in audio:start-capture:', err?.message || err);
      return { success: false, error: err?.message || 'Audio capture start failed' };
    }
  });

  // Channel: 'audio:stop-capture' (IpcChannels.AUDIO_STOP_CAPTURE)
  ipcMain.handle(IpcChannels.AUDIO_STOP_CAPTURE, async (): Promise<{ success: boolean }> => {
    try {
      console.log('🛑 [IPCHandlers] Processing audio:stop-capture request...');
      return audioManager.stopCapture();
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in audio:stop-capture:', err?.message || err);
      return { success: false };
    }
  });

  // Channel: 'audio:command-recognized' (IpcChannels.AUDIO_COMMAND_RECOGNIZED)
  ipcMain.handle(IpcChannels.AUDIO_COMMAND_RECOGNIZED, async (_event: any, payload: { commandText: string; confidence?: number }): Promise<AudioCommandRecognizedPayload> => {
    try {
      const commandText = typeof payload === 'string' ? payload : (payload?.commandText || '');
      const confidence = typeof payload === 'object' && payload?.confidence !== undefined ? payload.confidence : 0.98;
      return audioManager.processCommandRecognition(commandText, confidence);
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in audio:command-recognized:', err?.message || err);
      return {
        command: 'unknown',
        confidence: 0,
        state: 'IDLE',
        timestamp: Date.now()
      };
    }
  });

  // Channel: 'exec:run' (IpcChannels.EXEC_RUN)
  ipcMain.handle(IpcChannels.EXEC_RUN, async (_event: any, payload: { intent: string | Record<string, any> }): Promise<ExecutionResult> => {
    try {
      console.log('⚡ [IPCHandlers] Processing exec:run request...');
      const intentInput = typeof payload === 'string' ? payload : (payload?.intent || payload);
      const plan = executionEngine.parseIntent(intentInput);

      const result = await executionEngine.executePlan(plan.id, (statusPayload: ExecutionStatusPayload) => {
        if (typeof broadcastTargets === 'function') {
          try {
            const windows = broadcastTargets();
            if (Array.isArray(windows)) {
              for (const win of windows) {
                if (win && !win.isDestroyed() && win.webContents) {
                  win.webContents.send(IpcChannels.EXEC_STATUS, statusPayload);
                }
              }
            }
          } catch (e) {}
        }
      });

      return result;
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in exec:run:', err?.message || err);
      return {
        success: false,
        planId: '',
        completedSteps: 0,
        totalSteps: 0,
        error: err?.message || 'Execution error',
        logs: [`[IPCHandlers] Exception: ${err?.message}`]
      };
    }
  });

  // Channel: 'exec:status' (IpcChannels.EXEC_STATUS)
  ipcMain.handle(IpcChannels.EXEC_STATUS, async (_event: any, payload: { planId: string }): Promise<ExecutionStatusPayload | null> => {
    try {
      const planId = typeof payload === 'string' ? payload : payload?.planId;
      return executionEngine.getPlanStatus(planId);
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in exec:status:', err?.message || err);
      return null;
    }
  });

  // Channel: 'exec:abort' (IpcChannels.EXEC_ABORT)
  ipcMain.handle(IpcChannels.EXEC_ABORT, async (_event: any, payload: { planId: string }): Promise<{ success: boolean }> => {
    try {
      const planId = typeof payload === 'string' ? payload : payload?.planId;
      const success = executionEngine.abortPlan(planId);
      return { success };
    } catch (err: any) {
      console.error('❌ [IPCHandlers] Error in exec:abort:', err?.message || err);
      return { success: false };
    }
  });

  // Telemetry Broadcast Subscription:
  // Emits 'stateSyncStatus' to renderer windows
  const unsubscribeSync = manager.onSyncStatus((status: StateSyncStatus) => {
    if (typeof broadcastTargets === 'function') {
      try {
        const windows = broadcastTargets();
        if (Array.isArray(windows)) {
          for (const win of windows) {
            if (win && !win.isDestroyed() && win.webContents) {
              win.webContents.send('stateSyncStatus', status);
            }
          }
        }
      } catch (broadcastErr) {
        // Safe swallow to prevent main loop disruption
      }
    }
  });

  // Audio Command Broadcast Listener:
  const commandListener = (payload: AudioCommandRecognizedPayload) => {
    if (typeof broadcastTargets === 'function') {
      try {
        const windows = broadcastTargets();
        if (Array.isArray(windows)) {
          for (const win of windows) {
            if (win && !win.isDestroyed() && win.webContents) {
              win.webContents.send(IpcChannels.AUDIO_COMMAND_RECOGNIZED, payload);
            }
          }
        }
      } catch (broadcastErr) {
        // Safe swallow
      }
    }
  };

  audioManager.on('command-recognized', commandListener);

  console.log('✅ [IPCHandlers] Registered conversation, clipboard, audio & execution IPC handlers');

  return {
    unregister: () => {
      try {
        if (typeof ipcMain.removeHandler === 'function') {
          ipcMain.removeHandler('conversation:verify-integrity');
          ipcMain.removeHandler('conversation:reconcile');
          ipcMain.removeHandler('conversation:get-sync-status');
          ipcMain.removeHandler('conversation:ingest-checkpoint');
          ipcMain.removeHandler('validate-bangla-text');
          ipcMain.removeHandler(IpcChannels.CLIPBOARD_SYNC);
          ipcMain.removeHandler(IpcChannels.AUDIO_START_CAPTURE);
          ipcMain.removeHandler(IpcChannels.AUDIO_STOP_CAPTURE);
          ipcMain.removeHandler(IpcChannels.AUDIO_COMMAND_RECOGNIZED);
          ipcMain.removeHandler(IpcChannels.EXEC_RUN);
          ipcMain.removeHandler(IpcChannels.EXEC_STATUS);
          ipcMain.removeHandler(IpcChannels.EXEC_ABORT);
        }
        unsubscribeSync();
        audioManager.off('command-recognized', commandListener);
      } catch (e) {}
    }
  };
}

