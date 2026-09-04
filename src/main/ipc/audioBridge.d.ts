export interface AudioBridgeOptions {
  path?: string;
  slotCount?: number;
  slotSize?: number;
  isCreator?: boolean;
  inMemory?: boolean;
}

export interface AudioBridgeWriteFrame {
  frameId: number | bigint;
  timestampNs?: number | bigint;
  audioData: Buffer | Uint8Array;
  sampleRate?: number;
  channels?: number;
  flags?: number;
}

export interface AudioBridgeReadFrame {
  frameId: number;
  timestampNs: number;
  payloadSize: number;
  channels: number;
  sampleRate: number;
  flags: number;
  data: Buffer;
}

export interface AudioBridgeMetrics {
  writeIndex: number;
  readIndex: number;
  queueDepth: number;
  slotCapacity: number;
  fillPercent: number;
  underrunCount: number;
  overrunCount: number;
  writerPid: number;
  readerPid: number;
  lastHeartbeatNs: number;
  isWriterAlive: boolean;
  stateFlags: number;
  estimatedLagMs: number;
}

export interface AudioBridgeWriteResult {
  success: boolean;
  frameId?: number | bigint;
  writeIndex?: bigint;
  payloadSize?: number;
  reason?: string;
}

export class SharedMemoryAudioBridge {
  constructor(options?: AudioBridgeOptions);
  slotCount: number;
  slotSize: number;
  totalSize: number;
  isCreator: boolean;
  inMemory: boolean;
  fd: number | null;
  initialized: boolean;
  init(): boolean;
  writeFrame(frame: AudioBridgeWriteFrame): AudioBridgeWriteResult;
  readFrame(): AudioBridgeReadFrame | null;
  getMetrics(): AudioBridgeMetrics;
  reset(): void;
  recoverStaleState(maxStaleNs?: bigint): boolean;
  close(): void;
}

export interface AudioBridgeIpcRegistration {
  bridge: SharedMemoryAudioBridge;
  unregister: () => void;
}

export function registerAudioBridgeIpc(
  ipcMain: any,
  bridge?: SharedMemoryAudioBridge | null
): AudioBridgeIpcRegistration;
