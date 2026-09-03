/**
 * Unit Test Suite: Clipboard Service & IPC Handler Integration
 * Validates bidirectional synchronization, formatted copying (code/JSON/HTML),
 * race condition isolation, and edge-case handling.
 */

const assert = require('assert');
const { ClipboardService } = require('../../src/main/clipboard-service');
const { CLIPBOARD_CHANNELS } = require('../../src/shared/constants/ipc-channels');
const { registerClipboardHandlers } = require('../../src/main/index');

async function runTests() {
  console.log('🧪 Starting Clipboard Integration Unit Tests...\n');

  // Mock clipboard instance to simulate OS clipboard in headless test runner
  const mockStore = { text: '', html: '' };
  const mockElectronClipboard = {
    writeText: (t) => { mockStore.text = t; },
    writeHTML: (h) => { mockStore.html = h; },
    write: (payload) => {
      if (payload.text !== undefined) mockStore.text = payload.text;
      if (payload.html !== undefined) mockStore.html = payload.html;
    },
    readText: () => mockStore.text,
    clear: () => { mockStore.text = ''; mockStore.html = ''; }
  };

  const service = new ClipboardService(mockElectronClipboard);

  // 1. Plain Text Bidirectional Sync
  {
    console.log('▶ Test 1: Plain text write and read bidirectional sync');
    const writeRes = await service.writeText('Hello Eloquent');
    assert.strictEqual(writeRes.success, true);
    assert.strictEqual(writeRes.length, 14);

    const readRes = await service.readText();
    assert.strictEqual(readRes.success, true);
    assert.strictEqual(readRes.text, 'Hello Eloquent');
    assert.strictEqual(readRes.isEmpty, false);
    console.log('  ✅ Test 1 Passed: Plain text sync matches perfectly');
  }

  // 2. HTML & Plain Text Fallback
  {
    console.log('▶ Test 2: HTML formatted copy with plain text fallback');
    const writeHtmlRes = await service.writeHTML('<strong>Bold Speech</strong>', 'Bold Speech');
    assert.strictEqual(writeHtmlRes.success, true);

    const readRes = await service.readText();
    assert.strictEqual(readRes.text, 'Bold Speech');
    console.log('  ✅ Test 2 Passed: Formatted HTML and plain text fallback written');
  }

  // 3. High-Level Copy: Structured JSON
  {
    console.log('▶ Test 3: Structured JSON object copy');
    const payload = {
      data: { agent: 'Tuk Tuk', status: 'active', wpm: 150 }
    };
    const copyRes = await service.copy(payload);
    assert.strictEqual(copyRes.success, true);
    assert.strictEqual(copyRes.format, 'structured-json');

    const pasteRes = await service.paste();
    assert.strictEqual(pasteRes.success, true);
    assert.strictEqual(pasteRes.format, 'structured-json');
    const parsed = JSON.parse(pasteRes.text);
    assert.strictEqual(parsed.agent, 'Tuk Tuk');
    assert.strictEqual(parsed.wpm, 150);
    console.log('  ✅ Test 3 Passed: Structured JSON copied and parsed on paste');
  }

  // 4. High-Level Copy: Code Block
  {
    console.log('▶ Test 4: Code block formatted copy');
    const payload = {
      code: 'const x = 42;\nconsole.log(x);',
      language: 'typescript'
    };
    const copyRes = await service.copy(payload);
    assert.strictEqual(copyRes.success, true);
    assert.strictEqual(copyRes.format, 'code-block');

    const pasteRes = await service.paste();
    assert.strictEqual(pasteRes.text, payload.code);
    console.log('  ✅ Test 4 Passed: Code block formatted properly');
  }

  // 5. Edge Case: Empty & Null Handling
  {
    console.log('▶ Test 5: Empty clipboard and null payload handling');
    await service.clear();
    const emptyPaste = await service.paste();
    assert.strictEqual(emptyPaste.isEmpty, true);
    assert.strictEqual(emptyPaste.text, '');

    const nullWrite = await service.writeText(null);
    assert.strictEqual(nullWrite.success, false);
    assert.ok(nullWrite.error.includes('null or undefined'));

    const emptyCopy = await service.copy(null);
    assert.strictEqual(emptyCopy.success, false);

    const unsupportedCopy = await service.copy({ invalidKey: 123 });
    assert.strictEqual(unsupportedCopy.success, false);
    assert.strictEqual(unsupportedCopy.format, 'unsupported');
    console.log('  ✅ Test 5 Passed: Empty, null, and unsupported types handled cleanly');
  }

  // 6. Concurrency & Race Condition Sequential Execution
  {
    console.log('▶ Test 6: Concurrency and rapid successive operations');
    const ops = [
      service.writeText('Val 1'),
      service.writeText('Val 2'),
      service.writeText('Val 3'),
      service.readText()
    ];
    const results = await Promise.all(ops);
    assert.strictEqual(results[3].text, 'Val 3');
    console.log('  ✅ Test 6 Passed: Operations executed in strict sequential order');
  }

  // 7. IPC Channel Constants Consistency
  {
    console.log('▶ Test 7: IPC channel string constants verification');
    assert.strictEqual(CLIPBOARD_CHANNELS.COPY, 'clipboard:copy');
    assert.strictEqual(CLIPBOARD_CHANNELS.PASTE, 'clipboard:paste');
    assert.strictEqual(CLIPBOARD_CHANNELS.READ_TEXT, 'clipboard:read-text');
    assert.strictEqual(CLIPBOARD_CHANNELS.WRITE_TEXT, 'clipboard:write-text');
    assert.strictEqual(CLIPBOARD_CHANNELS.WRITE_HTML, 'clipboard:write-html');
    assert.strictEqual(CLIPBOARD_CHANNELS.CLEAR, 'clipboard:clear');
    console.log('  ✅ Test 7 Passed: All 6 IPC channels match specification');
  }

  // 8. IPC Handlers Registration Mock
  {
    console.log('▶ Test 8: IPC handler registration binding');
    const registeredHandlers = new Map();
    const mockIpcMain = {
      handle: (channel, handler) => {
        registeredHandlers.set(channel, handler);
      }
    };

    const registered = registerClipboardHandlers(mockIpcMain);
    assert.strictEqual(registered, true);
    assert.strictEqual(registeredHandlers.has(CLIPBOARD_CHANNELS.COPY), true);
    assert.strictEqual(registeredHandlers.has(CLIPBOARD_CHANNELS.PASTE), true);
    assert.strictEqual(registeredHandlers.has(CLIPBOARD_CHANNELS.READ_TEXT), true);
    assert.strictEqual(registeredHandlers.has(CLIPBOARD_CHANNELS.WRITE_TEXT), true);
    assert.strictEqual(registeredHandlers.has(CLIPBOARD_CHANNELS.WRITE_HTML), true);
    assert.strictEqual(registeredHandlers.has(CLIPBOARD_CHANNELS.CLEAR), true);
    console.log('  ✅ Test 8 Passed: All IPC channels registered onto ipcMain');
  }

  console.log('\n🎉 ALL CLIPBOARD INTEGRATION UNIT TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch(err => {
  console.error('\n❌ Unit tests failed:', err);
  process.exit(1);
});
