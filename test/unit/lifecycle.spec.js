/**
 * Unit Test Suite: Multi-Layered Session Termination & Resource Cleanup Protocol
 * 
 * Validates:
 * 1. Notification to renderer windows to flush state prior to process teardown.
 * 2. Graceful SIGTERM dispatch to the Go audio child process and bounded wait.
 * 3. Escalation to SIGKILL when the child process hangs past the 2s timeout.
 * 4. Explicit setting of process.exitCode (0 for clean teardown, 1 for forced kill).
 * 5. AudioBridge.terminate() socket closure, queue drainage, and listener cleanup.
 * 6. IPC requestShutdown channel execution and error resilience.
 */

const assert = require('assert');
const EventEmitter = require('events');
const { shutdownSequence, registerLifecycleIpc } = require('../../src/main/index');
const { AudioBridge } = require('../../src/main/audio-bridge');

class MockChildProcess extends EventEmitter {
  constructor(options = {}) {
    super();
    this.pid = options.pid || 12345;
    this.killed = false;
    this.exitCode = null;
    this.signalCode = null;
    this.hangsOnSigterm = options.hangsOnSigterm || false;
    this.signalsReceived = [];
  }

  kill(signal = 'SIGTERM') {
    this.signalsReceived.push(signal);
    if (signal === 'SIGTERM') {
      if (!this.hangsOnSigterm) {
        setImmediate(() => {
          this.killed = true;
          this.exitCode = 0;
          this.signalCode = 'SIGTERM';
          this.emit('exit', 0, 'SIGTERM');
          this.emit('close', 0, 'SIGTERM');
        });
        return true;
      }
      // Simulate hung process: do not emit exit on SIGTERM
      return true;
    }

    if (signal === 'SIGKILL') {
      setImmediate(() => {
        this.killed = true;
        this.exitCode = null;
        this.signalCode = 'SIGKILL';
        this.emit('exit', null, 'SIGKILL');
        this.emit('close', null, 'SIGKILL');
      });
      return true;
    }

    return true;
  }
}

class MockBrowserWindow {
  constructor() {
    this.messagesSent = [];
    this.isDestroyedFlag = false;
    this.webContents = {
      isDestroyed: () => this.isDestroyedFlag,
      send: (channel, data) => {
        this.messagesSent.push({ channel, data });
      }
    };
  }
}

async function runTests() {
  console.log('🧪 Starting Lifecycle & Session Teardown Unit Tests...\n');

  // Test 1: Phase 1 - Notify Renderer to Flush State
  {
    console.log('▶ Test 1: Renderer notification to flush state before teardown');
    const mockWin1 = new MockBrowserWindow();
    const mockWin2 = new MockBrowserWindow();
    const mockChild = new MockChildProcess({ hangsOnSigterm: false });

    const res = await shutdownSequence({
      windows: [mockWin1, mockWin2],
      childProcess: mockChild,
      flushWaitMs: 10,
      timeoutMs: 500,
      skipAppExit: true,
      resetPromise: true
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.forced, false);
    assert.strictEqual(process.exitCode, 0, 'Clean shutdown must set process.exitCode to 0');

    // Verify messages delivered to webContents
    const win1Channels = mockWin1.messagesSent.map(m => m.channel);
    assert.ok(win1Channels.includes('app:prepare-shutdown'), 'Window 1 must receive app:prepare-shutdown');
    assert.ok(win1Channels.includes('session:flush-state'), 'Window 1 must receive session:flush-state');

    const win2Channels = mockWin2.messagesSent.map(m => m.channel);
    assert.ok(win2Channels.includes('app:prepare-shutdown'), 'Window 2 must receive app:prepare-shutdown');
    assert.ok(win2Channels.includes('session:flush-state'), 'Window 2 must receive session:flush-state');

    console.log('  ✅ Test 1 Passed: Renderer windows successfully notified to flush state.');
  }

  // Test 2: Phase 2 & 3 - Graceful SIGTERM & Clean Exit within Timeout
  {
    console.log('▶ Test 2: Graceful SIGTERM termination and clean process exit');
    const mockChild = new MockChildProcess({ hangsOnSigterm: false });

    const res = await shutdownSequence({
      childProcess: mockChild,
      flushWaitMs: 0,
      timeoutMs: 1000,
      skipAppExit: true,
      resetPromise: true
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.forced, false, 'Should not be forced if process exited on SIGTERM');
    assert.ok(mockChild.signalsReceived.includes('SIGTERM'), 'SIGTERM signal must be dispatched');
    assert.ok(!mockChild.signalsReceived.includes('SIGKILL'), 'SIGKILL should not be sent for responsive process');
    assert.strictEqual(process.exitCode, 0, 'Clean exit code must be 0');

    console.log('  ✅ Test 2 Passed: Go process cleanly exited on SIGTERM within timeout.');
  }

  // Test 3: Phase 4 - Hung Process Escalation to SIGKILL & process.exitCode = 1
  {
    console.log('▶ Test 3: Escalation to SIGKILL on hung Go process and exitCode = 1');
    const mockHungChild = new MockChildProcess({ hangsOnSigterm: true });

    // Use a short 200ms timeout for test speed
    const res = await shutdownSequence({
      childProcess: mockHungChild,
      flushWaitMs: 0,
      timeoutMs: 200,
      skipAppExit: true,
      resetPromise: true
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.forced, true, 'Must report forced escalation');
    assert.ok(mockHungChild.signalsReceived.includes('SIGTERM'), 'SIGTERM must have been attempted first');
    assert.ok(mockHungChild.signalsReceived.includes('SIGKILL'), 'SIGKILL must be sent after timeout exceeded');
    assert.strictEqual(process.exitCode, 1, 'Forced termination must set process.exitCode to 1');

    console.log('  ✅ Test 3 Passed: Hung Go process correctly escalated to SIGKILL with exitCode 1.');
  }

  // Test 4: AudioBridge.terminate() Cleanup & Zero Event Loop Hangs
  {
    console.log('▶ Test 4: AudioBridge.terminate() resource cleanup');
    let socketDestroyed = false;
    const mockSocket = {
      destroy: () => { socketDestroyed = true; }
    };

    const bridge = new AudioBridge({
      targetTickIntervalMs: 10,
      ipcSink: mockSocket
    });

    bridge.start();
    assert.strictEqual(bridge.isRunning, true);

    // Enqueue dummy frame
    bridge.ingestAudio(Buffer.from([0x01, 0x02, 0x03, 0x04]));

    const termRes = await bridge.terminate();
    assert.strictEqual(termRes.success, true);
    assert.strictEqual(bridge.isRunning, false, 'AudioBridge must not be running');
    assert.strictEqual(bridge.frameQueue.length, 0, 'Frame queue must be drained');
    assert.strictEqual(socketDestroyed, true, 'Underlying socket must be destroyed');
    assert.strictEqual(bridge.eventNames().length, 0, 'All EventEmitter listeners must be cleared');

    console.log('  ✅ Test 4 Passed: AudioBridge cleanly terminated with all resources freed.');
  }

  // Test 5: Renderer-Initiated Shutdown (IPC requestShutdown)
  {
    console.log('▶ Test 5: Renderer-initiated shutdown via IPC bridge');
    let ipcHandler = null;
    const mockIpcMain = {
      handle: (channel, handler) => {
        if (channel === 'app:request-shutdown') {
          ipcHandler = handler;
        }
      },
      removeHandler: () => {}
    };

    const mockChild = new MockChildProcess({ hangsOnSigterm: false });
    registerLifecycleIpc(mockIpcMain, {
      childProcess: mockChild,
      flushWaitMs: 0,
      timeoutMs: 500,
      skipAppExit: true,
      resetPromise: true
    });

    assert.ok(typeof ipcHandler === 'function', 'app:request-shutdown IPC handler must be registered');

    const result = await ipcHandler();
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.forced, false);
    assert.strictEqual(process.exitCode, 0);

    console.log('  ✅ Test 5 Passed: Renderer-initiated IPC requestShutdown successfully processed.');
  }

  // Test 6: Error Resilience with Missing or Dead Child Process
  {
    console.log('▶ Test 6: Error resilience when child process is null or already dead');
    const res = await shutdownSequence({
      childProcess: null,
      flushWaitMs: 0,
      timeoutMs: 100,
      skipAppExit: true,
      resetPromise: true
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.forced, false);
    assert.strictEqual(process.exitCode, 0);

    console.log('  ✅ Test 6 Passed: Handles null/dead process without throwing.');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL LIFECYCLE & SESSION TEARDOWN UNIT TESTS PASSED (100% GREEN)!');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('💥 Fatal error in lifecycle test suite:', err);
  process.exit(1);
});
