/**
 * Main Process IPC Registry
 * 
 * Central hub aggregating and registering all IPC handler domains:
 * - Clipboard operations ('clipboard:copy-bengali-fix')
 * - Prompt submissions ('prompt:submit', 'prompt:validate')
 * - Audio ring buffer & fast-path streaming ('audio-ring:*')
 */

const { registerClipboardHandlers, CHANNEL_COPY_BENGALI_FIX } = require('./handlers/clipboardHandlers');
const { registerPromptIpc, PROMPT_CHANNELS } = require('./promptHandler');
const { registerAudioBridgeIpc } = require('./audioBridge');

function registerAllIpcHandlers(ipcMain, options = {}) {
  const registered = {
    clipboard: registerClipboardHandlers(ipcMain, options),
    prompt: typeof registerPromptIpc === 'function' ? registerPromptIpc(ipcMain, options) : false,
    audio: typeof registerAudioBridgeIpc === 'function' ? registerAudioBridgeIpc(ipcMain, options) : false
  };

  return registered;
}

module.exports = {
  registerAllIpcHandlers,
  registerClipboardHandlers,
  CHANNEL_COPY_BENGALI_FIX,
  PROMPT_CHANNELS
};
