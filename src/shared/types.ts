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
  EXEC_ABORT = 'exec:abort'
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

export * from './types/execution';


