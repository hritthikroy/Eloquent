/**
 * Conversation Processor Unit Test Suite
 * Validates transcript parsing, actionable intent extraction,
 * Libboard prompt schema compliance, and robust edge-case handling.
 */

const assert = require('assert');
const { ConversationProcessor, generatePrompt } = require('../../src/main/conversationProcessor');

console.log('================================================================================');
console.log('🧪 RUNNING CONVERSATION PROCESSOR & LIBBOARD GENERATION UNIT TESTS');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Standard User-Tuk Conversation Array
// -----------------------------------------------------------------------------
console.log('▶ [TEST 1] Standard User-Tuk Dialogue Processing');
const sampleTurns = [
  { speaker: 'user', text: 'Hey Tuk Tuk, we need to optimize our audio pipeline.' },
  { speaker: 'tuk', text: 'On it babe! Andrew and I are reviewing the Go buffer architecture.' },
  { speaker: 'user', text: 'Let us build a zero-copy ring buffer with 16kHz PCM audio streaming.' }
];

const res1 = ConversationProcessor.generatePrompt(sampleTurns);
assert.strictEqual(res1.success, true, 'Generation must succeed for valid turns');
assert.strictEqual(res1.error, null, 'Error must be null on success');
assert.strictEqual(res1.turnsCount, 3, 'Must count 3 turns');
assert.ok(res1.actionsCount >= 2, 'Must extract at least 2 actions');
assert.ok(res1.prompt.includes('Clear Technical Objective'), 'Must contain Technical Objective');
assert.ok(res1.prompt.includes('Key Files / Architecture'), 'Must contain Key Files section');
assert.ok(res1.prompt.includes('Quality Requirements & AST Verification'), 'Must contain Quality section');
assert.ok(res1.prompt.includes('16kHz PCM audio streaming'), 'Must map audio intent');
assert.ok(!res1.prompt.startsWith('```'), 'Must not have markdown fences');
console.log('   ✅ Test 1 Passed: Successfully generated valid Libboard prompt from conversation array\n');

// -----------------------------------------------------------------------------
// TEST 2: JSON String Input
// -----------------------------------------------------------------------------
console.log('▶ [TEST 2] JSON Stringified Dialogue Input');
const jsonInput = JSON.stringify([
  { role: 'user', content: 'Deploy the AST validator for our prompts.' },
  { role: 'assistant', content: 'Deploying recursive self-correction loop now.' }
]);

const res2 = generatePrompt(jsonInput);
assert.strictEqual(res2.success, true);
assert.strictEqual(res2.turnsCount, 2);
assert.ok(res2.prompt.includes('Deploy the AST validator'));
assert.ok(res2.prompt.includes('recursive AST validation loop'));
console.log('   ✅ Test 2 Passed: Handled JSON stringified transcript cleanly\n');

// -----------------------------------------------------------------------------
// TEST 3: Plain-Text Line-by-Line Transcript
// -----------------------------------------------------------------------------
console.log('▶ [TEST 3] Plain-Text Line Transcript Parsing');
const plainTextTranscript = `
User: Let's inspect the overlay canvas visualizer and fix IPC lag.
Tuk Tuk: Right here babe! Decoupling visualizer telemetry from layout updates.
User: Ensure all channels are registered.
`;

const res3 = ConversationProcessor.generatePrompt(plainTextTranscript);
assert.strictEqual(res3.success, true);
assert.strictEqual(res3.turnsCount, 3);
assert.ok(res3.prompt.includes('visualizer'));
assert.ok(res3.prompt.includes('IPC'));
console.log('   ✅ Test 3 Passed: Successfully parsed plain text transcripts\n');

// -----------------------------------------------------------------------------
// TEST 4: Nested History Object ({ turns: [...] } or { history: [...] })
// -----------------------------------------------------------------------------
console.log('▶ [TEST 4] Nested History Object Parsing');
const nestedObj = {
  turns: [
    { speaker: 'user', text: 'Run static analysis across all modules.' }
  ]
};
const res4 = ConversationProcessor.generatePrompt(nestedObj);
assert.strictEqual(res4.success, true);
assert.strictEqual(res4.turnsCount, 1);
assert.ok(res4.prompt.includes('static analysis pass'));
console.log('   ✅ Test 4 Passed: Supported nested history objects\n');

// -----------------------------------------------------------------------------
// TEST 5: Edge Cases - Graceful Failure with Exact Error String
// -----------------------------------------------------------------------------
console.log('▶ [TEST 5] Edge Cases: Empty, Null, Undefined & Malformed Inputs');
const EXPECTED_ERR = 'Unable to generate Libboard prompt: conversation data invalid';

// 5a. Empty Array
const emptyArrRes = ConversationProcessor.generatePrompt([]);
assert.strictEqual(emptyArrRes.success, false);
assert.strictEqual(emptyArrRes.error, EXPECTED_ERR);
assert.strictEqual(emptyArrRes.prompt, null);

// 5b. Null & Undefined
const nullRes = ConversationProcessor.generatePrompt(null);
assert.strictEqual(nullRes.success, false);
assert.strictEqual(nullRes.error, EXPECTED_ERR);

const undefinedRes = ConversationProcessor.generatePrompt(undefined);
assert.strictEqual(undefinedRes.success, false);
assert.strictEqual(undefinedRes.error, EXPECTED_ERR);

// 5c. Empty string
const emptyStrRes = ConversationProcessor.generatePrompt('   ');
assert.strictEqual(emptyStrRes.success, false);
assert.strictEqual(emptyStrRes.error, EXPECTED_ERR);

// 5d. Malformed JSON with no recognized text
const malformedJsonRes = ConversationProcessor.generatePrompt('{"randomKey": 123}');
assert.strictEqual(malformedJsonRes.success, false);
assert.strictEqual(malformedJsonRes.error, EXPECTED_ERR);

// 5e. Array of empty / malformed turns
const emptyTurnsRes = ConversationProcessor.generatePrompt([{}, { speaker: 'user', text: '' }]);
assert.strictEqual(emptyTurnsRes.success, false);
assert.strictEqual(emptyTurnsRes.error, EXPECTED_ERR);
console.log(`   ✅ Test 5 Passed: All edge cases returned exact error: "${EXPECTED_ERR}"\n`);

// -----------------------------------------------------------------------------
// TEST 6: Schema & AST Conformance Verification
// -----------------------------------------------------------------------------
console.log('▶ [TEST 6] AST Conformance & Section Layout Verification');
const schemaVerification = ConversationProcessor.generatePrompt([
  { speaker: 'user', text: 'Optimize the memory footprint of our Go backend.' }
]);

assert.ok(schemaVerification.prompt.includes('Clear Technical Objective'));
assert.ok(schemaVerification.prompt.includes('Key Files / Architecture'));
assert.ok(schemaVerification.prompt.includes('Quality Requirements & AST Verification'));
assert.ok(schemaVerification.prompt.includes('src/main/conversationProcessor.js'));
assert.ok(schemaVerification.prompt.includes('src/renderer/components/LibboardPromptViewer.jsx'));
console.log('   ✅ Test 6 Passed: Output strictly adheres to Libboard 3-section schema\n');

console.log('================================================================================');
console.log('🎉 ALL CONVERSATION PROCESSOR UNIT TESTS PASSED WITH 100% SUCCESS!');
console.log('================================================================================\n');
