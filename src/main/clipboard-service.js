/**
 * Clipboard Service
 * Dedicated Electron Main process service for bidirectional OS clipboard operations.
 * Isolates OS-level clipboard access from the renderer process, enforces payload validation,
 * manages race conditions, and handles non-text or locked clipboard states gracefully.
 */

let electronClipboard = null;
try {
  const electron = require('electron');
  if (electron && electron.clipboard) {
    electronClipboard = electron.clipboard;
  }
} catch (e) {
  // Headless / non-Electron test environment fallback
}

class ClipboardService {
  constructor(customClipboard = null) {
    this.clipboard = customClipboard || electronClipboard;
    // In-memory clipboard store for fallback / testing
    this._fallbackStore = {
      text: '',
      html: '',
      timestamp: Date.now()
    };
    // Sequential execution queue to prevent race conditions during rapid calls
    this._queue = Promise.resolve();
  }

  /**
   * Enqueue operations to avoid concurrency race conditions
   * @private
   */
  _enqueue(operation) {
    this._queue = this._queue.then(async () => {
      return await operation();
    }).catch(err => {
      console.error('❌ [ClipboardService] Queue operation error:', err.message);
      throw err;
    });
    return this._queue;
  }

  /**
   * Write plain text to system clipboard
   * @param {string} text
   * @returns {Promise<{success: boolean, length: number, error?: string}>}
   */
  async writeText(text) {
    return this._enqueue(async () => {
      try {
        if (text === null || text === undefined) {
          return { success: false, length: 0, error: 'Cannot write null or undefined to clipboard' };
        }

        const stringVal = typeof text === 'string' ? text : String(text);

        if (this.clipboard && typeof this.clipboard.writeText === 'function') {
          this.clipboard.writeText(stringVal);
        } else {
          this._fallbackStore.text = stringVal;
          this._fallbackStore.timestamp = Date.now();
        }

        return {
          success: true,
          length: stringVal.length
        };
      } catch (err) {
        console.error('❌ [ClipboardService] writeText failed:', err.message);
        return {
          success: false,
          length: 0,
          error: `Clipboard writeText failed: ${err.message}`
        };
      }
    });
  }

  /**
   * Write formatted HTML and optional fallback plain text to system clipboard
   * @param {string} html
   * @param {string} [plainText]
   * @returns {Promise<{success: boolean, length: number, error?: string}>}
   */
  async writeHTML(html, plainText = '') {
    return this._enqueue(async () => {
      try {
        if (!html && !plainText) {
          return { success: false, length: 0, error: 'Empty payload provided to writeHTML' };
        }

        const safeHtml = typeof html === 'string' ? html : String(html || '');
        const safeText = typeof plainText === 'string' ? plainText : (safeHtml.replace(/<[^>]*>?/gm, '') || '');

        if (this.clipboard && typeof this.clipboard.writeHTML === 'function') {
          // Write both HTML and plain text fallback
          if (typeof this.clipboard.write === 'function') {
            this.clipboard.write({
              html: safeHtml,
              text: safeText
            });
          } else {
            this.clipboard.writeHTML(safeHtml);
            if (safeText && typeof this.clipboard.writeText === 'function') {
              this.clipboard.writeText(safeText);
            }
          }
        } else {
          this._fallbackStore.html = safeHtml;
          this._fallbackStore.text = safeText;
          this._fallbackStore.timestamp = Date.now();
        }

        return {
          success: true,
          length: safeHtml.length
        };
      } catch (err) {
        console.error('❌ [ClipboardService] writeHTML failed:', err.message);
        return {
          success: false,
          length: 0,
          error: `Clipboard writeHTML failed: ${err.message}`
        };
      }
    });
  }

  /**
   * Read plain text from system clipboard
   * @returns {Promise<{success: boolean, text: string, length: number, isEmpty: boolean, error?: string}>}
   */
  async readText() {
    return this._enqueue(async () => {
      try {
        let text = '';
        if (this.clipboard && typeof this.clipboard.readText === 'function') {
          text = this.clipboard.readText() || '';
        } else {
          text = this._fallbackStore.text || '';
        }

        const trimmed = text.trim();
        return {
          success: true,
          text: text,
          length: text.length,
          isEmpty: trimmed.length === 0
        };
      } catch (err) {
        console.error('❌ [ClipboardService] readText failed (potential OS lock):', err.message);
        return {
          success: false,
          text: '',
          length: 0,
          isEmpty: true,
          error: `Clipboard readText failed: ${err.message}`
        };
      }
    });
  }

  /**
   * Clear system clipboard
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clear() {
    return this._enqueue(async () => {
      try {
        if (this.clipboard && typeof this.clipboard.clear === 'function') {
          this.clipboard.clear();
        }
        this._fallbackStore = { text: '', html: '', timestamp: Date.now() };
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });
  }

  /**
   * High-level copy handler supporting formatted text, code blocks, or structured data
   * @param {Object} payload - { text, html, code, language, data }
   * @returns {Promise<{success: boolean, format: string, error?: string}>}
   */
  async copy(payload) {
    if (!payload) {
      return { success: false, format: 'none', error: 'Empty payload provided to copy' };
    }

    // 1. Structured JSON Object
    if (payload.data !== undefined && typeof payload.data === 'object') {
      try {
        const jsonText = JSON.stringify(payload.data, null, 2);
        const codeBlockHtml = `<pre><code class="language-json">${jsonText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        await this.writeHTML(codeBlockHtml, jsonText);
        return { success: true, format: 'structured-json' };
      } catch (jsonErr) {
        return { success: false, format: 'structured-json', error: jsonErr.message };
      }
    }

    // 2. Formatted Code Block
    if (payload.code) {
      const codeString = String(payload.code);
      const lang = payload.language || 'text';
      const escapedCode = codeString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const htmlContent = `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
      await this.writeHTML(htmlContent, codeString);
      return { success: true, format: 'code-block' };
    }

    // 3. Formatted HTML + Plain Text
    if (payload.html) {
      await this.writeHTML(payload.html, payload.text || '');
      return { success: true, format: 'html' };
    }

    // 4. Plain Text
    if (payload.text !== undefined) {
      await this.writeText(payload.text);
      return { success: true, format: 'text' };
    }

    // 5. Unsupported data type (e.g. binary/image without text)
    console.warn('⚠️ [ClipboardService] Unsupported payload data type received for copy');
    return {
      success: false,
      format: 'unsupported',
      error: 'Unsupported payload: must provide text, html, code, or structured data'
    };
  }

  /**
   * High-level paste handler retrieving text or structured content
   * @returns {Promise<{success: boolean, text: string, isEmpty: boolean, format: string, error?: string}>}
   */
  async paste() {
    const result = await this.readText();
    if (!result.success) {
      return {
        success: false,
        text: '',
        isEmpty: true,
        format: 'none',
        error: result.error
      };
    }

    let detectedFormat = 'text';
    const trimmed = (result.text || '').trim();

    // Check if pasted content is structured JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        detectedFormat = 'structured-json';
      } catch (e) {
        // Just standard text
      }
    }

    return {
      success: true,
      text: result.text,
      isEmpty: result.isEmpty,
      format: detectedFormat
    };
  }
}

// Export singleton instance and class definition
const clipboardService = new ClipboardService();

module.exports = {
  ClipboardService,
  clipboardService
};
