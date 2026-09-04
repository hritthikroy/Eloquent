/**
 * @file cachePreload.js
 * @description Secure Preload bridge exposing the cache-clearing API to the Electron renderer process.
 * Employs contextBridge to enforce isolation boundaries and prevent prototype pollution.
 */

const { contextBridge, ipcRenderer } = require('electron');

const CACHE_CHANNELS = {
  CLEAR_APP_CACHE: 'clear-app-cache',
  CLEAR_GO_CACHE: 'clear-go-cache',
};

const cacheApiBridge = {
  /**
   * Invokes full application cache purge across Chromium session, Node.js memory, and Go backend.
   * @param {Object} [options] - Optional configurations (clearStorage, timeout, etc.)
   * @returns {Promise<{
   *   success: boolean,
   *   timestamp: number,
   *   chromiumCleared: boolean,
   *   nodeCleared: boolean,
   *   goBackendCleared: boolean,
   *   error?: string,
   *   details?: Object
   * }>}
   */
  clearCache: (options = {}) => ipcRenderer.invoke(CACHE_CHANNELS.CLEAR_APP_CACHE, options),

  /**
   * Directly signals the Go audio backend to reset its internal cache structures.
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  clearGoCache: (options = {}) => ipcRenderer.invoke(CACHE_CHANNELS.CLEAR_GO_CACHE, options),
};

// Expose safe window.api object
try {
  if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function') {
    contextBridge.exposeInMainWorld('api', {
      clearCache: (options) => cacheApiBridge.clearCache(options),
      clearGoCache: (options) => cacheApiBridge.clearGoCache(options),
    });

    // Also expose dedicated cacheAPI namespace
    contextBridge.exposeInMainWorld('cacheAPI', cacheApiBridge);
  }
} catch (err) {
  console.warn('⚠️ [cachePreload] ContextBridge unavailable or already exposed:', err.message);
}

module.exports = {
  cacheApiBridge,
  CACHE_CHANNELS,
};
