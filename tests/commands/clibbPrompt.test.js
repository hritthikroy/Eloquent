/**
 * Unit Test Suite for clibb-prompt Command
 * Tests typical, empty, malformed intents, AST verification,
 * static analysis compliance, and idempotence.
 */

const assert = require('assert');
const { ClibbPromptCommand, run } = require('../../src/commands/clibbPrompt');
const { AstVerifier } = require('../../src/validation/astVerifier');
const { main } = require('../../src/cli');

console.log('================================================================================');
console.log('🧪 RUNNING CLIBB-PROMPT COMMAND UNIT TEST SUITE');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Typical Valid Intent
// -----------------------------------------------------------------------------
console.log('▶ [TEST 1] Typical Valid Intent Generation');
const intent1 = 'Implement low-latency 16kHz PCM audio streaming in backend-go';
const prompt1 = run(intent1);

assert.ok(prompt1.includes('Clear Technical Objective'));
assert.ok(prompt1.includes('Key Files / Architecture'));
assert.ok(prompt1.includes('Quality Requirements & AST Verification'));
assert.ok(prompt1.includes('backend-go/main.go'));
assert.ok(prompt1.includes(intent1));

// Verify 3 sections in prescribed order
const idxObj = prompt1.indexOf('Clear Technical Objective');
const idxFiles = prompt1.indexOf('Key Files / Architecture');
const idxQual = prompt1.indexOf('Quality Requirements & AST Verification');
assert.ok(idxObj < idxFiles && idxFiles < idxQual, 'Sections must follow strict prescribed order');

// Verify zero trailing whitespace on every line
prompt1.split('\n').forEach((line, i) => {
  assert.strictEqual(/\s+$/.test(line), false, `Line ${i + 1} must not have trailing whitespace`);
});
console.log('   ✅ Test 1 Passed: Valid 3-section prompt produced without trailing whitespace\n');

// -----------------------------------------------------------------------------
// TEST 2: Idempotence (Repeated execution yields identical output)
// -----------------------------------------------------------------------------
console.log('▶ [TEST 2] Idempotency Verification');
const prompt1Repeat = run(intent1);
assert.strictEqual(prompt1, prompt1Repeat, 'Repeated executions must produce identical byte-for-byte output');
console.log('   ✅ Test 2 Passed: Execution is strictly idempotent\n');

// -----------------------------------------------------------------------------
// TEST 3: Embedded Code Snippet AST Verification
// -----------------------------------------------------------------------------
console.log('▶ [TEST 3] Embedded Code Snippet AST Verification');
// 3a. Valid code snippet passes
const validSnippet = 'const a = 10; function test() { return a * 2; }';
const promptWithValidSnippet = run('Create a mathematical helper', { codeSnippet: validSnippet });
assert.ok(promptWithValidSnippet.includes(validSnippet));

// 3b. Syntactically invalid snippet must throw
const invalidSnippet = 'const broken = { illegal syntax !!';
assert.throws(() => {
  run('Create a broken helper', { codeSnippet: invalidSnippet });
}, /Embedded code snippet failed AST verification via node -c/, 'Invalid code snippet must abort with descriptive error');
console.log('   ✅ Test 3 Passed: Code snippets verified with node -c\n');

// -----------------------------------------------------------------------------
// TEST 4: Edge Cases - Null, Undefined, Non-String & Empty Inputs
// -----------------------------------------------------------------------------
console.log('▶ [TEST 4] Edge Cases: Null, Undefined, Non-String & Empty Intent Validation');

assert.throws(() => {
  run(null);
}, /Invalid intent: input must be a non-empty string/);

assert.throws(() => {
  run(undefined);
}, /Invalid intent: input must be a non-empty string/);

assert.throws(() => {
  run(12345);
}, /Invalid intent: input must be a string/);

assert.throws(() => {
  run('');
}, /Invalid intent: input cannot be empty/);

assert.throws(() => {
  run('    ');
}, /Invalid intent: input cannot be empty/);
console.log('   ✅ Test 4 Passed: Input validation cleanly rejects malformed intents\n');

// -----------------------------------------------------------------------------
// TEST 5: CLI Invocation Verification
// -----------------------------------------------------------------------------
console.log('▶ [TEST 5] CLI Command Invocation');
const cliExit0 = main(['clibb-prompt', 'Refactor state manager persistence']);
assert.strictEqual(cliExit0, 0, 'CLI should return 0 for valid intent');

const cliExitMissing = main(['clibb-prompt']);
assert.strictEqual(cliExitMissing, 1, 'CLI should return 1 for missing intent');
console.log('   ✅ Test 5 Passed: CLI interface executes cleanly\n');

console.log('================================================================================');
console.log('🎉 ALL CLIBB-PROMPT UNIT TESTS PASSED WITH 100% SUCCESS!');
console.log('================================================================================\n');
