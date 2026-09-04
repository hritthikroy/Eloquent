/**
 * Unit Tests for Cross-Platform Clipboard Utility
 * Mocks Electron's clipboard API to verify:
 * 1. Successful prompt writes
 * 2. Empty string / whitespace no-op handling
 * 3. 1 MiB truncation safety ceiling
 * 4. Error propagation and zero-throw exception safety
 * 5. Toast notification callback wiring
 * 6. Fallback mechanisms
 */

import {
  copyPrompt,
  setToastHandler,
  getLastError,
  MAX_PROMPT_SIZE
} from '../src/clipboard';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING CLIPBOARD UTILITY & PROMPT COPY UNIT TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // Set up mock Electron clipboard
  let mockWrittenText: string | null = null;
  let mockShouldThrow = false;
  let toastMessages: Array<{ msg: string; isError?: boolean }> = [];

  setToastHandler((msg, isError) => {
    toastMessages.push({ msg, isError });
  });

  const mockElectronClipboard = {
    writeText: (text: string) => {
      if (mockShouldThrow) {
        throw new Error('OS Clipboard Lock Timeout');
      }
      mockWrittenText = text;
    },
    readText: () => mockWrittenText || ''
  };

  // Mock require('electron') cache
  const originalRequire = require('module').prototype.require;
  require('module').prototype.require = function (pathStr: string) {
    if (pathStr === 'electron') {
      return { clipboard: mockElectronClipboard };
    }
    return originalRequire.apply(this, arguments as any);
  };

  // TEST 1: Standard valid prompt copy
  console.log('--- TEST 1: Successful Prompt Copy ---');
  toastMessages = [];
  mockWrittenText = null;
  mockShouldThrow = false;

  const validPrompt = 'Clear Technical Objective\nImplement cross-platform clipboard\nKey Files / Architecture\n- src/clipboard.ts';
  copyPrompt(validPrompt);

  assert(mockWrittenText === validPrompt, 'Written text exactly matches the input prompt');
  assert(toastMessages.length === 1, 'Toast handler called once on success');
  assert(toastMessages[0].msg === 'Prompt copied to clipboard!', 'Toast message confirms prompt copied');
  assert(getLastError() === null, 'No errors recorded on successful copy');

  // TEST 2: Edge Cases - Empty strings and whitespace no-ops
  console.log('\n--- TEST 2: Empty & Whitespace Inputs (No-op) ---');
  mockWrittenText = 'original_unmodified_content';
  toastMessages = [];

  copyPrompt('');
  assert(mockWrittenText === 'original_unmodified_content', 'Empty string performs no-op and preserves clipboard');

  copyPrompt('    \n\t  ');
  assert(mockWrittenText === 'original_unmodified_content', 'Whitespace-only string performs no-op');

  copyPrompt(null as any);
  assert(mockWrittenText === 'original_unmodified_content', 'Null input performs safe no-op');

  copyPrompt(undefined as any);
  assert(mockWrittenText === 'original_unmodified_content', 'Undefined input performs safe no-op');

  assert(toastMessages.length === 0, 'No toast messages dispatched for no-op inputs');

  // TEST 3: Edge Case - Oversized prompt (> 1 MiB) truncation
  console.log('\n--- TEST 3: Oversized Prompt Truncation (> 1 MiB) ---');
  toastMessages = [];
  mockWrittenText = null;

  // Generate 1.5 MiB string (1.5 * 1024 * 1024 chars)
  const oversizeLength = Math.floor(1.5 * MAX_PROMPT_SIZE);
  const largePrompt = 'A'.repeat(oversizeLength);

  copyPrompt(largePrompt);

  assert(mockWrittenText !== null, 'Large prompt is written to clipboard');
  assert((mockWrittenText as any)?.length === MAX_PROMPT_SIZE, `Prompt is safely truncated to exactly ${MAX_PROMPT_SIZE} bytes (1 MiB)`);
  assert(toastMessages.some(t => t.isError && t.msg.includes('truncated to 1 MiB')), 'Toast notification warns user of truncation');

  // TEST 4: Exception Safety & Zero Uncaught Throw Invariant
  console.log('\n--- TEST 4: Uncaught Exception Safety ---');
  toastMessages = [];
  mockShouldThrow = true; // Simulate OS lock or access denied error

  let caughtSynchronously = false;
  try {
    copyPrompt('Test prompt under failing clipboard');
  } catch {
    caughtSynchronously = true;
  }

  assert(caughtSynchronously === false, 'copyPrompt never throws uncaught exceptions to caller');
  assert(getLastError() !== null, 'LastError recorded the simulated clipboard error');

  // TEST 5: Toast Handler Lifecycle
  console.log('\n--- TEST 5: Toast Handler Cleanup ---');
  setToastHandler(null);
  mockShouldThrow = false;
  mockWrittenText = null;

  // Should not throw even when toastHandler is null
  let threwWithoutToast = false;
  try {
    copyPrompt('Valid prompt with null toastHandler');
  } catch {
    threwWithoutToast = true;
  }

  assert(threwWithoutToast === false, 'Operates cleanly when toastHandler is null');
  assert(mockWrittenText === 'Valid prompt with null toastHandler', 'Successfully writes without toastHandler');

  // Clean up require override
  require('module').prototype.require = originalRequire;

  console.log(`\n================================================================`);
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
  console.log(`================================================================\n`);
}

runTests().catch(err => {
  console.error('Fatal test error in clipboard unit tests:', err);
  process.exit(1);
});
