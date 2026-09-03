/**
 * IPC Handlers Module
 * Exposes the generate-libboard-prompt channel and connects the Electron
 * main process to the ConversationProcessor engine.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { ConversationProcessor } = require('./conversationProcessor');

function registerLibboardIpcHandlers(ipcMain, userDataPath) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') return;

  const defaultHistoryPath = userDataPath
    ? path.join(userDataPath, 'history.json')
    : path.join(process.cwd(), 'userData', 'history.json');

  // Handle 'generate-libboard-prompt' invocation from renderer
  ipcMain.handle('generate-libboard-prompt', async (_event, payload = {}) => {
    try {
      console.log('🔄 [IPCHandlers] Processing generate-libboard-prompt request...');
      let inputData = payload.conversationData;

      // If no data provided directly in payload, load from persistent history.json
      if (!inputData && fs.existsSync(defaultHistoryPath)) {
        try {
          inputData = JSON.parse(fs.readFileSync(defaultHistoryPath, 'utf8'));
        } catch (e) {
          console.warn('⚠️ [IPCHandlers] Could not parse history.json:', e.message);
        }
      }

      const result = ConversationProcessor.generatePrompt(inputData, {
        appName: 'Eloquent'
      });

      // If requested, copy prompt directly to system clipboard via pbcopy
      if (result.success && result.prompt && payload.copyToClipboard && process.platform === 'darwin') {
        try {
          const cp = spawn('pbcopy');
          cp.stdin.write(result.prompt);
          cp.stdin.end();
          console.log('📋 [IPCHandlers] Copied Libboard prompt directly to system clipboard');
        } catch (clipErr) {
          console.warn('⚠️ [IPCHandlers] Clipboard copy failed:', clipErr.message);
        }
      }

      return result;
    } catch (err) {
      console.error('❌ [IPCHandlers] Unhandled error in generate-libboard-prompt:', err);
      return {
        success: false,
        error: 'Unable to generate Libboard prompt: conversation data invalid',
        prompt: null
      };
    }
  });

  console.log('✅ [IPCHandlers] Registered generate-libboard-prompt IPC channel');
}

module.exports = {
  registerLibboardIpcHandlers
};
