/**
 * IPC Channels Definition
 * Standardized channel constants for coordinating synchronization between
 * Electron renderer, dedicated WebWorker threads, and the Go audio backend.
 */

export const FORCE_SYNC_REQUEST = 'force-sync:request';
export const FORCE_SYNC_RESPONSE = 'force-sync:response';

export const FORCE_SYNC_CHANNELS = Object.freeze({
  REQUEST: FORCE_SYNC_REQUEST,
  RESPONSE: FORCE_SYNC_RESPONSE,
});

export default FORCE_SYNC_CHANNELS;

// CommonJS compatibility for Node.js test runners and main process
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FORCE_SYNC_REQUEST,
    FORCE_SYNC_RESPONSE,
    FORCE_SYNC_CHANNELS,
    default: FORCE_SYNC_CHANNELS,
  };
}
