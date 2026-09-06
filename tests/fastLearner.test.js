/**
 * tests/fastLearner.test.js
 * 
 * Unit Test Suite for FastLearner Module and FastLearnerToggle
 * Validates initialization, config handling, session start/stop lifecycle,
 * IPC channel forwarding, progress events, and edge-case error recovery.
 */

const assert = require('assert');
const { FastLearner } = require('../src/renderer/fastLearner');

// In-memory mock for localStorage in Node environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

async function runTests() {
  console.log('🧪 Running FastLearner Module Unit Test Suite...\n');

  global.window = {
    localStorage: new MockLocalStorage(),
    electron: {
      ipcRenderer: {
        send: (channel, payload) => {
          global.lastIpcSend = { channel, payload };
        }
      }
    }
  };

  const learner = FastLearner.getInstance();

  // Test 1: Initialization and Config Defaults
  {
    console.log('▶ Test 1: FastLearner initialization & defaults');
    const initialized = learner.init();
    assert.strictEqual(initialized, true);
    const progress = learner.getProgress();
    assert.strictEqual(progress.isActive, false);
    assert.strictEqual(progress.config.learningSpeed, 'normal');
    assert.strictEqual(progress.config.contentRetention, 0.85);
    console.log('  ✅ Test 1 Passed: Initialized cleanly with default configuration');
  }

  // Test 2: Start Session & Session Persistence
  {
    console.log('▶ Test 2: Session start & localStorage persistence');
    const startRes = learner.startSession({ learningSpeed: 'fast', contentRetention: 0.95 });
    assert.strictEqual(startRes.success, true);
    assert.strictEqual(learner.getProgress().isActive, true);

    const savedConfig = JSON.parse(global.window.localStorage.getItem('fast_learner_config'));
    assert.strictEqual(savedConfig.learningSpeed, 'fast');
    assert.strictEqual(savedConfig.contentRetention, 0.95);
    console.log('  ✅ Test 2 Passed: Started session and persisted config to localStorage');
  }

  // Test 3: Progress Event Emission & Listener Unsubscribe
  {
    console.log('▶ Test 3: Progress event emission & IPC event forwarding');
    let emitted = null;
    const unsubscribe = learner.onProgress((data) => {
      emitted = data;
    });

    learner.emitProgress({ completedSteps: 5, totalSteps: 10 });
    assert.notStrictEqual(emitted, null);
    assert.strictEqual(emitted.progress.completedSteps, 5);

    assert.strictEqual(global.lastIpcSend.channel, 'fast-learner:progress');
    assert.strictEqual(global.lastIpcSend.payload.progress.completedSteps, 5);

    unsubscribe();
    emitted = null;
    learner.emitProgress({ completedSteps: 6 });
    assert.strictEqual(emitted, null);
    console.log('  ✅ Test 3 Passed: Emitted progress events to listeners and ipcRenderer');
  }

  // Test 4: Stop Session & State Transition
  {
    console.log('▶ Test 4: Stop session lifecycle');
    const stopRes = learner.stopSession();
    assert.strictEqual(stopRes.success, true);
    assert.strictEqual(learner.getProgress().isActive, false);
    console.log('  ✅ Test 4 Passed: Stopped session cleanly');
  }

  // Test 5: Edge Case - Corrupted LocalStorage Config Recovery
  {
    console.log('▶ Test 5: Edge case recovery for corrupted localStorage config');
    global.window.localStorage.setItem('fast_learner_config', '{corrupted_json_string');
    const learner2 = new FastLearner();
    const initRes = learner2.init();
    assert.strictEqual(initRes, true);
    assert.strictEqual(learner2.config.learningSpeed, 'normal'); // Default fallback
    console.log('  ✅ Test 5 Passed: Corrupted config safely handled with default fallback');
  }

  console.log('\n🌟 All FastLearner Unit Tests Passed Successfully! 🚀');
}

runTests().catch((err) => {
  console.error('❌ FastLearner unit tests failed:', err);
  process.exit(1);
});
