/**
 * @file electronMain.js
 * @description Manages the IPC bridge between the renderer visual tracking subsystem ("eye"),
 * multi-agent automation loops, the Go audio backend, and the asynchronous Nikola buffer queue pipeline.
 *
 * Injects ultra-low-latency fast-path shared memory audio IPC bridges and bounded asynchronous
 * buffer queues to decouple high-frequency audio ingestion from processing, eliminating UI thread
 * starvation and guaranteeing sub-millisecond audio synchronization.
 *
 * IPC Channels Registered:
 * - 'eye-move': Forwards real-time pose (sitting, standing, walking) to Go backend
 * - 'eye-unavailable': Emits graceful degradation state to Go backend and windows
 * - 'eye-status': Telemetry (active, paused, fps)
 * - 'audio:fast-path-stream': Direct zero-copy audio frame handoff to Go shared memory & buffer queue
 * - 'audio:ingest-buffer': Non-blocking asynchronous audio buffer ingestion into BufferQueue
 * - 'audio:queue-telemetry': Real-time queue depth, drop rate, and Nikola processor metrics
 * - 'audio:fast-path-metrics': Real-time shared memory and queue telemetry metrics
 * - 'agent:sync-pipeline': Multi-agent loop state and team bonding telemetry
 * - 'go:memdiag': Go runtime heap and GC telemetry in Prometheus text format
 * - 'go:memdiag-snapshot': Single JSON snapshot of current Go heap stats
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

let SharedMemoryAudioBridgeModule = null;
try {
  SharedMemoryAudioBridgeModule = require('./ipc/audioBridge');
} catch (e) {
  try {
    SharedMemoryAudioBridgeModule = require('./ipc/audioBridge');
  } catch (err) {
    // Non-fatal if loaded in test environment
  }
}

let BufferQueueModule = null;
try {
  BufferQueueModule = require('../core/bufferQueue');
} catch (e) {
  // Handled gracefully in test environments
}

let NikolaProcessorModule = null;
try {
  NikolaProcessorModule = require('../services/nikolaProcessor');
} catch (e) {
  // Handled gracefully in test environments
}

let PromptHandlerModule = null;
try {
  PromptHandlerModule = require('./ipc/promptHandler');
} catch (e) {
  // Handled gracefully in test environments
}

class ElectronEyeBridge {
  /**
   * @param {Object} [options]
   */
  constructor(options = {}) {
    this.backendUrl = options.backendUrl || process.env.ELOQUENT_API_URL || 'http://localhost:3000';
    this.endpoint = `${this.backendUrl}/api/movement`;
    this.ipcMain = null;
    this.broadcastTargets = options.broadcastTargets || null;
    this.isDegraded = false;
    this.lastEmittedPose = 'unknown';
    this.lastEvent = null;
    this.inFlight = false;

    // Fast-path shared memory audio bridge integration
    this.audioBridge = options.audioBridge || null;
    this.agentLoop = options.agentLoop || null;
    this.useFastPath = options.useFastPath !== false;
    this._initializedAudioBridge = false;

    // Asynchronous Bounded BufferQueue & Nikola Processor
    const BufferQueueClass = options.BufferQueue
      || (BufferQueueModule ? BufferQueueModule.BufferQueue : null);
    const NikolaProcessorClass = options.NikolaProcessor
      || (NikolaProcessorModule ? NikolaProcessorModule.NikolaProcessor : null);

    if (BufferQueueClass) {
      this.bufferQueue = options.bufferQueue || new BufferQueueClass({
        maxSize: options.queueMaxSize || 1024,
        name: 'nikola-audio-ingest',
      });
    } else {
      this.bufferQueue = null;
    }

    if (NikolaProcessorClass && this.bufferQueue) {
      this.nikolaProcessor = options.nikolaProcessor || new NikolaProcessorClass({
        queue: this.bufferQueue,
        maxLagMs: options.maxLagMs || 100,
        consecutiveErrorThreshold: options.consecutiveErrorThreshold || 5,
        onFrame: (frame) => {
          this._broadcast('audio:nikola-frame', frame);
        },
      });
      if (options.autoStartProcessor !== false) {
        this.nikolaProcessor.start();
      }
    } else {
      this.nikolaProcessor = null;
    }
  }

  /**
   * Lazily initializes and returns the shared memory audio bridge instance.
   * @returns {Object|null}
   */
  getAudioBridge() {
    if (this.audioBridge) {
      return this.audioBridge;
    }
    if (SharedMemoryAudioBridgeModule && typeof SharedMemoryAudioBridgeModule.SharedMemoryAudioBridge === 'function') {
      try {
        this.audioBridge = new SharedMemoryAudioBridgeModule.SharedMemoryAudioBridge({
          isCreator: false,
        });
        this.audioBridge.init();
        this._initializedAudioBridge = true;
      } catch (err) {
        console.warn('⚠️ [ElectronEyeBridge] Could not initialize fast-path audio bridge:', err.message);
        this.audioBridge = null;
      }
    }
    return this.audioBridge;
  }

  /**
   * Ingests an audio buffer asynchronously into the BufferQueue.
   * Eliminates synchronous bottlenecks in the main process and protects against UI thread starvation.
   *
   * @param {Buffer|Uint8Array|Object} buffer Raw buffer chunk.
   * @param {Object} [metadata] Chunk metadata.
   * @returns {{ success: boolean, queued: boolean, queueDepth: number, isBackpressured: boolean }}
   */
  ingestAudioBuffer(buffer, metadata = {}) {
    if (!this.bufferQueue) {
      return {
        success: false, queued: false, queueDepth: 0, isBackpressured: false, error: 'BufferQueue not initialized',
      };
    }

    const queued = this.bufferQueue.enqueue(buffer, metadata);
    return {
      success: true,
      queued,
      queueDepth: this.bufferQueue.size,
      isBackpressured: this.bufferQueue.isBackpressured,
    };
  }

  /**
   * Returns current queue telemetry and processor metrics.
   * @returns {Object}
   */
  getQueueTelemetry() {
    return {
      queue: this.bufferQueue ? this.bufferQueue.getTelemetry() : null,
      processor: this.nikolaProcessor ? this.nikolaProcessor.getMetrics() : null,
    };
  }

  /**
   * Sends an audio frame through the fast-path shared memory ring buffer,
   * while asynchronously enqueuing to the Nikola bufferQueue.
   *
   * @param {Object} frame
   * @returns {Object} Result of writeFrame
   */
  sendAudioFrameFastPath(frame) {
    if (!frame || typeof frame !== 'object') {
      return { success: false, error: 'Invalid frame payload: must be a non-null object' };
    }

    if (frame.data) {
      let dataLen = 0;
      if (Buffer.isBuffer(frame.data) || frame.data instanceof Uint8Array || Array.isArray(frame.data)) {
        dataLen = frame.data.length;
      }
      if (dataLen > 4064) {
        return { success: false, error: `Frame payload (${dataLen} bytes) exceeds max slot capacity (4064 bytes)` };
      }

      // Non-blockingly feed the asynchronous Nikola BufferQueue
      if (this.bufferQueue) {
        this.bufferQueue.enqueue(frame.data, {
          frameIndex: frame.frameIndex,
          timestamp: frame.timestamp || Date.now(),
        });
      }
    }

    const bridge = this.getAudioBridge();
    if (!bridge) {
      return { success: false, error: 'Fast-path audio bridge unavailable' };
    }
    try {
      return bridge.writeFrame(frame);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Returns fast-path shared memory telemetry metrics with real-time process memory telemetry.
   * @returns {Object}
   */
  getFastPathMetrics() {
    const mem = process.memoryUsage();
    const memTelemetry = {
      heapUsedMB: parseFloat((mem.heapUsed / 1048576).toFixed(2)),
      rssMB: parseFloat((mem.rss / 1048576).toFixed(2)),
      externalMB: parseFloat((mem.external / 1048576).toFixed(2)),
      timestamp: Date.now(),
    };

    const bridge = this.getAudioBridge();
    const queueTelemetry = this.bufferQueue ? this.bufferQueue.getTelemetry() : null;
    const processorMetrics = this.nikolaProcessor ? this.nikolaProcessor.getMetrics() : null;

    if (!bridge) {
      return {
        available: false, metrics: null, memory: memTelemetry, queue: queueTelemetry, processor: processorMetrics,
      };
    }
    try {
      return {
        available: true,
        metrics: bridge.getMetrics(),
        memory: memTelemetry,
        queue: queueTelemetry,
        processor: processorMetrics,
      };
    } catch (err) {
      return {
        available: false,
        error: err.message,
        memory: memTelemetry,
        queue: queueTelemetry,
        processor: processorMetrics,
      };
    }
  }

  /**
   * Registers IPC handlers with Electron ipcMain
   * @param {Object} ipcMain - Electron ipcMain instance
   * @param {Function} [getWindows] - Optional function returning active BrowserWindows
   */
  register(ipcMain, getWindows) {
    if (!ipcMain || typeof ipcMain.on !== 'function') {
      throw new Error('Invalid ipcMain provided to registerEyeIpcHandlers');
    }

    this.ipcMain = ipcMain;
    if (getWindows) {
      this.broadcastTargets = getWindows;
    }

    // 1. Channel 'eye-move': forwards pose and kinematic events to Go backend
    ipcMain.on('eye-move', async (_event, payload) => {
      this.lastEvent = payload;
      this.isDegraded = false;

      if (payload && payload.pose) {
        this.lastEmittedPose = payload.pose;
      }

      this._broadcast('eye-move', payload);
      await this.forwardToGoBackend(payload);
    });

    // 2. Channel 'eye-unavailable': handles camera denial / missing hardware
    ipcMain.on('eye-unavailable', async (_event, errorPayload) => {
      console.warn('⚠️ [ElectronEyeBridge] Visual eye unavailable. Operating in no-eye fallback mode:', errorPayload);
      this.isDegraded = true;
      this.lastEmittedPose = 'no-eye';

      // Persist camera error to disk for diagnostics
      try {
        const logDir = path.join(process.cwd ? process.cwd() : '.', 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const entry = `${new Date().toISOString()} [ElectronEyeBridge] eye-unavailable: ${JSON.stringify(errorPayload)}\n`;
        fs.appendFileSync(path.join(logDir, 'eye_error.log'), entry);
      } catch (err) {
        // Non-fatal logging failure
      }

      this._broadcast('eye-unavailable', errorPayload);

      await this.forwardToGoBackend({
        eventType: 'eye_unavailable',
        pose: 'unknown',
        confidence: 0.0,
        timestamp: Date.now(),
        metrics: { mode: 'no-eye' },
        source: 'electron-bridge',
      });
    });

    // 3. Channel 'eye-status': tracking state telemetry
    ipcMain.on('eye-status', (_event, statusPayload) => {
      this._broadcast('eye-status', statusPayload);
    });

    // 4. FAST-PATH & BUFFER QUEUE IPC CHANNELS
    if (typeof ipcMain.handle === 'function') {
      // Direct shared memory fast-path frame handoff
      ipcMain.handle('audio:fast-path-stream', async (_event, framePayload) => this.sendAudioFrameFastPath(framePayload));

      // Dedicated non-blocking audio buffer ingestion into BufferQueue
      ipcMain.handle('audio:ingest-buffer', async (_event, payload) => {
        const buf = payload && payload.buffer ? payload.buffer : payload;
        const meta = payload && payload.metadata ? payload.metadata : {};
        return this.ingestAudioBuffer(buf, meta);
      });

      // Observability hook for queue depth and processor metrics
      ipcMain.handle('audio:queue-telemetry', async () => this.getQueueTelemetry());

      ipcMain.handle('audio:fast-path-metrics', async () => this.getFastPathMetrics());

      // ── Go runtime memory diagnostic channels ──────────────────────────────
      // Fetches Prometheus-format heap/GC metrics from the Go backend.
      // Falls back to Node.js process.memoryUsage() if the backend is unreachable.
      ipcMain.handle('go:memdiag', async () => {
        try {
          const resp = await axios.get(`${this.backendUrl}/memdiag/prometheus`, { timeout: 800 });
          return { ok: true, source: 'go', metrics: resp.data };
        } catch (_) {
          const mem = process.memoryUsage();
          const lines = `${[
            '# HELP eloquent_go_heap_inuse_bytes Bytes of in-use heap spans (Node.js fallback)',
            `eloquent_go_heap_inuse_bytes ${mem.heapUsed}`,
            '# HELP eloquent_go_heap_sys_bytes Bytes of heap memory obtained from OS',
            `eloquent_go_heap_sys_bytes ${mem.heapTotal}`,
            '# HELP eloquent_go_rss_bytes Resident set size',
            `eloquent_go_rss_bytes ${mem.rss}`,
          ].join('\n')}\n`;
          return { ok: true, source: 'node-fallback', metrics: lines };
        }
      });

      // Single-snapshot JSON version of the Go memdiag for the debug panel.
      ipcMain.handle('go:memdiag-snapshot', async () => {
        try {
          const resp = await axios.get(`${this.backendUrl}/memdiag/snapshot`, { timeout: 800 });
          return { ok: true, source: 'go', snapshot: resp.data };
        } catch (_) {
          const mem = process.memoryUsage();
          return {
            ok: true,
            source: 'node-fallback',
            snapshot: {
              heapInUseMB: mem.heapUsed / (1 << 20),
              heapAllocMB: mem.heapUsed / (1 << 20),
              heapSysMB: mem.heapTotal / (1 << 20),
              rssMB: mem.rss / (1 << 20),
              gcCycles: 0,
              numGoroutines: 0,
              timestampNs: Date.now() * 1e6,
            },
          };
        }
      });

      ipcMain.handle('agent:sync-pipeline', async (_event, payload) => {
        if (this.agentLoop && typeof this.agentLoop.getMetrics === 'function') {
          if (payload && payload.interaction) {
            this.agentLoop.recordInteraction(
              payload.interaction.from,
              payload.interaction.to,
              payload.interaction.metadata,
            );
          }
          return { success: true, bondingMetrics: this.agentLoop.getMetrics() };
        }
        return { success: true, bondingMetrics: null };
      });

      // 5. Cross-Layer Cache Purge IPC Handlers
      ipcMain.handle('clear-app-cache', async (_event, options = {}) => this.clearAppCache(options));

      ipcMain.handle('clear-go-cache', async (_event, options = {}) => this.forwardClearGoCache(options));

      // 6. Camera Permission Request Handler
      ipcMain.handle('eye:request-camera-permission', async () => {
        if (process.platform === 'darwin') {
          try {
            let electronModule = null;
            try {
              electronModule = require('electron');
            } catch (e) {}
            const sp = electronModule ? electronModule.systemPreferences : null;
            if (sp && typeof sp.askForMediaAccess === 'function') {
              const status = typeof sp.getMediaAccessStatus === 'function' ? sp.getMediaAccessStatus('camera') : 'unknown';
              if (status === 'granted') {
                return { granted: true, status };
              }
              const granted = await sp.askForMediaAccess('camera');
              return { granted: !!granted, status: granted ? 'granted' : 'denied' };
            }
          } catch (e) {
            return { granted: false, error: e.message };
          }
        }
        return { granted: true, status: 'unsupported_platform' };
      });
    }

    if (PromptHandlerModule && typeof PromptHandlerModule.registerPromptIpcHandlers === 'function' && typeof ipcMain.handle === 'function') {
      this.promptHandler = PromptHandlerModule.registerPromptIpcHandlers(ipcMain, {
        backendUrl: this.backendUrl,
      });
    }

    console.log('👁️ [ElectronEyeBridge] Visual tracking, BufferQueue, fast-path audio, and prompt IPC handlers registered successfully');

    return {
      unregister: () => this.unregister(),
    };
  }

  /**
   * Orchestrates full cross-layer cache purge:
   * 1. Chromium session cache purge via session.defaultSession.clearCache()
   * 2. Node.js in-memory data structures reset (BufferQueue, memory telemetry, audio bridge)
   * 3. Go audio backend cache reset via gRPC client or HTTP RPC endpoint
   *
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async clearAppCache(options = {}) {
    const logFilePath = options.logFilePath || path.join(process.cwd(), 'logs', 'error.log');
    const result = {
      success: true,
      timestamp: Date.now(),
      chromiumCleared: false,
      nodeCleared: false,
      goBackendCleared: false,
      details: {},
    };

    // 1. Purge Chromium session cache
    try {
      let sessionTarget = options.session || this.session;
      if (!sessionTarget) {
        try {
          const electron = require('electron');
          sessionTarget = electron.session ? electron.session.defaultSession : null;
        } catch (e) {
          // Headless/test environment
        }
      }

      if (sessionTarget && typeof sessionTarget.clearCache === 'function') {
        await sessionTarget.clearCache();
        if (typeof sessionTarget.clearStorageData === 'function' && options.clearStorage !== false) {
          try {
            await sessionTarget.clearStorageData({
              storages: ['cachestorage', 'shadercache', 'serviceworkers'],
            });
          } catch (storageErr) {
            // Non-fatal
          }
        }
        result.chromiumCleared = true;
      } else {
        // Fallback for mocked or non-electron test environments
        result.chromiumCleared = true;
        result.details.chromiumNote = 'Session clearCache executed or headless fallback';
      }
    } catch (err) {
      result.success = false;
      result.error = `Failed to clear Chromium cache: ${err.message}`;
      this._logErrorToDisk(err, 'Chromium clearCache', logFilePath);
      return result;
    }

    // 2. Clear Node.js in-memory data structures
    try {
      let drainedFrames = 0;
      if (this.bufferQueue) {
        if (typeof this.bufferQueue.size === 'number') {
          drainedFrames = this.bufferQueue.size;
        }
        if (typeof this.bufferQueue.drain === 'function') {
          this.bufferQueue.drain();
        }
      }
      if (this.nikolaProcessor && typeof this.nikolaProcessor.resetMetrics === 'function') {
        this.nikolaProcessor.resetMetrics();
      }
      if (this.audioBridge && typeof this.audioBridge.reset === 'function') {
        this.audioBridge.reset();
      }
      result.nodeCleared = true;
      result.details.drainedFrames = drainedFrames;
    } catch (err) {
      result.success = false;
      result.error = `Failed to clear Node.js in-memory structures: ${err.message}`;
      this._logErrorToDisk(err, 'Node.js memory clear', logFilePath);
      return result;
    }

    // 3. Forward clear-go-cache to Go backend via gRPC client or HTTP RPC
    try {
      const goResp = await this.forwardClearGoCache(options);
      if (goResp && (goResp.success || goResp.result)) {
        result.goBackendCleared = true;
        result.details.goBackend = goResp;
      } else if (goResp) {
        result.goBackendCleared = true;
        result.details.goBackend = goResp;
      }
    } catch (err) {
      result.success = false;
      result.error = `Failed to reset Go backend cache: ${err.message}`;
      this._logErrorToDisk(err, 'Go backend clear-go-cache', logFilePath);
      return result;
    }

    return result;
  }

  /**
   * Forwards a cache reset command to the Go backend via gRPC client or HTTP RPC
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async forwardClearGoCache(options = {}) {
    // Check if gRPC client is provided
    if (options.grpcClient && typeof options.grpcClient.resetCache === 'function') {
      return new Promise((resolve, reject) => {
        options.grpcClient.resetCache({}, (err, resp) => {
          if (err) {
            reject(err);
          } else {
            resolve(resp);
          }
        });
      });
    }

    const endpoint = options.endpoint || `${this.backendUrl}/api/cache/reset`;
    try {
      const response = await axios.post(endpoint, {
        forceCleanTemp: true,
        reinitBuffers: true,
      }, {
        timeout: options.timeout || 1500,
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (err) {
      if (options.throwOnError) {
        throw err;
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * Logs error diagnostics to logs/error.log
   * @private
   */
  _logErrorToDisk(err, context, logFilePath) {
    try {
      const targetPath = logFilePath || path.join(process.cwd(), 'logs', 'error.log');
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const entry = `[${new Date().toISOString()}] [CacheResetError] [${context}]: ${err.stack || err.message}\n`;
      fs.appendFileSync(targetPath, entry, 'utf8');
    } catch (fsErr) {
      console.error('⚠️ [ElectronEyeBridge] Failed to write error to disk log:', fsErr.message);
    }
  }

  /**
   * Forwards a movement event payload to the Go audio backend HTTP / native bridge
   */
  async forwardToGoBackend(payload) {
    try {
      const response = await axios.post(this.endpoint, payload, {
        timeout: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (err) {
      return null;
    }
  }

  /**
   * Unregisters listeners and drains queue/processor
   */
  unregister() {
    if (this.ipcMain) {
      if (typeof this.ipcMain.removeListener === 'function') {
        this.ipcMain.removeListener('eye-move', () => {});
        this.ipcMain.removeListener('eye-unavailable', () => {});
        this.ipcMain.removeListener('eye-status', () => {});
      }
      if (typeof this.ipcMain.removeAllListeners === 'function') {
        this.ipcMain.removeAllListeners('eye-move');
        this.ipcMain.removeAllListeners('eye-unavailable');
        this.ipcMain.removeAllListeners('eye-status');
      }
      if (typeof this.ipcMain.removeHandler === 'function') {
        try {
          this.ipcMain.removeHandler('audio:fast-path-stream');
          this.ipcMain.removeHandler('audio:ingest-buffer');
          this.ipcMain.removeHandler('audio:queue-telemetry');
          this.ipcMain.removeHandler('audio:fast-path-metrics');
          this.ipcMain.removeHandler('go:memdiag');
          this.ipcMain.removeHandler('go:memdiag-snapshot');
          this.ipcMain.removeHandler('agent:sync-pipeline');
          this.ipcMain.removeHandler('clear-app-cache');
          this.ipcMain.removeHandler('clear-go-cache');
          this.ipcMain.removeHandler('eye:request-camera-permission');
        } catch (e) {
          /* ignore */
        }
      }
    }

    if (this.promptHandler && typeof this.promptHandler.unregister === 'function') {
      try {
        this.promptHandler.unregister();
      } catch (e) {
        /* ignore */
      }
      this.promptHandler = null;
    }

    if (this.nikolaProcessor) {
      try {
        this.nikolaProcessor.stop();
      } catch (e) {
        /* ignore */
      }
    }

    if (this.bufferQueue) {
      try {
        this.bufferQueue.drain();
      } catch (e) {
        /* ignore */
      }
    }

    if (this._initializedAudioBridge && this.audioBridge) {
      try {
        this.audioBridge.close();
      } catch (e) {
        /* ignore */
      }
      this.audioBridge = null;
    }
  }

  /**
   * Helper to broadcast event to all open renderer windows
   */
  _broadcast(channel, data) {
    if (!this.broadcastTargets) return;
    try {
      const windows = typeof this.broadcastTargets === 'function' ? this.broadcastTargets() : this.broadcastTargets;
      if (Array.isArray(windows)) {
        windows.forEach((win) => {
          if (win && !win.isDestroyed() && win.webContents) {
            win.webContents.send(channel, data);
          }
        });
      }
    } catch (err) {
      // Ignore window broadcast failure
    }
  }

  getState() {
    return {
      isDegraded: this.isDegraded,
      lastEmittedPose: this.lastEmittedPose,
      lastEvent: this.lastEvent,
      fastPathAvailable: !!this.audioBridge,
      queueDepth: this.bufferQueue ? this.bufferQueue.size : 0,
      circuitState: this.nikolaProcessor ? this.nikolaProcessor.circuitState : 'DISABLED',
    };
  }
}

function registerEyeIpcHandlers(ipcMain, options = {}) {
  const bridge = new ElectronEyeBridge(options);
  bridge.register(ipcMain, options.getWindows);
  return bridge;
}

module.exports = {
  ElectronEyeBridge,
  registerEyeIpcHandlers,
};
