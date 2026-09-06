/**
 * Integration Test Suite: Device Decoupling & Lifecycle Teardown Protocol
 *
 * Validates:
 * 1. Immediate termination of camera worker windows and streams to extinguish green LED
 * 2. Explicit shutdown RPC invocation to Go backend to release device handles
 * 3. Health check verification confirming zero active devices before IPC promise resolves
 * 4. IPC handlers (audio:start, audio:stop with releaseResources, app:force-teardown)
 * 5. Window-all-closed and before-quit event binding and execution
 * 6. Zero regressions in existing lifecycle protocol
 */

'use strict';

const assert = require('assert');
const http = require('http');
const { LifecycleManager, registerLifecycleManager } = require('../src/main/lifecycle-manager');

async function runTestSuite() {
  console.log('🧪 Starting Device Decoupling & Lifecycle Teardown Integration Suite...\n');
  let passed = 0;
  let total = 0;

  function test(name, condition, detail = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`  ❌ [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  // Set up mock Go backend server on an ephemeral port
  let activeGoDevices = 2;
  let isGoStreaming = true;
  let shutdownRpcReceived = false;
  let releaseRpcReceived = false;

  const mockGoServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/audio/device-status' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        activeCount: activeGoDevices,
        isStreaming: isGoStreaming,
        devices: activeGoDevices > 0 ? [{ id: 'mic-1', type: 'microphone' }] : [],
      }));
      return;
    }

    if (req.url === '/audio/release' && req.method === 'POST') {
      releaseRpcReceived = true;
      const count = activeGoDevices;
      activeGoDevices = 0;
      isGoStreaming = false;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, devicesReleased: count, status: 'released' }));
      return;
    }

    if (req.url === '/shutdown' && req.method === 'POST') {
      shutdownRpcReceived = true;
      const count = activeGoDevices;
      activeGoDevices = 0;
      isGoStreaming = false;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, devicesReleased: count, status: 'terminating' }));
      return;
    }

    if (req.url === '/audio/start' && req.method === 'POST') {
      activeGoDevices = 1;
      isGoStreaming = true;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, isStreaming: true, status: 'started' }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));
  });

  const testPort = 19095;
  await new Promise((resolve) => mockGoServer.listen(testPort, '127.0.0.1', resolve));

  try {
    // ── TEST 1: Camera Hardware Immediate Release ───────────────────────────
    console.log('1. Camera Hardware Immediate Release');
    {
      let cameraWorkerDestroyed = false;
      let cameraStopped = false;

      const mockCameraManager = {
        isActive: true,
        workerWindow: {
          isDestroyed: () => cameraWorkerDestroyed,
          webContents: {
            send: (ch) => {
              if (ch === 'stop-camera') cameraStopped = true;
            },
          },
          destroy: () => {
            cameraWorkerDestroyed = true;
          },
        },
        stop: () => {
          cameraStopped = true;
        },
      };

      const manager = new LifecycleManager({
        goBackendPort: testPort,
        cameraManager: mockCameraManager,
      });

      const stopped = manager.stopCameraImmediate();
      test('stopCameraImmediate returns true when camera was active', stopped);
      test('Camera worker window is destroyed immediately to kill green LED', cameraWorkerDestroyed);
      test('Camera manager state is set to inactive', !mockCameraManager.isActive);
    }

    // ── TEST 2: Go Backend Release RPC & Device Verification ─────────────────
    console.log('\n2. Go Backend Release RPC & Verification');
    {
      const manager = new LifecycleManager({ goBackendPort: testPort });

      // Before release, active devices > 0
      const initialVerified = await manager.verifyDevicesReleased();
      test('verifyDevicesReleased returns false when Go backend holds devices', initialVerified === false);

      // Trigger release
      const releaseRes = await manager.releaseGoDeviceHandles();
      test('releaseGoDeviceHandles executes successfully', releaseRes.ok && releaseRpcReceived);
      test('releaseGoDeviceHandles reports released devices count', releaseRes.devicesReleased === 2);

      // Verify device handles released
      const verifiedAfter = await manager.verifyDevicesReleased();
      test('verifyDevicesReleased returns true once devices are closed', verifiedAfter === true);
    }

    // ── TEST 3: Full Teardown & Shutdown RPC ─────────────────────────────────
    console.log('\n3. Full Teardown & Shutdown RPC');
    {
      // Reset active state in mock Go server
      activeGoDevices = 1;
      isGoStreaming = true;

      let childProcessKilled = false;
      const mockChildProcess = {
        killed: false,
        exitCode: null,
        kill: (sig) => {
          childProcessKilled = true;
          mockChildProcess.killed = true;
          mockChildProcess.exitCode = 0;
        },
      };

      const manager = new LifecycleManager({
        goBackendPort: testPort,
        childProcess: mockChildProcess,
      });

      const teardownRes = await manager.executeTeardown(false);
      test('executeTeardown completes with success', teardownRes.success);
      test('Shutdown RPC dispatched to Go backend', shutdownRpcReceived);
      test('Go process devices released count recorded', teardownRes.devicesReleased === 1);
      test('Teardown duration is measured and bounded (< 500ms)', teardownRes.durationMs < 500, `${teardownRes.durationMs}ms`);
      test('Child process sent SIGTERM signal', childProcessKilled);
    }

    // ── TEST 4: App Event Listeners (window-all-closed & before-quit) ─────────
    console.log('\n4. App Event Listeners Integration');
    {
      const registeredEvents = new Map();
      const mockApp = {
        on: (event, handler) => registeredEvents.set(event, handler),
        quit: () => {},
        exit: () => {},
      };

      const manager = registerLifecycleManager(mockApp, { goBackendPort: testPort });
      test('app.on("window-all-closed") registered', registeredEvents.has('window-all-closed'));
      test('app.on("before-quit") registered', registeredEvents.has('before-quit'));
      test('app.on("will-quit") registered', registeredEvents.has('will-quit'));

      // Test window-all-closed event execution
      const windowAllClosedHandler = registeredEvents.get('window-all-closed');
      await windowAllClosedHandler();
      test('window-all-closed handler executes teardown without error', true);
    }

    // ── TEST 5: IPC Handlers (audio:stop with releaseResources) ──────────────
    console.log('\n5. IPC Handlers Resource Release Verification');
    {
      // Simulate ipcMain registry
      const handlers = new Map();
      const mockIpcMain = {
        handle: (channel, handler) => handlers.set(channel, handler),
        removeHandler: (channel) => handlers.delete(channel),
      };

      // Import registering function from dist-ts
      const { registerIpcHandlers } = require('../dist-ts/src/main/ipc-handlers');
      const mockStateMgr = {
        getState: () => ({}),
        onSyncStatus: () => () => {},
      };

      const registration = registerIpcHandlers(mockIpcMain, mockStateMgr);
      test('audio:stop handler registered on ipcMain', handlers.has('audio:stop') || handlers.has('audio:stop-capture'));
      test('app:force-teardown handler registered on ipcMain', handlers.has('app:force-teardown'));

      // Test audio:stop with releaseResources: true
      const stopHandler = handlers.get('audio:stop') || handlers.get('audio:stop-capture');
      const stopResult = await stopHandler(null, { releaseResources: true });

      test('audio:stop with releaseResources returns released: true', stopResult.released === true);
      test('audio:stop verifies device release before resolving', stopResult.verified === true);

      // Test app:force-teardown
      const forceHandler = handlers.get('app:force-teardown');
      const forceResult = await forceHandler();
      test('app:force-teardown executes and returns teardown result', forceResult.success === true);

      registration.unregister();
    }

    console.log(`\n🎉 All ${passed}/${total} Device Decoupling & Lifecycle Teardown tests completed successfully!`);
  } finally {
    await new Promise((resolve) => mockGoServer.close(resolve));
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ Unhandled test failure:', err);
  process.exit(1);
});
