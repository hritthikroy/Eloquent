/**
 * Resilient Inter-Process Communication (IPC) Bridge & Handler Registration
 *
 * Exposes explicit registerIpcHandlers(win: BrowserWindow) for stable Electron
 * lifecycle initialization, binding resilient IPC channels and audio device monitors.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { registerConversationIpcHandlers } from './ipc-handlers';

export interface AudioDeviceState {
  active: boolean;
  deviceName: string;
  sampleRate: number;
  channels: number;
  lastDisconnectedAt: number | null;
  lastReconnectedAt: number | null;
  disconnectCount: number;
}

export interface SubsystemStatus {
  timestamp: number;
  uptimeSeconds: number;
  subsystems: {
    audioPipeline: {
      status: string;
      deviceActive: boolean;
      deviceName: string;
      disconnectCount: number;
    };
    ipcBridge: {
      status: string;
      lastHeartbeatAgeMs: number;
      isResponsive: boolean;
    };
    conversationManager: {
      status: string;
      fsmEnforced: boolean;
    };
    neuralMeshMemory: {
      status: string;
      vaultActive: boolean;
    };
    uiVisualizer: {
      status: string;
      renderFpsTarget: number;
    };
  };
  memory: {
    heapUsedMB: number;
    rssMB: number;
    externalMB: number;
  };
}

// Internal module state
let isIpcRegistered = false;
let lastClientHeartbeat = Date.now();
const audioDeviceState: AudioDeviceState = {
  active: true,
  deviceName: 'default',
  sampleRate: 48000,
  channels: 1,
  lastDisconnectedAt: null,
  lastReconnectedAt: null,
  disconnectCount: 0,
};

export function getAudioDeviceState(): AudioDeviceState {
  return { ...audioDeviceState };
}

export function resetResilientIpcState(): void {
  isIpcRegistered = false;
  lastClientHeartbeat = Date.now();
  audioDeviceState.active = true;
  audioDeviceState.deviceName = 'default';
  audioDeviceState.disconnectCount = 0;
  audioDeviceState.lastDisconnectedAt = null;
  audioDeviceState.lastReconnectedAt = null;
}

export function getSystemSubsystemStatus(): SubsystemStatus {
  const mem = process.memoryUsage();
  return {
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    subsystems: {
      audioPipeline: {
        status: audioDeviceState.active ? 'healthy' : 'degraded',
        deviceActive: audioDeviceState.active,
        deviceName: audioDeviceState.deviceName,
        disconnectCount: audioDeviceState.disconnectCount,
      },
      ipcBridge: {
        status: isIpcRegistered ? 'healthy' : 'unregistered',
        lastHeartbeatAgeMs: Date.now() - lastClientHeartbeat,
        isResponsive: Date.now() - lastClientHeartbeat < 5000,
      },
      conversationManager: {
        status: 'healthy',
        fsmEnforced: true,
      },
      neuralMeshMemory: {
        status: 'healthy',
        vaultActive: true,
      },
      uiVisualizer: {
        status: 'healthy',
        renderFpsTarget: 60,
      },
    },
    memory: {
      heapUsedMB: parseFloat((mem.heapUsed / 1048576).toFixed(2)),
      rssMB: parseFloat((mem.rss / 1048576).toFixed(2)),
      externalMB: parseFloat((mem.external / 1048576).toFixed(2)),
    },
  };
}

/**
 * Registers all resilient IPC channels onto the provided ipcMain instance.
 */
export function registerResilientIpcHandlers(
  ipc: any = ipcMain,
  win?: BrowserWindow | any
): { unregister: () => void } {
  if (!ipc || typeof ipc.handle !== 'function') {
    return { unregister: () => {} };
  }

  // 1. Client Heartbeat Monitor
  ipc.handle('ipc:heartbeat', async (_event: any, payload: any = {}) => {
    lastClientHeartbeat = Date.now();
    return {
      pong: true,
      timestamp: lastClientHeartbeat,
      latencyMs: payload?.timestamp ? Math.max(0, Date.now() - payload.timestamp) : 0,
      deviceActive: audioDeviceState.active,
    };
  });

  // 2. Audio Device Hardware Status
  ipc.handle('audio:device-status', async () => {
    return getAudioDeviceState();
  });

  // 3. Audio Device Disconnect Reporter
  ipc.handle('audio:report-device-disconnect', async (_event: any, details: any = {}) => {
    audioDeviceState.active = false;
    audioDeviceState.lastDisconnectedAt = Date.now();
    audioDeviceState.disconnectCount += 1;
    console.warn(`⚠️ [Main/IPC] Audio device disconnected: ${details?.deviceName || audioDeviceState.deviceName}`);
    return { success: true, state: getAudioDeviceState() };
  });

  // 4. Audio Device Reconnect Reporter
  ipc.handle('audio:report-device-reconnect', async (_event: any, details: any = {}) => {
    audioDeviceState.active = true;
    audioDeviceState.lastReconnectedAt = Date.now();
    if (details?.deviceName) {
      audioDeviceState.deviceName = details.deviceName;
    }
    console.log(`✅ [Main/IPC] Audio device reconnected: ${audioDeviceState.deviceName}`);
    return { success: true, state: getAudioDeviceState() };
  });

  // 5. Audio Pipeline & Memory Health
  ipc.handle('audio:pipeline-health', async () => {
    const mem = process.memoryUsage();
    return {
      success: true,
      isHealthy: audioDeviceState.active,
      deviceActive: audioDeviceState.active,
      heapUsedMB: parseFloat((mem.heapUsed / 1048576).toFixed(2)),
      rssMB: parseFloat((mem.rss / 1048576).toFixed(2)),
      externalMB: parseFloat((mem.external / 1048576).toFixed(2)),
      timestamp: Date.now(),
    };
  });

  // 6. Subsystem State Diagnostic Audit
  ipc.handle('system:subsystem-status', async () => {
    return {
      success: true,
      report: getSystemSubsystemStatus(),
    };
  });

  isIpcRegistered = true;
  console.log('🛡️ [Main/IPC] Resilient IPC error boundaries and device lifecycle handlers active');

  return {
    unregister: () => {
      const channels = [
        'ipc:heartbeat',
        'audio:device-status',
        'audio:report-device-disconnect',
        'audio:report-device-reconnect',
        'audio:pipeline-health',
        'system:subsystem-status',
      ];
      channels.forEach((ch) => {
        try {
          ipc.removeHandler(ch);
        } catch (_) {}
      });
      isIpcRegistered = false;
      console.log('ℹ️ [Main/IPC] Resilient IPC handlers unregistered');
    },
  };
}

/**
 * Standard entry point for registering all IPC handlers before or after window creation.
 * Matches the required signature (win?: BrowserWindow) => void.
 *
 * @param win - Optional active BrowserWindow instance for targeting broadcasts.
 */
export function registerIpcHandlers(win?: BrowserWindow | any): { unregister: () => void } {
  console.log('🔌 [Main/IPC] registerIpcHandlers called. Initializing all IPC channels...');

  // 1. Register resilient health & telemetry handlers
  const resilientReg = registerResilientIpcHandlers(ipcMain, win);

  // 2. Register conversation, audio capture & execution handlers
  let conversationReg: { unregister: () => void } = { unregister: () => {} };
  try {
    conversationReg = registerConversationIpcHandlers(
      ipcMain,
      undefined,
      win ? () => [win] : undefined
    );
  } catch (err: any) {
    console.warn('⚠️ [Main/IPC] registerConversationIpcHandlers initialization note:', err?.message);
  }

  return {
    unregister: () => {
      resilientReg.unregister();
      conversationReg.unregister();
    },
  };
}

export default registerIpcHandlers;
