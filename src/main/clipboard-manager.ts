/**
 * src/main/clipboard-manager.ts
 * 
 * Main Process Clipboard Manager Service
 * Encapsulates electron.clipboard.writeText() logic with 500ms debouncing,
 * UTF-8 normalization, and robust null/empty input error handling.
 */

import { ClipboardSyncPayload, ClipboardSyncResponse } from '../shared/types';

let electronClipboard: { writeText: (text: string) => void; readText: () => string } | null = null;
try {
  // Dynamically require electron clipboard for main process / test environment resilience
  const electron = require('electron');
  if (electron && electron.clipboard) {
    electronClipboard = electron.clipboard;
  }
} catch {
  // Test / headless fallback
}

export class ClipboardManager {
  private static instance: ClipboardManager | null = null;
  private clipboard: { writeText: (text: string) => void; readText: () => string } | null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private pendingContent: string | null = null;
  private readonly DEBOUNCE_DELAY_MS = 500;

  constructor(customClipboard = null) {
    this.clipboard = customClipboard || electronClipboard;
  }

  /**
   * Singleton instance accessor
   */
  public static getInstance(customClipboard = null): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager(customClipboard);
    }
    return ClipboardManager.instance;
  }

  /**
   * Synchronizes generated prompt or code content to the OS system clipboard.
   * Encapsulates debouncing (500ms), UTF-8 normalization, and error isolation.
   * 
   * @param content Raw string content or payload to copy to system clipboard
   * @returns Promise resolving to ClipboardSyncResponse
   */
  public async syncPromptToClipboard(content: string | ClipboardSyncPayload | null | undefined): Promise<ClipboardSyncResponse> {
    const timestamp = Date.now();

    // 1. Input validation & null safety
    if (content === null || content === undefined) {
      return {
        success: false,
        length: 0,
        timestamp,
        error: 'Cannot copy null or undefined payload to clipboard'
      };
    }

    const rawText = typeof content === 'string' ? content : (content.content || '');
    if (typeof rawText !== 'string') {
      return {
        success: false,
        length: 0,
        timestamp,
        error: 'Invalid content type: Expected string payload'
      };
    }

    if (rawText.trim().length === 0) {
      return {
        success: false,
        length: 0,
        timestamp,
        error: 'Cannot copy empty string to clipboard'
      };
    }

    // 2. UTF-8 normalization and edge case sanitization
    const normalizedText = rawText.normalize('NFC').replace(/\r\n/g, '\n');

    // 3. Debouncing & Execution
    return new Promise((resolve) => {
      this.pendingContent = normalizedText;

      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = setTimeout(() => {
        try {
          if (this.pendingContent !== null) {
            if (this.clipboard && typeof this.clipboard.writeText === 'function') {
              this.clipboard.writeText(this.pendingContent);
            }
            const writtenLength = this.pendingContent.length;
            this.pendingContent = null;
            this.debounceTimeout = null;

            resolve({
              success: true,
              length: writtenLength,
              timestamp: Date.now()
            });
          } else {
            resolve({
              success: false,
              length: 0,
              timestamp: Date.now(),
              error: 'Debounce buffer cleared before write'
            });
          }
        } catch (err: any) {
          console.error('❌ [ClipboardManager] Error writing to OS clipboard:', err?.message || err);
          resolve({
            success: false,
            length: 0,
            timestamp: Date.now(),
            error: err?.message || 'Clipboard write error'
          });
        }
      }, this.DEBOUNCE_DELAY_MS);
    });
  }

  /**
   * Immediate non-debounced copy for explicit user click triggers
   */
  public syncPromptToClipboardImmediate(content: string | ClipboardSyncPayload | null | undefined): ClipboardSyncResponse {
    const timestamp = Date.now();

    if (content === null || content === undefined) {
      return {
        success: false,
        length: 0,
        timestamp,
        error: 'Cannot copy null or undefined payload to clipboard'
      };
    }

    const rawText = typeof content === 'string' ? content : (content.content || '');
    if (typeof rawText !== 'string' || rawText.trim().length === 0) {
      return {
        success: false,
        length: 0,
        timestamp,
        error: 'Cannot copy empty string to clipboard'
      };
    }

    const normalizedText = rawText.normalize('NFC').replace(/\r\n/g, '\n');

    try {
      if (this.clipboard && typeof this.clipboard.writeText === 'function') {
        this.clipboard.writeText(normalizedText);
      }
      return {
        success: true,
        length: normalizedText.length,
        timestamp: Date.now()
      };
    } catch (err: any) {
      return {
        success: false,
        length: 0,
        timestamp: Date.now(),
        error: err?.message || 'Clipboard write error'
      };
    }
  }
}

export const clipboardManager = ClipboardManager.getInstance();
