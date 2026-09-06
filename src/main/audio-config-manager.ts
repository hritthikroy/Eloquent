/**
 * src/main/audio-config-manager.ts
 *
 * Audio Configuration Manager for Eloquent Electron.
 * Manages local persistence, schema validation, default fallbacks,
 * and real-time IPC propagation to the Go audio backend.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { AudioBackendConfig, AudioConfigResponse } from '../shared/types';

export const DEFAULT_AUDIO_CONFIG: AudioBackendConfig = {
  sampleRate: 48000,
  bufferSize: 1024,
  outputDevice: 'default',
  channels: 1,
  volume: 1.0
};

export class AudioConfigManager {
  private static instance: AudioConfigManager;
  private configPath: string;
  private currentConfig: AudioBackendConfig;
  private backendUrl: string;

  private constructor() {
    let userDataDir = path.join(process.cwd(), 'userData', 'config');
    try {
      const geminiDir = path.join(os.homedir(), '.gemini', 'antigravity', 'config');
      if (!fs.existsSync(geminiDir)) {
        fs.mkdirSync(geminiDir, { recursive: true });
      }
      userDataDir = geminiDir;
    } catch (e) {
      try {
        if (!fs.existsSync(userDataDir)) {
          fs.mkdirSync(userDataDir, { recursive: true });
        }
      } catch (err2) {}
    }

    this.configPath = path.join(userDataDir, 'audio-config.json');
    this.backendUrl = process.env.AUDIO_SERVER_URL || 'http://localhost:9092';
    this.currentConfig = this.loadConfig();
  }

  public static getInstance(): AudioConfigManager {
    if (!AudioConfigManager.instance) {
      AudioConfigManager.instance = new AudioConfigManager();
    }
    return AudioConfigManager.instance;
  }

  /**
   * Validates an AudioBackendConfig payload against schema specifications.
   */
  public validateConfig(config: any): { valid: boolean; error?: string } {
    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'Config payload must be a non-null object' };
    }

    const { sampleRate, bufferSize, outputDevice } = config;

    const allowedSampleRates = [8000, 16000, 22050, 44100, 48000, 96000];
    if (typeof sampleRate !== 'number' || !allowedSampleRates.includes(sampleRate)) {
      return { valid: false, error: `Invalid sampleRate: ${sampleRate}. Allowed values: ${allowedSampleRates.join(', ')}` };
    }

    if (typeof bufferSize !== 'number' || bufferSize < 64 || bufferSize > 8192) {
      return { valid: false, error: `Invalid bufferSize: ${bufferSize}. Must be between 64 and 8192.` };
    }

    if (typeof outputDevice !== 'string' || !outputDevice.trim()) {
      return { valid: false, error: 'Output device must be a non-empty string' };
    }

    return { valid: true };
  }

  /**
   * Retrieves current active configuration, falling back gracefully to defaults.
   */
  public getConfig(): AudioBackendConfig {
    return { ...this.currentConfig };
  }

  /**
   * Persists, validates, and propagates configuration updates to the Go backend.
   */
  public async setConfig(newConfig: Partial<AudioBackendConfig>): Promise<AudioConfigResponse> {
    const mergedConfig: AudioBackendConfig = {
      ...this.currentConfig,
      ...newConfig,
      sampleRate: Number(newConfig.sampleRate || this.currentConfig.sampleRate),
      bufferSize: Number(newConfig.bufferSize || this.currentConfig.bufferSize),
      outputDevice: String(newConfig.outputDevice || this.currentConfig.outputDevice)
    };

    const validation = this.validateConfig(mergedConfig);
    if (!validation.valid) {
      console.error(`❌ [AudioConfigManager] Schema validation rejected payload: ${validation.error}`);
      return {
        success: false,
        config: this.currentConfig,
        error: validation.error
      };
    }

    this.currentConfig = mergedConfig;
    this.saveConfig(mergedConfig);

    // Propagate to Go backend via HTTP POST asynchronously
    this.propagateToGoBackend(mergedConfig).catch(err => {
      console.warn(`⚠️ [AudioConfigManager] Notice: Go backend propagation offline or pending: ${err.message}`);
    });

    return {
      success: true,
      config: this.currentConfig
    };
  }

  /**
   * Resets audio configuration to default parameters.
   */
  public async resetToDefaults(): Promise<AudioConfigResponse> {
    return this.setConfig(DEFAULT_AUDIO_CONFIG);
  }

  private loadConfig(): AudioBackendConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (this.validateConfig(parsed).valid) {
          return parsed;
        }
      }
    } catch (err) {}
    return { ...DEFAULT_AUDIO_CONFIG };
  }

  private saveConfig(config: AudioBackendConfig): void {
    try {
      const parentDir = path.dirname(this.configPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (err) {
      console.error('❌ [AudioConfigManager] Failed to save config to local store:', err);
    }
  }

  private async propagateToGoBackend(config: AudioBackendConfig): Promise<void> {
    try {
      await axios.post(`${this.backendUrl}/audio/config`, config, { timeout: 1500 });
    } catch (err: any) {
      // Graceful fallback for offline Go backend
    }
  }
}

export const audioConfigManager = AudioConfigManager.getInstance();
