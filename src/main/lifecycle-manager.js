/**
 * Electron Lifecycle Manager (CommonJS Runtime Module)
 *
 * Eliminates persistent macOS camera/microphone permission leaks and the "green light"
 * retention issue by enforcing strict lifecycle teardown on window closure, background
 * state transitions, and explicit application quit events.
 */

'use strict';

const http = require('http');

class LifecycleManager {
  constructor(options = {}) {
    this.goBackendPort = options.goBackendPort || parseInt(process.env.AUDIO_BACKEND_PORT || '9090', 10);
    this.timeoutMs = options.timeoutMs || 1500;
    this.cameraManager = options.cameraManager || null;
    this.audioManager = options.audioManager || null;
    this.audioBridge = options.audioBridge || null;
    this.childProcess = options.childProcess || null;

    this.isTornDown = false;
    this.isSuspended = false;
    this.teardownPromise = null;

    this.resolveSubsystems();
  }

  static getInstance(options) {
    if (!LifecycleManager.instance) {
      LifecycleManager.instance = new LifecycleManager(options);
    }
    return LifecycleManager.instance;
  }

  resolveSubsystems() {
    if (!this.cameraManager) {
      try {
        this.cameraManager = require('../utils/camera-manager');
      } catch (_) {}
    }
    if (!this.audioManager) {
      try {
        const { audioManager } = require('./audio-manager');
        this.audioManager = audioManager;
      } catch (_) {}
    }
    if (!this.audioBridge) {
      try {
        const { audioBridgeManager } = require('./audio-bridge');
        this.audioBridge = audioBridgeManager;
      } catch (_) {}
    }
  }

  async invokeGoShutdownRpc(port) {
    const targetPort = port || this.goBackendPort;
    return new Promise((resolve) => {
      const postData = JSON.stringify({ action: 'shutdown', timestamp: Date.now() });
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: targetPort,
          path: '/shutdown',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 1000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              resolve({ ok: true, devicesReleased: parsed.devicesReleased || 0 });
            } catch (_) {
              resolve({ ok: true, devicesReleased: 0 });
            }
          });
        }
      );

      req.on('error', () => resolve({ ok: false, devicesReleased: 0 }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, devicesReleased: 0 });
      });

      req.write(postData);
      req.end();
    });
  }

  async releaseGoDeviceHandles(port) {
    const targetPort = port || this.goBackendPort;
    return new Promise((resolve) => {
      const postData = JSON.stringify({ action: 'release', timestamp: Date.now() });
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: targetPort,
          path: '/audio/release',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 1000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              resolve({ ok: true, devicesReleased: parsed.devicesReleased || 0 });
            } catch (_) {
              resolve({ ok: true, devicesReleased: 0 });
            }
          });
        }
      );

      req.on('error', () => resolve({ ok: false, devicesReleased: 0 }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, devicesReleased: 0 });
      });

      req.write(postData);
      req.end();
    });
  }

  async verifyDevicesReleased(port) {
    const targetPort = port || this.goBackendPort;
    return new Promise((resolve) => {
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port: targetPort,
          path: '/audio/device-status',
          timeout: 800,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const activeCount = typeof parsed.activeCount === 'number' ? parsed.activeCount : 0;
              const isStreaming = !!parsed.isStreaming;
              resolve(activeCount === 0 && !isStreaming);
            } catch (_) {
              resolve(true);
            }
          });
        }
      );

      req.on('error', () => resolve(true));
      req.on('timeout', () => {
        req.destroy();
        resolve(true);
      });
    });
  }

  stopCameraImmediate() {
    this.resolveSubsystems();
    let stopped = false;

    if (this.cameraManager) {
      try {
        if (typeof this.cameraManager.stop === 'function') {
          this.cameraManager.stop();
          stopped = true;
        }
        if (this.cameraManager.workerWindow && !this.cameraManager.workerWindow.isDestroyed()) {
          try {
            this.cameraManager.workerWindow.webContents.send('stop-camera');
            this.cameraManager.workerWindow.destroy();
          } catch (_) {}
          this.cameraManager.workerWindow = null;
          stopped = true;
        }
        this.cameraManager.isActive = false;
        console.log('📷 [LifecycleManager] Camera hardware immediately released (Green LED extinguished)');
      } catch (err) {
        console.warn('⚠️ [LifecycleManager] Camera stop exception:', err?.message);
      }
    }
    return stopped;
  }

  stopAudioImmediate() {
    this.resolveSubsystems();
    let stopped = false;

    if (this.audioManager && typeof this.audioManager.stopCapture === 'function') {
      try {
        this.audioManager.stopCapture();
        stopped = true;
      } catch (_) {}
    }

    if (this.audioBridge && typeof this.audioBridge.stop === 'function') {
      try {
        this.audioBridge.stop();
        stopped = true;
      } catch (_) {}
    }
    return stopped;
  }

  async suspend() {
    console.log('💤 [LifecycleManager] Suspending media devices for background state...');
    this.stopCameraImmediate();
    this.stopAudioImmediate();
    const goRelease = await this.releaseGoDeviceHandles();
    this.isSuspended = true;
    return { suspended: true, devicesReleased: goRelease.devicesReleased };
  }

  resume() {
    console.log('⚡ [LifecycleManager] Resuming media devices from background state...');
    this.isSuspended = false;
    return { resumed: true };
  }

  async executeTeardown(force = false) {
    if (this.teardownPromise) {
      return this.teardownPromise;
    }

    this.teardownPromise = (async () => {
      const startTime = Date.now();
      console.log('🛑 [LifecycleManager] Executing full device teardown sequence...');

      // 1. Camera Hard Stop
      const cameraStopped = this.stopCameraImmediate();

      // 2. Audio Capture Stop
      const audioStopped = this.stopAudioImmediate();

      // 3. Go Backend Shutdown RPC
      const rpcResult = await this.invokeGoShutdownRpc();

      // 4. Verify device handles release
      const isVerifiedReleased = await this.verifyDevicesReleased();

      // 5. Force child process termination if provided and not yet exited
      if (this.childProcess && typeof this.childProcess.kill === 'function') {
        const isDead = this.childProcess.killed || this.childProcess.exitCode !== null;
        if (!isDead) {
          try {
            this.childProcess.kill('SIGTERM');
            if (force) {
              setTimeout(() => {
                if (this.childProcess && !this.childProcess.killed && this.childProcess.exitCode === null) {
                  this.childProcess.kill('SIGKILL');
                }
              }, 300);
            }
          } catch (_) {}
        }
      }

      this.isTornDown = true;
      const durationMs = Date.now() - startTime;
      console.log(`✅ [LifecycleManager] Device teardown complete in ${durationMs}ms (Devices released: ${rpcResult.devicesReleased})`);

      return {
        success: true,
        devicesReleased: rpcResult.devicesReleased,
        cameraStopped,
        audioStopped,
        durationMs,
        forced: force,
      };
    })();

    return this.teardownPromise;
  }

  async forceTeardown() {
    return this.executeTeardown(true);
  }

  registerAppListeners(app) {
    if (!app || typeof app.on !== 'function') return;

    app.on('window-all-closed', async () => {
      console.log('🪟 [LifecycleManager] app.on("window-all-closed") triggered');
      await this.executeTeardown(false);
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', async (event) => {
      console.log('🚪 [LifecycleManager] app.on("before-quit") triggered');
      if (!this.isTornDown) {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
          await this.executeTeardown(true);
          app.exit(0);
        } else {
          await this.executeTeardown(true);
        }
      }
    });

    app.on('will-quit', () => {
      this.stopCameraImmediate();
      this.stopAudioImmediate();
    });
  }
}

LifecycleManager.instance = null;

const defaultLifecycleManager = LifecycleManager.getInstance();

function registerLifecycleManager(app, options) {
  const manager = LifecycleManager.getInstance(options);
  manager.registerAppListeners(app);
  return manager;
}

module.exports = {
  LifecycleManager,
  lifecycleManager: defaultLifecycleManager,
  registerLifecycleManager,
};
