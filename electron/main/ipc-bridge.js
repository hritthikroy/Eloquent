/**
 * electron/main/ipc-bridge.js
 *
 * Secure Bidirectional IPC Channel between Electron Renderer/Main and Go Audio Backend.
 *
 * Provides:
 * - Zero-latency handoff of audio PCM buffers ('audio:stream-frame', 'audio:send-chunk').
 * - High-speed intent signal dispatching ('intent:resolved') directly to the execution layer.
 * - Explicit error handling and automated exponential-backoff reconnection on socket/process drops.
 * - Graceful backpressure queueing to avoid frame starvation during transient disconnects.
 * - Headless-friendly execution with Electron ipcMain fallback.
 */

const { EventEmitter } = require('events');
const net = require('net');

let electron = null;
try {
  electron = require('electron');
} catch (_) {
  // Headless test environment
}

const AUDIO_IPC_CHANNELS = Object.freeze({
  STREAM_FRAME: 'audio:stream-frame',
  SEND_CHUNK: 'audio:send-chunk',
  STATUS: 'audio:status',
  INTENT_RESOLVED: 'intent:resolved',
  ERROR: 'audio:error',
  DISCONNECTED: 'audio:disconnected',
  RECONNECT: 'audio:reconnect',
});

class AudioIpcBridge extends EventEmitter {
  /**
   * @param {Object} options
   * @param {number} [options.port=9092] - Socket port for Go backend
   * @param {string} [options.host='127.0.0.1'] - Host address
   * @param {number} [options.maxQueueSize=100] - Backpressure queue limit
   * @param {number} [options.reconnectIntervalMs=1000] - Initial reconnect delay
   * @param {number} [options.maxReconnectAttempts=10] - Max retry count
   * @param {Function} [options.webContentsProvider] - Function returning array of webContents
   */
  constructor(options = {}) {
    super();
    this.port = options.port || (process.env.AUDIO_PORT ? parseInt(process.env.AUDIO_PORT, 10) : 9092);
    this.host = options.host || '127.0.0.1';
    this.maxQueueSize = options.maxQueueSize || 128;
    this.reconnectIntervalMs = options.reconnectIntervalMs || 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.webContentsProvider = options.webContentsProvider || null;

    this.socket = null;
    this.isConnected = false;
    this.isDestroyed = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.bufferQueue = [];
    this.registeredIpcChannels = [];

    this.lastStatus = {
      status: 'idle',
      connected: false,
      queuedFrames: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Initializes the IPC bridge, registers Electron ipcMain listeners,
   * and initiates connection to the Go backend.
   */
  init() {
    this.registerElectronIpc();
    this.connect();
    return this;
  }

  /**
   * Registers bidirectional Electron ipcMain handlers if Electron is available.
   */
  registerElectronIpc() {
    if (!electron || !electron.ipcMain) {
      return;
    }

    const { ipcMain } = electron;

    const frameHandler = (event, chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : (chunk && chunk.data ? Buffer.from(chunk.data) : null);
      if (buf) {
        this.sendAudioFrame(buf);
      }
    };

    ipcMain.on(AUDIO_IPC_CHANNELS.STREAM_FRAME, frameHandler);
    ipcMain.on(AUDIO_IPC_CHANNELS.SEND_CHUNK, frameHandler);

    this.registeredIpcChannels.push(
      { channel: AUDIO_IPC_CHANNELS.STREAM_FRAME, handler: frameHandler },
      { channel: AUDIO_IPC_CHANNELS.SEND_CHUNK, handler: frameHandler }
    );
  }

  /**
   * Establishes a TCP stream socket connection to the Go audio processing backend.
   */
  connect() {
    if (this.isDestroyed || this.isConnected || this.socket) {
      return;
    }

    try {
      this.socket = net.createConnection({ port: this.port, host: this.host }, () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateStatus('ok', { connected: true });
        this.emit(AUDIO_IPC_CHANNELS.STATUS, this.lastStatus);

        // Flush backpressure buffer queue with zero latency
        this.flushBufferQueue();
      });

      let incomingChunks = '';

      this.socket.on('data', (chunk) => {
        incomingChunks += chunk.toString('utf8');
        const lines = incomingChunks.split('\n');
        incomingChunks = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            this.handleIncomingData(trimmed);
          }
        }
      });

      this.socket.on('error', (err) => {
        this.handleConnectionDrop(err);
      });

      this.socket.on('close', () => {
        if (this.isConnected) {
          this.handleConnectionDrop(new Error('Go audio backend socket closed'));
        }
      });
    } catch (err) {
      this.handleConnectionDrop(err);
    }
  }

  /**
   * Parses incoming JSON from the Go audio backend and routes intent signals.
   * @param {string} rawJson
   */
  handleIncomingData(rawJson) {
    try {
      const parsed = JSON.parse(rawJson);

      // Handle structured intent emissions
      if (parsed && (parsed.action || parsed.type === 'technical_task' || parsed.type === 'intent')) {
        this.handleIntentSignal(parsed);
      } else if (parsed && parsed.status) {
        this.updateStatus(parsed.status, parsed);
        this.broadcast(AUDIO_IPC_CHANNELS.STATUS, parsed);
      }
    } catch (err) {
      this.emit(AUDIO_IPC_CHANNELS.ERROR, {
        message: `Failed to parse Go backend payload: ${err.message}`,
        raw: rawJson,
      });
    }
  }

  /**
   * Dispatches resolved intent directly to event listeners and Electron renderer.
   * @param {Object} intent
   */
  handleIntentSignal(intent) {
    const payload = {
      ...intent,
      receivedAt: Date.now(),
      bypassLLM: intent.bypass_llm ?? intent.bypassLLM ?? true,
    };

    this.emit(AUDIO_IPC_CHANNELS.INTENT_RESOLVED, payload);
    this.broadcast(AUDIO_IPC_CHANNELS.INTENT_RESOLVED, payload);
  }

  /**
   * Hands off raw audio PCM buffer to the Go backend with zero latency.
   * If socket is temporarily disconnected, safely buffers frame.
   * @param {Buffer} buffer
   */
  sendAudioFrame(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return false;
    }

    if (this.isConnected && this.socket && !this.socket.destroyed) {
      return this.socket.write(buffer);
    }

    // Queue frame up to limit during transient reconnect
    if (this.bufferQueue.length < this.maxQueueSize) {
      this.bufferQueue.push(buffer);
      this.lastStatus.queuedFrames = this.bufferQueue.length;
      return true;
    }

    return false;
  }

  /**
   * Flushes queued audio buffers once connection is established.
   */
  flushBufferQueue() {
    if (!this.isConnected || !this.socket || this.socket.destroyed) {
      return;
    }

    while (this.bufferQueue.length > 0) {
      const chunk = this.bufferQueue.shift();
      if (chunk) {
        this.socket.write(chunk);
      }
    }
    this.lastStatus.queuedFrames = 0;
  }

  /**
   * Handles socket disconnects or process errors with exponential backoff retry.
   * @param {Error} err
   */
  handleConnectionDrop(err) {
    const wasConnected = this.isConnected;
    this.isConnected = false;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }

    this.updateStatus('error', {
      connected: false,
      error: err ? err.message : 'Connection dropped',
    });

    this.emit(AUDIO_IPC_CHANNELS.ERROR, {
      message: err ? err.message : 'Audio bridge connection dropped',
      reconnectAttempts: this.reconnectAttempts,
    });

    if (wasConnected) {
      this.emit(AUDIO_IPC_CHANNELS.DISCONNECTED, { timestamp: Date.now() });
      this.broadcast(AUDIO_IPC_CHANNELS.DISCONNECTED, { timestamp: Date.now() });
    }

    this.scheduleReconnect();
  }

  /**
   * Schedules automated reconnection with exponential backoff.
   */
  scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit(AUDIO_IPC_CHANNELS.ERROR, {
        message: `Max reconnect attempts (${this.maxReconnectAttempts}) exceeded for Go audio backend`,
      });
      return;
    }

    const delay = Math.min(this.reconnectIntervalMs * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed && !this.isConnected) {
        this.emit(AUDIO_IPC_CHANNELS.RECONNECT, { attempt: this.reconnectAttempts });
        this.connect();
      }
    }, delay);
  }

  /**
   * Broadcasts events to all active Electron renderer windows.
   * @param {string} channel
   * @param {Object} data
   */
  broadcast(channel, data) {
    if (typeof this.webContentsProvider === 'function') {
      try {
        const contentsList = this.webContentsProvider();
        if (Array.isArray(contentsList)) {
          for (const wc of contentsList) {
            if (wc && !wc.isDestroyed()) {
              wc.send(channel, data);
            }
          }
        }
      } catch (_) {}
    } else if (electron && electron.BrowserWindow) {
      try {
        const windows = electron.BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (win && win.webContents && !win.webContents.isDestroyed()) {
            win.webContents.send(channel, data);
          }
        }
      } catch (_) {}
    }
  }

  /**
   * Updates internal status snapshot.
   */
  updateStatus(status, details = {}) {
    this.lastStatus = {
      ...this.lastStatus,
      ...details,
      status,
      timestamp: Date.now(),
    };
  }

  /**
   * Cleanly destroys the bridge, closing sockets and unregistering IPC handlers.
   */
  destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }

    if (electron && electron.ipcMain) {
      for (const { channel, handler } of this.registeredIpcChannels) {
        electron.ipcMain.removeListener(channel, handler);
      }
      this.registeredIpcChannels = [];
    }

    this.bufferQueue = [];
    this.removeAllListeners();
  }
}

module.exports = {
  AUDIO_IPC_CHANNELS,
  AudioIpcBridge,
};
