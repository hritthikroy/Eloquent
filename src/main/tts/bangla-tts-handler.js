/**
 * Eloquent Audio - Bengali Text-to-Speech (TTS) IPC & Processing Handler
 * 
 * Validates incoming Bengali UTF-8 text, performs canonical Unicode normalization,
 * initiates low-latency synthesis via the Go audio backend bridge, and manages
 * the audio buffer lifecycle to ensure zero memory leaks.
 */

const { goBridge } = require('../audio/go-bridge');

class BanglaTtsHandler {
  constructor(options = {}) {
    this.bridge = options.bridge || goBridge;
    this.activeSessions = new Map();
    this.sessionIdCounter = 0;
    this.isRegistered = false;

    // Process-level cleanup hooks to guarantee no dangling audio buffer memory
    this._setupExitHooks();
  }

  /**
   * Cleans and canonicalizes Bengali UTF-8 text.
   * Performs Unicode NFC normalization, removes rogue control codes and zero-width artifacts.
   * 
   * @param {string} text - Raw input text
   * @returns {string} - Cleaned, normalized Bengali string
   * @throws {Error} - If input is empty, non-string, or purely whitespace
   */
  normalizeText(text) {
    if (typeof text !== 'string') {
      const err = new Error('Bengali TTS: Input text must be a string');
      err.code = 'INVALID_INPUT_TYPE';
      throw err;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      const err = new Error('Bengali TTS: Input text cannot be empty or whitespace only');
      err.code = 'EMPTY_TEXT_INPUT';
      throw err;
    }

    // 1. Canonical Unicode normalization (NFC)
    let normalized = trimmed.normalize('NFC');

    // 2. Remove non-printable control characters (except newline) and zero-width spaces
    normalized = normalized
      .replace(/[\u200B\uFEFF]/g, '') // Zero-width space, BOM
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // ASCII control codes

    if (!normalized.trim()) {
      const err = new Error('Bengali TTS: Input text contains no valid printable characters');
      err.code = 'EMPTY_AFTER_NORMALIZATION';
      throw err;
    }

    return normalized;
  }

  /**
   * Synthesizes Bengali text to 24kHz 16-bit PCM/WAV audio buffer.
   * 
   * @param {string} text - Bengali text to synthesize
   * @param {Object} [options]
   * @param {number} [options.timeoutMs=5000] - Max synthesis timeout
   * @param {string} [options.sessionId] - Client session identifier for tracking
   * @returns {Promise<{ success: boolean, audioBuffer: Buffer, sampleRate: number, channels: number, durationMs: number, sessionId: string }>}
   */
  async synthesize(text, options = {}) {
    const normalizedText = this.normalizeText(text);
    const sessionId = options.sessionId || `tts_bn_${++this.sessionIdCounter}_${Date.now()}`;

    // Track active synthesis session
    const session = {
      id: sessionId,
      startTime: Date.now(),
      status: 'synthesizing',
      aborted: false
    };
    this.activeSessions.set(sessionId, session);

    try {
      const result = await this.bridge.synthesizeBengali(normalizedText, {
        timeoutMs: options.timeoutMs || 5000
      });

      if (session.aborted) {
        const abortErr = new Error('Bengali TTS synthesis was cancelled');
        abortErr.code = 'SYNTHESIS_CANCELLED';
        throw abortErr;
      }

      session.status = 'completed';

      // Audio buffer lifecycle: hand off buffer with metadata
      const response = {
        success: true,
        sessionId,
        audioBuffer: result.buffer,
        sampleRate: result.sampleRate || 24000,
        channels: result.channels || 1,
        durationMs: result.durationMs,
        byteLength: result.byteLength
      };

      // Clean up session reference after dispatch to prevent retain cycles
      setImmediate(() => {
        this.activeSessions.delete(sessionId);
      });

      return response;
    } catch (err) {
      session.status = 'error';
      this.activeSessions.delete(sessionId);
      throw err;
    }
  }

  /**
   * Cancels an ongoing synthesis session.
   * @param {string} sessionId
   * @returns {boolean}
   */
  cancel(sessionId) {
    if (this.activeSessions.has(sessionId)) {
      const session = this.activeSessions.get(sessionId);
      session.aborted = true;
      this.activeSessions.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Registers IPC handlers with Electron's ipcMain.
   * @param {Object} ipcMain - Electron ipcMain module
   */
  registerIpc(ipcMain) {
    if (!ipcMain || typeof ipcMain.handle !== 'function') {
      return;
    }
    if (this.isRegistered) return;
    this.isRegistered = true;

    ipcMain.handle('tts:bangla:synthesize', async (event, text, options) => {
      try {
        const result = await this.synthesize(text, options);
        return {
          success: true,
          sessionId: result.sessionId,
          audioData: result.audioBuffer, // Serialized as Uint8Array/Buffer over IPC
          sampleRate: result.sampleRate,
          channels: result.channels,
          durationMs: result.durationMs
        };
      } catch (err) {
        return {
          success: false,
          error: err.message,
          code: err.code || 'SYNTHESIS_FAILED'
        };
      }
    });

    ipcMain.handle('tts:bangla:cancel', (event, sessionId) => {
      return { success: this.cancel(sessionId) };
    });
  }

  /**
   * Unregisters IPC handlers and clears all active sessions.
   */
  destroy(ipcMain) {
    if (ipcMain && typeof ipcMain.removeHandler === 'function') {
      ipcMain.removeHandler('tts:bangla:synthesize');
      ipcMain.removeHandler('tts:bangla:cancel');
    }
    this.isRegistered = false;
    this.activeSessions.clear();

    if (this._exitHandler) {
      process.removeListener('exit', this._exitHandler);
      process.removeListener('SIGINT', this._exitHandler);
      this._exitHandler = null;
    }
  }

  _setupExitHooks() {
    this._exitHandler = () => {
      this.activeSessions.clear();
    };
    process.once('exit', this._exitHandler);
    process.once('SIGINT', this._exitHandler);
  }
}

const defaultBanglaTtsHandler = new BanglaTtsHandler();

module.exports = {
  BanglaTtsHandler,
  banglaTtsHandler: defaultBanglaTtsHandler
};
