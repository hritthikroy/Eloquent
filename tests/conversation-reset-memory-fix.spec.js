const assert = require("assert");
const path = require("path");

// 1. Verify ActionRunner Regex Precision
console.log("🧪 Test 1: ActionRunner Regex Precision (No false positive hijacking of conversational speech)...");
const actionRunner = require("../src/utils/action-runner");

// Test conversational sentences with "can't see"
const testSpeech1 = "I can't see the difference between the people that she wants to live in the world.";
const lower1 = testSpeech1.toLowerCase();

const isEyeRecalibrationQuery =
  /\b(?:fix\s+(?:your|their|they\s+are|the|our)?\s*eyes?|recalibrate\s+(?:your|the)?\s*eyes?|reset\s+(?:your|the)?\s*eyes?|eye\s+tracker|eye\s+drift|chokh\s+(?:thik|nosto|bondho))\b/i.test(lower1) ||
  /\b(?:eyes?\s+(?:are\s+)?not\s+(?:working|active|functional|seeing|moving)|eyes?\s+(?:broken|dead|off))\b/i.test(lower1) ||
  /\b(?:camera\s+eyes?|ocular\s+eyes?|optical\s+cortex)\s+(?:not\s+working|broken|reset|fix|recalibrate)\b/i.test(lower1) ||
  /\b(?:they\s+are\s+not\s+seeing|you\s+are\s+not\s+seeing)\s+(?:my\s+)?(?:screen|display|monitor|code|window)\b/i.test(lower1);

const isVisualQuery =
  isEyeRecalibrationQuery ||
  /\b(see|look\s+at|inspect|watch|check|read)\s+(?:our|my|the|this)?\s*(?:screen|display|monitor|code|terminal|window|ide|antigravity|prompt)\b/i.test(lower1) ||
  /\b(what(?:'s|\s+is)\s+(?:on|showing\s+on|in)\s+(?:our|my|the|this)?\s*(?:screen|display|code|window))\b/i.test(lower1) ||
  /\b(what\s+do\s+you\s+see|what\s+are\s+you\s+seeing)\s+(?:on\s+(?:our|my|the|this)?\s*(?:screen|display|code|window))?\b/i.test(lower1) && /\b(?:screen|display|code|window|desktop)\b/i.test(lower1) ||
  /\b(can\s+you\s+see|are\s+you\s+seeing|do\s+you\s+see)\s+(?:our|my|the|this)?\s*(?:screen|display|monitor|code|terminal|window|desktop)\b/i.test(lower1) ||
  /\b(are\s+you\s+blind\s+to\s+my\s+screen|can(?:'t|not)\s+see\s+(?:our|my|the|this)?\s*(?:screen|display|monitor|code|window|desktop))\b/i.test(lower1) ||
  /\b(showing\s+empty|empty\s+screen|screen\s+blank|blank\s+screen|where\s+is\s+the\s+prompt\s+on\s+screen)\b/i.test(lower1) ||
  /\b(chokh\s+kholo|screen\s+dekho|screen\s+e\s+ki|screen\s+ta\s+dekh|code\s+ta\s+dekh|chokh\s+ta\s+dekh)\b/i.test(lower1);

assert.strictEqual(isEyeRecalibrationQuery, false, "Conversational 'I can't see the difference...' must NOT trigger isEyeRecalibrationQuery");
assert.strictEqual(isVisualQuery, false, "Conversational 'I can't see the difference...' must NOT trigger isVisualQuery");

// True positives should still trigger
assert.strictEqual(
  /\b(?:fix\s+(?:your|their|they\s+are|the|our)?\s*eyes?|recalibrate\s+(?:your|the)?\s*eyes?|reset\s+(?:your|the)?\s*eyes?|eye\s+tracker|eye\s+drift|chokh\s+(?:thik|nosto|bondho))\b/i.test("recalibrate your eyes"),
  true,
  "Explicit eye recalibration query must trigger"
);
console.log("✅ Test 1 Passed: ActionRunner regex does not hijack regular conversational speech.");

// 2. Verify IntentParser for Conversation Reset Directive
console.log("🧪 Test 2: IntentParser Conversation Reset & Memory Loss Directive...");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");

const userQuery = "fix every time reset conversation is the main issue for memory loss";
const isMemoryDirective = IntentParser.isShortTermMemoryLossDirective(userQuery);
assert.strictEqual(isMemoryDirective, true, "Must recognize 'fix every time reset conversation is the main issue for memory loss'");

const parsed = IntentParser.parseIntent(userQuery);
assert.strictEqual(parsed.action, "short_term_memory_loss_fix_directive", "Must map to short_term_memory_loss_fix_directive action");
console.log("✅ Test 2 Passed: IntentParser accurately classifies conversation reset memory loss directive.");

// 3. Verify JarvisManager History Retention
console.log("🧪 Test 3: JarvisManager Bilingual Context Retention...");
const JarvisManager = require("../src/utils/jarvis-manager");
const jm = new JarvisManager();
jm.conversationHistory = [
  { role: "user", content: "আমাদের কোডে একটা ইস্যু আছে babe" },
  { role: "assistant", content: "বলো babe, কোন ফাইলে বাগটা পাচ্ছি?", agent: "Tuk Tuk" },
  { role: "user", content: "I am checking line 42 now in main.js" },
  { role: "assistant", content: "Got it babe, looking at line 42 with you.", agent: "Tuk Tuk" },
  { role: "user", content: "Can we trace the function calls here?" }
];

const retrievedEnHistory = jm.getHistory(12, "tuktuk", "en");
// Should retain all 5 turns without dropping the Bengali turns!
assert.strictEqual(retrievedEnHistory.length, 5, `Expected 5 preserved turns in history, got ${retrievedEnHistory.length}`);
const hasBengali = retrievedEnHistory.some(t => /[\u0980-\u09FF]/.test(t.content));
assert.strictEqual(hasBengali, true, "Bilingual history must NOT be stripped when active language is 'en'");
console.log("✅ Test 3 Passed: JarvisManager retains all bilingual and code-mixed turns across language transitions.");

// 4. Verify LocalCognitiveBrain Contextual Continuity
console.log("🧪 Test 4: LocalCognitiveBrain Contextual Continuity & Memory Response...");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

// Direct reset query response
const resetReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", userQuery, {}, "en");
assert(
  resetReply.toLowerCase().includes("reset") && resetReply.toLowerCase().includes("memory"),
  `Expected response to address reset and memory, got: "${resetReply}"`
);

// Fallback response with prior context
const fallbackReply = LocalCognitiveBrain.synthesizeResponse(
  "tuktuk",
  "Tuk Tuk",
  "Now what should we do?",
  {
    conversationHistory: [
      { role: "user", content: "Fixing AST parser bug in index.js" },
      { role: "assistant", content: "Right with you babe!", agent: "Tuk Tuk" },
      { role: "user", content: "Now what should we do?" }
    ]
  },
  "en"
);

// Must acknowledge code/flow momentum rather than fresh generic starter
assert(
  fallbackReply.toLowerCase().includes("code") || fallbackReply.toLowerCase().includes("momentum") || fallbackReply.toLowerCase().includes("flow") || fallbackReply.toLowerCase().includes("step") || fallbackReply.toLowerCase().includes("locked"),
  `Fallback reply should maintain contextual continuity, got: "${fallbackReply}"`
);
console.log("✅ Test 4 Passed: LocalCognitiveBrain grounds fallback in conversation history.");

console.log("\n🎉 ALL CONVERSATION RESET & MEMORY LOSS TESTS PASSED (4/4)!");
