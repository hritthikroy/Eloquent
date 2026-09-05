/**
 * Secure Preload Script - Audio API Bridge
 * 
 * Exposes a strongly-typed, secure audio API (`window.audioAPI`) to the Electron
 * renderer process via contextBridge, enforcing strict context isolation and
 * whitelisting audio control channels.
 */

import { contextBridge, ipcRenderer } from 'electron';

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

export interface AudioStreamResponse {
  ok: boolean;
  status?: AudioStatus;
  parameters?: AudioParameters;
  message?: string;
  error?: string;
}

export interface AudioFrameData {
  frameId: number;
  timestampNs: number;
  sampleRate: number;
  channels: number;
  rms: number;
  peak: number;
  isSpeech: boolean;
  size: number;
}

export interface AudioError {
  type: string;
  message: string;
  timestamp: number;
}

export interface AudioAPI {
  play: (payload?: any) => Promise<any>;
  stop: () => Promise<any>;
  status: () => Promise<any>;
  startStream: (config?: Partial<AudioParameters>) => Promise<AudioStreamResponse>;
  stopStream: () => Promise<AudioStreamResponse>;
  updateParameters: (params: Partial<AudioParameters>) => Promise<AudioStreamResponse>;
  getStatus: () => Promise<AudioStatus>;
  getHealth: () => Promise<AudioHealth>;
  reconnect: () => Promise<boolean>;
  onStatusUpdate: (callback: (status: Partial<AudioStatus>) => void) => () => void;
  onStreamData: (callback: (data: AudioFrameData) => void) => () => void;
  onError: (callback: (error: AudioError) => void) => () => void;
  onDeviceChanged: (callback: (device: { inputDevice?: string; outputDevice?: string }) => void) => () => void;
}

export const audioAPI: AudioAPI = {
  play: (payload?: any) => {
    return ipcRenderer.invoke('audio:play', payload).catch((err) => {
      return Promise.reject(new Error(err && err.message ? err.message : 'Audio playback failed'));
    });
  },

  stop: () => {
    return ipcRenderer.invoke('audio:stop').catch((err) => {
      return Promise.reject(new Error(err && err.message ? err.message : 'Audio stop failed'));
    });
  },

  status: () => {
    return ipcRenderer.invoke('audio:status').catch((err) => {
      return Promise.reject(new Error(err && err.message ? err.message : 'Audio status check failed'));
    });
  },

  startStream: (config?: Partial<AudioParameters>) => {
    return ipcRenderer.invoke('audio:start-stream', config);
  },

  stopStream: () => {
    return ipcRenderer.invoke('audio:stop-stream');
  },

  updateParameters: (params: Partial<AudioParameters>) => {
    if (!params || typeof params !== 'object') {
      return Promise.reject(new Error('Audio parameters payload must be an object'));
    }
    return ipcRenderer.invoke('audio:update-parameters', params);
  },

  getStatus: () => {
    return ipcRenderer.invoke('audio:get-status');
  },

  getHealth: () => {
    return ipcRenderer.invoke('audio:get-health');
  },

  reconnect: () => {
    return ipcRenderer.invoke('audio:reconnect');
  },

  onStatusUpdate: (callback: (status: Partial<AudioStatus>) => void) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event: any, status: Partial<AudioStatus>) => callback(status);
    ipcRenderer.on('audio:status-update', subscription);
    return () => {
      ipcRenderer.removeListener('audio:status-update', subscription);
    };
  },

  onStreamData: (callback: (data: AudioFrameData) => void) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event: any, data: AudioFrameData) => callback(data);
    ipcRenderer.on('audio:stream-data', subscription);
    return () => {
      ipcRenderer.removeListener('audio:stream-data', subscription);
    };
  },

  onError: (callback: (error: AudioError) => void) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event: any, err: AudioError) => callback(err);
    ipcRenderer.on('audio:error', subscription);
    return () => {
      ipcRenderer.removeListener('audio:error', subscription);
    };
  },

  onDeviceChanged: (callback: (device: { inputDevice?: string; outputDevice?: string }) => void) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (_event: any, dev: any) => callback(dev);
    ipcRenderer.on('audio:device-changed', subscription);
    return () => {
      ipcRenderer.removeListener('audio:device-changed', subscription);
    };
  }
};

// Expose in isolated renderer context
try {
  contextBridge.exposeInMainWorld('audioAPI', audioAPI);
} catch {
  // If contextBridge is not available (e.g. running outside Electron runtime in unit tests), expose on window
  if (typeof window !== 'undefined') {
    (window as any).audioAPI = audioAPI;
  }
}

declare global {
  interface Window {
    audioAPI: AudioAPI;
  }
}
