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

const AUDIO_BINARY_MAGIC = 0x4155444f;

function packBinaryAudioFrame(frameId, timestamp, audioData) {
  const headerSize = 16;
  const totalLength = headerSize + audioData.length;
  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  view.setUint32(0, AUDIO_BINARY_MAGIC, false);
  view.setUint32(4, frameId, true);
  view.setFloat64(8, timestamp, true);

  buffer.set(audioData, headerSize);
  return buffer;
}

function unpackBinaryAudioFrame(buffer) {
  if (buffer.length < 16) {
    throw new Error(`Invalid binary audio frame: buffer length ${buffer.length} is less than 16-byte header`);
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = view.getUint32(0, false);
  if (magic !== AUDIO_BINARY_MAGIC) {
    throw new Error(`Invalid binary audio frame: expected magic 0x${AUDIO_BINARY_MAGIC.toString(16)}, got 0x${magic.toString(16)}`);
  }

  const frameId = view.getUint32(4, true);
  const timestamp = view.getFloat64(8, true);
  const audioData = buffer.subarray(16);

  return {
    frameId,
    timestamp,
    audioData
  };
}

class WindowStateManager {
  constructor(initialState) {
    this.state = {
      isMinimized: false,
      isMaximized: false,
      isFocused: true,
      isVisible: true,
      isFullScreen: false,
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      lastUpdated: Date.now(),
      ...initialState
    };
    this.pendingUpdates = {};
    this.scheduledMicrotask = false;
    this.listeners = new Set();
  }

  static getInstance() {
    if (!WindowStateManager.instance) {
      WindowStateManager.instance = new WindowStateManager();
    }
    return WindowStateManager.instance;
  }

  getState() {
    return {
      ...this.state,
      bounds: { ...this.state.bounds }
    };
  }

  updateSync(updates) {
    this.state = {
      ...this.state,
      ...updates,
      bounds: updates.bounds ? { ...updates.bounds } : this.state.bounds,
      lastUpdated: Date.now()
    };
    this.notifyListeners();
    return this.getState();
  }

  batchUpdate(updates) {
    return new Promise((resolve) => {
      this.pendingUpdates = {
        ...this.pendingUpdates,
        ...updates,
        bounds: updates.bounds ? { ...(this.pendingUpdates.bounds || this.state.bounds), ...updates.bounds } : this.pendingUpdates.bounds
      };

      if (!this.scheduledMicrotask) {
        this.scheduledMicrotask = true;
        const flush = () => {
          this.scheduledMicrotask = false;
          const merged = this.pendingUpdates;
          this.pendingUpdates = {};

          this.state = {
            ...this.state,
            ...merged,
            bounds: merged.bounds ? { ...merged.bounds } : this.state.bounds,
            lastUpdated: Date.now()
          };

          this.notifyListeners();
          resolve(this.getState());
        };

        if (typeof queueMicrotask === 'function') {
          queueMicrotask(flush);
        } else if (typeof setImmediate === 'function') {
          setImmediate(flush);
        } else {
          setTimeout(flush, 0);
        }
      } else {
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(() => resolve(this.getState()));
        } else {
          setTimeout(() => resolve(this.getState()), 0);
        }
      }
    });
  }

  onStateChange(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  reset(initialState) {
    this.pendingUpdates = {};
    this.scheduledMicrotask = false;
    this.state = {
      isMinimized: false,
      isMaximized: false,
      isFocused: true,
      isVisible: true,
      isFullScreen: false,
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      lastUpdated: Date.now(),
      ...initialState
    };
  }

  notifyListeners() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('⚠️ [WindowStateManager] Error in listener callback:', err);
      }
    }
  }
}

const windowStateManager = WindowStateManager.getInstance();
let isOptimizedIpcRegistered = false;

function registerOptimizedIpcHandlers(ipcMain, stateManager = windowStateManager) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    console.warn('⚠️ [Main/IPC] Valid ipcMain instance not provided, skipping optimized IPC registration');
    return { unregister: () => {} };
  }

  if (isOptimizedIpcRegistered) {
    console.log('ℹ️ [Main/IPC] Optimized IPC handlers already registered');
    return { unregister: () => {} };
  }

  ipcMain.handle('window:get-state', async () => {
    return stateManager.getState();
  });

  ipcMain.handle('window:batch-update', async (_event, updates) => {
    return await stateManager.batchUpdate(updates);
  });

  ipcMain.handle('audio:telemetry-binary', async (_event, rawBuffer) => {
    try {
      const uint8 = rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer);
      const frame = unpackBinaryAudioFrame(uint8);
      return {
        success: true,
        frameId: frame.frameId,
        timestamp: frame.timestamp,
        payloadSize: frame.audioData.length
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  });

  isOptimizedIpcRegistered = true;
  console.log('⚡ [Main/IPC] Optimized IPC channel listeners registered successfully');

  return {
    unregister: () => {
      try {
        if (typeof ipcMain.removeHandler === 'function') {
          ipcMain.removeHandler('window:get-state');
          ipcMain.removeHandler('window:batch-update');
          ipcMain.removeHandler('audio:telemetry-binary');
        }
        isOptimizedIpcRegistered = false;
      } catch (e) {}
    }
  };
}

const { SharedMemoryAudioBridge, registerAudioBridgeIpc } = require('./ipc/audioBridge');
const { registerResilientIpcHandlers, getSystemSubsystemStatus, getAudioDeviceState } = require('./ipc');

// Auto-register if Electron app is active
try {
  const { app, ipcMain } = require('electron');
  if (app && ipcMain) {
    const registerAll = () => {
      registerClipboardHandlers(ipcMain);
      registerOptimizedIpcHandlers(ipcMain);
      registerAudioBridgeIpc(ipcMain);
      registerResilientIpcHandlers(ipcMain);
    };

    if (app.isReady()) {
      registerAll();
    } else {
      app.whenReady().then(registerAll);
    }
  }
} catch (e) {
  // Headless / non-electron environment
}

module.exports = {
  registerClipboardHandlers,
  registerOptimizedIpcHandlers,
  registerAudioBridgeIpc,
  registerResilientIpcHandlers,
  getSystemSubsystemStatus,
  getAudioDeviceState,
  SharedMemoryAudioBridge,
  WindowStateManager,
  windowStateManager,
  packBinaryAudioFrame,
  unpackBinaryAudioFrame,
  clipboardService
};
