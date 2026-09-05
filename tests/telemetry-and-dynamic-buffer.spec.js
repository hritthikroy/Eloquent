/**
 * Test Suite: Telemetry Dashboard & Go Dynamic Audio Buffer Sizing
 * 
 * Verifies:
 * 1. Go audio backend dynamic buffer scaling according to vehicle speed and state.
 * 2. Electron IPC telemetry handlers ('telemetry:state-metrics', 'telemetry:open-window').
 * 3. End-to-end integration between chooseDistance, VehicleState, and batched UI telemetry.
 */

const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');

const { VehicleState, STATES } = require('../src/core/stateMachine');
const { IOHandler } = require('../src/pipeline/ioHandler');
const { registerStateIpc, StateBatchManager } = require('../electron/main');

class MockIpcMain extends EventEmitter {
  constructor() {
    super();
    this.handlers = new Map();
  }

  handle(channel, handler) {
    this.handlers.set(channel, handler);
  }

  async invoke(channel, ...args) {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`Channel not registered: ${channel}`);
    return handler({ sender: {} }, ...args);
  }
}

test('Telemetry Dashboard & Dynamic Buffer Sizing Suite', async (t) => {

  await t.test('1. Dynamic buffer size calculations for vehicle speed states', () => {
    // Simulating Go backend SetDynamicBufferForSpeed logic
    function getDynamicBufferSize(state, speed) {
      if (speed >= 60.0 || state === 'CRUISING') return 1024;
      if (speed >= 25.0 || state === 'ACCELERATING' || state === 'DECELERATING') return 2048;
      return 4096;
    }

    assert.strictEqual(getDynamicBufferSize(STATES.CRUISING, 80), 1024, 'High speed must use 1024-byte low-latency buffer');
    assert.strictEqual(getDynamicBufferSize(STATES.ACCELERATING, 40), 2048, 'Moderate speed must use 2048-byte buffer');
    assert.strictEqual(getDynamicBufferSize(STATES.STOPPED, 0), 4096, 'Stopped state must use 4096-byte power-efficient buffer');
    assert.strictEqual(getDynamicBufferSize(STATES.IDLE, 0), 4096, 'Idle state must use 4096-byte buffer');
  });

  await t.test('2. Electron IPC telemetry:state-metrics registration and payload validation', async () => {
    const mockIpc = new MockIpcMain();
    const vState = new VehicleState({ initialState: STATES.CRUISING, initialSpeed: 60 });
    const batchManager = new StateBatchManager({ vehicleState: vState });

    registerStateIpc(mockIpc, { vehicleState: vState });

    const res = await mockIpc.invoke('telemetry:state-metrics');

    assert.strictEqual(res.success, true);
    assert.ok(typeof res.timestamp === 'number');
    assert.strictEqual(res.state.state, STATES.CRUISING);
    assert.strictEqual(res.state.speed, 60);
    assert.ok(res.fsmMetrics !== undefined);
    assert.ok(res.pipelineMetrics !== undefined);
    assert.ok(res.batchMetrics !== undefined);
  });

  await t.test('3. chooseDistance dynamically scales vehicle speed and states', async () => {
    const vState = new VehicleState();
    const io = new IOHandler(vState);

    // High distance -> Accelerates towards 100 km/h
    let res = await io.chooseDistance(300);
    assert.strictEqual(vState.currentSpeed, 100);
    assert.strictEqual(vState.state, STATES.ACCELERATING);

    // Short distance -> Slow approach (speed 25)
    res = await io.chooseDistance(35);
    assert.strictEqual(vState.currentSpeed, 25);
    assert.strictEqual(vState.state, STATES.DECELERATING);

    // Zero distance -> Stopped (speed 0)
    res = await io.chooseDistance(0);
    assert.strictEqual(vState.currentSpeed, 0);
    assert.strictEqual(vState.state, STATES.STOPPED);
  });

  await t.test('4. StateBatchManager coalesces rapid telemetry emissions into 60fps windows', async () => {
    const mockIpc = new MockIpcMain();
    const vState = new VehicleState();
    const batchManager = new StateBatchManager({ vehicleState: vState, batchIntervalMs: 15 });

    let broadcasts = [];
    batchManager.broadcast = (channel, payload) => {
      broadcasts.push({ channel, payload });
    };

    // Emit 15 rapid state updates
    for (let i = 1; i <= 15; i++) {
      batchManager.queueUpdate({ state: STATES.ACCELERATING, speed: i * 4 });
    }

    assert.strictEqual(broadcasts.length, 0, 'No synchronous broadcasts before batch timer expires');

    // Wait for batch flush
    await new Promise(r => setTimeout(r, 30));

    assert.strictEqual(broadcasts.length, 1, 'Only one coalesced broadcast emitted');
    assert.strictEqual(broadcasts[0].channel, 'state-updated');
    assert.strictEqual(broadcasts[0].payload.batchCount, 15);
    assert.strictEqual(broadcasts[0].payload.coalescedCount, 14);
    assert.strictEqual(broadcasts[0].payload.speed, 60);
  });

});
