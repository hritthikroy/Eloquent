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

export interface VerifyIntegrityPayload {
  uiState?: ConversationalState;
  auditScope?: 'full' | 'recent';
}

export interface VerifyIntegrityResponse {
  success: boolean;
  report: StateAuditReport | null;
  error?: string;
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

  console.log('✅ [IPCHandlers] Registered conversation:verify-integrity & stateSyncStatus channels');

  return {
    unregister: () => {
      try {
        if (typeof ipcMain.removeHandler === 'function') {
          ipcMain.removeHandler('conversation:verify-integrity');
          ipcMain.removeHandler('conversation:reconcile');
          ipcMain.removeHandler('conversation:get-sync-status');
          ipcMain.removeHandler('conversation:ingest-checkpoint');
        }
        unsubscribeSync();
      } catch (e) {}
    }
  };
}
