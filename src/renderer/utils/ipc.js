/**
 * IPC Utilities for Renderer Process
 * Standardized communication bridge for visual tracking ('eye') and movement events.
 */

const getIpcBridge = () => {
  if (typeof window !== 'undefined') {
    if (window.electronAPI) return window.electronAPI;
    if (window.ipcRenderer) return window.ipcRenderer;
  }
  return null;
};

/**
 * Sends a standardized eye movement/pose event from renderer to main process
 * @param {Object} event - Movement/pose event payload
 * @param {string} event.eventType - 'pose_change' | 'movement' | 'presence'
 * @param {'standing' | 'sitting' | 'walking' | 'unknown'} event.pose - Detected pose
 * @param {number} event.confidence - Confidence score between 0.0 and 1.0
 * @param {number} event.timestamp - Millisecond timestamp
 * @param {Object} [event.metrics] - Key kinematic measurements
 */
export function sendEyeMove(event) {
  const bridge = getIpcBridge();
  if (bridge && typeof bridge.send === 'function') {
    bridge.send('eye-move', event);
    return true;
  }
  return false;
}

/**
 * Listens for eye movement events dispatched across IPC
 * @param {Function} callback - Handler called with movement event data
 * @returns {Function} Unsubscribe function
 */
export function listenEyeMove(callback) {
  const bridge = getIpcBridge();
  if (bridge) {
    if (typeof bridge.receive === 'function') {
      bridge.receive('eye-move', callback);
      return () => {
        if (typeof bridge.removeAllListeners === 'function') {
          bridge.removeAllListeners('eye-move');
        }
      };
    }
    if (typeof bridge.on === 'function') {
      bridge.on('eye-move', (e, ...args) => callback(e && e.data ? e.data : (args[0] || e)));
      return () => {
        if (typeof bridge.removeAllListeners === 'function') {
          bridge.removeAllListeners('eye-move');
        }
      };
    }
  }
  return () => {};
}

/**
 * Emits an eye-unavailable event when camera is denied, disconnected, or fails
 * @param {Object|string} reason - Error description or reason object
 */
export function sendEyeUnavailable(reason) {
  const bridge = getIpcBridge();
  const payload = typeof reason === 'string' ? { error: reason, timestamp: Date.now() } : (reason || { error: 'Unknown', timestamp: Date.now() });
  if (bridge && typeof bridge.send === 'function') {
    bridge.send('eye-unavailable', payload);
    return true;
  }
  return false;
}

/**
 * Listens for eye-unavailable events
 * @param {Function} callback - Handler called when eye subsystem is unavailable
 * @returns {Function} Unsubscribe function
 */
export function listenEyeUnavailable(callback) {
  const bridge = getIpcBridge();
  if (bridge) {
    if (typeof bridge.receive === 'function') {
      bridge.receive('eye-unavailable', callback);
      return () => {
        if (typeof bridge.removeAllListeners === 'function') {
          bridge.removeAllListeners('eye-unavailable');
        }
      };
    }
    if (typeof bridge.on === 'function') {
      bridge.on('eye-unavailable', (e, ...args) => callback(e && e.data ? e.data : (args[0] || e)));
      return () => {
        if (typeof bridge.removeAllListeners === 'function') {
          bridge.removeAllListeners('eye-unavailable');
        }
      };
    }
  }
  return () => {};
}

/**
 * Sends general status updates for the eye tracker (active, paused, fps)
 * @param {Object} status 
 */
export function sendEyeStatus(status) {
  const bridge = getIpcBridge();
  if (bridge && typeof bridge.send === 'function') {
    bridge.send('eye-status', status);
    return true;
  }
  return false;
}

/**
 * Listens for eye status changes
 * @param {Function} callback 
 * @returns {Function} Unsubscribe function
 */
export function listenEyeStatus(callback) {
  const bridge = getIpcBridge();
  if (bridge) {
    if (typeof bridge.receive === 'function') {
      bridge.receive('eye-status', callback);
      return () => {
        if (typeof bridge.removeAllListeners === 'function') {
          bridge.removeAllListeners('eye-status');
        }
      };
    }
    if (typeof bridge.on === 'function') {
      bridge.on('eye-status', (e, ...args) => callback(e && e.data ? e.data : (args[0] || e)));
      return () => {
        if (typeof bridge.removeAllListeners === 'function') {
          bridge.removeAllListeners('eye-status');
        }
      };
    }
  }
  return () => {};
}

// CommonJS compatibility for Node.js environments and tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendEyeMove,
    listenEyeMove,
    sendEyeUnavailable,
    listenEyeUnavailable,
    sendEyeStatus,
    listenEyeStatus
  };
}
