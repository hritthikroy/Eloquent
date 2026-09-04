/**
 * Cross-Platform Clipboard Utility for Eloquent Electron
 * Programmatically writes generated Antigravity developer prompts to the system clipboard.
 */

import { spawn } from 'child_process';

export const MAX_PROMPT_SIZE = 1024 * 1024; // 1 MiB safety ceiling

export type ToastCallback = (message: string, isError?: boolean) => void;

let lastError: Error | null = null;
let toastHandler: ToastCallback | null = null;

/**
 * Sets a toast notification handler for surfacing feedback or errors to the UI
 */
export function setToastHandler(handler: ToastCallback | null): void {
  toastHandler = handler;
}

/**
 * Retrieves the last caught clipboard error, if any
 */
export function getLastError(): Error | null {
  return lastError;
}

/**
 * Writes the given text to the system clipboard using platform-specific fallback CLI binaries
 */
function writeViaCliFallback(text: string): boolean {
  try {
    if (process.platform === 'darwin') {
      const child = spawn('pbcopy');
      child.stdin.write(text);
      child.stdin.end();
      return true;
    } else if (process.platform === 'win32') {
      const child = spawn('clip');
      child.stdin.write(text);
      child.stdin.end();
      return true;
    } else if (process.platform === 'linux') {
      try {
        const child = spawn('xclip', ['-selection', 'clipboard']);
        child.stdin.write(text);
        child.stdin.end();
        return true;
      } catch {
        const child = spawn('xsel', ['--clipboard', '--input']);
        child.stdin.write(text);
        child.stdin.end();
        return true;
      }
    }
  } catch (err: any) {
    lastError = err;
    console.error('❌ [Clipboard] Platform CLI fallback copy failed:', err.message);
  }
  return false;
}

/**
 * Programmatically copies the Antigravity developer prompt to the system clipboard.
 * - Empty string: No-op.
 * - Extremely large prompts (> 1 MiB): Truncated safely to 1 MiB.
 * - Sandboxed or denied environments: Safely logs and alerts toast handler without throwing.
 * - Guarantees: Returns void and NEVER throws uncaught exceptions.
 * 
 * @param text - The developer prompt string to write to clipboard
 */
export function copyPrompt(text: string): void {
  lastError = null;

  // 1. Edge Case: Empty or non-string input is a safe no-op
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return;
  }

  // 2. Edge Case: Truncate prompts exceeding 1 MiB
  let processedText = text;
  if (processedText.length > MAX_PROMPT_SIZE) {
    console.warn(`⚠️ [Clipboard] Prompt size (${processedText.length} bytes) exceeds 1 MiB limit. Truncating.`);
    processedText = processedText.slice(0, MAX_PROMPT_SIZE);
    if (toastHandler) {
      toastHandler('Prompt truncated to 1 MiB before copying', true);
    }
  }

  // 3. Attempt write via Electron clipboard API
  let electronWritten = false;
  try {
    // Check for Electron clipboard module
    let electronClipboard: any = null;
    try {
      const electron = require('electron');
      electronClipboard = electron.clipboard || (electron.default && electron.default.clipboard);
    } catch {
      // Electron not available or in headless Node environment
    }

    if (electronClipboard && typeof electronClipboard.writeText === 'function') {
      electronClipboard.writeText(processedText);
      electronWritten = true;
      if (toastHandler) {
        toastHandler('Prompt copied to clipboard!');
      }
      return;
    }
  } catch (err: any) {
    lastError = err;
    console.warn('⚠️ [Clipboard] Electron clipboard.writeText error, attempting CLI fallback:', err.message);
  }

  // 4. In browser/renderer environment check window.clipboardAPI or navigator.clipboard
  if (typeof window !== 'undefined') {
    try {
      if ((window as any).clipboardAPI && typeof (window as any).clipboardAPI.copyPrompt === 'function') {
        (window as any).clipboardAPI.copyPrompt(processedText);
        if (toastHandler) toastHandler('Prompt copied to clipboard!');
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(processedText).then(() => {
          if (toastHandler) toastHandler('Prompt copied to clipboard!');
        }).catch((err) => {
          lastError = err;
          console.error('❌ [Clipboard] navigator.clipboard.writeText failed:', err);
          if (toastHandler) toastHandler('Failed to copy prompt to clipboard', true);
        });
        return;
      }
    } catch (winErr: any) {
      lastError = winErr;
      console.error('❌ [Clipboard] Window clipboard invocation failed:', winErr.message);
      if (toastHandler) toastHandler('Failed to copy prompt: clipboard permission denied', true);
      return;
    }
  }

  // 5. If not in renderer or Electron clipboard was unavailable/failed, try platform CLI fallback
  if (!electronWritten && typeof process !== 'undefined' && process.platform) {
    const cliSuccess = writeViaCliFallback(processedText);
    if (cliSuccess) {
      if (toastHandler) toastHandler('Prompt copied to clipboard!');
      return;
    }
  }

  if (lastError && toastHandler) {
    toastHandler('Clipboard access denied or unavailable', true);
  }
}

export default copyPrompt;
