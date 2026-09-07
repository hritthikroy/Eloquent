/**
 * tests/english-and-banglish-no-bangla.spec.js
 *
 * Verification suite for:
 * 1. "English,and Banglish. no bangla" directive detection
 * 2. Strict zero Bengali Unicode script invariant (/[\u0980-\u09FF]/ === false)
 * 3. Pure Roman Banglish and crisp English speech output
 * 4. Preservation of Tuk Tuk's single-soul en-US-AvaNeural voice
 */

const assert = require("assert");
const IntentParser = require("../src/utils/prompt-engine/intent-parser");
const ActionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");

async function runTests() {
  console.log("🧪 Starting English & Banglish Only (No Bangla Script) Test Suite...\n");

  const jm = new JarvisManager();

  // Test 1: IntentParser detection
  console.log("Test 1: IntentParser detection of 'English,and Banglish. no bangla'...");
  const inputs = [
    "English,and Banglish. no bangla",
    "English, and Banglish. no bangla",
    "english and banglish only no bangla",
    "no bangla",
    "no bangla script",
    "only english and banglish",
    "shudhu english ar banglish"
  ];
  for (const input of inputs) {
    const detected = IntentParser.isEnglishAndBanglishNoBanglaDirective(input);
    assert.strictEqual(detected, true, `Expected "${input}" to be detected as English and Banglish directive`);
  }
  console.log("✅ IntentParser accurately detected all variations of English and Banglish (No Bangla) directive.\n");

  // Test 2: ActionRunner handles directive
  console.log("Test 2: ActionRunner handleAction execution...");
  const actionResult = await ActionRunner.handleAction(
    "English,and Banglish. no bangla",
    jm.agents.tuktuk,
    jm
  );
  assert.strictEqual(actionResult.handled, true, "Expected directive to be handled");
  assert.strictEqual(actionResult.agentVoice, "en-US-AvaMultilingualNeural", "Expected voice to be en-US-AvaMultilingualNeural");
  assert.strictEqual(/[\u0980-\u09FF]/.test(actionResult.speech), false, "Expected ZERO Bengali Unicode characters in speech");
  assert.strictEqual(jm.getPreference("no_bangla_script"), true, "Expected no_bangla_script preference to be true");
  assert.strictEqual(jm.getPreference("conversationLanguage"), "banglish", "Expected conversationLanguage to be banglish");
  assert.strictEqual(jm.currentLanguageMode, "banglish", "Expected currentLanguageMode to be banglish");
  console.log("✅ ActionRunner successfully locked preferences and generated 100% Roman Banglish/English speech:\n   \"" + actionResult.speech + "\"\n");

  // Test 3: evaluateLanguageTransition & detectPreferenceChange
  console.log("Test 3: evaluateLanguageTransition & detectPreferenceChange behavior...");
  const transition = jm.evaluateLanguageTransition("English,and Banglish. no bangla");
  assert.strictEqual(transition, "banglish", "Expected transition to be banglish");

  const pref = jm.detectPreferenceChange("English,and Banglish. no bangla");
  assert.ok(pref, "Expected preference change object");
  assert.strictEqual(pref.mode, "banglish", "Expected preference mode to be banglish");
  assert.strictEqual(/[\u0980-\u09FF]/.test(pref.value), false, "Expected ZERO Bengali characters in preference confirmation");
  console.log("✅ Language transition and preference detection locked strictly to Banglish with zero Bengali script.\n");

  // Test 4: Zero Bengali Unicode in BanglaVoiceCortex and TTS normalization
  console.log("Test 4: Acoustic processing and phonetic normalization in Banglish mode...");
  banglaVoiceCortex.setBanglishOnlyMode(true);
  
  // Mixed Bengali text that should be Romanized
  const mixedBengali = "আমি তোমার কোড বিল্ড ও টেস্ট করেছি, কোনো সমস্যা নেই!";
  const processedByCortex = banglaVoiceCortex.processUtterance(mixedBengali, "en-US-AvaNeural");
  assert.strictEqual(/[\u0980-\u09FF]/.test(processedByCortex), false, "Expected cortex output to have ZERO Bengali Unicode");
  console.log(`   Cortex Transliterated: "${mixedBengali}" -> "${processedByCortex}"`);

  // English words should NOT be converted to Bengali script
  const englishTech = "check the build and test the terminal pipeline smoothly";
  const processedEnglish = banglaVoiceCortex.processUtterance(englishTech, "en-US-AvaNeural");
  assert.strictEqual(/[\u0980-\u09FF]/.test(processedEnglish), false, "Expected English tech terms to not have Bengali script");
  assert.ok(processedEnglish.includes("build"), "Expected 'build' to remain in English");
  assert.ok(processedEnglish.includes("test"), "Expected 'test' to remain in English");
  console.log(`   English Tech Preserved: "${englishTech}" -> "${processedEnglish}"`);
  console.log("✅ Zero Bengali Unicode and pristine English/Banglish acoustic pipeline verified.\n");

  console.log("🎉 ALL 4 TESTS PASSED! English and Banglish only with zero Bangla script 100% verified.");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
