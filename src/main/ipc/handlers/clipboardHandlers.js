/**
 * Clipboard IPC Handlers
 * 
 * Manages IPC communication between Electron Renderer and Main process
 * for clipboard operations, specifically registering 'clipboard:copy-bengali-fix'.
 */

const { ClipboardService } = require('../../services/clipboardService');
const { BENGALI_FIX_PROMPT } = require('../../../shared/constants/prompts');

const CHANNEL_COPY_BENGALI_FIX = 'clipboard:copy-bengali-fix';

/**
 * Registers all clipboard-related IPC handlers.
 * 
 * @param {Object} ipcMain - Electron ipcMain module
 * @param {Object} [options]
 * @returns {boolean} Whether registration was successful
 */
function registerClipboardHandlers(ipcMain, options = {}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    return false;
  }

  // Remove existing handler to avoid duplicate registration errors during hot-reload
  try {
    if (typeof ipcMain.removeHandler === 'function') {
      ipcMain.removeHandler(CHANNEL_COPY_BENGALI_FIX);
    }
  } catch (_) {}

  // Register dedicated 'clipboard:copy-bengali-fix' channel
  ipcMain.handle(CHANNEL_COPY_BENGALI_FIX, async (_event, customText) => {
    const textToCopy = typeof customText === 'string' && customText.trim()
      ? customText
      : BENGALI_FIX_PROMPT;

    try {
      const success = await ClipboardService.copyBengaliFixPrompt(textToCopy);
      return {
        success,
        channel: CHANNEL_COPY_BENGALI_FIX,
        text: textToCopy,
        timestamp: Date.now()
      };
    } catch (err) {
      console.error('❌ [ClipboardHandlers] Error copying Bengali fix prompt:', err);
      return {
        success: false,
        channel: CHANNEL_COPY_BENGALI_FIX,
        error: err.message,
        timestamp: Date.now()
      };
    }
  });

  return true;
}

module.exports = {
  CHANNEL_COPY_BENGALI_FIX,
  registerClipboardHandlers
};
