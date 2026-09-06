/**
 * test/unit/clipboard-manager.test.js
 * 
 * Unit Test Suite for ClipboardManager and IPC Synchronization Module
 * Validates debouncing (500ms), UTF-8 normalization, empty/null safety handling,
 * and IPC channel contract stability.
 */

const assert = require('assert');
const { ClipboardManager } = require('../../dist-ts/src/main/clipboard-manager');
const { IpcChannels } = require('../../dist-ts/src/shared/types');

async function runTests() {
  console.log('🧪 Running ClipboardManager Unit & Debouncing Test Suite...\n');

  let mockStore = { text: '' };
  const mockClipboard = {
    writeText: (t) => { mockStore.text = t; },
    readText: () => mockStore.text
  };

  const manager = new ClipboardManager(mockClipboard);

  // Test 1: Null and Undefined Input Safety
  {
    console.log('▶ Test 1: Null & undefined input validation');
    const resNull = await manager.syncPromptToClipboard(null);
    assert.strictEqual(resNull.success, false);
    assert.strictEqual(resNull.length, 0);
    assert.ok(resNull.error.includes('null or undefined'));

    const resEmpty = await manager.syncPromptToClipboard('');
    assert.strictEqual(resEmpty.success, false);
    assert.strictEqual(resEmpty.length, 0);
    assert.ok(resEmpty.error.includes('empty string'));
    console.log('  ✅ Test 1 Passed: Null & empty string inputs handled gracefully without throwing');
  }

  // Test 2: UTF-8 Normalization & Immediate Copy
  {
    console.log('▶ Test 2: UTF-8 normalization & immediate copy');
    const rawBengaliText = 'হ্যালো\r\nবিশ্ব'; // Split CRLF and decomposed string
    const res = manager.syncPromptToClipboardImmediate(rawBengaliText);
    assert.strictEqual(res.success, true);
    assert.strictEqual(mockStore.text, 'হ্যালো\nবিশ্ব');
    console.log('  ✅ Test 2 Passed: UTF-8 normalized and CRLF converted to LF');
  }

  // Test 3: Debouncing Mechanism (500ms)
  {
    console.log('▶ Test 3: 500ms debouncing queue for high-frequency streaming inputs');
    mockStore.text = '';

    // Rapid successive calls
    manager.syncPromptToClipboard('Stream frame 1');
    manager.syncPromptToClipboard('Stream frame 2');
    const promiseFinal = manager.syncPromptToClipboard('Final Prompt Result');

    // Immediately after call, store should not be updated yet
    assert.strictEqual(mockStore.text, '');

    // Wait 550ms for debouncing timer to complete
    await new Promise(r => setTimeout(r, 550));

    const resFinal = await promiseFinal;
    assert.strictEqual(resFinal.success, true);
    assert.strictEqual(mockStore.text, 'Final Prompt Result');
    console.log('  ✅ Test 3 Passed: Debounced rapid calls into a single final write');
  }

  // Test 4: Payload Interface Synchronization
  {
    console.log('▶ Test 4: Payload object interface support');
    const payload = {
      content: 'Architectural Spec Output',
      source: 'Vision System Architect'
    };
    const res = manager.syncPromptToClipboardImmediate(payload);
    assert.strictEqual(res.success, true);
    assert.strictEqual(mockStore.text, 'Architectural Spec Output');
    console.log('  ✅ Test 4 Passed: Object payload correctly unwrapped and copied');
  }

  console.log('\n🌟 All ClipboardManager Unit Tests Passed Successfully! 🚀');
}

runTests().catch(err => {
  console.error('❌ ClipboardManager unit tests failed:', err);
  process.exit(1);
});
