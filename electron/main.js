/**
 * Electron Main Process State Synchronization Bridge
 * 
 * Exposes secure IPC channels for state requests and commits,
 * and batches state update messages to prevent UI repaint jitter
 * caused by high-frequency engine transitions.
 * 
 * Interacts with electron/preload.js (window.electronAPI).
 */

const { BrowserWindow } = require('electron');
const { VehicleState, STATES } = require('../src/core/stateMachine');

class StateBatchManager {
  constructor(options = {}) {
    this.batchIntervalMs = options.batchIntervalMs || 16; // ~60fps coalescing
    this.vehicleState = options.vehicleState || new VehicleState();
    this.pendingUpdates = [];
    this.batchTimer = null;
    this.totalBatchesSent = 0;
    this.totalUpdatesCoalesced = 0;

    // Automatically hook VehicleState transition events
    if (this.vehicleState && typeof this.vehicleState.on === 'function') {
      this.vehicleState.on('stateChange', (state) => {
        this.queueUpdate(state);
      });
    }
  }

  /**
   * Queues a state update and schedules batched broadcast.
   */
  queueUpdate(update) {
    this.pendingUpdates.push({
      ...update,
      receivedAt: Date.now()
    });

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flush();
      }, this.batchIntervalMs);
    }
  }

  /**
   * Flushes and coalesces all pending updates into a single broadcast.
   */
  flush() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingUpdates.length === 0) return null;

    const count = this.pendingUpdates.length;
    this.totalUpdatesCoalesced += count;
    this.totalBatchesSent++;

    // Coalesce into the most recent state snapshot
    const latest = this.pendingUpdates[this.pendingUpdates.length - 1];
    const batchedPayload = {
      ...latest,
      batchCount: count,
      coalescedCount: count - 1,
      batchTimestamp: Date.now()
    };

    this.pendingUpdates = [];
    this.broadcast('state-updated', batchedPayload);
    return batchedPayload;
  }

  /**
   * Broadcasts message to all active BrowserWindow instances.
   */
  broadcast(channel, payload) {
    try {
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed() && win.webContents) {
            win.webContents.send(channel, payload);
          }
        }
      }
    } catch (_) {}
  }

  getMetrics() {
    return {
      totalBatchesSent: this.totalBatchesSent,
      totalUpdatesCoalesced: this.totalUpdatesCoalesced,
      pendingCount: this.pendingUpdates.length,
      currentState: this.vehicleState.getState()
    };
  }

  reset() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.pendingUpdates = [];
    this.totalBatchesSent = 0;
    this.totalUpdatesCoalesced = 0;
    if (this.vehicleState && typeof this.vehicleState.reset === 'function') {
      this.vehicleState.reset();
    }
  }
}

let batchManagerInstance = null;

function getBatchManager(options = {}) {
  if (!batchManagerInstance) {
    batchManagerInstance = new StateBatchManager(options);
  }
  return batchManagerInstance;
}

/**
 * Registers IPC handlers for state management.
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} [options]
 */
function registerStateIpc(ipcMain, options = {}) {
  if (!ipcMain) return null;

  const manager = getBatchManager(options);
  const vState = manager.vehicleState;

  // 1. state-request handler
  ipcMain.handle('state-request', async () => {
    return vState.getState();
  });

  // 2. state-commit handler
  ipcMain.handle('state-commit', async (_event, commitPayload) => {
    try {
      if (!commitPayload) {
        return { success: false, error: 'Empty commit payload' };
      }

      let result;
      if (commitPayload.distance !== undefined) {
        result = vState.chooseDistance(commitPayload.distance, commitPayload);
      } else if (commitPayload.speed !== undefined) {
        result = vState.setSpeed(commitPayload.speed);
      } else if (commitPayload.state) {
        result = vState.transition(commitPayload.state, commitPayload.speed, commitPayload);
      } else {
        result = vState.getState();
      }

      // Automatically queued via stateChange listener
      return { success: true, result, state: vState.getState() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 3. state-change event listener
  ipcMain.on('state-change', (_event, payload) => {
    manager.queueUpdate(payload);
  });

  return {
    manager,
    vehicleState: vState
  };
}

module.exports = {
  StateBatchManager,
  registerStateIpc,
  getBatchManager,
  STATES
};
