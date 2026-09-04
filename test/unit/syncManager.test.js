/**
 * SyncManager & forceSyncWorker Unit Test Suite
 * 
 * Verifies:
 * 1. Non-blocking asynchronous forceSync execution offloaded to WebWorker.
 * 2. Strict render loop frame budget preservation (< 1 ms variance increase across 10,000 frames).
 * 3. Bidirectional message coordination (FORCE_SYNC_REQUEST / FORCE_SYNC_RESPONSE).
 * 4. Graceful fallback on worker termination, timeout, and message queue overflow.
 * 5. Telemetry accuracy: latency tracking, queue depth, failure and success counters.
 */

const assert = require('assert');
const { FORCE_SYNC_REQUEST, FORCE_SYNC_RESPONSE } = require('../../src/main/ipcChannels.js');
const { computeDriftMetrics, handleWorkerMessage } = require('../../src/renderer/forceSyncWorker.js');
const { SyncManager } = require('../../src/renderer/syncManager.js');

/**
 * High-fidelity MockWorker simulating browser WebWorker thread
 */
class MockWorker {
  constructor(options = {}) {
    this.delayMs = options.delayMs || 0;
    this.shouldError = options.shouldError || false;
    this.shouldIgnore = options.shouldIgnore || false;
    this.onmessage = null;
    this.onerror = null;
    this.listeners = { message: [], error: [] };
    this.postedMessages = [];
    this.isTerminated = false;
  }

  addEventListener(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event].push(handler);
    }
  }

  removeEventListener(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
    }
  }

  postMessage(message) {
    if (this.isTerminated) return;
    this.postedMessages.push(message);

    if (this.shouldIgnore) return;

    if (this.shouldError) {
      setTimeout(() => {
        const errorEvent = { message: 'Mock worker internal crash' };
        if (typeof this.onerror === 'function') this.onerror(errorEvent);
        this.listeners.error.forEach((h) => h(errorEvent));
      }, this.delayMs);
      return;
    }

    setTimeout(() => {
      if (this.isTerminated) return;
      handleWorkerMessage(message, (reply) => {
        const event = { data: reply };
        if (typeof this.onmessage === 'function') this.onmessage(event);
        this.listeners.message.forEach((h) => h(event));
      });
    }, this.delayMs);
  }

  terminate() {
    this.isTerminated = true;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING NON-BLOCKING FORCESYNC & WORKER VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(condition, name) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // --- SECTION 1: Drift Calculation Unit Logic ---
  console.log('--- 1. Testing Drift Metrics Computation ---');

  const baselineMetrics = computeDriftMetrics({
    sampleRate: 48000,
    totalAudioSamples: 48000 * 2, // 2.0s audio
    totalVisualFrames: 60 * 2,     // 2.0s visual (60 FPS)
    targetFps: 60,
  });

  test(baselineMetrics.clockDriftUs === 0, 'Zero drift when audio and visual clocks match');
  test(baselineMetrics.state === 'in-sync', 'State is in-sync when drift is within thresholds');

  const leadMetrics = computeDriftMetrics({
    sampleRate: 48000,
    totalAudioSamples: 48000 * 3, // 3.0s audio
    totalVisualFrames: 60 * 2,     // 2.0s visual
    targetFps: 60,
  });
  test(leadMetrics.state === 'recalibrating', 'Identifies severe lead (>50ms) as recalibrating');

  // --- SECTION 2: Worker Message Exchange ---
  console.log('\n--- 2. Testing Worker Asynchronous Message Dispatch ---');

  const mockWorker = new MockWorker({ delayMs: 5 });
  const manager = new SyncManager({
    workerInstance: mockWorker,
    timeoutMs: 2000,
  });

  const syncPromise = manager.requestForceSync({
    sampleRate: 48000,
    totalAudioSamples: 96000,
    totalVisualFrames: 120,
    targetFps: 60,
  });

  // Verify manager registered request in queue
  test(manager.getMetrics().queueDepth === 1, 'In-flight sync request added to queueDepth');

  const syncResult = await syncPromise;
  test(syncResult.success === true, 'requestForceSync successfully resolves');
  test(syncResult.offloadedToWorker === true, 'Execution was offloaded to dedicated worker');
  test(syncResult.driftMetrics.state === 'in-sync', 'Returns valid driftMetrics from worker');
  test(manager.getMetrics().queueDepth === 0, 'Queue depth decrements to 0 upon completion');
  test(manager.getMetrics().workerSuccessCount === 1, 'Increments workerSuccessCount');

  // --- SECTION 3: Frame Budget & Variance (< 1 ms across 10,000 frames) ---
  console.log('\n--- 3. Testing 16ms Frame Budget Stability across 10,000 Frames ---');

  const FRAME_BUDGET_MS = 16.666; // 60 FPS
  const NUM_FRAMES = 10000;

  // Simulate baseline frame rendering loop without forceSync
  const baselineDeltas = new Float64Array(NUM_FRAMES);
  for (let i = 0; i < NUM_FRAMES; i++) {
    const frameStart = performance.now();
    // Simulate typical renderer work (DOM reconciliation, CSS styling, small tasks ~0.5ms)
    let acc = 0;
    for (let j = 0; j < 500; j++) acc += Math.sqrt(j);
    const frameEnd = performance.now();
    baselineDeltas[i] = frameEnd - frameStart;
  }

  // Calculate baseline variance
  let baselineSum = 0;
  for (let i = 0; i < NUM_FRAMES; i++) baselineSum += baselineDeltas[i];
  const baselineMean = baselineSum / NUM_FRAMES;
  let baselineVarSum = 0;
  for (let i = 0; i < NUM_FRAMES; i++) {
    baselineVarSum += (baselineDeltas[i] - baselineMean) ** 2;
  }
  const baselineVariance = baselineVarSum / NUM_FRAMES;

  // Simulate frame loop with frequent concurrent worker forceSync calls
  const concurrentDeltas = new Float64Array(NUM_FRAMES);
  const fastWorker = new MockWorker({ delayMs: 1 });
  const perfManager = new SyncManager({ workerInstance: fastWorker });
  const backgroundPromises = [];

  for (let i = 0; i < NUM_FRAMES; i++) {
    const frameStart = performance.now();

    // Trigger non-blocking forceSync periodically during frame rendering
    if (i % 100 === 0) {
      backgroundPromises.push(perfManager.requestForceSync({
        sampleRate: 48000,
        totalAudioSamples: i * 800,
        totalVisualFrames: i,
      }));
    }

    // Identical renderer workload
    let acc = 0;
    for (let j = 0; j < 500; j++) acc += Math.sqrt(j);

    const frameEnd = performance.now();
    concurrentDeltas[i] = frameEnd - frameStart;
  }

  await Promise.all(backgroundPromises);

  // Calculate concurrent frame variance
  let concurrentSum = 0;
  for (let i = 0; i < NUM_FRAMES; i++) concurrentSum += concurrentDeltas[i];
  const concurrentMean = concurrentSum / NUM_FRAMES;
  let concurrentVarSum = 0;
  for (let i = 0; i < NUM_FRAMES; i++) {
    concurrentVarSum += (concurrentDeltas[i] - concurrentMean) ** 2;
  }
  const concurrentVariance = concurrentVarSum / NUM_FRAMES;

  const varianceIncreaseMs = Math.abs(concurrentVariance - baselineVariance);
  console.log(`   Baseline Frame Variance:   ${baselineVariance.toFixed(6)} ms²`);
  console.log(`   Concurrent Frame Variance: ${concurrentVariance.toFixed(6)} ms²`);
  console.log(`   Variance Difference:       ${varianceIncreaseMs.toFixed(6)} ms`);

  test(varianceIncreaseMs < 1.0, 'Frame time variance increase is strictly < 1.0 ms across 10,000 frames');
  test(concurrentMean < FRAME_BUDGET_MS, 'Average frame rendering time remains well within 16.6 ms frame budget');

  // --- SECTION 4: Queue Overflow Handling ---
  console.log('\n--- 4. Testing Queue Overflow Protection ---');

  const slowWorker = new MockWorker({ delayMs: 500 });
  const boundedManager = new SyncManager({
    workerInstance: slowWorker,
    maxQueueDepth: 4,
    fallbackOnFailure: false,
  });

  // Fill queue to max capacity (4 items)
  const pending = [];
  for (let i = 0; i < 4; i++) {
    pending.push(boundedManager.requestForceSync());
  }

  // 5th item should trigger queue overflow
  let caughtOverflow = false;
  try {
    await boundedManager.requestForceSync();
  } catch (err) {
    caughtOverflow = true;
    test(err.message.includes('queue overflow'), 'Rejects with queue overflow message when capacity exceeded');
  }
  test(caughtOverflow === true, 'Queue overflow guard throws when fallback is disabled');

  // Now test with fallbackOnFailure = true
  const fallbackManager = new SyncManager({
    workerInstance: slowWorker,
    maxQueueDepth: 2,
    fallbackOnFailure: true,
  });

  fallbackManager.requestForceSync(); // 1
  fallbackManager.requestForceSync(); // 2
  const overflowFallbackRes = await fallbackManager.requestForceSync(); // 3 -> overflows to fallback
  test(overflowFallbackRes.success === true, 'Seamlessly falls back to main thread when queue overflows');
  test(overflowFallbackRes.offloadedToWorker === false, 'Fallback executes synchronously on current thread');
  test(fallbackManager.getMetrics().fallbackCount > 0, 'Increments fallbackCount on queue overflow');

  // --- SECTION 5: Worker Timeout Guard ---
  console.log('\n--- 5. Testing Worker Timeout Guard & Fallback ---');

  const unresponsiveWorker = new MockWorker({ shouldIgnore: true });
  const timeoutManager = new SyncManager({
    workerInstance: unresponsiveWorker,
    timeoutMs: 40,
    fallbackOnFailure: true,
  });

  const timeoutRes = await timeoutManager.requestForceSync();
  test(timeoutRes.success === true, 'Timeout safely triggers main-thread fallback resolution');
  test(timeoutRes.offloadedToWorker === false, 'Result was computed via fallback');
  test(timeoutRes.fallbackReason.includes('timeout'), 'Provides timeout fallback reason');

  // --- SECTION 6: Worker Crash / Termination Handling ---
  console.log('\n--- 6. Testing Worker Crash Handling & Recovery ---');

  const crashingWorker = new MockWorker({ shouldError: true, delayMs: 10 });
  const recoveryManager = new SyncManager({
    workerInstance: crashingWorker,
    fallbackOnFailure: true,
  });

  const crashRes = await recoveryManager.requestForceSync();
  test(crashRes.success === true, 'Resolves via fallback when worker encounters an unhandled error');
  test(recoveryManager.getMetrics().fallbackCount > 0, 'Increments fallbackCount on worker error');

  // --- SECTION 7: Clean Termination ---
  console.log('\n--- 7. Testing Clean Termination & Resource Cleanup ---');

  const cleanManager = new SyncManager({ workerInstance: new MockWorker() });
  cleanManager.terminate();
  test(cleanManager.getMetrics().isWorkerActive === false, 'Worker is deactivated on terminate');
  test(cleanManager.pendingRequests.size === 0, 'Pending requests drained on terminate');

  console.log(`\n================================================================`);
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
  console.log(`================================================================\n`);
}

runTests().catch((err) => {
  console.error('Fatal error in syncManager tests:', err);
  process.exit(1);
});
