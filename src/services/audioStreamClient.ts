/**
 * AudioStreamClient
 *
 * Node.js / Electron client connecting to the Go audio-service daemon via
 * Server-Sent Events (SSE) and HTTP Ingest.
 */

import { EventEmitter } from 'events';
import * as http from 'http';

export interface ProcessedAudioFrame {
  data?: string | number[];
  size: number;
  rms: number;
  peak: number;
  isSpeech: boolean;
  isSilence: boolean;
  isUnderflow: boolean;
  isRecycled: boolean;
  timestampNs: number;
}

export interface AudioServiceHealth {
  state: string;
  uptimeMs: number;
  framesIngested: number;
  dropRate: number;
  bridgeHealthy: boolean;
  lastErrorMs: number;
  isHealthy: boolean;
}

export interface AudioStreamClientOptions {
  baseUrl?: string;
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
  maxReconnectIntervalMs?: number;
  requestTimeoutMs?: number;
}

export class AudioStreamClient extends EventEmitter {
  private baseUrl: string;
  private autoReconnect: boolean;
  private reconnectIntervalMs: number;
  private maxReconnectIntervalMs: number;
  private requestTimeoutMs: number;

  private isConnected: boolean = false;
  private isDestroyed: boolean = false;
  private currentReconnectDelay: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private activeRequest: http.ClientRequest | null = null;
  private activeResponse: http.IncomingMessage | null = null;

  constructor(options: AudioStreamClientOptions = {}) {
    super();
    this.baseUrl = options.baseUrl || 'http://127.0.0.1:9090';
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectIntervalMs = options.reconnectIntervalMs || 1000;
    this.maxReconnectIntervalMs = options.maxReconnectIntervalMs || 10000;
    this.requestTimeoutMs = options.requestTimeoutMs || 3000;
    this.currentReconnectDelay = this.reconnectIntervalMs;
  }

  public connect(): void {
    if (this.isDestroyed || this.isConnected) return;

    try {
      const url = new URL('/audio/stream', this.baseUrl);
      const req = http.get(url.toString(), (res) => {
        this.activeResponse = res;

        if (res.statusCode !== 200) {
          this.handleDisconnect(new Error(`Server returned status code ${res.statusCode}`));
          return;
        }

        this.isConnected = true;
        this.currentReconnectDelay = this.reconnectIntervalMs;
        this.emit('connected');

        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            const trimmed = block.trim();
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.replace(/^data:\s*/, '');
              try {
                const frame: ProcessedAudioFrame = JSON.parse(jsonStr);
                this.emit('frame', frame);
                if (frame.isSpeech) {
                  this.emit('speech', frame);
                }
              } catch (_) {}
            }
          }
        });

        res.on('end', () => {
          this.handleDisconnect(new Error('SSE stream ended by remote peer'));
        });

        res.on('error', (err) => {
          this.handleDisconnect(err);
        });
      });

      req.on('error', (err) => {
        this.handleDisconnect(err);
      });

      this.activeRequest = req;
    } catch (err: any) {
      this.handleDisconnect(err);
    }
  }

  public async ingestPCM(data: Buffer | Uint8Array): Promise<boolean> {
    if (this.isDestroyed || data.length === 0) return false;

    return new Promise((resolve) => {
      try {
        const url = new URL('/audio/ingest', this.baseUrl);
        const req = http.request(
          url.toString(),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': data.length,
            },
            timeout: this.requestTimeoutMs,
          },
          (res) => {
            resolve(res.statusCode === 200);
            res.resume();
          }
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.write(data);
        req.end();
      } catch (_) {
        resolve(false);
      }
    });
  }

  public async getHealth(): Promise<AudioServiceHealth | null> {
    return new Promise((resolve) => {
      try {
        const url = new URL('/audio/status', this.baseUrl);
        const req = http.get(url.toString(), { timeout: this.requestTimeoutMs }, (res) => {
          if (res.statusCode !== 200) {
            resolve(null);
            res.resume();
            return;
          }

          let raw = '';
          res.on('data', (c) => (raw += c.toString('utf8')));
          res.on('end', () => {
            try {
              const body = JSON.parse(raw);
              resolve(body.health || null);
            } catch (_) {
              resolve(null);
            }
          });
        });

        req.on('error', () => resolve(null));
      } catch (_) {
        resolve(null);
      }
    });
  }

  public async getPrometheusMetrics(): Promise<string> {
    return new Promise((resolve) => {
      try {
        const url = new URL('/audio/metrics/prometheus', this.baseUrl);
        const req = http.get(url.toString(), { timeout: this.requestTimeoutMs }, (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c.toString('utf8')));
          res.on('end', () => resolve(raw));
        });
        req.on('error', () => resolve(''));
      } catch (_) {
        resolve('');
      }
    });
  }

  private handleDisconnect(err: Error): void {
    if (!this.isConnected && this.reconnectTimer) return;

    this.isConnected = false;
    this.emit('disconnected', err);

    if (this.autoReconnect && !this.isDestroyed) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.currentReconnectDelay = Math.min(
          this.currentReconnectDelay * 1.5,
          this.maxReconnectIntervalMs
        );
        this.connect();
      }, this.currentReconnectDelay);
    }
  }

  public disconnect(): void {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.activeResponse) {
      this.activeResponse.destroy();
      this.activeResponse = null;
    }
    if (this.activeRequest) {
      this.activeRequest.destroy();
      this.activeRequest = null;
    }
    this.isConnected = false;
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.removeAllListeners();
  }
}
