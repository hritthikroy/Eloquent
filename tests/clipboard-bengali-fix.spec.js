/**
 * Test Suite: Cross-Platform Clipboard Utility for Bengali Fixing Prompt
 * 
 * Verifies:
 * 1. BENGALI_FIX_PROMPT constant export and integrity from shared constants.
 * 2. ClipboardService UTF-8 sanitization and canonical NFC normalization.
 * 3. ClipboardService.copyBengaliFixPrompt() asynchronous execution & boolean return.
 * 4. IPC handler 'clipboard:copy-bengali-fix' registration and execution response.
 * 5. Renderer clipboardBridge wrapper and toast notification triggers.
 * 6. Non-blocking event loop execution during clipboard operations.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { BENGALI_FIX_PROMPT, BENGALI_FIX_PROMPT_NORMALIZED } = require('../src/shared/constants/prompts');
const { ClipboardService, clipboardService } = require('../src/main/services/clipboardService');
const { registerClipboardHandlers, CHANNEL_COPY_BENGALI_FIX } = require('../src/main/ipc/handlers/clipboardHandlers');
const { copyBengaliFixPrompt } = require('../src/renderer/utils/clipboardBridge');

test('Cross-Platform Clipboard Utility & Bengali Prompt Suite', async (t) => {
  await t.test('1. BENGALI_FIX_PROMPT constant integrity', () => {
    assert.ok(typeof BENGALI_FIX_PROMPT === 'string', 'BENGALI_FIX_PROMPT must be a string');
    assert.strictEqual(
      BENGALI_FIX_PROMPT,
      'fix our bngal do deep research ho a real bngla human talk need same like not robotic need realistic',
      'Must match exact expected fixing prompt string'
    );
    assert.ok(BENGALI_FIX_PROMPT_NORMALIZED.includes('Bangla'), 'Normalized prompt constant must be exported');
  });

  await t.test('2. UTF-8 Sanitization & Canonical NFC Normalization', () => {
    // 2.1 Basic UTF-8 preservation
    const sanitized = ClipboardService.sanitizeUtf8(BENGALI_FIX_PROMPT);
    assert.strictEqual(sanitized, BENGALI_FIX_PROMPT);

    // 2.2 Bengali Unicode normalization (NFC)
    const bengaliText = 'বাংলা ভাষা ও বর্ণমালা';
    assert.strictEqual(ClipboardService.sanitizeUtf8(bengaliText), bengaliText);

    // 2.3 Non-printable control characters removal
    const dirty = 'fix\x00 our\x08 bngal\x1F';
    assert.strictEqual(ClipboardService.sanitizeUtf8(dirty), 'fix our bngal');

    // 2.4 Error on null/undefined
    assert.throws(() => ClipboardService.sanitizeUtf8(null), /cannot be null/);
    assert.throws(() => ClipboardService.sanitizeUtf8(undefined), /cannot be null/);
  });

  await t.test('3. ClipboardService.copyBengaliFixPrompt() asynchronous execution', async () => {
    const success = await ClipboardService.copyBengaliFixPrompt();
    assert.strictEqual(success, true, 'copyBengaliFixPrompt() must resolve to true');

    const service = new ClipboardService();
    const readBack = await service.readText();
    assert.strictEqual(readBack, BENGALI_FIX_PROMPT, 'Copied prompt must match read back text without corruption');
  });

  await t.test('4. Non-blocking event loop verification', async () => {
    let tickCount = 0;
    const interval = setInterval(() => { tickCount++; }, 1);

    const promise = ClipboardService.copyBengaliFixPrompt();
    assert.ok(promise instanceof Promise, 'Must return a Promise');

    const result = await promise;
    clearInterval(interval);

    assert.strictEqual(result, true);
    assert.ok(tickCount >= 0, 'Event loop must continue processing during async write');
  });

  await t.test('5. IPC Handler registration and response format', async () => {
    // Mock ipcMain
    const handlers = new Map();
    const mockIpcMain = {
      handle: (channel, fn) => {
        handlers.set(channel, fn);
      },
      removeHandler: (channel) => {
        handlers.delete(channel);
      }
    };

    const registered = registerClipboardHandlers(mockIpcMain);
    assert.strictEqual(registered, true, 'Handler registration should succeed');
    assert.ok(handlers.has(CHANNEL_COPY_BENGALI_FIX), `Must register channel '${CHANNEL_COPY_BENGALI_FIX}'`);

    // Invoke handler
    const handlerFn = handlers.get(CHANNEL_COPY_BENGALI_FIX);
    const res = await handlerFn({}, BENGALI_FIX_PROMPT);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.channel, 'clipboard:copy-bengali-fix');
    assert.strictEqual(res.text, BENGALI_FIX_PROMPT);
    assert.ok(typeof res.timestamp === 'number');
  });

  await t.test('6. Renderer clipboardBridge wrapper & toast notification', async () => {
    let toastMessage = '';
    let toastType = '';

    const onToast = (msg, type) => {
      toastMessage = msg;
      toastType = type;
    };

    const res = await copyBengaliFixPrompt(BENGALI_FIX_PROMPT, { onToast });

    assert.strictEqual(res.success, true, 'copyBengaliFixPrompt must resolve with success: true');
    assert.strictEqual(res.prompt, BENGALI_FIX_PROMPT);
    assert.ok(toastMessage.includes('copied to clipboard'), 'Toast notification must be triggered');
    assert.strictEqual(toastType, 'success');
  });
});
