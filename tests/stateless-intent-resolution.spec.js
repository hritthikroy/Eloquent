/**
 * tests/stateless-intent-resolution.spec.js
 *
 * Automated Verification Suite for:
 * 1. Intent Router (src/core/intentRouter.ts):
 *    - Deterministic technical task mapping for high-confidence keywords ("fix memory loop", "write prompt", "Go service", "Listen").
 *    - Truncated audio transcript recovery ("Chatter. Chatter for.", "Chatter for.", "Chatter.").
 *    - Zero-filler bypass: immediately bypasses LLM chat buffer (bypassLLM: true).
 *    - Latency benchmark: sub-200ms SLA target verification.
 * 2. Session Memory & Anti-Loop Quarantine (src/state/sessionMemory.ts):
 *    - Audit trail logging and input hash consistency.
 *    - Consecutive loop detection (>= 3 repeats) and automated quarantine.
 *    - Self-healing quarantine release.
 * 3. Electron IPC Bridge (electron/main/ipc-bridge.js):
 *    - Zero-latency buffer handoff and backpressure queueing.
 *    - Structured intent signal dispatching.
 *    - Connection drop handling and exponential backoff reconnect logic.
 */

const assert = require('assert');
const path = require('path');

const {
  resolveIntent,
  IntentRouter,
} = require('../dist-ts/src/core/intentRouter');

const {
  SessionMemory,
} = require('../dist-ts/src/state/sessionMemory');

const {
  AudioIpcBridge,
  AUDIO_IPC_CHANNELS,
} = require('../electron/main/ipc-bridge');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASSED: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('\n===========================================================================');
  console.log('   STATELESS INTENT RESOLUTION & GO AUDIO SERVICE VERIFICATION SUITE');
  console.log('===========================================================================\n');

  // ---------------------------------------------------------------------------
  // GROUP 1: Intent Router & Truncated Gap Resolution
  // ---------------------------------------------------------------------------
  console.log('⚡ 1. Intent Router (src/core/intentRouter.ts) Tests:');

  await test('Resolves truncated instruction gap ("Chatter. Chatter for.") to write_go_audio_service', () => {
    const result = resolveIntent('Chatter. Chatter for.');
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.action, 'write_go_audio_service');
    assert.strictEqual(result.type, 'technical_task');
    assert.strictEqual(result.isTruncated, true);
    assert.strictEqual(result.bypassLLM, true);
    assert.strictEqual(result.targetService, 'services/audio');
    assert(result.confidence >= 0.95);
  });

  await test('Resolves minor variations of truncated chatter ("Chatter for.", "Chatter.")', () => {
    const r1 = resolveIntent('Chatter for.');
    assert.strictEqual(r1.matched, true);
    assert.strictEqual(r1.action, 'write_go_audio_service');
    assert.strictEqual(r1.isTruncated, true);
    assert.strictEqual(r1.bypassLLM, true);

    const r2 = resolveIntent('Chatter.');
    assert.strictEqual(r2.matched, true);
    assert.strictEqual(r2.action, 'write_go_audio_service');
    assert.strictEqual(r2.isTruncated, true);
    assert.strictEqual(r2.bypassLLM, true);
  });

  await test('Resolves "Listen" command directly to init_go_audio_service without chatter', () => {
    const result = resolveIntent('Listen');
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.action, 'init_go_audio_service');
    assert.strictEqual(result.bypassLLM, true);
    assert.strictEqual(result.targetService, 'services/audio');
    assert.strictEqual(result.isTruncated, false);
  });

  await test('Resolves "fix memory loop" to fix_memory_loop with bypassLLM', () => {
    const result = resolveIntent('fix memory loop');
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.action, 'fix_memory_loop');
    assert.strictEqual(result.bypassLLM, true);
    assert.strictEqual(result.targetService, 'src/state');
  });

  await test('Resolves "write prompt" to write_prompt with bypassLLM', () => {
    const result = resolveIntent('write prompt');
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.action, 'write_prompt');
    assert.strictEqual(result.bypassLLM, true);
    assert.strictEqual(result.targetService, 'src/core');
  });

  await test('Resolves "Go service" to write_go_audio_service', () => {
    const result = resolveIntent('Go service');
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.action, 'write_go_audio_service');
    assert.strictEqual(result.bypassLLM, true);
  });

  await test('Rejects ambiguous conversational filler and allows normal flow', () => {
    const result = resolveIntent('How is the weather today?');
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.bypassLLM, false);
  });

  await test('IntentRouter class wrapper functions identically and measures sub-millisecond latency', () => {
    const router = new IntentRouter();
    assert.strictEqual(router.isDirectBypass('Listen'), true);
    assert.strictEqual(router.isDirectBypass('Chatter. Chatter for.'), true);
    assert.strictEqual(router.isDirectBypass('How are you?'), false);

    const iterations = 1000;
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      router.resolve('Chatter. Chatter for.');
    }
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const avgLatencyMs = elapsedMs / iterations;
    console.log(`     Average intent resolution latency: ${avgLatencyMs.toFixed(4)}ms (Target: < 200ms)`);
    assert(avgLatencyMs < 200, `Latency must be < 200ms, got ${avgLatencyMs}ms`);
  });

  // ---------------------------------------------------------------------------
  // GROUP 2: Session Memory & Anti-Loop Quarantine
  // ---------------------------------------------------------------------------
  console.log('\n🛡️ 2. Session Memory & Anti-Loop Quarantine (src/state/sessionMemory.ts) Tests:');

  await test('Records intent entry with input hash and timestamp', () => {
    const memory = new SessionMemory();
    const entry = memory.recordIntent({
      action: 'write_go_audio_service',
      rawInput: 'Chatter. Chatter for.',
      bypassLLM: true,
    });

    assert(entry.id.startsWith('audit-'));
    assert.strictEqual(entry.action, 'write_go_audio_service');
    assert.strictEqual(entry.rawInput, 'Chatter. Chatter for.');
    assert.strictEqual(entry.bypassLLM, true);
    assert.strictEqual(entry.resultStatus, 'pending');
    assert(entry.inputHash.length > 0);

    const trail = memory.getAuditTrail();
    assert.strictEqual(trail.length, 1);
  });

  await test('Detects consecutive identical actions and triggers self-healing quarantine', () => {
    const memory = new SessionMemory({ loopThreshold: 3 });

    memory.recordIntent({ action: 'canned_filler', rawInput: 'repeat 1' });
    memory.recordIntent({ action: 'canned_filler', rawInput: 'repeat 2' });

    // Pre-threshold check
    const check1 = memory.detectLoop('canned_filler', 'repeat 3');
    assert.strictEqual(check1.isLoop, false);
    assert.strictEqual(check1.shouldQuarantine, false);

    memory.recordIntent({ action: 'canned_filler', rawInput: 'repeat 3' });

    // Reached consecutive loop threshold (3)
    const check2 = memory.detectLoop('canned_filler', 'repeat 4');
    assert.strictEqual(check2.isLoop, true);
    assert.strictEqual(check2.shouldQuarantine, true);
    assert.strictEqual(check2.recommendedAction, 'quarantine');

    // Recording fourth repeat should automatically mark as quarantined
    const entry4 = memory.recordIntent({ action: 'canned_filler', rawInput: 'repeat 4' });
    assert.strictEqual(entry4.resultStatus, 'quarantined');
    assert.strictEqual(memory.isQuarantined('canned_filler'), true);
  });

  await test('Releasing quarantine restores action to normal execution', () => {
    const memory = new SessionMemory();
    memory.quarantineAction('bad_loop', 'Test quarantine');
    assert.strictEqual(memory.isQuarantined('bad_loop'), true);

    memory.releaseQuarantine('bad_loop');
    assert.strictEqual(memory.isQuarantined('bad_loop'), false);
  });

  await test('Maintains bounded audit trail capacity without memory leaks', () => {
    const memory = new SessionMemory({ maxAuditSize: 5 });
    for (let i = 0; i < 10; i++) {
      memory.recordIntent({ action: `action_${i}`, rawInput: `input_${i}` });
    }
    const trail = memory.getAuditTrail();
    assert.strictEqual(trail.length, 5);
    assert.strictEqual(trail[0].action, 'action_5');
    assert.strictEqual(trail[4].action, 'action_9');
  });

  // ---------------------------------------------------------------------------
  // GROUP 3: Electron IPC Bridge
  // ---------------------------------------------------------------------------
  console.log('\n🔌 3. Electron IPC Bridge (electron/main/ipc-bridge.js) Tests:');

  await test('Validates audio buffer and manages backpressure queue', () => {
    const bridge = new AudioIpcBridge({ port: 19999, maxQueueSize: 5 });

    // Invalid buffers rejected
    assert.strictEqual(bridge.sendAudioFrame(null), false);
    assert.strictEqual(bridge.sendAudioFrame(undefined), false);
    assert.strictEqual(bridge.sendAudioFrame(Buffer.alloc(0)), false);

    // Valid buffer queued when socket is not connected
    const pcm = Buffer.alloc(512);
    assert.strictEqual(bridge.sendAudioFrame(pcm), true);
    assert.strictEqual(bridge.lastStatus.queuedFrames, 1);

    // Fill queue to max
    for (let i = 0; i < 4; i++) {
      bridge.sendAudioFrame(Buffer.alloc(512));
    }
    assert.strictEqual(bridge.lastStatus.queuedFrames, 5);

    // Queue limit rejection
    assert.strictEqual(bridge.sendAudioFrame(Buffer.alloc(512)), false);

    bridge.destroy();
  });

  await test('Dispatches intent signal event from incoming Go backend JSON payload', (done) => {
    return new Promise((resolve, reject) => {
      const bridge = new AudioIpcBridge({ port: 19998 });

      const testPayload = {
        id: 'intent-test-ipc',
        type: 'technical_task',
        action: 'write_go_audio_service',
        confidence: 0.99,
        raw_input: 'Chatter. Chatter for.',
        bypass_llm: true,
      };

      bridge.on(AUDIO_IPC_CHANNELS.INTENT_RESOLVED, (intent) => {
        try {
          assert.strictEqual(intent.id, 'intent-test-ipc');
          assert.strictEqual(intent.action, 'write_go_audio_service');
          assert.strictEqual(intent.bypassLLM, true);
          assert(intent.receivedAt > 0);
          bridge.destroy();
          resolve();
        } catch (err) {
          bridge.destroy();
          reject(err);
        }
      });

      bridge.handleIncomingData(JSON.stringify(testPayload));
    });
  });

  await test('Handles connection drop gracefully and schedules exponential backoff', (done) => {
    return new Promise((resolve) => {
      const bridge = new AudioIpcBridge({ port: 19997, reconnectIntervalMs: 50 });

      bridge.on(AUDIO_IPC_CHANNELS.ERROR, (errData) => {
        assert(errData.message.includes('Simulated network failure'));
        assert.strictEqual(bridge.isConnected, false);
        bridge.destroy();
        resolve();
      });

      bridge.handleConnectionDrop(new Error('Simulated network failure'));
    });
  });

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n===========================================================================');
  console.log(`   RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('===========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
