/**
 * Prompt IPC Handler Module
 * 
 * Manages IPC channels for receiving, validating, and forwarding user prompts
 * between the Electron renderer UI and the Go audio backend.
 * 
 * Registered Channels:
 * - 'prompt:submit': Receives prompt, validates non-empty/length bounds, forwards to Go backend
 * - 'prompt:validate': Pre-flight validation helper for renderer input feedback
 */

const axios = require('axios');

/**
 * Validates prompt text according to length, whitespace, and character constraints
 * @param {string} prompt - Raw prompt string
 * @param {Object} [options]
 * @param {number} [options.maxLength=4096] - Maximum allowed character length
 * @param {boolean} [options.strict=false] - If true, rejects prompts exceeding maxLength instead of truncating
 * @returns {{ valid: boolean, cleanPrompt: string, error?: string, warnings: string[], charCount: number }}
 */
function validatePrompt(prompt, options = {}) {
  const maxLength = options.maxLength || 4096;
  const strict = options.strict || false;
  const warnings = [];

  if (prompt === null || prompt === undefined) {
    return {
      valid: false,
      cleanPrompt: '',
      error: 'Prompt cannot be empty or contain only whitespace.',
      warnings,
      charCount: 0
    };
  }

  const promptStr = String(prompt);
  const trimmed = promptStr.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      cleanPrompt: '',
      error: 'Prompt cannot be empty or contain only whitespace.',
      warnings,
      charCount: 0
    };
  }

  let cleanPrompt = promptStr;
  const charCount = Array.from(cleanPrompt).length; // Unicode-aware length

  if (charCount > maxLength) {
    if (strict) {
      return {
        valid: false,
        cleanPrompt: '',
        error: `Prompt exceeds maximum allowed length of ${maxLength} characters.`,
        warnings,
        charCount
      };
    }
    // Truncate safely at Unicode code point boundary
    cleanPrompt = Array.from(cleanPrompt).slice(0, maxLength).join('');
    warnings.push(`Prompt exceeded ${maxLength} characters and was truncated.`);
  }

  return {
    valid: true,
    cleanPrompt,
    warnings,
    charCount: Array.from(cleanPrompt).length
  };
}

/**
 * Forwards prompt payload to the Go audio backend via HTTP
 * @param {Object} payload - Validated prompt payload
 * @param {Object} [options]
 * @returns {Promise<{ delivered: boolean, data?: any, error?: string }>}
 */
async function forwardPromptToGoBackend(payload, options = {}) {
  const backendUrl = options.backendUrl || process.env.ELOQUENT_API_URL || 'http://localhost:3000';
  const endpoint = `${backendUrl}/api/prompt`;
  const timeoutMs = options.timeoutMs || 1500;

  try {
    const response = await axios.post(endpoint, payload, {
      timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json' }
    });
    return { delivered: true, data: response.data };
  } catch (err) {
    // Graceful offline fallback
    return {
      delivered: false,
      error: err.message || 'Go backend connection timed out or is offline'
    };
  }
}

/**
 * Registers prompt IPC handlers with ipcMain
 * @param {Object} ipcMain - Electron ipcMain instance
 * @param {Object} [options]
 * @returns {{ unregister: () => void }}
 */
function registerPromptIpcHandlers(ipcMain, options = {}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    return { unregister: () => {} };
  }

  // 1. Channel 'prompt:submit'
  ipcMain.handle('prompt:submit', async (_event, rawPayload) => {
    try {
      const payload = typeof rawPayload === 'string'
        ? { prompt: rawPayload }
        : (rawPayload || {});

      const validation = validatePrompt(payload.prompt, options);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          code: 'INVALID_PROMPT',
          timestamp: Date.now()
        };
      }

      const transmitPayload = {
        prompt: validation.cleanPrompt,
        timestamp: payload.timestamp || Date.now(),
        metadata: payload.metadata || {},
        warnings: validation.warnings,
        charCount: validation.charCount
      };

      const forwardResult = await forwardPromptToGoBackend(transmitPayload, options);

      return {
        success: true,
        prompt: validation.cleanPrompt,
        forwardedToGo: forwardResult.delivered,
        warnings: validation.warnings,
        charCount: validation.charCount,
        backendResponse: forwardResult.data || null,
        timestamp: Date.now()
      };
    } catch (err) {
      console.error('❌ [PromptIPCHandler] Internal error handling prompt submission:', err);
      return {
        success: false,
        error: err.message || 'Internal error processing prompt submission',
        timestamp: Date.now()
      };
    }
  });

  // 2. Channel 'prompt:validate'
  ipcMain.handle('prompt:validate', async (_event, rawPrompt) => {
    return validatePrompt(rawPrompt, options);
  });

  return {
    unregister: () => {
      try {
        if (typeof ipcMain.removeHandler === 'function') {
          ipcMain.removeHandler('prompt:submit');
          ipcMain.removeHandler('prompt:validate');
        }
      } catch (e) {
        /* ignore */
      }
    }
  };
}

module.exports = {
  validatePrompt,
  forwardPromptToGoBackend,
  registerPromptIpcHandlers
};
