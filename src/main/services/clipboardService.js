/**
 * Clipboard Service
 * 
 * Production-grade, cross-platform clipboard service for Electron Main process.
 * Encapsulates native OS clipboard operations via electron.clipboard, provides
 * headless/test fallback, performs UTF-8 sequence sanitization, and prevents
 * main event loop stalls through asynchronous non-blocking writes.
 */

const { BENGALI_FIX_PROMPT } = require('../../shared/constants/prompts');

let electronClipboard = null;
try {
  const electron = require('electron');
  if (electron && electron.clipboard) {
    electronClipboard = electron.clipboard;
  }
} catch (_) {
  // Headless test environment fallback
}

class ClipboardService {
  constructor(customClipboard = null) {
    this.clipboard = customClipboard || electronClipboard;
    this._fallbackText = '';
  }

  /**
   * Sanitizes input to ensure valid UTF-8 string encoding and canonical NFC normalization.
   * 
   * @param {*} input - String to sanitize
   * @returns {string} - Cleaned UTF-8 string
   * @throws {Error} - If input cannot be converted to valid UTF-8 string
   */
  static sanitizeUtf8(input) {
    if (input === null || input === undefined) {
      throw new Error('Clipboard Error: input cannot be null or undefined');
    }
    const str = typeof input === 'string' ? input : String(input);
    
    // Canonical NFC normalization to ensure clean multi-byte character representation across OSes
    const normalized = str.normalize('NFC');

    // Remove rogue non-printable ASCII control characters (keeping standard whitespace/newlines)
    return normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Static method to write the Bengali fixing prompt to the system clipboard.
   * 
   * @param {string} [customPrompt] - Optional override prompt
   * @returns {Promise<boolean>} - Resolves to true on success, false/reject on error
   */
  static async copyBengaliFixPrompt(customPrompt = BENGALI_FIX_PROMPT) {
    const service = new ClipboardService();
    return service.writeText(customPrompt);
  }

  /**
   * Asynchronously writes sanitized UTF-8 text to the native clipboard without blocking the event loop.
   * 
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>}
   */
  async writeText(text) {
    return new Promise((resolve, reject) => {
      // Defer execution using setImmediate to yield event loop and prevent micro-stalls
      setImmediate(() => {
        try {
          const sanitized = ClipboardService.sanitizeUtf8(text);

          if (this.clipboard && typeof this.clipboard.writeText === 'function') {
            this.clipboard.writeText(sanitized);
          } else {
            // In-memory fallback for headless tests
            this._fallbackText = sanitized;
            ClipboardService._globalFallbackText = sanitized;
          }

          resolve(true);
        } catch (err) {
          console.error('❌ [ClipboardService] Failed to write text to clipboard:', err.message);
          resolve(false);
        }
      });
    });
  }

  /**
   * Reads plain text from the clipboard.
   * @returns {Promise<string>}
   */
  async readText() {
    return new Promise((resolve) => {
      setImmediate(() => {
        try {
          if (this.clipboard && typeof this.clipboard.readText === 'function') {
            resolve(this.clipboard.readText() || '');
          } else {
            resolve(this._fallbackText || ClipboardService._globalFallbackText || '');
          }
        } catch (err) {
          console.error('❌ [ClipboardService] Failed to read text from clipboard:', err.message);
          resolve('');
        }
      });
    });
  }
}

ClipboardService._globalFallbackText = '';

module.exports = {
  ClipboardService,
  clipboardService: new ClipboardService()
};
