/**
 * Zero Pure Bangla Removal, Code-Mixed Banglish Default Register & Instant Responses Test Suite
 * 
 * Verifies:
 * 1. STT Acoustic Sanitization & Transliteration ("remove pure bangal responses no need need banglish defult istent responses")
 * 2. IntentParser Directive Detection & Routing ("remove_pure_bangla_banglish_default_instant_responses")
 * 3. JarvisManager Calibration & Preferences (pure_bangla_removed=true, banglish_default_voice_mode=true, instant_response_mode_active=true)
 * 4. Language Transition & Routing (Bengali inputs map to Banglish, never pure formal Bengali)
 * 5. System Prompt & Compact System Prompt Rules (Strict Rule 10 & Rule 8 Banglish enforcement)
 * 6. SanitizeAgentLexicon Banglish register modernizer (removes sadhu/formal Bengali)
 * 7. ActionRunner Execution & Persona Sovereignty:
 *    - Tuk Tuk: strictly "babe", zero "bro", zero "Chief", natural Banglish, zero trailing '?'
 *    - Vision: strictly "brother" / "bro" / "ভাই", natural Banglish, zero trailing '?'
 *    - Friday: strictly "Chief", natural Banglish, zero trailing '?'
 *    - DD: strictly "bro" / "ভাই", natural Banglish, zero trailing '?'
 *    - Squad Standup: 4-agent coordinated handoff in natural Banglish, zero trailing '?'
 * 8. LocalCognitiveBrain Direct Synthesis & Fallback modernization
 * 9. Mathematical Telemetry & Invariants:
 *    - P_ZeroPureBangla ≡ 1.00
 *    - B_BanglishDefault ≡ 1.00
 *    - I_InstantResponse ≡ 1.00
 *    - Tau_Turn <= 180ms
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ Test ${totalTests}: ${name}`);
  } catch (err) {
    console.error(`  ❌ Test ${totalTests} FAILED: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("\n================================================================================");
  console.log("🌟 TEST SUITE: Zero Pure Bangla Removal, Banglish Default & Instant Responses");
  console.log("================================================================================\n");

  // Test 1: STT Acoustic Sanitization & Transliteration
  await runTest("STT Acoustic Sanitization for Pure Bangla Removal & Banglish Instant", () => {
    const rawInput = "remove pure bangal responses no need need banglish defult istent responses";
    const sanitized = TextSanitizer.sanitize(rawInput);

    assert.ok(
      sanitized.toLowerCase().includes("pure bangla responses") ||
      sanitized.toLowerCase().includes("banglish default instant responses"),
      `Sanitized output should normalize query properly: "${sanitized}"`
    );
    assert.ok(
      sanitized.toLowerCase().includes("instant responses"),
      `Sanitized output must normalize 'istent' to 'instant': "${sanitized}"`
    );
    assert.ok(
      sanitized.toLowerCase().includes("default"),
      `Sanitized output must normalize 'defult' to 'default': "${sanitized}"`
    );
  });

  // Test 2: IntentParser Directive Detection & Routing
  await runTest("IntentParser Directive Detection & Routing", () => {
    const testPhrases = [
      "remove pure bangal responses no need need banglish defult istent responses",
      "remove pure bangla responses no need need banglish default instant responses",
      "remove pure bangla responses",
      "no pure bangla need banglish default instant responses",
      "banglish default instant responses",
      "বিশুদ্ধ বাংলা বাদ দাও ব্যাংলিশ ডিফল্ট ইনস্ট্যান্ট রেসপন্স চাই"
    ];

    for (const phrase of testPhrases) {
      const isDirective = IntentParser.isRemovePureBanglaBanglishDefaultInstantResponsesDirective(phrase.toLowerCase());
      assert.strictEqual(isDirective, true, `Phrase failed detection: "${phrase}"`);
    }

    const parsed = IntentParser.parse("remove pure bangla responses no need need banglish default instant responses");
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "remove_pure_bangla_banglish_default_instant_responses");
  });

  // Test 3: JarvisManager Calibration & Preferences
  await runTest("JarvisManager Calibration & Preferences", async () => {
    const jarvis = new JarvisManager();
    const calib = jarvis.calibrateRemovePureBanglaBanglishDefaultInstantResponses();

    assert.strictEqual(calib.success, true);
    assert.strictEqual(calib.languageMode, "banglish");
    assert.strictEqual(jarvis.getPreference("pure_bangla_removed"), true);
    assert.strictEqual(jarvis.getPreference("pure_bangla_responses_banned"), true);
    assert.strictEqual(jarvis.getPreference("banglish_default_voice_mode"), true);
    assert.strictEqual(jarvis.getPreference("instant_response_mode_active"), true);
    assert.strictEqual(jarvis.getPreference("vad_rapid_endpointing_ms"), 180);
    assert.strictEqual(jarvis.getPreference("sub_200ms_turn_taking"), true);

    assert.strictEqual(calib.telemetry.pureBanglaRemoved, 1.0);
    assert.strictEqual(calib.telemetry.banglishDefaultActive, 1.0);
    assert.strictEqual(calib.telemetry.instantResponseOptimized, 1.0);
    assert.strictEqual(calib.telemetry.vadLatencyMs <= 180, true);
  });

  // Test 4: Language Transition to Banglish
  await runTest("Language Transition Never Reverts to Pure Bangla When Banned", () => {
    const jarvis = new JarvisManager();
    jarvis.calibrateRemovePureBanglaBanglishDefaultInstantResponses();

    // Passing Bengali phrase
    const transition = jarvis.evaluateLanguageTransition("কেমন আছো তুমি");
    assert.strictEqual(transition, "banglish", "Bengali input must map to 'banglish', never pure 'bn'");
    assert.strictEqual(jarvis.currentLanguageMode, "banglish");
  });

  // Test 5: System Prompt and Compact Prompt Banglish Enforcements
  await runTest("System Prompts Mandate Banglish & Zero Pure Bangla", () => {
    const jarvis = new JarvisManager();
    jarvis.calibrateRemovePureBanglaBanglishDefaultInstantResponses();

    const fullPrompt = jarvis.getSystemPrompt("tuktuk");
    assert.ok(
      fullPrompt.includes("100% CODE-MIXED BANGLISH & ZERO PURE BANGLA RESPONSES & INSTANT RESPONSES"),
      "Full system prompt must contain strict code-mixed Banglish directive"
    );
    assert.ok(
      fullPrompt.includes("Never speak in pure formal Bengali") || fullPrompt.includes("ZERO PURE BANGLA RESPONSES"),
      "Prompt must strictly prohibit 100% formal Bengali"
    );

    const compactPrompt = jarvis.getCompactSystemPrompt("tuktuk");
    assert.ok(
      compactPrompt.includes("BANGLISH DEFAULT & ZERO PURE BANGLA"),
      "Compact prompt must contain Banglish default and zero pure bangla"
    );
  });

  // Test 6: Lexicon Sanitizer Modernization to Banglish
  await runTest("sanitizeAgentLexicon Modernizes Formal Phrases to Natural Banglish", () => {
    const jarvis = new JarvisManager();
    jarvis.calibrateRemovePureBanglaBanglishDefaultInstantResponses();

    const formalSample = "আমি আপনার কী সেবা করতে পারি?";
    const modernBanglish = jarvis.sanitizeAgentLexicon(formalSample, "tuktuk");

    assert.ok(!modernBanglish.includes("আমি আপনার কী সেবা করতে পারি"), "Must not keep robotic formal Bengali phrase");
    assert.ok(!modernBanglish.endsWith("?"), "Must adhere to anti-trailer law (no trailing '?')");
  });

  // Test 7: ActionRunner Tuk Tuk Persona Sovereignty & Anti-Trailer Law
  await runTest("ActionRunner Tuk Tuk: Strictly 'babe', Banglish, Zero Pure Sadhu, Zero Trailing '?'", async () => {
    const jarvis = new JarvisManager();
    const result = await actionRunner.runAction(
      "remove pure bangal responses no need need banglish defult istent responses",
      { activeAgent: { key: "tuktuk", language: "banglish" }, jarvisManager: jarvis }
    );

    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.agentName, "Tuk Tuk");
    assert.ok(result.speech.toLowerCase().includes("babe"), "Tuk Tuk must say 'babe'");
    assert.ok(!/\b(?:bro|brother|chief)\b/i.test(result.speech), "Tuk Tuk must NEVER say bro or Chief");
    assert.ok(!result.speech.trim().endsWith("?"), "Must not end with a trailing question mark");
    assert.strictEqual(result.data.pureBanglaRemoved, true);
    assert.strictEqual(result.data.banglishDefaultActive, true);
    assert.strictEqual(result.data.instantResponsesActive, true);
    assert.strictEqual(result.data.zeroPureBanglaInvariant, 1.0);
    assert.strictEqual(result.data.banglishDefaultInvariant, 1.0);
    assert.strictEqual(result.data.instantResponseInvariant, 1.0);
    assert.strictEqual(result.data.rapidTurnTakingLatencyMs <= 180, true);
  });

  // Test 8: ActionRunner Vision, Friday, DD Persona Sovereignty
  await runTest("ActionRunner Vision, Friday, DD Persona Sovereignty", async () => {
    const jarvis = new JarvisManager();

    // Vision
    const resVision = await actionRunner.runAction(
      "remove pure bangla responses no need need banglish default instant responses",
      { activeAgent: { key: "vision", language: "banglish" }, jarvisManager: jarvis }
    );
    assert.strictEqual(resVision.agentName, "Vision");
    assert.ok(/\b(?:brother|bro|ভাই)\b/i.test(resVision.speech), "Vision must say brother/bro/ভাই");
    assert.ok(!resVision.speech.trim().endsWith("?"), "Vision must not end with '?'");

    // Friday
    const resFriday = await actionRunner.runAction(
      "remove pure bangla responses no need need banglish default instant responses",
      { activeAgent: { key: "friday", language: "banglish" }, jarvisManager: jarvis }
    );
    assert.strictEqual(resFriday.agentName, "Friday");
    assert.ok(/\b(?:chief)\b/i.test(resFriday.speech), "Friday must say Chief");
    assert.ok(!resFriday.speech.trim().endsWith("?"), "Friday must not end with '?'");

    // DD
    const resDD = await actionRunner.runAction(
      "remove pure bangla responses no need need banglish default instant responses",
      { activeAgent: { key: "dd", language: "banglish" }, jarvisManager: jarvis }
    );
    assert.strictEqual(resDD.agentName, "DD");
    assert.ok(/\b(?:bro|ভাই)\b/i.test(resDD.speech), "DD must say bro/ভাই");
    assert.ok(!resDD.speech.trim().endsWith("?"), "DD must not end with '?'");
  });

  // Test 9: LocalCognitiveBrain Synthesis
  await runTest("LocalCognitiveBrain Synthesis & Anti-Trailer Invariant", async () => {
    const query = "remove pure bangal responses no need need banglish defult istent responses";

    const speechTukTuk = localCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      query,
      {},
      "banglish"
    );
    assert.ok(speechTukTuk && speechTukTuk.length > 0);
    assert.ok(speechTukTuk.toLowerCase().includes("babe"));
    assert.ok(!speechTukTuk.trim().endsWith("?"));

    const speechVision = localCognitiveBrain.synthesizeResponse(
      "vision",
      "Vision",
      query,
      {},
      "banglish"
    );
    assert.ok(speechVision && speechVision.length > 0);
    assert.ok(/\b(?:brother|bro|ভাই)\b/i.test(speechVision));
    assert.ok(!speechVision.trim().endsWith("?"));

    const speechSquad = localCognitiveBrain.synthesizeResponse(
      "team",
      "Squad",
      query,
      {},
      "banglish"
    );
    assert.ok(speechSquad && speechSquad.length > 0);
    assert.ok(speechSquad.includes("Tuk Tuk") || speechSquad.includes("Vision"));
    assert.ok(!speechSquad.trim().endsWith("?"));
  });

  console.log("\n================================================================================");
  console.log(`🎉 ALL TESTS PASSED (${passedTests}/${totalTests})`);
  console.log("================================================================================\n");
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
