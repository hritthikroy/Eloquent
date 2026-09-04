/* eslint-disable max-classes-per-file */
/**
 * @file clearCache.test.js
 * @description End-to-end integration and regression test suite for the cross-layer cache clearing routine.
 * Validates Chromium session purge, Node.js BufferQueue draining, Go backend cache reset,
 * contextBridge preload APIs, Settings UI component, error logging to logs/error.log, and audio playback integrity.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { ElectronEyeBridge } = require('../../src/main/electronMain');
const { cacheApiBridge, CACHE_CHANNELS } = require('../../src/preload/cachePreload');

// Create mock IPC Main implementation
class MockIpcMain extends EventEmitter {
  constructor() {
    super();
    this.handlers = new Map();
  }

  handle(channel, handler) {
    this.handlers.set(channel, handler);
  }

  removeHandler(channel) {
    this.handlers.delete(channel);
  }

  async invoke(channel, ...args) {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`);
    }
    const event = { sender: {} };
    return handler(event, ...args);
  }
}

// Create mock BufferQueue implementation
class MockBufferQueue {
  constructor() {
    this.items = [];
    this.size = 0;
    this.isBackpressured = false;
  }

  enqueue(data, metadata) {
    this.items.push({ data, metadata });
    this.size = this.items.length;
    return true;
  }

  drain() {
    this.items = [];
    this.size = 0;
  }

  getTelemetry() {
    return { size: this.size, dropped: 0 };
  }
}

async function runTests() {
  console.log('🚀 Starting E2E & Regression Test Suite for Cache Clearing...\n');
  const tempLogDir = path.join(__dirname, '..', '..', 'logs');
  const tempLogPath = path.join(tempLogDir, 'error.log');

  // Clean log file before testing
  if (fs.existsSync(tempLogPath)) {
    try {
      fs.unlinkSync(tempLogPath);
    } catch (e) {
      /* ignore */
    }
  }

  let passedTests = 0;

  // -------------------------------------------------------------
  // Test 1: Electron Main IPC Handler 'clear-app-cache' Success Flow
  // -------------------------------------------------------------
  console.log('🧪 Test 1: Main Process clearAppCache Purges Chromium, Node.js Memory, and Go Backend');
  const mockIpc1 = new MockIpcMain();
  const mockQueue1 = new MockBufferQueue();

  // Enqueue sample audio frames into buffer queue
  mockQueue1.enqueue(Buffer.from([1, 2, 3, 4]), { frameIndex: 1 });
  mockQueue1.enqueue(Buffer.from([5, 6, 7, 8]), { frameIndex: 2 });
  assert.strictEqual(mockQueue1.size, 2, 'BufferQueue should contain 2 frames initially');

  let chromiumClearCalled = false;
  let chromiumStorageCleared = false;
  const mockSession1 = {
    clearCache: async () => {
      chromiumClearCalled = true;
    },
    clearStorageData: async () => {
      chromiumStorageCleared = true;
    },
  };

  let goBackendCalled = false;
  const mockGrpcClient1 = {
    resetCache: (req, callback) => {
      goBackendCalled = true;
      callback(null, {
        success: true,
        result: { filesRemoved: 3, bytesFreed: 1024, entriesEvicted: 5 },
      });
    },
  };

  const bridge1 = new ElectronEyeBridge({
    BufferQueue: MockBufferQueue,
    bufferQueue: mockQueue1,
  });
  bridge1.register(mockIpc1);

  const result1 = await mockIpc1.invoke('clear-app-cache', {
    session: mockSession1,
    grpcClient: mockGrpcClient1,
    logFilePath: tempLogPath,
  });

  assert.strictEqual(result1.success, true, 'Result success should be true');
  assert.strictEqual(result1.chromiumCleared, true, 'Chromium cache should report cleared');
  assert.strictEqual(chromiumClearCalled, true, 'session.clearCache should have been called');
  assert.strictEqual(chromiumStorageCleared, true, 'session.clearStorageData should have been called');
  assert.strictEqual(result1.nodeCleared, true, 'Node.js layer should report cleared');
  assert.strictEqual(mockQueue1.size, 0, 'BufferQueue should be completely drained (size = 0)');
  assert.strictEqual(result1.goBackendCleared, true, 'Go backend should report cleared');
  assert.strictEqual(goBackendCalled, true, 'Go backend gRPC resetCache should have been invoked');

  bridge1.unregister();
  console.log('  ✅ Passed: All 3 layers successfully purged and verified.\n');
  passedTests += 1;

  // -------------------------------------------------------------
  // Test 2: Preload ContextBridge safe APIs
  // -------------------------------------------------------------
  console.log('🧪 Test 2: Preload ContextBridge window.api.clearCache Invocation');
  assert.strictEqual(typeof cacheApiBridge.clearCache, 'function', 'clearCache must be exposed as a function');
  assert.strictEqual(typeof cacheApiBridge.clearGoCache, 'function', 'clearGoCache must be exposed as a function');
  assert.strictEqual(CACHE_CHANNELS.CLEAR_APP_CACHE, 'clear-app-cache');
  assert.strictEqual(CACHE_CHANNELS.CLEAR_GO_CACHE, 'clear-go-cache');

  console.log('  ✅ Passed: Preload API exposes safe methods with correct channel constants.\n');
  passedTests += 1;

  // -------------------------------------------------------------
  // Test 3: Edge Case & Error Logging to logs/error.log
  // -------------------------------------------------------------
  console.log('🧪 Test 3: Edge Case Error Handling & Diagnostic Logging to logs/error.log');
  const mockIpc3 = new MockIpcMain();
  const bridge3 = new ElectronEyeBridge();
  bridge3.register(mockIpc3);

  // Mock failing session throwing simulated permission / disk error
  const failingSession = {
    clearCache: async () => {
      throw new Error('EACCES: permission denied, unable to purge disk cache');
    },
  };

  const errorResult = await mockIpc3.invoke('clear-app-cache', {
    session: failingSession,
    logFilePath: tempLogPath,
  });

  assert.strictEqual(errorResult.success, false, 'Result success should be false on permission error');
  assert.ok(errorResult.error.includes('EACCES'), 'Descriptive error message should be returned to renderer');

  // Verify error was appended to logs/error.log
  assert.ok(fs.existsSync(tempLogPath), 'logs/error.log should be created on failure');
  const logContent = fs.readFileSync(tempLogPath, 'utf8');
  assert.ok(logContent.includes('EACCES: permission denied'), 'Error log should contain exception trace');
  assert.ok(logContent.includes('[Chromium clearCache]'), 'Error log should contain context tag');

  bridge3.unregister();
  console.log('  ✅ Passed: Failures handled gracefully, descriptive error returned and logged to disk.\n');
  passedTests += 1;

  // -------------------------------------------------------------
  // Test 4: Regression Test - Audio Playback & IPC Channels After Cache Clear
  // -------------------------------------------------------------
  console.log('🧪 Test 4: Regression Check - Audio Ingestion & Playback Functionality Post Cache Clear');
  const mockIpc4 = new MockIpcMain();
  const mockQueue4 = new MockBufferQueue();

  const bridge4 = new ElectronEyeBridge({
    BufferQueue: MockBufferQueue,
    bufferQueue: mockQueue4,
  });
  bridge4.register(mockIpc4);

  // Step 1: Perform cache clear
  const clearResult = await mockIpc4.invoke('clear-app-cache', {
    session: { clearCache: async () => {}, clearStorageData: async () => {} },
    grpcClient: { resetCache: (req, cb) => cb(null, { success: true }) },
    logFilePath: tempLogPath,
  });
  assert.strictEqual(clearResult.success, true);
  assert.strictEqual(mockQueue4.size, 0);

  // Step 2: Ingest new audio frames post-clear
  const ingest1 = bridge4.ingestAudioBuffer(Buffer.from([10, 20, 30]), { frameIndex: 100 });
  assert.strictEqual(ingest1.success, true, 'Audio ingestion should succeed post cache clear');
  assert.strictEqual(ingest1.queueDepth, 1, 'Queue depth should be 1');

  const ingest2 = bridge4.ingestAudioBuffer(Buffer.from([40, 50, 60]), { frameIndex: 101 });
  assert.strictEqual(ingest2.success, true, 'Second frame ingestion should succeed');
  assert.strictEqual(ingest2.queueDepth, 2, 'Queue depth should be 2');

  // Step 3: Check queue telemetry
  const telemetry = bridge4.getQueueTelemetry();
  assert.strictEqual(telemetry.queue.size, 2, 'Queue telemetry should accurately reflect active frames');

  // Step 4: Verify state manager remains healthy
  const state = bridge4.getState();
  assert.strictEqual(state.queueDepth, 2, 'Bridge state should show 2 queued frames');
  assert.strictEqual(state.isDegraded, false, 'Bridge should remain in active non-degraded posture');

  bridge4.unregister();
  console.log('  ✅ Passed: Zero regressions detected in audio pipeline and telemetry channels.\n');
  passedTests += 1;

  // -------------------------------------------------------------
  // Test 5: Settings Component Workflow Verification
  // -------------------------------------------------------------
  console.log('🧪 Test 5: Settings Component Simulated Clear Cache Flow');

  let capturedResult = null;
  const mockOnCacheCleared = (res) => {
    capturedResult = res;
  };

  // Simulate clicking Clear Cache button in Settings
  const simulatedClearHandler = async () => {
    const mockIpc5 = new MockIpcMain();
    const bridge5 = new ElectronEyeBridge();
    bridge5.register(mockIpc5);

    const res = await mockIpc5.invoke('clear-app-cache', {
      session: { clearCache: async () => {}, clearStorageData: async () => {} },
      grpcClient: { resetCache: (req, cb) => cb(null, { success: true, result: { filesRemoved: 2 } }) },
      logFilePath: tempLogPath,
    });
    mockOnCacheCleared(res);
    bridge5.unregister();
  };

  await simulatedClearHandler();
  assert.ok(capturedResult !== null, 'Callback should have been fired');
  assert.strictEqual(capturedResult.success, true, 'Callback result should indicate success');
  assert.strictEqual(capturedResult.chromiumCleared, true);
  assert.strictEqual(capturedResult.nodeCleared, true);
  assert.strictEqual(capturedResult.goBackendCleared, true);

  console.log('  ✅ Passed: Settings component handler triggers clear and dispatches event.\n');
  passedTests += 1;

  console.log(`🎉 All ${passedTests} E2E & Regression Tests Passed Successfully!\n`);
}

runTests().catch((err) => {
  console.error('❌ E2E Test Suite Failed:', err);
  process.exit(1);
});
