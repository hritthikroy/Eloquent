/**
 * tests/english-bangla-mixed-no-pure-deshi.spec.js
 *
 * Test suite verifying:
 * 1. IntentParser detects user prompt:
 *    "not use only bangla only use english bangal mixed for bangla only never use pure deshi bangll use bangla for hard sentances understand do deep chack and fix all"
 * 2. ActionRunner configures:
 *    - english_bangla_mixed_only = true
 *    - pure_deshi_bangla_banned = true
 *    - bangla_for_hard_sentences = true
 *    - voice = en-US-AvaMultilingualNeural
 * 3. BanglaVoiceCortex eliminates pure deshi/archaic words and preserves code-mixing
 * 4. JarvisManager prompts embed:
 *    - Never use only Bangla
 *    - Strict ban on pure deshi Bangla
 *    - Bangla used for hard sentences
 *    - Code-mixed real Bangla letters + English letters
 */

const assert = require("assert");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const JarvisManager = require("../src/utils/jarvis-manager");
const { banglaVoiceCortex } = require("../src/utils/bangla-voice-cortex");
const actionRunner = require("../src/utils/action-runner");

console.log("🧪 [START]: Running tests for English-Bangla Mixed, No Pure Deshi Bangla & Bangla for Hard Sentences...");

// 1. Intent Detection
const userUtterance = "not use only bangla only use english bangal mixed for bangla only never use pure deshi bangll use bangla for hard sentances understand do deep chack and fix all";

const detected = IntentParser.isEnglishBanglaMixedNoPureDeshiHardSentencesDirective(userUtterance);
assert.strictEqual(detected, true, "Should detect user prompt as english-bangla mixed no pure deshi directive");

const parsed = IntentParser.parse(userUtterance);
assert.strictEqual(parsed.target, "english_bangla_mixed_no_pure_deshi_hard_sentences_directive", "Parsed target must match directive");
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
  configureEnglishBanglaMixedNoPureDeshiHardSentences: () => {
    prefs.english_bangla_mixed_only = true;
    prefs.pure_deshi_bangla_banned = true;
    prefs.bangla_for_hard_sentences = true;
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
  assert.strictEqual(result.data.englishBanglaMixedOnly, true, "englishBanglaMixedOnly must be true");
  assert.strictEqual(result.data.pureDeshiBanglaBanned, true, "pureDeshiBanglaBanned must be true");
  assert.strictEqual(result.data.banglaForHardSentences, true, "banglaForHardSentences must be true");

  // Verify speech contains real Bangla letters AND English letters
  assert.ok(/[\u0980-\u09FF]/.test(result.speech), "Speech must contain real Bangla letters");
  assert.ok(/[a-zA-Z]/.test(result.speech), "Speech must contain English letters");
  assert.ok(!result.speech.includes("খাঁটি দেশি"), "Speech must not contain pure deshi terms");
  console.log("  ✅ Step 2 passed: ActionRunner configured English-Bangla Mixed, No Pure Deshi & Bangla for Hard Sentences.");
  console.log("     Spoken Response: " + result.speech);

  // 3. BanglaVoiceCortex De-Deshi Filtering
  banglaVoiceCortex.setCodeMixedRealBanglaAndEnglishLetters(true);
  banglaVoiceCortex.setPureDeshiBanglaBanned(true);

  const testUtteranceWithDeshi = "এই সিস্টেমের জটিলতা এবং খাঁটি দেশি সাধু ভাষা পরিমাপণ দরকার নেই";
  const processed = banglaVoiceCortex.processUtterance(testUtteranceWithDeshi, "en-US-AvaMultilingualNeural");

  assert.ok(!processed.includes("খাঁটি দেশি"), "'খাঁটি দেশি' must be filtered");
  assert.ok(!processed.includes("সাধু ভাষা"), "'সাধু ভাষা' must be filtered");
  assert.ok(!processed.includes("জটিলতা"), "'জটিলতা' must be replaced with 'complexity'");
  console.log("  ✅ Step 3 passed: BanglaVoiceCortex filtered out pure deshi Bengali terms.");
  console.log("     Processed: " + processed);

  // 4. JarvisManager Prompt Invariants
  const jm = new JarvisManager();
  jm.setPreference("single_real_voice_active", true);
  jm.configureEnglishBanglaMixedNoPureDeshiHardSentences();

  const systemPrompt = jm.getSystemPrompt(null, "explain how quantum vibe works", null, "banglish");
  assert.ok(systemPrompt.includes("ENGLISH-BANGLA MIXED ONLY"), "Prompt must mandate ENGLISH-BANGLA MIXED ONLY");
  assert.ok(systemPrompt.includes("STRICT BAN ON PURE DESHI BANGLA"), "Prompt must mandate STRICT BAN ON PURE DESHI BANGLA");
  assert.ok(systemPrompt.includes("BANGLA FOR HARD SENTENCES"), "Prompt must mandate BANGLA FOR HARD SENTENCES");

  const compactPrompt = jm.getCompactSystemPrompt(null, "what is this", null, "banglish");
  assert.ok(compactPrompt.includes("ENGLISH-BANGLA MIXED ONLY"), "Compact prompt must include ENGLISH-BANGLA MIXED ONLY");
  assert.ok(compactPrompt.includes("BANGLA FOR HARD SENTENCES"), "Compact prompt must include BANGLA FOR HARD SENTENCES");
  console.log("  ✅ Step 4 passed: JarvisManager system & compact prompts embed all invariants.");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY for English-Bangla Mixed, No Pure Deshi Bangla & Bangla for Hard Sentences!\n");
})();
