/**
 * tests/code-mixed-real-bangla-and-english-letters.spec.js
 *
 * Test suite verifying:
 * 1. IntentParser detects user prompt:
 *    "chak the last conversation talk fix banal prounciation when you talk in banglish use real bangla later and english later for better pronaunciation"
 * 2. ActionRunner configures code-mixed real Bangla letters & English letters on AvaMultilingualNeural
 * 3. JarvisManager.resolveVoiceForLanguage guarantees en-US-AvaMultilingualNeural and bans PradeepNeural
 * 4. phoneticNormalizeForTTS preserves real Bangla script alongside English letters
 * 5. BanglaVoiceCortex preserves real Bangla letters and English words side-by-side
 */

const assert = require("assert");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const JarvisManager = require("../src/utils/jarvis-manager");
const { banglaVoiceCortex } = require("../src/utils/bangla-voice-cortex");
const actionRunner = require("../src/utils/action-runner");

console.log("🧪 [START]: Running tests for Code-Mixed Real Bangla & English Letters...");

// 1. Intent Detection
const userUtterance = "chak the last conversation talk fix banal prounciation when you talk in banglish use real bangla later and english later for better pronaunciation";

const detected = IntentParser.isCodeMixedRealBanglaAndEnglishLettersDirective(userUtterance);
assert.strictEqual(detected, true, "Should detect user prompt as code-mixed real Bangla & English letters directive");

const parsed = IntentParser.parse(userUtterance);
assert.strictEqual(parsed.target, "code_mixed_real_bangla_and_english_letters_directive", "Parsed target must match directive");
assert.strictEqual(parsed.intent, IntentParser.INTENTS.SMOOTH_CONVERSATION, "Intent should be SMOOTH_CONVERSATION");

console.log("  ✅ Step 1 passed: IntentParser correctly detects and parses user prompt.");

// 2. ActionRunner Execution
const prefs = {
  single_real_voice_active: true,
  single_voice_tuktuk_exclusive: true,
  multi_personality_disabled: true
};

const mockJM = {
  config: {
    userName: "Hritthik",
    salutation: "Hritthik",
    voice: "en-US-AvaMultilingualNeural"
  },
  preferences: prefs,
  currentLanguageMode: "banglish",
  agents: {
    tuktuk: { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" }
  },
  getPreference: (k) => prefs[k],
  setPreference: (k, v) => { prefs[k] = v; },
  saveConfig: (c) => Object.assign(mockJM.config, c),
  isSingleRealVoiceMode: () => true,
  configureCodeMixedRealBanglaAndEnglishLetters: () => {
    prefs.code_mixed_real_bangla_and_english_letters = true;
    prefs.no_bangla_script = false;
    mockJM.config.voice = "en-US-AvaMultilingualNeural";
    return { success: true };
  }
};

(async () => {
  const result = await actionRunner.handleAction(userUtterance, mockJM.agents.tuktuk, mockJM, null, null);
  assert.strictEqual(result.handled, true, "Directive must be handled");
  assert.strictEqual(result.agentVoice, "en-US-AvaMultilingualNeural", "Voice must be en-US-AvaMultilingualNeural");
  assert.strictEqual(result.data.codeMixedRealBanglaAndEnglishLetters, true, "codeMixedRealBanglaAndEnglishLetters must be true");
  assert.strictEqual(result.data.noBanglaScript, false, "noBanglaScript must be false");

  // Verify speech contains real Bangla letters AND English letters
  assert.ok(/[\u0980-\u09FF]/.test(result.speech), "Speech must contain real Bangla letters");
  assert.ok(/[a-zA-Z]/.test(result.speech), "Speech must contain English letters");
  console.log("  ✅ Step 2 passed: ActionRunner configured codeMixedRealBanglaAndEnglishLetters on AvaMultilingualNeural.");
  console.log("     Spoken Response: " + result.speech);

  // 3. Voice Resolution
  const tuktukVoice = JarvisManager.resolveVoiceForLanguage("en-US-AvaMultilingualNeural", "আমি তোমার সাথে আছি");
  assert.strictEqual(tuktukVoice, "en-US-AvaMultilingualNeural", "Tuk Tuk voice must be AvaMultilingualNeural");

  // Strict PradeepNeural ban
  const bannedPradeep = JarvisManager.resolveVoiceForLanguage("bn-BD-PradeepNeural", "টেস্ট");
  assert.strictEqual(bannedPradeep, "en-US-AvaMultilingualNeural", "PradeepNeural must be strictly banned and redirected");

  console.log("  ✅ Step 3 passed: Voice resolution preserves AvaMultilingualNeural and bans PradeepNeural.");

  // 4. Phonetic Normalization
  banglaVoiceCortex.setCodeMixedRealBanglaAndEnglishLetters(true);
  const sampleText = "Babe, আমি তোমার code build আর test করেছি, everything is running smooth!";
  const normalized = JarvisManager.phoneticNormalizeForTTS(sampleText, "en-US-AvaMultilingualNeural");

  // Must preserve Bengali Unicode
  assert.ok(/[\u0980-\u09FF]/.test(normalized), "Bengali script must NOT be stripped or romanized");
  assert.ok(normalized.includes("আমি তোমার"), "Bengali words must be preserved in real Bengali script");

  // English words must stay in English letters (not converted to Bengali script loanwords)
  assert.ok(normalized.includes("code"), "'code' must remain in Latin alphabet");
  assert.ok(normalized.includes("build"), "'build' must remain in Latin alphabet");
  assert.ok(normalized.includes("test"), "'test' must remain in Latin alphabet");
  assert.ok(!normalized.includes("বিল্ড"), "'বিল্ড' should not replace 'build'");
  assert.ok(!normalized.includes("টেস্ট"), "'টেস্ট' should not replace 'test'");

  console.log("  ✅ Step 4 passed: phoneticNormalizeForTTS preserves real Bangla letters and English letters.");

  // 5. BanglaVoiceCortex Preflight Pipeline
  const cortexOutput = banglaVoiceCortex.processBengaliUtterance(sampleText, "en-US-AvaMultilingualNeural");

  assert.ok(/[\u0980-\u09FF]/.test(cortexOutput), "Cortex output must preserve real Bengali letters");
  assert.ok(/[a-zA-Z]/.test(cortexOutput), "Cortex output must preserve English letters");
  assert.ok(cortexOutput.includes("code"), "Cortex output must preserve English technical terms");

  console.log("  ✅ Step 5 passed: BanglaVoiceCortex preserves real Bangla letters and English letters.");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
})().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
