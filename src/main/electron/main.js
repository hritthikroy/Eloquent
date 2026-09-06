/**
 * Electron Main Process Antiquity Proxy Initializer
 *
 * Establishes secure IPC channels between Electron Renderer and the Antiquity
 * proxy layer, enforcing session authentication handshakes and schema validation.
 */

'use strict';

const path = require('path');
const { AntiquityToolRouter, defaultRouter } = require('../../proxy/tool-router');

// Attempt to load electron ipcMain safely
let electronIpcMain = null;
try {
  // eslint-disable-next-line global-require
  const electron = require('electron');
  electronIpcMain = electron.ipcMain || null;
} catch (e) {
  // Graceful fallback in non-Electron test harnesses
}

/**
 * Initializes Antiquity Proxy and registers IPC handlers.
 *
 * @param {object} [ipc] Optional custom IPC instance (defaults to electron.ipcMain)
 * @param {AntiquityToolRouter} [routerInstance] Optional custom AntiquityToolRouter instance
 * @returns {{ router: AntiquityToolRouter, channels: string[] }}
 */
function initializeAntiquityProxy(ipc = electronIpcMain, routerInstance = defaultRouter) {
  const router = routerInstance || new AntiquityToolRouter();
  const registeredChannels = [];

  if (!ipc || typeof ipc.handle !== 'function') {
    return {
      router,
      channels: [],
      warning: 'IPC handle function not available in current environment',
    };
  }

  // 1. Handshake Channel: Negotiates session token for renderer client
  ipc.handle('antiquity:handshake', async (event, args = {}) => {
    const clientId = (args && args.clientId) ? args.clientId : 'renderer-window';
    const sessionToken = router.generateSessionHandshake(clientId);
    return {
      ok: true,
      authToken: sessionToken,
      registeredTools: router.getHealthStatus().registeredTools,
      timestamp: Date.now(),
    };
  });
  registeredChannels.push('antiquity:handshake');

  // 2. Invoke Channel: Intercepts, validates against schema.json, routes to microservice
  ipc.handle('antiquity:invoke', async (event, request = {}) => {
    try {
      const response = await router.routeToolInvocation(request);
      return response;
    } catch (err) {
      return {
        success: false,
        requestId: request.requestId || 'unknown',
        tool: request.tool || 'unknown',
        data: null,
        error: {
          code: 'ROUTER_UNHANDLED_EXCEPTION',
          message: err.message || 'Internal proxy routing exception',
          details: [err.stack ? err.stack.split('\n')[0] : 'Unknown error'],
        },
        executionTimeMs: 0,
      };
    }
  });
  registeredChannels.push('antiquity:invoke');

  // 3. Status & Health Channel: Telemetry for UI monitoring dashboard
  ipc.handle('antiquity:status', async () => {
    return router.getHealthStatus();
  });
  registeredChannels.push('antiquity:status');

  // 4. Revocation Channel: Clean up session token on window unload
  ipc.handle('antiquity:revoke', async (event, args = {}) => {
    if (args && args.authToken) {
      const revoked = router.revokeAuthToken(args.authToken);
      return { ok: revoked };
    }
    return { ok: false };
  });
  registeredChannels.push('antiquity:revoke');

  return {
    router,
    channels: registeredChannels,
  };
}

// Auto-initialize if running in Electron main process
if (electronIpcMain) {
  initializeAntiquityProxy(electronIpcMain, defaultRouter);
}

module.exports = {
  initializeAntiquityProxy,
  defaultRouter,
};
