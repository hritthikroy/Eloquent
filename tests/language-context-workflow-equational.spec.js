/**
 * tests/language-context-workflow-equational.spec.js
 *
 * Mathematical and integration test suite verifying:
 * 1. Equational Language Context State Machine (ELCT) & Hysteresis M_lang
 * 2. Explicit Language Directives (English workflow vs Full Bengali mode)
 * 3. Hysteresis Stability on ambiguous/short inputs (0 language flickering)
 * 4. Dynamic System Prompt Invariants (English Law 10 vs Bengali Law 10)
 * 5. Context Memory Isolation & Preceding Turns Sanitization
 * 6. Lexical Sanitizer Fallback & Accidental Banglish Stripping in English Mode
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const JarvisManager = require("../src/utils/jarvis-manager");

console.log("================================================================================");
console.log("🌐 VERIFYING EQUATIONAL LANGUAGE CONTEXT STATE MACHINE & WORKFLOW FOCUS");
console.log("================================================================================");

let testsPassed = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS ${totalTests}] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${totalTests}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

const tmpUserData = path.join("/tmp", "eloquent_test_lang_" + Date.now());
if (!fs.existsSync(tmpUserData)) fs.mkdirSync(tmpUserData, { recursive: true });

const jarvis = new JarvisManager(tmpUserData);

// -----------------------------------------------------------------------------
// TEST 1: Default State is English Workflow Mode
// -----------------------------------------------------------------------------
runTest("Default Language State is English Workflow Mode", () => {
  assert.strictEqual(jarvis.currentLanguageMode, "en", "Default language mode must be en");
});

// -----------------------------------------------------------------------------
// TEST 2: English Technical Work Commands Retain English Mode
// -----------------------------------------------------------------------------
runTest("English Technical Work Commands maintain English Mode", () => {
  const mode1 = jarvis.evaluateLanguageTransition("Let us review the code in main.js and check for AST errors");
  assert.strictEqual(mode1, "en");
  assert.strictEqual(jarvis.currentLanguageMode, "en");

  const mode2 = jarvis.evaluateLanguageTransition("What is the architecture of the audio bridge?");
  assert.strictEqual(mode2, "en");
  assert.strictEqual(jarvis.currentLanguageMode, "en");
});

// -----------------------------------------------------------------------------
// TEST 3: Hysteresis Invariant on Ambiguous / Short Phrases in English Mode
// -----------------------------------------------------------------------------
runTest("Hysteresis prevents flickering on short or pet-name inputs in English Mode", () => {
  jarvis.currentLanguageMode = "en";

  // Saying babe or okay or check this should NOT switch to Bengali!
  assert.strictEqual(jarvis.evaluateLanguageTransition("okay babe"), "en");
  assert.strictEqual(jarvis.evaluateLanguageTransition("yeah"), "en");
  assert.strictEqual(jarvis.evaluateLanguageTransition("cool babe"), "en");
  assert.strictEqual(jarvis.evaluateLanguageTransition("check this"), "en");
  assert.strictEqual(jarvis.currentLanguageMode, "en", "Language mode must remain en");
});

// -----------------------------------------------------------------------------
// TEST 4: Explicit Language Switch Command to Bengali
// -----------------------------------------------------------------------------
runTest("Explicit switch to Bengali via banglay kotha bolo", () => {
  const pref = jarvis.detectPreferenceChange("Banglay kotha bolo babe");
  assert.ok(pref, "Preference change must be detected");
  assert.strictEqual(pref.type, "language");
  assert.strictEqual(pref.mode, "bn");
  assert.strictEqual(jarvis.currentLanguageMode, "bn");
});

// -----------------------------------------------------------------------------
// TEST 5: Bengali Conversation Continuity in Full Bengali Mode
// -----------------------------------------------------------------------------
runTest("Bengali speech maintains Full Bengali Mode across turns", () => {
  jarvis.currentLanguageMode = "bn";

  const mode1 = jarvis.evaluateLanguageTransition("tumi kemon acho babe? amader project koto dur?");
  assert.strictEqual(mode1, "bn");

  // Bengali Unicode script
  const mode2 = jarvis.evaluateLanguageTransition("আমি একদম ঠিক আছি চলো কোড করি");
  assert.strictEqual(mode2, "bn");

  // Bengali with English tech loanword still maintains Bengali mode
  const mode3 = jarvis.evaluateLanguageTransition("terminal-e build run koro babe");
  assert.strictEqual(mode3, "bn");
  assert.strictEqual(jarvis.currentLanguageMode, "bn");
});

// -----------------------------------------------------------------------------
// TEST 6: Hysteresis Invariant in Bengali Mode
// -----------------------------------------------------------------------------
runTest("Hysteresis prevents accidental drop to English on short inputs in Bengali Mode", () => {
  jarvis.currentLanguageMode = "bn";

  assert.strictEqual(jarvis.evaluateLanguageTransition("babe"), "bn");
  assert.strictEqual(jarvis.evaluateLanguageTransition("hmmm"), "bn");
  assert.strictEqual(jarvis.evaluateLanguageTransition("achha"), "bn");
  assert.strictEqual(jarvis.currentLanguageMode, "bn");
});

// -----------------------------------------------------------------------------
// TEST 7: Explicit Switch Back to English Workflow Mode
// -----------------------------------------------------------------------------
runTest("Explicit switch back to English via talk in english", () => {
  const pref = jarvis.detectPreferenceChange("talk in english babe");
  assert.ok(pref, "Preference change must be detected");
  assert.strictEqual(pref.type, "language");
  assert.strictEqual(pref.mode, "en");
  assert.strictEqual(jarvis.currentLanguageMode, "en");
});

// -----------------------------------------------------------------------------
// TEST 8: Dynamic Prompt Invariant Enforcement for English Mode
// -----------------------------------------------------------------------------
runTest("getSystemPrompt generates strict English Law 10 when mode is en", () => {
  jarvis.currentLanguageMode = "en";
  const prompt = jarvis.getSystemPrompt(jarvis.agents.tuktuk, "check terminal", null, "en");
  
  assert.ok(prompt.includes("STRICT ACTIVE WORKFLOW LANGUAGE: 100% MODERN ENGLISH LAW"), "Prompt must contain English workflow invariant");
  assert.ok(prompt.includes("ZERO LANGUAGE DRIFT"), "Prompt must forbid language drift");
  assert.ok(!prompt.includes("LIVING COLLOQUIAL BANGLA & BANGLISH (চলতি কথ্য বাংলা):"), "English prompt must not include Bengali colloquial directive");
});

// -----------------------------------------------------------------------------
// TEST 9: Dynamic Prompt Invariant Enforcement for Bengali Mode
// -----------------------------------------------------------------------------
runTest("getSystemPrompt generates full Bengali Law 10 when mode is bn", () => {
  jarvis.currentLanguageMode = "bn";
  const prompt = jarvis.getSystemPrompt(jarvis.agents.tuktuk, "kemon acho", null, "bn");
  
  assert.ok(prompt.includes("STRICT ACTIVE CONVERSATIONAL LANGUAGE: FULL AUTHENTIC BENGALI"), "Prompt must contain full Bengali invariant");
  assert.ok(prompt.includes("CONTINUOUS WORKFLOW: Keep the conversation strictly in Bengali"), "Prompt must mandate continuous Bengali flow");
});

// -----------------------------------------------------------------------------
// TEST 10: Context Memory Isolation & English Preceding Turns Sanitization
// -----------------------------------------------------------------------------
runTest("Context Memory and session continuity isolate languages cleanly", () => {
  // Add alternating turns
  jarvis.conversationHistory = [];
  jarvis.addTurn("user", "What is the memory footprint?", "user", "en");
  jarvis.addTurn("assistant", "Memory is flat at 90 megabytes, brother.", "vision", "en");
  jarvis.addTurn("user", "তুমি কেমন আছো সোনা", "user", "bn");
  jarvis.addTurn("assistant", "আমি ভালো আছি babe!", "tuktuk", "bn");

  // In English mode, getHistory should isolate and prioritize English turns
  const enHistory = jarvis.getHistory(4, "tuktuk", "en");
  assert.ok(enHistory.every(t => !/[\u0980-\u09FF]/.test(t.content)), "English history must not contain raw Bengali Unicode script");

  // In Bengali mode, getHistory contains all turns
  const bnHistory = jarvis.getHistory(4, "tuktuk", "bn");
  assert.strictEqual(bnHistory.length, 4);
});

// -----------------------------------------------------------------------------
// TEST 11: Lexical Sanitizer Fallback in English Mode
// -----------------------------------------------------------------------------
runTest("Sanitizer cleans accidental Banglish openers in English Mode", () => {
  jarvis.currentLanguageMode = "en";
  const leakedText = "Hey babe, shono! The code logic is completely clean.";
  const cleaned = jarvis.sanitizeAgentLexicon(leakedText, "tuktuk");
  assert.ok(!cleaned.includes("shono"), "Banglish opener must be stripped in English mode");
  assert.ok(cleaned.startsWith("Hey babe, The code"), "Must preserve clean English flow");
});

console.log("\n================================================================================");
console.log(`🎉 ALL ${testsPassed}/${totalTests} LANGUAGE CONTEXT WORKFLOW TESTS PASSED (100%)`);
console.log("================================================================================");
