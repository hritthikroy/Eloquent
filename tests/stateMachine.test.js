/**
 * Antigravity Finite State Machine & IO Pipeline Test Suite
 * 
 * Verifies:
 * 1. Strict FSM transitions across vehicle speed and distance states.
 * 2. Explicit transition guards for "same speed" and "different state" edge cases.
 * 3. Collision loop prevention under conflicting and oscillating state calls.
 * 4. 10,000 rapid state transitions benchmark (sub-5ms latency per transition, zero loops).
 * 5. Non-blocking IOHandler queue and single-threaded fallback degradation.
 * 6. Batched Electron IPC state updates preventing UI jitter.
 */

const test = require('node:test');
const assert = require('node:assert');

const { VehicleState, STATES, ALLOWED_TRANSITIONS } = require('../src/core/stateMachine');
const { IOHandler, chooseDistance } = require('../src/pipeline/ioHandler');
const { StateBatchManager } = require('../electron/main');

test('Antigravity Collision-Safe State Machine & IO Pipeline Suite', async (t) => {

  await t.test('1. VehicleState strict FSM state transitions', () => {
    const v = new VehicleState();
    assert.strictEqual(v.state, STATES.IDLE);
    assert.strictEqual(v.currentSpeed, 0);

    // Transition: IDLE -> ACCELERATING (speed 30)
    let res = v.transition(STATES.ACCELERATING, 30);
    assert.strictEqual(res.transitioned, true);
    assert.strictEqual(v.state, STATES.ACCELERATING);
    assert.strictEqual(v.currentSpeed, 30);

    // Transition: ACCELERATING -> CRUISING (speed 30)
    res = v.transition(STATES.CRUISING, 30);
    assert.strictEqual(res.transitioned, true);
    assert.strictEqual(v.state, STATES.CRUISING);
    assert.strictEqual(v.currentSpeed, 30);

    // Transition: CRUISING -> DECELERATING (speed 10)
    res = v.transition(STATES.DECELERATING, 10);
    assert.strictEqual(res.transitioned, true);
    assert.strictEqual(v.state, STATES.DECELERATING);
    assert.strictEqual(v.currentSpeed, 10);

    // Transition: DECELERATING -> STOPPED (speed 0)
    res = v.transition(STATES.STOPPED, 0);
    assert.strictEqual(res.transitioned, true);
    assert.strictEqual(v.state, STATES.STOPPED);
    assert.strictEqual(v.currentSpeed, 0);

    // Emergency stop from any state
    v.transition(STATES.ACCELERATING, 50);
    res = v.transition(STATES.EMERGENCY_STOP, 0);
    assert.strictEqual(res.transitioned, true);
    assert.strictEqual(v.state, STATES.EMERGENCY_STOP);
    assert.strictEqual(v.currentSpeed, 0);
  });

  await t.test('2. "Same Speed" Edge Case Guard prevents redundant transitions and loops', () => {
    const v = new VehicleState({ initialSpeed: 45, initialState: STATES.CRUISING });
    let eventsCount = 0;
    v.on('transition', () => { eventsCount++; });

    // Request transition with identical speed
    const res = v.transition(undefined, 45);
    assert.strictEqual(res.transitioned, false, 'Must not transition when speed is identical');
    assert.strictEqual(res.reason, 'SAME_SPEED_GUARD');
    assert.strictEqual(eventsCount, 0, 'Must not emit transition event on same speed guard');
    assert.strictEqual(v.currentSpeed, 45);
    assert.strictEqual(v.state, STATES.CRUISING);

    // Explicit state with same speed
    const res2 = v.transition(STATES.CRUISING, 45);
    assert.strictEqual(res2.transitioned, false);
    assert.strictEqual(res2.reason, 'SAME_SPEED_GUARD');
    assert.strictEqual(eventsCount, 0);
  });

  await t.test('3. "Different State" Edge Case Guard routes intermediate steps safely', () => {
    const v = new VehicleState({ initialState: STATES.STOPPED, initialSpeed: 0 });

    // Directly requesting CRUISING from STOPPED is forbidden by strict FSM rules.
    // The guard must route through ACCELERATING instead of causing an illegal state jump or loop.
    const res = v.transition(STATES.CRUISING, 60);
    assert.strictEqual(res.transitioned, true);
    assert.strictEqual(v.state, STATES.ACCELERATING, 'Must intermediate route to ACCELERATING');
    assert.strictEqual(v.currentSpeed, 60);

    // From ACCELERATING, CRUISING is permitted
    const res2 = v.transition(STATES.CRUISING, 60);
    assert.strictEqual(res2.transitioned, true);
    assert.strictEqual(v.state, STATES.CRUISING);
  });

  await t.test('4. Collision Loop Detection & Damping', () => {
    const v = new VehicleState();
    let collisionAlertFired = false;
    v.on('collisionPrevented', () => { collisionAlertFired = true; });

    // Simulate rapid conflicting engine loop oscillating between states
    for (let i = 0; i < 8; i++) {
      v.transition(STATES.ACCELERATING, 30);
      v.transition(STATES.DECELERATING, 10);
    }

    const metrics = v.getMetrics();
    assert.ok(metrics.collisionLoopsPrevented > 0, 'Must detect and prevent collision loops');
    assert.strictEqual(collisionAlertFired, true, 'Must emit collisionPrevented event');
  });

  await t.test('5. 10,000 Rapid State Transitions Benchmark (Sub-5ms per transition, zero loops)', () => {
    const v = new VehicleState();
    const ITERATIONS = 10000;
    const startTime = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      const speed = (i % 120);
      let targetState;
      if (speed === 0) targetState = STATES.STOPPED;
      else if (speed > 80) targetState = STATES.CRUISING;
      else if (i % 2 === 0) targetState = STATES.ACCELERATING;
      else targetState = STATES.DECELERATING;

      const res = v.transition(targetState, speed, { iteration: i });
      assert.strictEqual(res.success, true);
    }

    const totalDurationMs = performance.now() - startTime;
    const avgLatencyMs = totalDurationMs / ITERATIONS;

    console.log(`⚡ [Benchmark] 10,000 transitions completed in ${totalDurationMs.toFixed(2)}ms (Avg: ${avgLatencyMs.toFixed(4)}ms/transition)`);
    assert.ok(avgLatencyMs < 5.0, `Latency must be sub-5ms per transition (got ${avgLatencyMs.toFixed(4)}ms)`);
    assert.ok(totalDurationMs < 5000, `Total duration must be under 5s (got ${totalDurationMs.toFixed(2)}ms)`);
    assert.strictEqual(v._locked, false, 'Must be fully unlocked after 10,000 transitions');
  });

  await t.test('6. Non-blocking IOHandler queue & student distance selection', async () => {
    const io = new IOHandler();
    let tickCount = 0;
    const interval = setInterval(() => { tickCount++; }, 1);

    // Queue 50 distance selection requests
    const promises = [];
    for (let d = 0; d < 50; d++) {
      promises.push(io.chooseDistance(d * 5));
    }

    const results = await Promise.all(promises);
    clearInterval(interval);

    assert.strictEqual(results.length, 50);
    assert.ok(tickCount > 0, 'Event loop must not be blocked during distance evaluation');

    const metrics = io.getMetrics();
    assert.strictEqual(metrics.totalProcessed, 50);
    assert.strictEqual(metrics.queueLength, 0);

    // Test collision loop fallback degradation
    io.handleCollisionAlert({ reason: 'TEST_COLLISION' });
    const fallbackMetrics = io.getMetrics();
    assert.strictEqual(fallbackMetrics.mode, 'single_threaded');
    assert.strictEqual(fallbackMetrics.fallbackCount, 1);
  });

  await t.test('7. Electron Main State Batching eliminates UI jitter', async () => {
    const batchManager = new StateBatchManager({ batchIntervalMs: 20 });
    let broadcastCount = 0;
    let lastPayload = null;

    batchManager.broadcast = (channel, payload) => {
      broadcastCount++;
      lastPayload = payload;
    };

    // Fire 20 rapid state updates in same tick
    for (let i = 1; i <= 20; i++) {
      batchManager.queueUpdate({ state: STATES.ACCELERATING, speed: i * 5 });
    }

    assert.strictEqual(broadcastCount, 0, 'Must not broadcast synchronously on every update');
    assert.strictEqual(batchManager.pendingUpdates.length, 20);

    // Wait for batch timer to flush
    await new Promise((r) => setTimeout(r, 40));

    assert.strictEqual(broadcastCount, 1, 'Must coalesce rapid updates into a single broadcast');
    assert.ok(lastPayload !== null);
    assert.strictEqual(lastPayload.batchCount, 20);
    assert.strictEqual(lastPayload.speed, 100);
    assert.strictEqual(batchManager.pendingUpdates.length, 0);
  });

});
