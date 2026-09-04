export interface ElectronEyeBridgeOptions {
  backendUrl?: string;
  broadcastTargets?: any;
  audioBridge?: any;
  agentLoop?: any;
  useFastPath?: boolean;
  BufferQueue?: any;
  NikolaProcessor?: any;
  bufferQueue?: any;
  nikolaProcessor?: any;
  queueMaxSize?: number;
  maxLagMs?: number;
  consecutiveErrorThreshold?: number;
  session?: any;
}

export interface ClearAppCacheResult {
  success: boolean;
  timestamp: number;
  chromiumCleared: boolean;
  nodeCleared: boolean;
  goBackendCleared: boolean;
  error?: string;
  details?: any;
}

export class ElectronEyeBridge {
  constructor(options?: ElectronEyeBridgeOptions);
  backendUrl: string;
  endpoint: string;
  session?: any;
  isDegraded: boolean;
  lastEmittedPose: string;
  lastEvent: any;
  inFlight: boolean;
  audioBridge: any;
  agentLoop: any;
  useFastPath: boolean;
  bufferQueue: any;
  nikolaProcessor: any;
  getAudioBridge(): any;
  ingestAudioBuffer(buffer: any, metadata?: any): {
    success: boolean;
    queued: boolean;
    queueDepth: number;
    isBackpressured: boolean;
    error?: string;
  };
  getQueueTelemetry(): { queue: any; processor: any };
  sendAudioFrameFastPath(frame: any): any;
  getFastPathMetrics(): {
    available: boolean;
    metrics?: any;
    error?: string;
    memory: any;
    queue?: any;
    processor?: any;
  };
  register(ipcMain: any, getWindows?: () => any[]): { unregister: () => void };
  clearAppCache(options?: {
    session?: any;
    grpcClient?: any;
    clearStorage?: boolean;
    endpoint?: string;
    logFilePath?: string;
    timeout?: number;
  }): Promise<ClearAppCacheResult>;
  forwardClearGoCache(options?: {
    grpcClient?: any;
    endpoint?: string;
    timeout?: number;
    throwOnError?: boolean;
  }): Promise<any>;
  forwardToGoBackend(payload: any): Promise<any>;
  unregister(): void;
  getState(): {
    isDegraded: boolean;
    lastEmittedPose: string;
    lastEvent: any;
    fastPathAvailable: boolean;
    queueDepth: number;
    circuitState: string;
  };
}

export function registerEyeIpcHandlers(
  ipcMain: any,
  options?: ElectronEyeBridgeOptions & { getWindows?: () => any[] }
): ElectronEyeBridge;
