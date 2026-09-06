/**
 * Analytics Bridge - Main Process WebSocket & Event Batching Layer (CommonJS companion)
 *
 * Bridges the Electron frontend and the Go audio backend:
 * - Maintains a persistent bidirectional WebSocket connection to the Go anomaly detector.
 * - Handles exponential backoff reconnection with jitter.
 * - Batches user interaction events and audio latency samples into memory queues with drop-oldest bounds.
 * - Ingests and routes real-time AnomalyAlert events from Go to Electron renderer windows via IPC.
 */

const { EventEmitter } = require('events');
let WebSocket = null;
try {
  WebSocket = require('ws');
} catch (e) {
  // Graceful fallback
}

let electronIpcMain = null;
let electronBrowserWindow = null;
try {
  const electron = require('electron');
  electronIpcMain = electron.ipcMain;
  electronBrowserWindow = electron.BrowserWindow;
} catch {
  // Running in standalone Node test environment
}

class AnalyticsBridge extends EventEmitter {
  constructor(options = {}) {
    super();

    const host = options.host || '127.0.0.1';
    const port = options.port || (process.env.ANALYTICS_PORT ? parseInt(process.env.ANALYTICS_PORT, 10) : 9095);
    const defaultWsUrl = options.wsUrl || `ws://${host}:${port}/analytics/ws`;

    this.config = {
      wsUrl: defaultWsUrl,
      host,
      port,
      batchSize: options.batchSize || 10,
      flushIntervalMs: options.flushIntervalMs || 1000,
      maxQueueCapacity: options.maxQueueCapacity || 1000,
      reconnectInitialDelayMs: options.reconnectInitialDelayMs || 500,
      reconnectMaxDelayMs: options.reconnectMaxDelayMs || 10000,
      reconnectMultiplier: options.reconnectMultiplier || 1.5,
    };

    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isDestroyed = false;
    this.reconnectTimer = null;
    this.flushTimer = null;
    this.reconnectAttempts = 0;

    this.interactionQueue = [];
    this.latencyQueue = [];
    this.alertHistory = [];
    this.totalAlertsReceived = 0;
    this.ipcRegistered = false;

    this.startPeriodicFlush();
    this.registerIpcHandlers();
  }

  connect() {
    if (this.isDestroyed || this.isConnected || this.isConnecting || !WebSocket) {
      return;
    }

    this.isConnecting = true;
    this.emit('connecting', { url: this.config.wsUrl, attempt: this.reconnectAttempts });

    try {
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected', { url: this.config.wsUrl });
        this.flush();
      });

      this.ws.on('message', (data) => {
        this.handleIncomingMessage(data);
      });

      this.ws.on('error', (err) => {
        this.emit('error', err);
      });

      this.ws.on('close', (code, reason) => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isConnecting = false;
        this.ws = null;

        this.emit('disconnected', {
          code,
          reason: reason ? reason.toString() : '',
          wasConnected,
        });

        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      });
    } catch (err) {
      this.isConnecting = false;
      this.emit('error', err);
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.isDestroyed) {
      return;
    }

    const { reconnectInitialDelayMs, reconnectMaxDelayMs, reconnectMultiplier } = this.config;
    const baseDelay = Math.min(
      reconnectMaxDelayMs,
      reconnectInitialDelayMs * Math.pow(reconnectMultiplier, this.reconnectAttempts)
    );
    const jitter = baseDelay * (0.1 + Math.random() * 0.15);
    const delay = Math.round(baseDelay + jitter);

    this.reconnectAttempts++;
    this.emit('reconnect_scheduled', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  trackInteraction(event) {
    if (this.isDestroyed) return;

    if (this.interactionQueue.length >= this.config.maxQueueCapacity) {
      this.interactionQueue.shift();
      this.emit('queue_saturated', { type: 'interaction' });
    }

    this.interactionQueue.push({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });

    this.emit('interaction_queued', event);

    if (this.interactionQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  reportAudioLatency(sample) {
    if (this.isDestroyed) return;

    if (this.latencyQueue.length >= this.config.maxQueueCapacity) {
      this.latencyQueue.shift();
      this.emit('queue_saturated', { type: 'latency' });
    }

    this.latencyQueue.push({
      ...sample,
      timestamp: sample.timestamp || Date.now(),
    });

    this.emit('latency_queued', sample);

    if (this.latencyQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  flush() {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    if (this.interactionQueue.length === 0 && this.latencyQueue.length === 0) {
      return true;
    }

    const payload = {
      type: 'interaction_batch',
      timestamp: Date.now(),
      userEvents: [...this.interactionQueue],
      latencySamples: [...this.latencyQueue],
    };

    try {
      this.ws.send(JSON.stringify(payload));
      const flushedInteractions = this.interactionQueue.length;
      const flushedLatency = this.latencyQueue.length;

      this.interactionQueue = [];
      this.latencyQueue = [];

      this.emit('flushed', {
        interactions: flushedInteractions,
        latencySamples: flushedLatency,
      });
      return true;
    } catch (err) {
      this.emit('flush_error', err);
      return false;
    }
  }

  handleIncomingMessage(rawData) {
    try {
      const parsed = JSON.parse(rawData.toString());

      if (parsed.type === 'anomaly_alert' && parsed.payload) {
        const alert = parsed.payload;
        this.totalAlertsReceived++;

        if (this.alertHistory.length >= 100) {
          this.alertHistory.shift();
        }
        this.alertHistory.push(alert);

        this.emit('anomaly_alert', alert);
        this.broadcastToRenderers('analytics:anomaly-alert', alert);
      }
    } catch (err) {
      this.emit('parse_error', { error: err.message, raw: rawData.toString() });
    }
  }

  broadcastToRenderers(channel, data) {
    if (!electronBrowserWindow) return;
    try {
      const windows = electronBrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed() && win.webContents) {
          win.webContents.send(channel, data);
        }
      }
    } catch {
      // Ignore broadcast errors during app shutdown
    }
  }

  startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  registerIpcHandlers() {
    if (!electronIpcMain || this.ipcRegistered) return;

    electronIpcMain.handle('analytics:track-event', (_, eventData) => {
      this.trackInteraction(eventData);
      return { ok: true, queued: true };
    });

    electronIpcMain.handle('analytics:report-latency', (_, sampleData) => {
      this.reportAudioLatency(sampleData);
      return { ok: true, queued: true };
    });

    electronIpcMain.handle('analytics:get-status', () => {
      return this.getState();
    });

    electronIpcMain.handle('analytics:get-alerts', () => {
      return this.getAlertHistory();
    });

    this.ipcRegistered = true;
  }

  getState() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      interactionQueueLength: this.interactionQueue.length,
      latencyQueueLength: this.latencyQueue.length,
      totalAlertsReceived: this.totalAlertsReceived,
      wsUrl: this.config.wsUrl,
    };
  }

  getAlertHistory() {
    return [...this.alertHistory];
  }

  destroy() {
    this.isDestroyed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.interactionQueue = [];
    this.latencyQueue = [];
    this.removeAllListeners();
  }
}

let globalBridge = null;

function getAnalyticsBridge(config) {
  if (!globalBridge) {
    globalBridge = new AnalyticsBridge(config);
  }
  return globalBridge;
}

function resetAnalyticsBridge() {
  if (globalBridge) {
    globalBridge.destroy();
    globalBridge = null;
  }
}

module.exports = {
  AnalyticsBridge,
  getAnalyticsBridge,
  resetAnalyticsBridge,
};
