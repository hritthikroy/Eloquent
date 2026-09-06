/**
 * Analytics Bridge - Main Process WebSocket & Event Batching Layer
 * 
 * Bridges the Electron frontend and the Go audio backend:
 * - Maintains a persistent bidirectional WebSocket connection to the Go anomaly detector.
 * - Handles exponential backoff reconnection with jitter.
 * - Batches user interaction events and audio latency samples into memory queues with drop-oldest bounds.
 * - Ingests and routes real-time AnomalyAlert events from Go to Electron renderer windows via IPC.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  AnalyticsBridgeConfig,
  AnomalyAlert,
  AudioLatencySample,
  UserInteractionEvent,
} from '../shared/types/metrics';

// Safe dynamic access to Electron to allow unit testing in non-Electron Node environments
let electronIpcMain: any = null;
let electronBrowserWindow: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron = require('electron');
  electronIpcMain = electron.ipcMain;
  electronBrowserWindow = electron.BrowserWindow;
} catch {
  // Running in standalone Node test environment
}

export interface AnalyticsBridgeState {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  interactionQueueLength: number;
  latencyQueueLength: number;
  totalAlertsReceived: number;
  wsUrl: string;
}

export class AnalyticsBridge extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private isDestroyed: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;

  private interactionQueue: UserInteractionEvent[] = [];
  private latencyQueue: AudioLatencySample[] = [];
  private alertHistory: AnomalyAlert[] = [];
  private totalAlertsReceived: number = 0;

  private config: Required<AnalyticsBridgeConfig>;
  private ipcRegistered: boolean = false;

  constructor(options: AnalyticsBridgeConfig = {}) {
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

    this.startPeriodicFlush();
    this.registerIpcHandlers();
  }

  /**
   * Initializes and opens the WebSocket connection to the Go backend.
   */
  public connect(): void {
    if (this.isDestroyed || this.isConnected || this.isConnecting) {
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

        // Flush any buffered items accumulated while disconnected
        this.flush();
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleIncomingMessage(data);
      });

      this.ws.on('error', (err: Error) => {
        this.emit('error', err);
        // Error triggers close handler next
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isConnecting = false;
        this.ws = null;

        this.emit('disconnected', {
          code,
          reason: reason.toString(),
          wasConnected,
        });

        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      });
    } catch (err: any) {
      this.isConnecting = false;
      this.emit('error', err);
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Schedules a reconnection attempt using exponential backoff with jitter.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isDestroyed) {
      return;
    }

    const { reconnectInitialDelayMs, reconnectMaxDelayMs, reconnectMultiplier } = this.config;
    const baseDelay = Math.min(
      reconnectMaxDelayMs,
      reconnectInitialDelayMs * Math.pow(reconnectMultiplier, this.reconnectAttempts)
    );
    // Add 10-25% random jitter to avoid thundering herd on backend restarts
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

  /**
   * Tracks a user interaction event (clicks, step transitions, dwell, backtracks).
   * Buffers the event with memory bounds and flushes when batchSize is met.
   */
  public trackInteraction(event: UserInteractionEvent): void {
    if (this.isDestroyed) return;

    // Enforce memory bounds - drop oldest events if queue is saturated
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

  /**
   * Reports an audio processing latency sample from the audio engine.
   */
  public reportAudioLatency(sample: AudioLatencySample): void {
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

  /**
   * Flushes all queued interaction events and latency samples to the Go backend.
   */
  public flush(): boolean {
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
    } catch (err: any) {
      this.emit('flush_error', err);
      return false;
    }
  }

  /**
   * Handles incoming WebSocket messages, specifically AnomalyAlert broadcasts from Go.
   */
  private handleIncomingMessage(rawData: WebSocket.RawData): void {
    try {
      const parsed = JSON.parse(rawData.toString());

      if (parsed.type === 'anomaly_alert' && parsed.payload) {
        const alert: AnomalyAlert = parsed.payload;
        this.totalAlertsReceived++;

        // Maintain bounded alert history
        if (this.alertHistory.length >= 100) {
          this.alertHistory.shift();
        }
        this.alertHistory.push(alert);

        // Emit local event
        this.emit('anomaly_alert', alert);

        // Broadcast to all active Electron renderer windows
        this.broadcastToRenderers('analytics:anomaly-alert', alert);
      }
    } catch (err: any) {
      this.emit('parse_error', { error: err.message, raw: rawData.toString() });
    }
  }

  /**
   * Safely broadcasts an event to all open Electron BrowserWindow webContents.
   */
  private broadcastToRenderers(channel: string, data: any): void {
    if (!electronBrowserWindow) return;
    try {
      const windows = electronBrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed() && win.webContents) {
          win.webContents.send(channel, data);
        }
      }
    } catch (err) {
      // Ignore broadcast errors during app shutdown
    }
  }

  /**
   * Starts the background interval timer to flush batches periodically.
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Registers IPC handlers for Electron renderer interaction tracking and status queries.
   */
  private registerIpcHandlers(): void {
    if (!electronIpcMain || this.ipcRegistered) return;

    electronIpcMain.handle('analytics:track-event', (_: any, eventData: UserInteractionEvent) => {
      this.trackInteraction(eventData);
      return { ok: true, queued: true };
    });

    electronIpcMain.handle('analytics:report-latency', (_: any, sampleData: AudioLatencySample) => {
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

  /**
   * Returns current internal state and queue telemetry.
   */
  public getState(): AnalyticsBridgeState {
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

  /**
   * Returns the recorded alert history.
   */
  public getAlertHistory(): AnomalyAlert[] {
    return [...this.alertHistory];
  }

  /**
   * Closes connections, clears timers, and frees resources.
   */
  public destroy(): void {
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

// Global Singleton Instance
let globalBridge: AnalyticsBridge | null = null;

export function getAnalyticsBridge(config?: AnalyticsBridgeConfig): AnalyticsBridge {
  if (!globalBridge) {
    globalBridge = new AnalyticsBridge(config);
  }
  return globalBridge;
}

export function resetAnalyticsBridge(): void {
  if (globalBridge) {
    globalBridge.destroy();
    globalBridge = null;
  }
}

export default AnalyticsBridge;
