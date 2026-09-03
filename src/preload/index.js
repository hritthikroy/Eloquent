/**
 * Preload Script for Secure IPC Communication & Clipboard API Bridge
 * Uses contextBridge to expose a strictly isolated clipboard API object to the renderer
 * without exposing raw ipcRenderer or compromising nodeIntegration/contextIsolation.
 */

const { contextBridge, ipcRenderer } = require('electron');

const CLIPBOARD_CHANNELS = {
  COPY: 'clipboard:copy',
  PASTE: 'clipboard:paste',
  READ_TEXT: 'clipboard:read-text',
  WRITE_TEXT: 'clipboard:write-text',
  WRITE_HTML: 'clipboard:write-html',
  CLEAR: 'clipboard:clear'
};

// Expose secure clipboard API to the renderer process
contextBridge.exposeInMainWorld('clipboard', {
  /**
   * Copy formatted text, code, or structured data to system clipboard
   * @param {string|Object} payload - text string or { text, html, code, language, data }
   * @returns {Promise<{success: boolean, format: string, error?: string}>}
   */
  copy: (payload) => {
    const safePayload = typeof payload === 'string' ? { text: payload } : (payload || {});
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.COPY, safePayload);
  },

  /**
   * Paste text or structured content from system clipboard
   * @returns {Promise<{success: boolean, text: string, isEmpty: boolean, format: string, error?: string}>}
   */
  paste: () => {
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.PASTE);
  },

  /**
   * Read raw plain text from system clipboard
   * @returns {Promise<{success: boolean, text: string, length: number, isEmpty: boolean, error?: string}>}
   */
  readText: () => {
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.READ_TEXT);
  },

  /**
   * Write plain text to system clipboard
   * @param {string} text
   * @returns {Promise<{success: boolean, length: number, error?: string}>}
   */
  writeText: (text) => {
    const safeText = text === null || text === undefined ? '' : String(text);
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.WRITE_TEXT, safeText);
  },

  /**
   * Write formatted HTML to system clipboard
   * @param {string} html
   * @param {string} [plainText]
   * @returns {Promise<{success: boolean, length: number, error?: string}>}
   */
  writeHTML: (html, plainText = '') => {
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.WRITE_HTML, { html, text: plainText });
  },

  /**
   * Clear system clipboard
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  clear: () => {
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.CLEAR);
  }
});
