/**
 * src/shared/types.ts
 * 
 * Shared Type Definitions for IPC Channels, Payloads, and API Contracts
 * across the Main and Renderer process boundary in Eloquent Electron.
 */

export enum IpcChannels {
  CLIPBOARD_SYNC = 'clipboard:sync',
  CONVERSATION_VERIFY_INTEGRITY = 'conversation:verify-integrity',
  CLIPBOARD_COPY_BENGALI_FIX = 'clipboard:copy-bengali-fix',
  AUDIO_START_CAPTURE = 'audio:start-capture',
  AUDIO_STOP_CAPTURE = 'audio:stop-capture',
  AUDIO_COMMAND_RECOGNIZED = 'audio:command-recognized',
  EXEC_RUN = 'exec:run',
  EXEC_STATUS = 'exec:status',
  EXEC_ABORT = 'exec:abort',
  GET_AUDIO_CONFIG = 'get-audio-config',
  SET_AUDIO_CONFIG = 'set-audio-config'
}

export interface AudioBackendConfig {
  sampleRate: number;
  bufferSize: number;
  outputDevice: string;
  channels?: number;
  volume?: number;
}

export interface AudioConfigResponse {
  success: boolean;
  config: AudioBackendConfig;
  error?: string;
}

export interface ClipboardSyncPayload {
  content: string;
  source?: string;
  timestamp?: number;
}

export interface ClipboardSyncResponse {
  success: boolean;
  length: number;
  timestamp: number;
  error?: string;
}

export interface AudioCaptureConfig {
  sampleRate?: number;
  channels?: number;
  chunkSizeMs?: number;
}

export interface AudioCommandRecognizedPayload {
  command: string;
  confidence: number;
  state: 'READY' | 'IDLE';
  timestamp: number;
  rawText?: string;
}

/**
 * AudioChunk represents a verified binary frame transmitted to the Go audio backend.
 */
export interface AudioChunk {
  data: Buffer | Uint8Array | string;
  sequenceNumber?: number;
  timestamp?: number;
  checksum?: string;
  sampleRate?: number;
  channels?: number;
}

/**
 * AudioStatus represents the structured status returned from the Go audio backend.
 */
export interface AudioStatus {
  status: 'ok' | 'error';
  latency_ms: number;
  message?: string;
  bytesReceived?: number;
  sequenceNumber?: number;
  timestamp?: number;
}

/**
 * Standard IPC channels for resilient audio bridge transmission and telemetry.
 */
export const AUDIO_IPC_CHANNELS = {
  SEND_CHUNK: 'audio:send-chunk',
  STATUS: 'audio:status',
  STREAM_ERROR: 'audio:stream-error',
  GET_STATUS: 'audio:get-status',
} as const;

export * from './types/execution';


