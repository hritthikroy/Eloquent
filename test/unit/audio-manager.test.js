/**
 * test/unit/audio-manager.test.js
 * 
 * Unit Test Suite for AudioManager and Voice Recognition Pipeline
 * Validates audio capture lifecycle, microphone permission checks,
 * "Chai chhi" phonetic command recognition, and state transition logic.
 */

const assert = require('assert');
const { AudioManager } = require('../../dist-ts/src/main/audio-manager');
const { IpcChannels } = require('../../dist-ts/src/shared/types');

async function runTests() {
  console.log('🧪 Running AudioManager Unit Test Suite...\n');

  const manager = AudioManager.getInstance();

  // Test 1: Microphone Permission Check Fallback
  {
    console.log('▶ Test 1: Microphone permission check');
    const perm = await manager.checkMicrophonePermission();
    assert.strictEqual(typeof perm.granted, 'boolean');
    assert.strictEqual(perm.granted, true);
    console.log('  ✅ Test 1 Passed: Microphone permission check returned granted state');
  }

  // Test 2: Audio Capture Stream Lifecycle
  {
    console.log('▶ Test 2: Audio capture stream start and stop lifecycle');
    assert.strictEqual(manager.getIsCapturing(), false);

    const startRes = await manager.startCapture({ sampleRate: 16000, chunkSizeMs: 50 });
    assert.strictEqual(startRes.success, true);
    assert.strictEqual(manager.getIsCapturing(), true);

    let receivedChunk = false;
    const pcmListener = (chunk) => {
      if (Buffer.isBuffer(chunk)) {
        receivedChunk = true;
      }
    };
    manager.on('pcm-chunk', pcmListener);

    // Wait for at least one chunk emission
    await new Promise(r => setTimeout(r, 120));

    manager.off('pcm-chunk', pcmListener);
    const stopRes = manager.stopCapture();
    assert.strictEqual(stopRes.success, true);
    assert.strictEqual(manager.getIsCapturing(), false);
    assert.strictEqual(receivedChunk, true);
    console.log('  ✅ Test 2 Passed: Audio capture stream started, emitted PCM chunks, and stopped cleanly');
  }

  // Test 3: Phonetic "Chai chhi" Command Recognition
  {
    console.log('▶ Test 3: "Chai chhi" phonetic command recognition & state transition');
    let emittedPayload = null;
    const commandListener = (payload) => {
      emittedPayload = payload;
    };
    manager.on('command-recognized', commandListener);

    const payload = manager.processCommandRecognition('Chai chhi', 0.98);
    assert.strictEqual(payload.command, 'chai_chhi');
    assert.strictEqual(payload.state, 'READY');
    assert.strictEqual(payload.confidence, 0.98);
    assert.strictEqual(manager.getActiveState(), 'READY');

    assert.notStrictEqual(emittedPayload, null);
    assert.strictEqual(emittedPayload.command, 'chai_chhi');
    assert.strictEqual(emittedPayload.state, 'READY');

    manager.off('command-recognized', commandListener);
    console.log('  ✅ Test 3 Passed: Recognized "Chai chhi" command and transitioned state to READY');
  }

  // Test 4: Unknown Speech / Idle State Handing
  {
    console.log('▶ Test 4: Unknown speech input handling & IDLE state transition');
    const payload = manager.processCommandRecognition('Hello testing audio', 0.85);
    assert.strictEqual(payload.command, 'unknown');
    assert.strictEqual(payload.state, 'IDLE');
    assert.strictEqual(manager.getActiveState(), 'IDLE');
    console.log('  ✅ Test 4 Passed: Unrecognized speech maintained IDLE state');
  }

  console.log('\n🌟 All AudioManager Unit Tests Passed Successfully! 🚀');
}

runTests().catch(err => {
  console.error('❌ AudioManager unit tests failed:', err);
  process.exit(1);
});
