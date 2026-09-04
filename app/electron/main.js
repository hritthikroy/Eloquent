/**
 * Eloquent Desktop IPC Bridge - Multi-Agent Deep Research & Squad Coordination
 * 
 * Exposes secure IPC channels for real-time research dispatch, progress feeds,
 * and neural-mesh memory bank synchronization across the Electron desktop UI.
 */

const { BrowserWindow } = require('electron');
const { AndrewOrchestrator } = require('../../src/core/agent/andrew');
const { NeuralMeshMemoryBank } = require('../../src/core/memory/banks');

let orchestratorInstance = null;
let memoryBankInstance = null;

/**
 * Initialize and register research IPC handlers.
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} [options]
 */
function registerResearchIpc(ipcMain, options = {}) {
  if (!ipcMain) return null;

  if (!memoryBankInstance) {
    memoryBankInstance = options.memoryBank || new NeuralMeshMemoryBank();
  }

  if (!orchestratorInstance) {
    orchestratorInstance = options.orchestrator || new AndrewOrchestrator({ memoryBank: memoryBankInstance });
  }

  // 1. Dispatch deep research
  ipcMain.handle('research:dispatch', async (event, promptOrUrl, overrideOptions) => {
    try {
      const result = await orchestratorInstance.dispatchDeepResearch(promptOrUrl, overrideOptions);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 2. Query research and telemetry status
  ipcMain.handle('research:status', async () => {
    return orchestratorInstance.getTelemetry();
  });

  // 3. Query neural-mesh memory banks
  ipcMain.handle('memory:get-banks', async (event, agentId) => {
    return memoryBankInstance.getAgentMemory(agentId || 'agent_andrew');
  });

  // 4. Search memory vault across the squad
  ipcMain.handle('memory:query', async (event, searchPrompt, opts) => {
    return memoryBankInstance.query(searchPrompt, opts);
  });

  // 5. Trigger explicit memory bank persistence sync
  ipcMain.handle('memory:sync-banks', async () => {
    return memoryBankInstance.sync();
  });

  // Forward live progress and telemetry to all active renderer windows
  orchestratorInstance.on('research:dispatched', (data) => {
    broadcastToWindows('research:status-feed', { type: 'dispatched', ...data });
  });

  orchestratorInstance.on('research:progress', (data) => {
    broadcastToWindows('research:progress', data);
  });

  orchestratorInstance.on('research:completed', (data) => {
    broadcastToWindows('research:status-feed', { type: 'completed', ...data });
  });

  orchestratorInstance.on('research:error', (data) => {
    broadcastToWindows('research:status-feed', { type: 'error', ...data });
  });

  return {
    orchestrator: orchestratorInstance,
    memoryBank: memoryBankInstance
  };
}

function broadcastToWindows(channel, payload) {
  try {
    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, payload);
        }
      }
    }
  } catch (_) {}
}

module.exports = {
  registerResearchIpc,
  getOrchestrator: () => orchestratorInstance,
  getMemoryBank: () => memoryBankInstance
};
