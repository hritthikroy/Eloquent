/**
 * Preload Script TypeScript Module for Secure IPC & Lifecycle Communication
 *
 * Exposes window.electronAPI.forceTeardown() and system diagnostic channels,
 * ensuring seamless mapping between renderer APIs and main process IPC handlers.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { AudioChunk, AudioStatus, AUDIO_IPC_CHANNELS } from '../shared/types';

export const CLIPBOARD_CHANNELS = {
  COPY: 'clipboard:copy',
  PASTE: 'clipboard:paste',
  READ_TEXT: 'clipboard:read-text',
  WRITE_TEXT: 'clipboard:write-text',
  WRITE_HTML: 'clipboard:write-html',
  CLEAR: 'clipboard:clear',
} as const;

export const LIFECYCLE_CHANNELS = {
  SHUTDOWN: 'app:request-shutdown',
  FORCE_TEARDOWN: 'app:force-teardown',
  PREPARE_SHUTDOWN: 'app:prepare-shutdown',
} as const;

// 1. Expose secure clipboard API
contextBridge.exposeInMainWorld('clipboard', {
  copy: (payload: any) => {
    const safePayload = typeof payload === 'string' ? { text: payload } : (payload || {});
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.COPY, safePayload);
  },
  paste: () => ipcRenderer.invoke(CLIPBOARD_CHANNELS.PASTE),
  readText: () => ipcRenderer.invoke(CLIPBOARD_CHANNELS.READ_TEXT),
  writeText: (text: string) => {
    const safeText = text === null || text === undefined ? '' : String(text);
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.WRITE_TEXT, safeText);
  },
  writeHTML: (html: string, plainText: string = '') => {
    return ipcRenderer.invoke(CLIPBOARD_CHANNELS.WRITE_HTML, { html, text: plainText });
  },
  clear: () => ipcRenderer.invoke(CLIPBOARD_CHANNELS.CLEAR),
});

// 2. Expose lifecycle management APIs
contextBridge.exposeInMainWorld('lifecycle', {
  requestShutdown: (payload: any = {}) => {
    return ipcRenderer.invoke(LIFECYCLE_CHANNELS.SHUTDOWN, payload);
  },
  forceTeardown: () => {
    return ipcRenderer.invoke(LIFECYCLE_CHANNELS.FORCE_TEARDOWN);
  },
  onPrepareShutdown: (callback: (data: any) => void) => {
    if (typeof callback === 'function') {
      ipcRenderer.on(LIFECYCLE_CHANNELS.PREPARE_SHUTDOWN, (_event, data) => callback(data));
    }
  },
});

// 3. Expose dedicated system diagnostics API
contextBridge.exposeInMainWorld('systemDiagnostics', {
  heartbeat: (payload: any = {}) => ipcRenderer.invoke('ipc:heartbeat', payload),
  getDeviceStatus: () => ipcRenderer.invoke('audio:device-status'),
  reportDeviceDisconnect: (details: any = {}) => ipcRenderer.invoke('audio:report-device-disconnect', details),
  reportDeviceReconnect: (details: any = {}) => ipcRenderer.invoke('audio:report-device-reconnect', details),
  getPipelineHealth: () => ipcRenderer.invoke('audio:pipeline-health'),
  getSubsystemStatus: () => ipcRenderer.invoke('system:subsystem-status'),
});

// 4. Expose comprehensive electronAPI with forceTeardown and device control
contextBridge.exposeInMainWorld('electronAPI', {
  forceTeardown: () => {
    return ipcRenderer.invoke('app:force-teardown');
  },
  requestShutdown: (payload: any = {}) => {
    return ipcRenderer.invoke('app:request-shutdown', payload);
  },
  audioStop: (releaseResources: boolean = true) => {
    return ipcRenderer.invoke('audio:stop', { releaseResources });
  },
  audioStart: (config: any = {}) => {
    return ipcRenderer.invoke('audio:start', config);
  },
  getDeviceStatus: () => ipcRenderer.invoke('audio:device-status'),
  getPipelineHealth: () => ipcRenderer.invoke('audio:pipeline-health'),
  getSubsystemStatus: () => ipcRenderer.invoke('system:subsystem-status'),
  heartbeat: (payload: any = {}) => ipcRenderer.invoke('ipc:heartbeat', payload),
  audio: {
    sendChunk: (chunk: Buffer | Uint8Array | string | AudioChunk | any) => {
      return ipcRenderer.invoke(AUDIO_IPC_CHANNELS.SEND_CHUNK, chunk);
    },
    onStatus: (callback: (status: AudioStatus) => void) => {
      if (typeof callback === 'function') {
        const handler = (_event: any, status: AudioStatus) => callback(status);
        ipcRenderer.on(AUDIO_IPC_CHANNELS.STATUS, handler);
        return () => ipcRenderer.removeListener(AUDIO_IPC_CHANNELS.STATUS, handler);
      }
      return () => {};
    },
    getStatus: () => ipcRenderer.invoke(AUDIO_IPC_CHANNELS.GET_STATUS),
  },
});
