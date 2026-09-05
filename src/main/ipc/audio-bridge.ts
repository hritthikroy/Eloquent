/**
 * Audio Bridge IPC Integration Layer
 * 
 * Bridges the Go audio backend with the Electron app shell, establishing a robust,
 * low-latency communication channel for real-time audio streaming, dynamic parameter
 * adjustments (volume, latency, effects), and automatic error recovery / process supervision.
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

export interface AudioParameters {
  volume: number;
  latencyTargetMs: number;
  bufferSize: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  vadSensitivity: number;
  sampleRate: number;
  channels: number;
  inputDevice?: string;
  outputDevice?: string;
}

export interface AudioStatus {
  status: string;
  ready: boolean;
  isStreaming: boolean;
  uptimeMs: number;
  activeClients: number;
  framesIngested: number;
  framesProcessed: number;
  framesDropped: number;
  bufferUnderruns: number;
  currentLatencyMs: number;
  parameters: AudioParameters;
  timestamp: number;
  version: string;
}

export interface AudioHealth {
  status: string;
  ready: boolean;
  isStreaming: boolean;
  uptimeMs: number;
  timestamp: number;
  version: string;
}

export interface AudioTransport {
  get: (endpoint: string) => Promise<any>;
  post: (endpoint: string, body: any) => Promise<any>;
  createStream?: (endpoint: string, onData: (chunk: string) => void) => { destroy: () => void };
}

export interface AudioBridgeOptions {
  port?: number;
  host?: string;
  spawnBackend?: boolean;
  backendBinaryPath?: string;
  backendSourceDir?: string;
  autoReconnect?: boolean;
  maxRestarts?: number;
  healthCheckIntervalMs?: number;
  webContentsProvider?: () => any[];
  customTransport?: AudioTransport;
}

export class AudioBridgeManager extends EventEmitter {
  private port: number;
  private host: string;
  private baseUrl: string;
  private spawnBackend: boolean;
  private backendBinaryPath: string | null;
  private backendSourceDir: string;
  private autoReconnect: boolean;
  private maxRestarts: number;
  private healthCheckIntervalMs: number;
  private webContentsProvider?: () => any[];
  private customTransport?: AudioTransport;

  private childProcess: ChildProcess | null = null;
  private isConnected: boolean = false;
  private isStreaming: boolean = false;
  private isDestroyed: boolean = false;
  private restartCount: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private streamRequest: http.ClientRequest | null = null;
  private streamSubscription: { destroy: () => void } | null = null;
  private cachedParameters: AudioParameters;

  constructor(options: AudioBridgeOptions = {}) {
    super();

    this.port = options.port || (process.env.AUDIO_PORT ? parseInt(process.env.AUDIO_PORT, 10) : 9090);
    this.host = options.host || '127.0.0.1';
    this.baseUrl = `http://${this.host}:${this.port}`;
    this.spawnBackend = options.spawnBackend ?? true;
    this.backendBinaryPath = options.backendBinaryPath || null;
    this.backendSourceDir = options.backendSourceDir || path.resolve(__dirname, '../../../backend-go');
    this.autoReconnect = options.autoReconnect ?? true;
    this.maxRestarts = options.maxRestarts || 5;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs || 2500;
    this.webContentsProvider = options.webContentsProvider;
    this.customTransport = options.customTransport;

    this.cachedParameters = {
      volume: 1.0,
      latencyTargetMs: 20,
      bufferSize: 1024,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      vadSensitivity: 0.7,
      sampleRate: 48000,
      channels: 1,
      inputDevice: 'default',
      outputDevice: 'default'
    };
  }

  /**
   * Boot the bridge manager: verifies or launches the Go backend process
   * and commences health tracking.
   */
  public async init(): Promise<boolean> {
    if (this.isDestroyed) return false;

    console.log(`🎙️ [AudioBridge] Initializing Go Audio Bridge at ${this.baseUrl}...`);

    // 1. Check if backend is already live on the target port
    const isLive = await this.pingHealth();
    if (isLive) {
      console.log(`✅ [AudioBridge] Existing Go backend detected and connected on ${this.baseUrl}`);
      this.isConnected = true;
      this.startHealthPolling();
      return true;
    }

    // 2. If not live and process spawning is enabled, spawn the Go backend
    if (this.spawnBackend) {
      await this.startBackendProcess();
      const ready = await this.waitForReadiness(8000);
      if (ready) {
        console.log(`🚀 [AudioBridge] Go backend successfully spawned and ready on ${this.baseUrl}`);
        this.isConnected = true;
        this.startHealthPolling();
        return true;
      } else {
        console.warn(`⚠️ [AudioBridge] Go backend spawned but failed readiness check within timeout`);
      }
    }

    this.startHealthPolling();
    return this.isConnected;
  }

  /**
   * Spawns the Go backend child process with auto-recovery.
   */
  private async startBackendProcess(): Promise<void> {
    if (this.childProcess) return;

    // Check for compiled binary first, fallback to `go run main.go`
    let command = 'go';
    let args = ['run', 'main.go'];
    let cwd = this.backendSourceDir;

    // Check custom binary or built executable
    const possibleBinaries = [
      this.backendBinaryPath,
      path.join(this.backendSourceDir, 'eloquent-backend'),
      path.resolve(__dirname, '../../../go-backend/main.go')
    ].filter(Boolean) as string[];

    let useBinary = false;
    for (const bin of possibleBinaries) {
      if (bin.endsWith('.go') && fs.existsSync(bin)) {
        command = 'go';
        args = ['run', path.basename(bin)];
        cwd = path.dirname(bin);
        break;
      } else if (fs.existsSync(bin)) {
        command = bin;
        args = [];
        cwd = path.dirname(bin);
        useBinary = true;
        break;
      }
    }

    console.log(`📦 [AudioBridge] Spawning Go backend: ${command} ${args.join(' ')} (cwd: ${cwd})`);

    try {
      this.childProcess = spawn(command, args, {
        cwd,
        env: {
          ...process.env,
          PORT: String(this.port),
          AUDIO_PORT: String(this.port),
          GIN_MODE: 'release'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.childProcess.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.log(`[GoBackend] ${line}`);
      });

      this.childProcess.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.error(`[GoBackend:ERR] ${line}`);
      });

      this.childProcess.on('error', (err: Error) => {
        console.error(`❌ [AudioBridge] Process spawn error: ${err.message}`);
        this.handleProcessFailure(err);
      });

      this.childProcess.on('exit', (code: number | null, signal: string | null) => {
        console.warn(`🛑 [AudioBridge] Go backend exited with code ${code}, signal ${signal}`);
        this.childProcess = null;
        this.isConnected = false;
        this.broadcast('audio:error', {
          type: 'crash',
          message: `Go backend exited unexpectedly (code: ${code}, signal: ${signal})`,
          timestamp: Date.now()
        });

        if (this.autoReconnect && !this.isDestroyed) {
          this.attemptRestart();
        }
      });
    } catch (err: any) {
      console.error(`❌ [AudioBridge] Failed to spawn Go backend: ${err.message}`);
    }
  }

  /**
   * Attempts exponential backoff restart of the backend process.
   */
  private attemptRestart(): void {
    if (this.restartCount >= this.maxRestarts) {
      console.error(`🚨 [AudioBridge] Max restart threshold (${this.maxRestarts}) reached. Halting auto-restart.`);
      return;
    }

    this.restartCount++;
    const delay = Math.min(1000 * Math.pow(1.5, this.restartCount), 10000);
    console.log(`🔄 [AudioBridge] Scheduling backend restart attempt ${this.restartCount}/${this.maxRestarts} in ${delay}ms...`);

    setTimeout(async () => {
      if (this.isDestroyed) return;
      await this.startBackendProcess();
      const ready = await this.waitForReadiness(6000);
      if (ready) {
        console.log(`🎉 [AudioBridge] Backend successfully recovered!`);
        this.isConnected = true;
        this.restartCount = 0;
        if (this.isStreaming) {
          this.startStream();
        }
      }
    }, delay);
  }

  private handleProcessFailure(error: Error): void {
    this.isConnected = false;
    this.emit('error', error);
    this.broadcast('audio:error', {
      type: 'connection_failure',
      message: error.message,
      timestamp: Date.now()
    });
  }

  /**
   * Polls health check until backend responds or timeout expires.
   */
  private async waitForReadiness(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.pingHealth()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }

  /**
   * Checks if backend is reachable and healthy.
   */
  public async pingHealth(): Promise<boolean> {
    try {
      const res = await this.getHealth();
      return res.status === 'ok' || res.ready === true;
    } catch {
      return false;
    }
  }

  /**
   * Fetches health check endpoint `/audio/health`.
   */
  public getHealth(): Promise<AudioHealth> {
    if (this.customTransport) {
      return this.customTransport.get('/audio/health');
    }

    return new Promise((resolve, reject) => {
      const req = http.get(`${this.baseUrl}/audio/health`, { timeout: 1500 }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              resolve(data);
            } catch (e: any) {
              reject(new Error(`Failed to parse health JSON: ${e.message}`));
            }
          } else {
            reject(new Error(`Health check returned HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Health check request timed out'));
      });
    });
  }

  /**
   * Fetches full audio engine status `/audio/status`.
   */
  public async getStatus(): Promise<AudioStatus> {
    if (this.customTransport) {
      const data = await this.customTransport.get('/audio/status');
      if (data && data.parameters) {
        this.cachedParameters = { ...this.cachedParameters, ...data.parameters };
      }
      return data;
    }

    return new Promise((resolve, reject) => {
      const req = http.get(`${this.baseUrl}/audio/status`, { timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              if (data.parameters) {
                this.cachedParameters = { ...this.cachedParameters, ...data.parameters };
              }
              resolve(data);
            } catch (e: any) {
              reject(new Error(`Failed to parse status JSON: ${e.message}`));
            }
          } else {
            reject(new Error(`Status check returned HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Status request timed out'));
      });
    });
  }

  /**
   * Starts audio streaming pipeline on the Go backend and subscribes to SSE stream.
   */
  public async startStream(config?: Partial<AudioParameters>): Promise<{ ok: boolean; status?: AudioStatus; error?: string }> {
    try {
      if (config) {
        await this.updateParameters(config);
      }

      await this.postJson('/audio/start', {});
      this.isStreaming = true;
      this.connectSSEStream();

      const status = await this.getStatus();
      this.broadcast('audio:status-update', status);
      return { ok: true, status };
    } catch (err: any) {
      console.error(`❌ [AudioBridge] Failed to start audio stream: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Stops audio streaming pipeline on the Go backend.
   */
  public async stopStream(): Promise<{ ok: boolean; status?: AudioStatus; error?: string }> {
    try {
      this.disconnectSSEStream();
      this.isStreaming = false;

      await this.postJson('/audio/stop', {});
      const status = await this.getStatus();
      this.broadcast('audio:status-update', status);
      return { ok: true, status };
    } catch (err: any) {
      console.error(`❌ [AudioBridge] Failed to stop audio stream: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Dispatches parameter updates to `/audio/parameters` without buffer underruns.
   */
  public async updateParameters(params: Partial<AudioParameters>): Promise<{ ok: boolean; parameters: AudioParameters; error?: string }> {
    try {
      const response = await this.postJson('/audio/parameters', params);
      const updated = response.parameters || { ...this.cachedParameters, ...params };
      this.cachedParameters = updated;

      this.broadcast('audio:status-update', {
        parameters: updated,
        timestamp: Date.now()
      });

      return { ok: true, parameters: updated };
    } catch (err: any) {
      console.error(`❌ [AudioBridge] Failed to update parameters: ${err.message}`);
      return { ok: false, parameters: this.cachedParameters, error: err.message };
    }
  }

  /**
   * Subscribes to real-time Server-Sent Events stream `/audio/stream`.
   */
  private connectSSEStream(): void {
    if (this.customTransport?.createStream) {
      this.streamSubscription = this.customTransport.createStream('/audio/stream', (chunk: string) => {
        try {
          const parsed = JSON.parse(chunk);
          this.broadcast('audio:stream-data', parsed);
          this.emit('stream-data', parsed);
        } catch {
          // ignore parsing error
        }
      });
      return;
    }

    if (this.streamRequest) {
      this.disconnectSSEStream();
    }

    try {
      const url = `${this.baseUrl}/audio/stream`;
      this.streamRequest = http.get(url, {
        headers: { Accept: 'text/event-stream' }
      }, (res) => {
        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const ev of events) {
            const line = ev.trim();
            if (line.startsWith('data:')) {
              const jsonStr = line.replace(/^data:\s*/, '');
              try {
                const parsed = JSON.parse(jsonStr);
                this.broadcast('audio:stream-data', parsed);
                this.emit('stream-data', parsed);
              } catch {
                // Ignore malformed heartbeats
              }
            }
          }
        });

        res.on('end', () => {
          if (this.isStreaming && !this.isDestroyed) {
            setTimeout(() => this.connectSSEStream(), 1000);
          }
        });
      });

      this.streamRequest.on('error', (err) => {
        console.warn(`[AudioBridge] SSE Stream error: ${err.message}`);
      });
    } catch (err: any) {
      console.warn(`[AudioBridge] SSE Stream connection failed: ${err.message}`);
    }
  }

  private disconnectSSEStream(): void {
    if (this.streamSubscription) {
      this.streamSubscription.destroy();
      this.streamSubscription = null;
    }
    if (this.streamRequest) {
      try {
        this.streamRequest.destroy();
      } catch {}
      this.streamRequest = null;
    }
  }

  /**
   * Health polling loop to keep renderer notified of state changes.
   */
  private startHealthPolling(): void {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);

    this.healthCheckTimer = setInterval(async () => {
      if (this.isDestroyed) return;

      try {
        const health = await this.getHealth();
        const wasConnected = this.isConnected;
        this.isConnected = health.ready || health.status === 'ok';

        if (!wasConnected && this.isConnected) {
          console.log(`✅ [AudioBridge] Reconnected to Go backend.`);
          this.broadcast('audio:status-update', { isHealthy: true, status: 'connected' });
        }
      } catch {
        if (this.isConnected) {
          console.warn(`⚠️ [AudioBridge] Lost connection to Go audio backend.`);
          this.isConnected = false;
          this.broadcast('audio:status-update', { isHealthy: false, status: 'disconnected' });
        }
      }
    }, this.healthCheckIntervalMs);

    if (this.healthCheckTimer.unref) {
      this.healthCheckTimer.unref();
    }
  }

  /**
   * Broadcasts payloads to all open BrowserWindow webContents.
   */
  private broadcast(channel: string, payload: any): void {
    if (!this.webContentsProvider) return;
    try {
      const windows = this.webContentsProvider();
      if (Array.isArray(windows)) {
        for (const win of windows) {
          if (win && win.webContents && !win.webContents.isDestroyed()) {
            win.webContents.send(channel, payload);
          }
        }
      }
    } catch (e: any) {
      console.warn(`[AudioBridge] Broadcast failed on ${channel}: ${e.message}`);
    }
  }

  /**
   * Helper to perform HTTP POST with JSON body.
   */
  private postJson(endpoint: string, body: any): Promise<any> {
    if (this.customTransport) {
      return this.customTransport.post(endpoint, body);
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body || {});
      const req = http.request(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 3000
      }, (res) => {
        let respBody = '';
        res.on('data', (chunk) => (respBody += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(respBody || '{}'));
            } catch {
              resolve({ ok: true });
            }
          } else {
            reject(new Error(`POST ${endpoint} returned HTTP ${res.statusCode}: ${respBody}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`POST ${endpoint} timed out`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Registers all IPC handlers onto Electron's ipcMain.
   */
  public registerIpcHandlers(ipcMain: any): { unregister: () => void } {
    if (!ipcMain || typeof ipcMain.handle !== 'function') {
      throw new Error('Invalid ipcMain instance provided to registerIpcHandlers');
    }

    // 1. Start Audio Stream
    ipcMain.handle('audio:start-stream', async (_event: any, config?: Partial<AudioParameters>) => {
      return this.startStream(config);
    });

    // 2. Stop Audio Stream
    ipcMain.handle('audio:stop-stream', async () => {
      return this.stopStream();
    });

    // 3. Update Audio Parameters
    ipcMain.handle('audio:update-parameters', async (_event: any, params: Partial<AudioParameters>) => {
      return this.updateParameters(params);
    });

    // 4. Get Audio Status
    ipcMain.handle('audio:get-status', async () => {
      return this.getStatus();
    });

    // 5. Get Audio Health
    ipcMain.handle('audio:get-health', async () => {
      return this.getHealth();
    });

    // 6. Manual Reconnect
    ipcMain.handle('audio:reconnect', async () => {
      return this.init();
    });

    console.log('✅ [AudioBridge] Audio IPC handlers registered successfully.');

    return {
      unregister: () => {
        ipcMain.removeHandler('audio:start-stream');
        ipcMain.removeHandler('audio:stop-stream');
        ipcMain.removeHandler('audio:update-parameters');
        ipcMain.removeHandler('audio:get-status');
        ipcMain.removeHandler('audio:get-health');
        ipcMain.removeHandler('audio:reconnect');
      }
    };
  }

  /**
   * Disposes the bridge manager, halts polling, and drains active processes.
   */
  public async close(): Promise<void> {
    this.isDestroyed = true;
    this.disconnectSSEStream();

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.childProcess) {
      try {
        this.childProcess.kill('SIGTERM');
      } catch {}
      this.childProcess = null;
    }

    this.isConnected = false;
    this.isStreaming = false;
  }
}
