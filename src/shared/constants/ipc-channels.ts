/**
 * Standardized IPC Channel Constants for Clipboard Synchronization
 * Ensures strict type-safety and contract consistency between
 * Electron Main process, Preload Bridge, and React Renderer.
 */

export const CLIPBOARD_CHANNELS = {
  COPY: 'clipboard:copy',
  PASTE: 'clipboard:paste',
  READ_TEXT: 'clipboard:read-text',
  WRITE_TEXT: 'clipboard:write-text',
  WRITE_HTML: 'clipboard:write-html',
  CLEAR: 'clipboard:clear'
} as const;

export type ClipboardChannel = typeof CLIPBOARD_CHANNELS[keyof typeof CLIPBOARD_CHANNELS];

// CommonJS compatibility for Node.js main process
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CLIPBOARD_CHANNELS
  };
}
