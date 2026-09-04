/**
 * @file promptBuilder.test.ts
 * @description Comprehensive unit and integration test suite for Vision PromptBuilder,
 * 4-section AST schema validation regex, edge-case sanitization, and Electron IPC handlers.
 */

import assert from 'assert';
import { EventEmitter } from 'events';
import {
  PromptBuilder,
  buildPrompt,
  ANTIGRAVITY_PROMPT_REGEX,
} from '../../src/vision/promptBuilder';
import { registerVisionIpcHandlers } from '../../src/main/electron/ipcHandlers';

// Mock ipcMain helper
class MockIpcMain extends EventEmitter {
  public handlers: Map<string, Function> = new Map();

  public handle(channel: string, handler: Function): void {
    this.handlers.set(channel, handler);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  public async invoke(channel: string, ...args: any[]): Promise<any> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`);
    }
    const event = { sender: {} };
    return handler(event, ...args);
  }
}

async function runPromptBuilderTests() {
  console.log('🚀 Starting Vision PromptBuilder Test Suite...\n');

  let passedTests = 0;

  // -------------------------------------------------------------
  // Test 1: Standard Intent Parsing and 4-Section Assembly
  // -------------------------------------------------------------
  console.log('🧪 Test 1: Standard Intent Parsing and 4-Section Assembly');
  const intent1 = 'Implement low-latency audio stream processing with Go ring buffer';
  const prompt1 = buildPrompt(intent1);

  assert.strictEqual(typeof prompt1, 'string', 'Prompt must be a string');
  assert.ok(ANTIGRAVITY_PROMPT_REGEX.test(prompt1), 'Prompt must strictly match ANTIGRAVITY_PROMPT_REGEX');

  const validation1 = PromptBuilder.validatePrompt(prompt1);
  assert.strictEqual(validation1.isValid, true, 'Validation result must be valid');
  assert.strictEqual(validation1.errors.length, 0, 'Must have zero validation errors');
  assert.strictEqual(validation1.headersFound.length, 4, 'Must contain exactly 4 section headers');

  assert.ok(prompt1.includes('Clear Technical Objective\n'), 'Must contain section 1 header');
  assert.ok(prompt1.includes('\n\nKey Files / Architecture\n'), 'Must contain section 2 header');
  assert.ok(prompt1.includes('\n\nQuality Requirements & AST Verification\n'), 'Must contain section 3 header');
  assert.ok(prompt1.includes('\n\nNext Steps & Continuation Roadmap\n'), 'Must contain section 4 header');

  console.log('  ✅ Passed: Standard prompt correctly assembled and regex validated.\n');
  passedTests += 1;

  // -------------------------------------------------------------
  // Test 2: Strict Section Header Order and Singularity
  // -------------------------------------------------------------
  console.log('🧪 Test 2: Strict Section Header Order and Singularity');
  const prompt2 = buildPrompt('Refactor Settings UI components for dark mode');

  const idx1 = prompt2.indexOf('Clear Technical Objective');
  const idx2 = prompt2.indexOf('Key Files / Architecture');
  const idx3 = prompt2.indexOf('Quality Requirements & AST Verification');
  const idx4 = prompt2.indexOf('Next Steps & Continuation Roadmap');

  assert.ok(idx1 !== -1 && idx2 !== -1 && idx3 !== -1 && idx4 !== -1, 'All 4 headers must be present');
  assert.ok(idx1 < idx2, 'Section 1 must precede Section 2');
  assert.ok(idx2 < idx3, 'Section 2 must precede Section 3');
  assert.ok(idx3 < idx4, 'Section 3 must precede Section 4');

  // Verify each header appears exactly once
  const headers = [
    'Clear Technical Objective',
    'Key Files / Architecture',
    'Quality Requirements & AST Verification',
    'Next Steps & Continuation Roadmap',
  ];
  for (const header of headers) {
    const count = (prompt2.match(new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    assert.strictEqual(count, 1, `Header "${header}" must appear exactly once, got ${count}`);
  }

  console.log('  ✅ Passed: All 4 headers are in strict order and singular.\n');
  passedTests += 1;

  // -------------------------------------------------------------
  // Test 3: Domain Inference (Audio, Vision, Cache, UI, Core)
  // -------------------------------------------------------------
  console.log('🧪 Test 3: Domain Inference across Architecture Layers');

  // Audio domain
  const audioPrompt = buildPrompt('Optimize Go PCM audio stream and DSP buffer queues');
  assert.ok(audioPrompt.includes('go/audio/prompt_service.go') || audioPrompt.includes('engine.go'), 'Audio domain should include audio paths');

  // Vision domain
  const visionPrompt = buildPrompt('Enhance camera pose tracking in vision subsystem');
  assert.ok(visionPrompt.includes('src/vision/promptBuilder.ts'), 'Vision domain should include vision paths');

  // Cache domain
  const cachePrompt = buildPrompt('Purge Chromium cache and reset Go audio buffers');
  assert.ok(cachePrompt.includes('electronMain.js') && cachePrompt.includes('Settings.tsx'), 'Cache domain should include cache paths');

  // Custom files and rules
  const customPrompt = buildPrompt('Custom architecture task', {
    customFiles: [{ path: 'custom/path/file.ts', description: 'Custom module description' }],
    customQualityRequirements: ['Verify custom invariant #42.'],
    customNextSteps: ['Deploy to production cluster.'],
  });
  assert.ok(customPrompt.includes('custom/path/file.ts: Custom module description'), 'Must include custom file entry');
  assert.ok(customPrompt.includes('Verify custom invariant #42.'), 'Must include custom quality directive');
  assert.ok(customPrompt.includes('Deploy to production cluster.'), 'Must include custom next step');

  console.log('  ✅ Passed: Domain inference and custom overrides functioning as expected.\n');
  passedTests += 1;

  // -------------------------------------------------------------
  // Test 4: Edge-Case Handling (Empty, Null, Malicious HTML, Oversized Inputs)
  // -------------------------------------------------------------
  console.log('🧪 Test 4: Edge-Case Handling (Null, HTML tags, Control Chars, Large Bounds)');

  // Null and undefined inputs
  const promptNull = buildPrompt(null as any);
  assert.ok(ANTIGRAVITY_PROMPT_REGEX.test(promptNull), 'Null input should produce valid prompt fallback');

  const promptUndefined = buildPrompt(undefined as any);
  assert.ok(ANTIGRAVITY_PROMPT_REGEX.test(promptUndefined), 'Undefined input should produce valid prompt fallback');

  const promptEmpty = buildPrompt('   \n\t  ');
  assert.ok(ANTIGRAVITY_PROMPT_REGEX.test(promptEmpty), 'Empty whitespace input should produce valid prompt fallback');

  // Malicious HTML / Script tags / Control characters
  const dirtyIntent = '<script>alert("XSS")</script>Fix <div style="color:red">the camera</div>\x00\x08 frame buffer';
  const cleanPrompt = buildPrompt(dirtyIntent);
  assert.ok(!cleanPrompt.includes('<script>'), 'Must strip <script> tags');
  assert.ok(!cleanPrompt.includes('alert("XSS")'), 'Must eliminate XSS payload');
  assert.ok(!cleanPrompt.includes('\x00'), 'Must strip null bytes');
  assert.ok(ANTIGRAVITY_PROMPT_REGEX.test(cleanPrompt), 'Cleaned prompt must pass regex');

  // Conversational preamble stripping
  const fillerIntent = 'Sure thing, please implement a new visual visualizer component, hope this helps!';
  const filteredPrompt = buildPrompt(fillerIntent);
  assert.ok(!filteredPrompt.toLowerCase().startsWith('clear technical objective\nsure'), 'Must strip conversational filler preamble');

  // Extremely long input (50,000 characters)
  const hugeIntent = `Implement massive scalable pipeline. ${'A'.repeat(50000)}`;
  const truncatedPrompt = buildPrompt(hugeIntent, { maxIntentLength: 1000 });
  assert.ok(truncatedPrompt.includes('... [truncated]'), 'Must truncate excessive length gracefully');
  assert.ok(ANTIGRAVITY_PROMPT_REGEX.test(truncatedPrompt), 'Truncated prompt must still satisfy 4-section regex');

  console.log('  ✅ Passed: All edge cases (null, malicious, oversized) safely handled.\n');
  passedTests += 1;

  // -------------------------------------------------------------
  // Test 5: Electron Main Process IPC Handler 'vision-build-prompt'
  // -------------------------------------------------------------
  console.log('🧪 Test 5: Electron IPC Handler "vision-build-prompt" Integration');
  const mockIpc = new MockIpcMain();
  const registration = registerVisionIpcHandlers(mockIpc);

  // Invoke with string intent
  const res1 = await mockIpc.invoke('vision-build-prompt', 'Build audio visualizer in React');
  assert.strictEqual(res1.success, true, 'IPC response success must be true');
  assert.ok(typeof res1.prompt === 'string', 'IPC response must include prompt string');
  assert.ok(ANTIGRAVITY_PROMPT_REGEX.test(res1.prompt), 'IPC generated prompt must pass regex');
  assert.strictEqual(typeof res1.timestamp, 'number', 'IPC response must include timestamp');

  // Invoke with object payload
  const res2 = await mockIpc.invoke('vision-build-prompt', {
    intent: 'Refactor Go backend memory allocations',
    options: { domain: 'Memory Optimization' },
  });
  assert.strictEqual(res2.success, true);
  assert.ok(ANTIGRAVITY_PROMPT_REGEX.test(res2.prompt));

  // Clean unregister
  registration.unregister();
  assert.strictEqual(mockIpc.handlers.has('vision-build-prompt'), false, 'Handler must be removed on unregister');

  console.log('  ✅ Passed: IPC handler forwards intent and returns structured response.\n');
  passedTests += 1;

  console.log(`🎉 All ${passedTests} Vision PromptBuilder Unit & Integration Tests Passed!\n`);
}

runPromptBuilderTests().catch((err) => {
  console.error('❌ Vision PromptBuilder Tests Failed:', err);
  process.exit(1);
});
