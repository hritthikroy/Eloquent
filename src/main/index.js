/**
 * Main Process IPC Entry & Clipboard Service Registration
 * Handles lifecycle bindings and provides safe IPC handlers for the clipboard service.
 */

const { clipboardService } = require('./clipboard-service');
const { CLIPBOARD_CHANNELS } = require('../shared/constants/ipc-channels');

let isRegistered = false;

/**
 * Register all clipboard IPC handlers on the provided ipcMain instance
 * @param {Electron.IpcMain} ipcMain
 * @returns {boolean} Whether registration was successful
 */
function registerClipboardHandlers(ipcMain) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    console.warn('⚠️ [Main/Clipboard] Valid ipcMain instance not provided, skipping registration');
    return false;
  }

  if (isRegistered) {
    console.log('ℹ️ [Main/Clipboard] Clipboard IPC handlers already registered');
    return true;
  }

  // 1. High-level Copy (supports text, html, code, structured-json)
  ipcMain.handle(CLIPBOARD_CHANNELS.COPY, async (_event, payload) => {
    try {
      return await clipboardService.copy(payload);
    } catch (err) {
      console.error('❌ [IPC:clipboard:copy] Error:', err.message);
      return { success: false, format: 'none', error: err.message };
    }
  });

  // 2. High-level Paste (returns text and format)
  ipcMain.handle(CLIPBOARD_CHANNELS.PASTE, async () => {
    try {
      return await clipboardService.paste();
    } catch (err) {
      console.error('❌ [IPC:clipboard:paste] Error:', err.message);
      return { success: false, text: '', isEmpty: true, format: 'none', error: err.message };
    }
  });

  // 3. Read Plain Text
  ipcMain.handle(CLIPBOARD_CHANNELS.READ_TEXT, async () => {
    try {
      return await clipboardService.readText();
    } catch (err) {
      console.error('❌ [IPC:clipboard:read-text] Error:', err.message);
      return { success: false, text: '', length: 0, isEmpty: true, error: err.message };
    }
  });

  // 4. Write Plain Text
  ipcMain.handle(CLIPBOARD_CHANNELS.WRITE_TEXT, async (_event, text) => {
    try {
      return await clipboardService.writeText(text);
    } catch (err) {
      console.error('❌ [IPC:clipboard:write-text] Error:', err.message);
      return { success: false, length: 0, error: err.message };
    }
  });

  // 5. Write HTML
  ipcMain.handle(CLIPBOARD_CHANNELS.WRITE_HTML, async (_event, { html, text } = {}) => {
    try {
      return await clipboardService.writeHTML(html, text);
    } catch (err) {
      console.error('❌ [IPC:clipboard:write-html] Error:', err.message);
      return { success: false, length: 0, error: err.message };
    }
  });

  // 6. Clear Clipboard
  ipcMain.handle(CLIPBOARD_CHANNELS.CLEAR, async () => {
    try {
      return await clipboardService.clear();
    } catch (err) {
      console.error('❌ [IPC:clipboard:clear] Error:', err.message);
      return { success: false, error: err.message };
    }
  });

  isRegistered = true;
  console.log('📋 [Main/Clipboard] Clipboard IPC handlers successfully registered');
  return true;
}

// Auto-register if Electron app is active
try {
  const { app, ipcMain } = require('electron');
  if (app && ipcMain) {
    if (app.isReady()) {
      registerClipboardHandlers(ipcMain);
    } else {
      app.whenReady().then(() => registerClipboardHandlers(ipcMain));
    }
  }
} catch (e) {
  // Headless / non-electron environment
}

module.exports = {
  registerClipboardHandlers,
  clipboardService
};
