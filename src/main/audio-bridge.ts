/**
 * Ambient Audio Bridge - Main Process & IPC Handler Layer
 *
 * Implements the "Cozy High" ambient mode IPC integration:
 * - Spawns or communicates with the Go audio backend (bin/audio-server)
 * - Initiates and controls the soft lo-fi loop stream
 * - Gracefully handles missing Go audio binaries with static UI fallback without crashing
 * - Broadcasts audio:state events to the renderer shell for CSS theme synchronization
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

export interface AmbientAudioState {
  isPlaying: boolean;
  ambientMode: string | null;
  theme?: string;
  volume: number;
  available: boolean;
  error?: string;
  pid?: number;
  timestamp: number;
}

export interface AmbientAudioTransport {
  get: (endpoint: string) => Promise<any>;
  post: (endpoint: string, body: any) => Promise<any>;
}

export interface AmbientAudioOptions {
  mode?: string;
  volume?: number;
  binaryPath?: string;
  port?: number;
  host?: string;
  webContentsProvider?: () => any[];
  customTransport?: AmbientAudioTransport;
}

export class AmbientAudioBridge extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private isPlaying: boolean = false;
  private currentMode: string | null = null;
  private currentVolume: number = 0.8;
  private port: number;
  private host: string;
  private binaryPath: string;
  private webContentsProvider?: () => any[];
  private customTransport?: AmbientAudioTransport;
  private isDestroyed: boolean = false;

  constructor(options: AmbientAudioOptions = {}) {
    super();
    this.port = options.port || (process.env.AUDIO_PORT ? parseInt(process.env.AUDIO_PORT, 10) : 9092);
    this.host = options.host || '127.0.0.1';
    this.webContentsProvider = options.webContentsProvider;
    this.customTransport = options.customTransport;

    // Resolve binary path candidates
    const rootDir = this.findRootDir();
    this.binaryPath = options.binaryPath || path.join(rootDir, 'bin/audio-server');
  }

  private findRootDir(): string {
    let current = __dirname;
    for (let i = 0; i < 5; i++) {
      if (fs.existsSync(path.join(current, 'package.json'))) {
        return current;
      }
      current = path.dirname(current);
    }
    return process.cwd();
  }

  /**
   * Check whether the Go audio-server binary is present on the filesystem.
   */
  public isBinaryAvailable(): boolean {
    if (!this.binaryPath) return false;
    try {
      return fs.existsSync(this.binaryPath);
    } catch {
      return false;
    }
  }

  /**
   * Query the Go backend health endpoint.
   */
  public async pingHealth(): Promise<boolean> {
    if (this.customTransport) {
      try {
        const res = await this.customTransport.get('/health');
        return Boolean(res && (res.status === 'ok' || res.ready));
      } catch {
        return false;
      }
    }
    return new Promise((resolve) => {
      const req = http.get(`http://${this.host}:${this.port}/health`, { timeout: 1000 }, (res) => {
        resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300));
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Spawns the Go audio server child process if not already live.
   */
  public async ensureServerRunning(): Promise<boolean> {
    if (await this.pingHealth()) {
      return true;
    }

    if (!this.isBinaryAvailable()) {
      console.warn(`⚠️ [AmbientBridge] Audio binary not found at ${this.binaryPath}. Falling back to UI-only mode.`);
      return false;
    }

    if (this.childProcess) {
      return true;
    }

    return new Promise((resolve) => {
      try {
        console.log(`🚀 [AmbientBridge] Spawning Go audio backend from: ${this.binaryPath}`);
        this.childProcess = spawn(this.binaryPath, ['--port', String(this.port)], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            AUDIO_PORT: String(this.port),
            PORT: String(this.port)
          }
        });

        this.childProcess.on('error', (err) => {
          console.error(`❌ [AmbientBridge] Failed to spawn audio binary: ${err.message}`);
          this.childProcess = null;
          resolve(false);
        });

        this.childProcess.on('exit', (code, signal) => {
          console.warn(`🛑 [AmbientBridge] Go audio server exited (code: ${code}, signal: ${signal})`);
          this.childProcess = null;
          this.isPlaying = false;
          this.broadcastState({
            isPlaying: false,
            ambientMode: null,
            volume: this.currentVolume,
            available: this.isBinaryAvailable(),
            timestamp: Date.now()
          });
        });

        // Poll for readiness
        let attempts = 0;
        const check = setInterval(async () => {
          attempts++;
          const live = await this.pingHealth();
          if (live || attempts > 15) {
            clearInterval(check);
            resolve(live);
          }
        }, 150);
      } catch (err: any) {
        console.error(`❌ [AmbientBridge] Exception while launching audio server: ${err?.message}`);
        this.childProcess = null;
        resolve(false);
      }
    });
  }

  /**
   * Initiates the Cozy High lo-fi loop playback.
   */
  public async playAmbient(options: { mode?: string; volume?: number } = {}): Promise<{
    success: boolean;
    isPlaying: boolean;
    available: boolean;
    mode: string;
    volume: number;
    error?: string;
  }> {
    const mode = options.mode || 'cozy-high';
    const volume = typeof options.volume === 'number' ? options.volume : 0.8;
    this.currentMode = mode;
    this.currentVolume = volume;

    // Verify binary availability
    const binaryPresent = this.isBinaryAvailable();
    if (!binaryPresent) {
      const fallbackState: AmbientAudioState = {
        isPlaying: false,
        ambientMode: mode,
        theme: 'warm-earthy',
        volume,
        available: false,
        error: 'Audio backend binary unavailable — Visual cozy mode active',
        timestamp: Date.now()
      };
      this.broadcastState(fallbackState);
      return {
        success: false,
        isPlaying: false,
        available: false,
        mode,
        volume,
        error: 'Audio binary not found at ' + this.binaryPath
      };
    }

    const running = await this.ensureServerRunning();
    if (!running) {
      const fallbackState: AmbientAudioState = {
        isPlaying: false,
        ambientMode: mode,
        theme: 'warm-earthy',
        volume,
        available: false,
        error: 'Failed to connect to audio backend server',
        timestamp: Date.now()
      };
      this.broadcastState(fallbackState);
      return {
        success: false,
        isPlaying: false,
        available: false,
        mode,
        volume,
        error: 'Failed to start audio server'
      };
    }

    // Dispatch HTTP POST to /audio/ambient
    try {
      await this.postJson('/audio/ambient', {
        action: 'start',
        mode,
        volume
      });

      this.isPlaying = true;
      const state: AmbientAudioState = {
        isPlaying: true,
        ambientMode: mode,
        theme: 'warm-earthy',
        volume,
        available: true,
        pid: this.childProcess?.pid,
        timestamp: Date.now()
      };

      this.broadcastState(state);
      this.emit('state-changed', state);

      return {
        success: true,
        isPlaying: true,
        available: true,
        mode,
        volume
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to dispatch start request to audio server';
      console.error(`❌ [AmbientBridge] ${errorMsg}`);
      return {
        success: false,
        isPlaying: false,
        available: true,
        mode,
        volume,
        error: errorMsg
      };
    }
  }

  /**
   * Halts the ambient lo-fi loop playback.
   */
  public async stopAmbient(): Promise<{ success: boolean; isPlaying: boolean }> {
    this.isPlaying = false;
    this.currentMode = null;

    try {
      await this.postJson('/audio/ambient', { action: 'stop' });
    } catch (_) {
      // Ignored if server stopped or unreachable
    }

    const state: AmbientAudioState = {
      isPlaying: false,
      ambientMode: null,
      volume: this.currentVolume,
      available: this.isBinaryAvailable(),
      timestamp: Date.now()
    };

    this.broadcastState(state);
    this.emit('state-changed', state);

    return { success: true, isPlaying: false };
  }

  /**
   * Broadcasts the current state across all active BrowserWindow instances.
   */
  public broadcastState(state: AmbientAudioState): void {
    if (!this.webContentsProvider) return;
    try {
      const windows = this.webContentsProvider();
      if (Array.isArray(windows)) {
        for (const win of windows) {
          if (win && win.webContents && !win.webContents.isDestroyed()) {
            win.webContents.send('audio:state', state);
          }
        }
      }
    } catch (e: any) {
      console.warn(`[AmbientBridge] Broadcast failed: ${e?.message}`);
    }
  }

  private postJson(endpoint: string, body: any): Promise<any> {
    if (this.customTransport) {
      return this.customTransport.post(endpoint, body);
    }
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body || {});
      const req = http.request(
        `http://${this.host}:${this.port}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          timeout: 2500
        },
        (res) => {
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
              reject(new Error(`POST ${endpoint} failed with HTTP ${res.statusCode}: ${respBody}`));
            }
          });
        }
      );

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
   * Cleanly terminate spawned processes and listeners.
   */
  public async terminate(): Promise<void> {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    await this.stopAmbient();

    if (this.childProcess) {
      try {
        this.childProcess.kill('SIGTERM');
      } catch {}
      this.childProcess = null;
    }
  }
}

// Global singleton instance
let defaultAmbientBridge: AmbientAudioBridge | null = null;

export function getAmbientAudioBridge(options?: AmbientAudioOptions): AmbientAudioBridge {
  if (!defaultAmbientBridge) {
    defaultAmbientBridge = new AmbientAudioBridge(options);
  }
  return defaultAmbientBridge;
}

/**
 * Register the ambient audio IPC handlers onto Electron's ipcMain.
 */
export function registerAmbientIpc(
  ipcMain: any,
  options: AmbientAudioOptions = {}
): { unregister: () => void; bridge: AmbientAudioBridge } {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new Error('Invalid ipcMain provided to registerAmbientIpc');
  }

  const bridge = getAmbientAudioBridge(options);

  // 1. audio:play-ambient
  try { ipcMain.removeHandler('audio:play-ambient'); } catch (_) {}
  ipcMain.handle('audio:play-ambient', async (_event: any, payload?: any) => {
    return bridge.playAmbient(payload || {});
  });

  // 2. audio:stop-ambient
  try { ipcMain.removeHandler('audio:stop-ambient'); } catch (_) {}
  ipcMain.handle('audio:stop-ambient', async () => {
    return bridge.stopAmbient();
  });

  // 3. audio:ambient-state
  try { ipcMain.removeHandler('audio:ambient-state'); } catch (_) {}
  ipcMain.handle('audio:ambient-state', async () => {
    return {
      available: bridge.isBinaryAvailable(),
      live: await bridge.pingHealth()
    };
  });

  return {
    bridge,
    unregister: () => {
      try { ipcMain.removeHandler('audio:play-ambient'); } catch (_) {}
      try { ipcMain.removeHandler('audio:stop-ambient'); } catch (_) {}
      try { ipcMain.removeHandler('audio:ambient-state'); } catch (_) {}
    }
  };
}

export default AmbientAudioBridge;
