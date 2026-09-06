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

// ── Multi-Layered Session Termination & Teardown Protocol ────────────────────
let activeShutdownPromise = null;
let registeredGoProcess = null;
let registeredAudioBridge = null;
let isLifecycleHooked = false;

/**
 * Register active Go backend child process and/or AudioBridge instance
 * so they can be gracefully cleaned up during shutdownSequence.
 * @param {Object} targets
 * @param {Object} [targets.childProcess]
 * @param {Object} [targets.audioBridge]
 */
function registerShutdownTargets(targets = {}) {
  if (targets.childProcess) registeredGoProcess = targets.childProcess;
  if (targets.audioBridge) registeredAudioBridge = targets.audioBridge;
}

/**
 * Orchestrates multi-layered teardown:
 * 1) Notify renderer to flush state,
 * 2) Send SIGTERM to the Go audio child process,
 * 3) Await process exit with a 2-second timeout,
 * 4) Force kill with SIGKILL if timeout exceeds,
 * 5) Exit Electron.
 * 
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=2000] - Timeout awaiting Go process exit
 * @param {Object} [options.childProcess] - Target child process to kill
 * @param {Object} [options.audioBridge] - Target AudioBridge instance to terminate
 * @param {Object} [options.app] - Electron app instance
 * @param {Array} [options.windows] - Open BrowserWindow instances
 * @param {number} [options.flushWaitMs=50] - Grace wait for renderer state flush
 * @param {boolean} [options.skipAppExit=false] - If true, do not call app.exit()
 * @param {boolean} [options.resetPromise=false] - Reset active shutdown promise
 * @returns {Promise<{success: boolean, forced: boolean, exitCode: number, durationMs: number}>}
 */
async function shutdownSequence(options = {}) {
  if (options.resetPromise === true) {
    activeShutdownPromise = null;
  }

  if (activeShutdownPromise) {
    return activeShutdownPromise;
  }

  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 2000;
  const targetProcess = options.childProcess !== undefined ? options.childProcess : registeredGoProcess;
  const bridge = options.audioBridge !== undefined ? options.audioBridge : registeredAudioBridge;
  const electronApp = options.app || (function() {
    try { return require('electron').app; } catch (_) { return null; }
  })();
  const browserWindows = options.windows || (function() {
    try {
      const { BrowserWindow } = require('electron');
      return typeof BrowserWindow.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
    } catch (_) {
      return [];
    }
  })();

  activeShutdownPromise = (async () => {
    console.log('🛑 [Lifecycle] Initiating multi-layered shutdown sequence...');
    const startTime = Date.now();
    let forced = false;

    // 1. Notify renderer to flush state
    try {
      console.log('📡 [Lifecycle:Phase 1] Notifying renderer to flush state...');
      if (Array.isArray(browserWindows) && browserWindows.length > 0) {
        for (const win of browserWindows) {
          if (win && win.webContents && !win.webContents.isDestroyed()) {
            try {
              win.webContents.send('app:prepare-shutdown', { timestamp: Date.now() });
              win.webContents.send('session:flush-state');
            } catch (_) {}
          }
        }
      }
      if (options.flushWaitMs !== 0) {
        await new Promise((resolve) => setTimeout(resolve, options.flushWaitMs || 50));
      }
    } catch (err) {
      console.warn('⚠️ [Lifecycle:Phase 1] Error during renderer state flush:', err.message);
    }

    // 2. Terminate AudioBridge connections and send SIGTERM to Go audio child process
    try {
      console.log('🎙️ [Lifecycle:Phase 2] Terminating AudioBridge & sending SIGTERM to Go process...');
      if (bridge) {
        if (typeof bridge.terminate === 'function') {
          await bridge.terminate().catch((e) => console.warn('⚠️ [Lifecycle] AudioBridge.terminate warning:', e.message));
        } else if (typeof bridge.close === 'function') {
          await bridge.close().catch((e) => console.warn('⚠️ [Lifecycle] AudioBridge.close warning:', e.message));
        }
      }

      if (targetProcess && typeof targetProcess.kill === 'function') {
        const isAlreadyExited = targetProcess.killed || targetProcess.exitCode !== null || targetProcess.signalCode !== null;
        if (!isAlreadyExited) {
          try {
            targetProcess.kill('SIGTERM');
          } catch (killErr) {
            console.warn('⚠️ [Lifecycle:Phase 2] Error sending SIGTERM to Go process:', killErr.message);
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ [Lifecycle:Phase 2] Error in audio bridge teardown:', err.message);
    }

    // 3 & 4. Await process exit with timeout, force kill if timeout exceeds
    if (targetProcess && typeof targetProcess.kill === 'function') {
      const isAlreadyExited = targetProcess.killed || targetProcess.exitCode !== null || targetProcess.signalCode !== null;
      if (!isAlreadyExited) {
        console.log(`⏱️ [Lifecycle:Phase 3] Awaiting Go process exit (Timeout: ${timeoutMs}ms)...`);
        const exitPromise = new Promise((resolve) => {
          const onExit = () => resolve({ clean: true });
          if (typeof targetProcess.once === 'function') {
            targetProcess.once('exit', onExit);
            targetProcess.once('close', onExit);
          } else {
            resolve({ clean: true });
          }
        });

        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => resolve({ clean: false }), timeoutMs);
        });

        const result = await Promise.race([exitPromise, timeoutPromise]);

        if (!result.clean) {
          console.warn(`⚠️ [Lifecycle:Phase 4] Go process did not exit within ${timeoutMs}ms. Escalating to SIGKILL!`);
          forced = true;
          try {
            targetProcess.kill('SIGKILL');
          } catch (fkErr) {
            console.warn('⚠️ [Lifecycle:Phase 4] SIGKILL escalation warning:', fkErr.message);
          }
        } else {
          console.log('✅ [Lifecycle:Phase 3] Go process exited gracefully.');
        }
      }
    }

    // Explicitly set process.exitCode: 0 on clean exit, 1 on forced escalation
    if (forced) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }

    const durationMs = Date.now() - startTime;
    console.log(`🏁 [Lifecycle:Phase 5] Teardown complete in ${durationMs}ms (Forced: ${forced}, ExitCode: ${process.exitCode}).`);

    // 5. Exit Electron
    if (options.skipAppExit !== true && electronApp && typeof electronApp.exit === 'function') {
      try {
        electronApp.exit(process.exitCode);
      } catch (_) {}
    }

    return {
      success: true,
      forced,
      exitCode: process.exitCode,
      durationMs
    };
  })();

  return activeShutdownPromise;
}

/**
 * Register lifecycle hooks (before-quit and window-all-closed) to ensure
 * clean shutdown and resolve the "stuck final tab" issue.
 * @param {Electron.App} app
 * @param {Object} [options]
 */
function registerLifecycleHooks(app, options = {}) {
  if (!app || typeof app.on !== 'function') return;
  if (isLifecycleHooked) return;
  isLifecycleHooked = true;

  let isHandlingQuit = false;

  app.on('before-quit', async (event) => {
    if (isHandlingQuit) return;
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    isHandlingQuit = true;
    try {
      await shutdownSequence({ ...options, app });
    } catch (err) {
      console.error('❌ [Lifecycle] Error in before-quit shutdown sequence:', err);
      process.exitCode = 1;
      if (typeof app.exit === 'function') app.exit(1);
    }
  });

  app.on('window-all-closed', async (event) => {
    // Resolve "stuck final tab" issue: trigger shutdown sequence when final window/tab closes
    if (isHandlingQuit) return;
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    isHandlingQuit = true;
    try {
      await shutdownSequence({ ...options, app });
    } catch (err) {
      console.error('❌ [Lifecycle] Error in window-all-closed shutdown sequence:', err);
      process.exitCode = 1;
      if (typeof app.exit === 'function') app.exit(1);
    }
  });
}

/**
 * Register renderer IPC request-shutdown handler.
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} [options]
 */
function registerLifecycleIpc(ipcMain, options = {}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') return;
  try {
    ipcMain.removeHandler('app:request-shutdown');
  } catch (_) {}
  ipcMain.handle('app:request-shutdown', async () => {
    console.log('📥 [IPC:app:request-shutdown] Renderer requested application shutdown');
    return await shutdownSequence(options);
  });
}

// Auto-register if Electron app is active
try {
  const { app, ipcMain } = require('electron');
  if (app && ipcMain) {
    const registerAll = () => {
      registerClipboardHandlers(ipcMain);
      registerOptimizedIpcHandlers(ipcMain);
      registerAudioBridgeIpc(ipcMain);
      registerResilientIpcHandlers(ipcMain);
      registerLifecycleIpc(ipcMain);
      registerLifecycleHooks(app);
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
  shutdownSequence,
  registerLifecycleHooks,
  registerLifecycleIpc,
  registerShutdownTargets,
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
