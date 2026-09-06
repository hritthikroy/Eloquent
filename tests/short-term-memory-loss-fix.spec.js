/**
 * tests/short-term-memory-loss-fix.spec.js
 * Comprehensive automated verification for short-term working memory loss fix,
 * multi-turn episodic retention, conversational amnesia prevention,
 * and strict persona sovereignty across Eloquent Electron.
 */

const assert = require('assert');
const path = require('path');

console.log('🧪 Starting Short-Term Memory Loss Fix Verification Suite...\n');

// 1. TextSanitizer Normalization Tests
console.log('▶ Test 1: TextSanitizer Phonetic & Terminology Normalization');
const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');

const input1 = "fix this short time memory lost issues";
const sanitized1 = TextSanitizer.sanitize(input1);
console.log(`  Raw: "${input1}" -> Sanitized: "${sanitized1}"`);
assert(sanitized1.includes("short-term memory loss"), "Expected 'short time memory lost' to normalize to 'short-term memory loss'");

const input2 = "we have short time memory problem and memory lost";
const sanitized2 = TextSanitizer.sanitize(input2);
console.log(`  Raw: "${input2}" -> Sanitized: "${sanitized2}"`);
assert(sanitized2.includes("short-term memory"), "Expected 'short time memory' to normalize to 'short-term memory'");
assert(sanitized2.includes("memory loss"), "Expected 'memory lost' to normalize to 'memory loss'");
console.log('  ✅ TextSanitizer test passed.\n');

// 2. IntentParser Directive Detection & Routing
console.log('▶ Test 2: IntentParser Directive Detection & Routing');
const { IntentParser } = require('../src/utils/prompt-engine/intent-parser');

const testPhrases = [
  "fix this short time memory lost issues",
  "fix this short-term memory loss issues",
  "solve conversational amnesia problem",
  "stop short term memory loss",
  "আমাদের শর্ট টাইম মেমোরি লস ফিক্স করো"
];

for (const phrase of testPhrases) {
  const isDetected = IntentParser.isShortTermMemoryLossDirective(phrase);
  assert.strictEqual(isDetected, true, `Expected "${phrase}" to be recognized as short-term memory loss directive`);
  
  const parsed = IntentParser.parse(phrase);
  assert(parsed !== null, `Parsed result should not be null for "${phrase}"`);
  assert.strictEqual(parsed.intent, "SMOOTH_CONVERSATION", `Expected intent 'SMOOTH_CONVERSATION', got '${parsed.intent}'`);
  assert.strictEqual(parsed.action, "short_term_memory_loss_fix_directive", `Expected action 'short_term_memory_loss_fix_directive', got '${parsed.action}'`);
}
console.log('  ✅ IntentParser detection & routing tests passed.\n');

async function runAllTests() {
  // 3. ActionRunner Execution & Persona Sovereignty
  console.log('▶ Test 3: ActionRunner Execution, Expansion & Persona Sovereignty');
  const actionRunner = require('../src/utils/action-runner');

  const mockJarvis = {
    working_memory_turns_depth: 6,
    expandWorkingMemory(turns) {
      this.working_memory_turns_depth = turns;
      return turns;
    },
    setPreference(key, val) {
      this[key] = val;
    }
  };

  const directiveInput = "fix this short time memory lost issues";

  // Tuk Tuk
  const resTT = await actionRunner.handleAction(directiveInput, { key: 'tuktuk', name: 'Tuk Tuk' }, mockJarvis);
  assert(resTT && resTT.speech, "Expected result speech from ActionRunner");
  assert(resTT.speech.toLowerCase().includes("babe"), "Tuk Tuk MUST include 'babe'");
  assert(!resTT.speech.toLowerCase().includes("brother") && !resTT.speech.toLowerCase().includes("chief"), "Tuk Tuk must not leak Vision/Friday honorifics");
  assert.strictEqual(mockJarvis.working_memory_turns_depth, 24, "Jarvis working memory depth should be expanded to 24 turns");

  // Vision
  const resVision = await actionRunner.handleAction(directiveInput, { key: 'vision', name: 'Vision' }, mockJarvis);
  assert(resVision.speech.toLowerCase().includes("brother") || resVision.speech.toLowerCase().includes("bro") || resVision.speech.includes("ভাই"), "Vision MUST include 'brother'/'bro'/'ভাই'");
  assert(!resVision.speech.toLowerCase().includes("babe") && !resVision.speech.toLowerCase().includes("chief"), "Vision must never use 'babe' or 'chief'");

  // Friday
  const resFriday = await actionRunner.handleAction(directiveInput, { key: 'friday', name: 'Friday' }, mockJarvis);
  assert(resFriday.speech.includes("Chief"), "Friday MUST include 'Chief'");
  assert(!resFriday.speech.toLowerCase().includes("babe") && !resFriday.speech.toLowerCase().includes("bro"), "Friday must never use 'babe' or 'bro'");

  // DD
  const resDD = await actionRunner.handleAction(directiveInput, { key: 'dd', name: 'DD' }, mockJarvis);
  assert(resDD.speech.toLowerCase().includes("bro"), "DD MUST include 'bro'");
  assert(!resDD.speech.toLowerCase().includes("babe") && !resDD.speech.toLowerCase().includes("chief"), "DD must never use 'babe' or 'chief'");

  console.log('  ✅ ActionRunner persona sovereignty & memory expansion passed.\n');

// 4. JarvisManager Multi-Turn Retention & Non-Destructive Realignment
  console.log('▶ Test 4: JarvisManager Non-Destructive Realignment & History Retention');
  const JarvisManager = require('../src/utils/jarvis-manager');
  const jarvisManager = new JarvisManager();

// Add 20 multi-turn exchanges (40 messages)
jarvisManager.conversationHistory = [];
for (let i = 1; i <= 20; i++) {
  jarvisManager.addTurn('user', `User message turn ${i}`, 'user', 'en');
  jarvisManager.addTurn('assistant', `Assistant reply turn ${i}`, 'Tuk Tuk', 'en');
}
assert.strictEqual(jarvisManager.conversationHistory.length, 40, "Should have 40 messages in history");

// Test that resolveConversationalMismatch does NOT wipe out history down to 2 messages
jarvisManager.resolveConversationalMismatch('User message turn 20', 'assistant');
console.log(`  History length after resolveConversationalMismatch: ${jarvisManager.conversationHistory.length}`);
assert(jarvisManager.conversationHistory.length >= 24, `Expected at least 24 entries retained, got ${jarvisManager.conversationHistory.length}`);

// Test getHistory retrieval with expanded window
const history16 = jarvisManager.getHistory(16);
console.log(`  getHistory(16) returned ${history16.length} messages`);
assert(history16.length >= 24, `getHistory(16) should return up to 32 messages (got ${history16.length})`);

// Test getWorkingMemorySummary & compact system prompt injection
const summary = jarvisManager.getWorkingMemorySummary();
console.log(`  Working Memory Summary excerpt: ${summary.slice(0, 100)}...`);
assert(summary.includes("User:") || summary.includes("Learned Preferences:"), "Summary should contain user or learned preferences");

const compactPrompt = jarvisManager.getCompactSystemPrompt('tuktuk');
assert(compactPrompt.includes("WORKING MEMORY"), "Compact prompt should include working memory block");
console.log('  ✅ JarvisManager non-destructive retention tests passed.\n');

// 5. LocalCognitiveBrain Offline Fallback & Persona Sovereign Directives
console.log('▶ Test 5: LocalCognitiveBrain Synthesis & Context Recall');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');

const memoryDirectiveText = "fix this short time memory lost issues";

// Tuk Tuk
const brainTT = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', memoryDirectiveText);
console.log(`  [Tuk Tuk]: ${brainTT}`);
assert(brainTT.toLowerCase().includes("babe"), "Tuk Tuk local brain must use 'babe'");
assert(!brainTT.toLowerCase().includes("brother") && !brainTT.toLowerCase().includes("chief"), "Tuk Tuk must not leak other personas");

// Vision
const brainVision = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', memoryDirectiveText);
console.log(`  [Vision]: ${brainVision}`);
assert(brainVision.toLowerCase().includes("brother") || brainVision.toLowerCase().includes("bro") || brainVision.includes("ভাই"), "Vision local brain must use 'brother'/'bro'/'ভাই'");
assert(!brainVision.toLowerCase().includes("babe"), "Vision must never use 'babe'");

// Friday
const brainFriday = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', memoryDirectiveText);
console.log(`  [Friday]: ${brainFriday}`);
assert(brainFriday.includes("Chief"), "Friday local brain must use 'Chief'");
assert(!brainFriday.toLowerCase().includes("babe") && !brainFriday.toLowerCase().includes("bro"), "Friday must never use 'babe' or 'bro'");

// DD
const brainDD = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', memoryDirectiveText);
console.log(`  [DD]: ${brainDD}`);
assert(brainDD.toLowerCase().includes("bro"), "DD local brain must use 'bro'");
assert(!brainDD.toLowerCase().includes("babe") && !brainDD.toLowerCase().includes("chief"), "DD must never use 'babe' or 'chief'");

// Squad
const brainSquad = LocalCognitiveBrain.synthesizeResponse('team', 'Squad', memoryDirectiveText);
console.log(`  [Squad]: ${brainSquad}`);
assert(brainSquad.includes("[Tuk Tuk]:") && brainSquad.includes("[Vision]:") && brainSquad.includes("[Friday]:") && brainSquad.includes("[DD]:"), "Squad must contain all 4 agents");

// Context Recall Test: user asks "what did I say earlier?" with conversationHistory provided in context
const recallQuery = "what was the error I mentioned earlier?";
const mockHistory = [
  { role: 'user', content: 'We encountered ECONNREFUSED on port 50051 during gRPC handshake' },
  { role: 'assistant', content: 'Checking gRPC audio backend port...' }
];

const recallTT = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', recallQuery, {
  conversationHistory: mockHistory
});
console.log(`  [Recall Tuk Tuk]: ${recallTT}`);
assert(recallTT.toLowerCase().includes("babe"), "Tuk Tuk recall must use 'babe'");
assert(recallTT.includes("ECONNREFUSED on port 50051"), "Tuk Tuk recall must quote or reference the previous error");

const recallVision = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', recallQuery, {
  conversationHistory: mockHistory
});
console.log(`  [Recall Vision]: ${recallVision}`);
assert(recallVision.toLowerCase().includes("brother") || recallVision.toLowerCase().includes("bhai"), "Vision recall must use 'brother'/'bhai'");
assert(recallVision.includes("ECONNREFUSED on port 50051"), "Vision recall must reference the previous error");

console.log('  ✅ LocalCognitiveBrain synthesis & context recall tests passed.\n');

// 6. PromptAssembler Domain & File Mapping Test
console.log('▶ Test 6: PromptAssembler Domain Mapping');
const { PromptAssembler } = require('../src/utils/prompt-engine/prompt-assembler');

  const assembled = await PromptAssembler.assemblePrompt("fix this short time memory lost issues");
  assert(assembled.includes("short-term working memory persistence"), "PromptAssembler objective must mention short-term working memory persistence");
  assert(assembled.includes("jarvis-manager.js"), "PromptAssembler must list jarvis-manager.js in Key Files");
  assert(assembled.includes("local-cognitive-brain.js"), "PromptAssembler must list local-cognitive-brain.js in Key Files");
  console.log('  ✅ PromptAssembler domain mapping test passed.\n');

  console.log('🎉 ALL SHORT-TERM MEMORY LOSS FIX VERIFICATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runAllTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
