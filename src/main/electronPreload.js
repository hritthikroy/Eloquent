/**
 * Electron Preload Script for Clipboard and Prompts
 * Exposes window.clipboardAPI to the renderer process via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipboardAPI', {
  /**
   * Programmatically copies a prompt string to the system clipboard
   * @param {string} text 
   */
  copyPrompt: (text) => {
    if (typeof text !== 'string' || !text.trim()) {
      return;
    }
    // Forward to main process via IPC channel
    try {
      ipcRenderer.send('clipboard:copy-prompt', text);
    } catch (err) {
      console.warn('⚠️ [electronPreload] clipboard:copy-prompt send error:', err.message);
    }
  }
});
