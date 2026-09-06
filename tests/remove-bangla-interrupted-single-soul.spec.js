/**
 * tests/remove-bangla-interrupted-single-soul.spec.js
 * 
 * Unit Verification Suite for:
 * Remove Bangla Interrupted Soul & One Single Real Soul Engine (Bangla & English)
 * 
 * Verifies:
 * 1. TextSanitizer STT normalization of phonetic mishearings:
 *    "remove bangla intrapted sol need one single real sol for all for bangal and english both"
 * 2. IntentParser recognition of target "remove_bangla_interrupted_single_soul"
 * 3. BanglaVoiceCortex unified single real soul mode enforcement (0 native Bengali Unicode script)
 * 4. FourAgentBilingualVoiceSmoothnessCortex Vision voice model unification (en-US-AndrewMultilingualNeural)
 * 5. ActionRunner action handling and 100% persona sovereignty across all 5 agent configurations
 */

const assert = require("assert");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const FourAgentBilingualVoiceSmoothnessCortex = require("../src/utils/four-agent-bilingual-voice-smoothness-cortex");
const ActionRunner = require("../src/utils/action-runner");

console.log("================================================================================");
console.log("🚀 RUNNING REMOVE BANGLA INTERRUPTED SOUL & SINGLE REAL SOUL VERIFICATION SUITE");
console.log("================================================================================");

let passedCount = 0;
const totalCount = 5;

async function runTests() {
  try {
    // ---------------------------------------------------------------------------
    // TEST 1: TextSanitizer Normalizes Phonetic STT Mishearings
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 1] Testing TextSanitizer STT Normalizations...");
    const rawInput = "remove bangla intrapted sol need one single real sol for all for bangal and english both";
    const sanitized = textSanitizer.sanitize(rawInput);
    console.log(`  Raw Input:      "${rawInput}"`);
    console.log(`  Sanitized Text: "${sanitized}"`);

    assert.ok(
      /Remove Bangla interrupted soul/i.test(sanitized) || /need one single real soul/i.test(sanitized),
      "TextSanitizer should normalize STT mishearings for interrupted soul and single real soul"
    );
    console.log("  ✅ [PASS 1/5] TextSanitizer normalizes phonetic STT mishearings!");
    passedCount++;

    // ---------------------------------------------------------------------------
    // TEST 2: IntentParser Classifies remove_bangla_interrupted_single_soul Target
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 2] Testing IntentParser Classification...");
    const parsed = IntentParser.parse(sanitized);
    console.log(`  Target:     "${parsed.target}"`);
    console.log(`  Confidence: ${parsed.confidence}`);

    assert.strictEqual(parsed.target, "remove_bangla_interrupted_single_soul", "Target must be remove_bangla_interrupted_single_soul");
    assert.strictEqual(parsed.confidence, 0.99, "Confidence must be 0.99");
    console.log("  ✅ [PASS 2/5] IntentParser classifies remove_bangla_interrupted_single_soul target!");
    passedCount++;

    // ---------------------------------------------------------------------------
    // TEST 3: BanglaVoiceCortex Unified Single Soul Mode & Script Removal
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing BanglaVoiceCortex Single Soul Enforcement...");
    banglaVoiceCortex.setUnifiedSingleSoulMode(true);
    const testTextWithBengaliScript = "Hritthik babe, amader Bangla interrupted soul একদম তুলে দিয়েছি! Ekhon single real soul active!";
    const cleaned = banglaVoiceCortex.enforceUnifiedSingleSoul(testTextWithBengaliScript);

    console.log(`  Input Text:   "${testTextWithBengaliScript}"`);
    console.log(`  Cleaned Text: "${cleaned}"`);

    const pureBengaliPattern = /[\u0980-\u09FF]/;
    assert.strictEqual(pureBengaliPattern.test(cleaned), false, "Cleaned output must contain 0 pure Bengali script characters");
    assert.ok(banglaVoiceCortex.isUnifiedSingleSoulMode, "BanglaVoiceCortex isUnifiedSingleSoulMode must be true");
    console.log("  ✅ [PASS 3/5] BanglaVoiceCortex enforces single real soul and 0 pure Bengali script!");
    passedCount++;

    // ---------------------------------------------------------------------------
    // TEST 4: FourAgentBilingualVoiceSmoothnessCortex Vision Voice Unification
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing Vision Multilingual Voice Unification...");
    const smoothnessCortex = new FourAgentBilingualVoiceSmoothnessCortex();
    const visionVoices = smoothnessCortex.agentVoices.vision;

    console.log(`  Vision EN Voice: "${visionVoices.en}"`);
    console.log(`  Vision BN Voice: "${visionVoices.bn}"`);

    assert.strictEqual(visionVoices.en, "en-US-AndrewMultilingualNeural", "Vision EN voice must be en-US-AndrewMultilingualNeural");
    assert.strictEqual(visionVoices.bn, "en-US-AndrewMultilingualNeural", "Vision BN voice must be en-US-AndrewMultilingualNeural for unified single soul");
    console.log("  ✅ [PASS 4/5] Vision voice model unified across English and Bangla/Banglish!");
    passedCount++;

    // ---------------------------------------------------------------------------
    // TEST 5: ActionRunner Handling & Persona Sovereignty
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing ActionRunner Persona Output Sovereignty...");

    const prompts = [
      { name: "Tuk Tuk", prompt: "Tuk Tuk remove bangla intrapted sol need one single real sol for all for bangal and english both" },
      { name: "Vision", prompt: "Vision remove bangla interrupted soul need one single real soul for all for bangla and english both" },
      { name: "Friday", prompt: "Friday remove bangla interrupted soul need one single real soul for all for bangla and english both" },
      { name: "DD", prompt: "DD remove bangla interrupted soul need one single real soul for all for bangla and english both" },
      { name: "Squad", prompt: "Squad remove bangla interrupted soul need one single real soul for all for bangla and english both" }
    ];

    for (const p of prompts) {
      const res = await ActionRunner.handleAction(p.prompt);
      console.log(`  [${p.name}]: "${res.speech.substring(0, 100)}..."`);
      assert.strictEqual(res.handled, true, `${p.name} prompt must be handled by ActionRunner`);
      assert.strictEqual(pureBengaliPattern.test(res.speech), false, `${p.name} response must contain zero pure Bengali script`);
    }

    console.log("  ✅ [PASS 5/5] ActionRunner handles single real soul action with 100% persona sovereignty!");
    passedCount++;

    console.log("\n================================================================================");
    console.log(`🌟 ALL ${passedCount}/${totalCount} SUBTESTS PASSED CLEANLY (100% VERIFIED)! 🚀`);
    console.log("================================================================================\n");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ [FAIL] Verification Test Failed:");
    console.error(err);
    process.exit(1);
  }
}

runTests();
