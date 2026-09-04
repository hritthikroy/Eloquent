/**
 * @file ipcHandlers.ts
 * @description Electron main process IPC handler registry for Vision prompt composition.
 * Exposes the 'vision-build-prompt' IPC channel forwarding requests to PromptBuilder.
 */

import { buildPrompt, PromptBuilder, PromptBuilderOptions } from '../../vision/promptBuilder';

export interface VisionBuildPromptPayload {
  intent?: string;
  options?: PromptBuilderOptions;
}

export interface VisionBuildPromptResponse {
  success: boolean;
  prompt: string;
  error?: string;
  timestamp: number;
}

/**
 * Registers Vision prompt composition IPC handlers.
 * @param ipcMain - Electron ipcMain instance or mock object.
 * @returns {{ unregister: () => void }}
 */
export function registerVisionIpcHandlers(ipcMain: any): { unregister: () => void } {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new Error('Invalid ipcMain instance provided to registerVisionIpcHandlers');
  }

  // Handler for 'vision-build-prompt'
  ipcMain.handle('vision-build-prompt', async (_event: any, payload: string | VisionBuildPromptPayload = {}): Promise<VisionBuildPromptResponse> => {
    try {
      const intentStr = typeof payload === 'string' ? payload : (payload.intent || '');
      const options = typeof payload === 'object' && payload !== null ? payload.options : {};

      const prompt = buildPrompt(intentStr, options);

      return {
        success: true,
        prompt,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      console.error('❌ [VisionIPCHandler] Error constructing prompt from intent:', err.message);
      return {
        success: false,
        prompt: '',
        error: err.message || 'Failed to compose vision developer prompt',
        timestamp: Date.now(),
      };
    }
  });

  return {
    unregister: () => {
      try {
        if (typeof ipcMain.removeHandler === 'function') {
          ipcMain.removeHandler('vision-build-prompt');
        }
      } catch (e) {
        /* ignore */
      }
    },
  };
}

export { buildPrompt, PromptBuilder };
export default registerVisionIpcHandlers;
