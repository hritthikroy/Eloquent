/**
 * src/shared/types.ts
 * 
 * Shared Type Definitions for IPC Channels, Payloads, and API Contracts
 * across the Main and Renderer process boundary in Eloquent Electron.
 */

export enum IpcChannels {
  CLIPBOARD_SYNC = 'clipboard:sync',
  CONVERSATION_VERIFY_INTEGRITY = 'conversation:verify-integrity',
  CLIPBOARD_COPY_BENGALI_FIX = 'clipboard:copy-bengali-fix'
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
