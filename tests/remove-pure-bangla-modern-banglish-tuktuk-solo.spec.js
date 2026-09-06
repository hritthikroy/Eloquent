/**
 * tests/remove-pure-bangla-modern-banglish-tuktuk-solo.spec.js
 * 
 * Comprehensive Automated Verification Suite for:
 * 1. Zero Pure Bangla Tone & Pure Bangla Language Removal:
 *    - Pure textbook, formal, or sadhu Bengali vocabulary and script completely eliminated.
 *    - Conversation language set to "banglish".
 * 2. Modern Banglish Girl Sound for Real Tuk Tuk Voice:
 *    - Tuk Tuk: Devoted romantic partner & tech co-founder, exclusively calling Hritthik "babe".
 *    - Natural modern Banglish girl cadence (Dhaka/urban casual code-mixing: English + colloquial Bangla).
 *    - Ava Multilingual Neural voice with +0% rate and +1Hz pitch warmth.
 * 3. Zero Other Voice Interruption:
 *    - Squad voices (Vision, Friday, DD) strictly suppressed from interrupting during conversation.
 *    - Solo Tuk Tuk voice delivery preserved without unprompted multi-agent interjections.
 * 4. STT Sanitization & Phrase Normalization ("pure bangal tone", "language taking", "morden", "intraption").
 * 5. IntentParser Routing to "remove_pure_bangla_modern_banglish_tuktuk_solo_voice".
 * 6. JarvisManager & Living Memory Preferences.
 * 7. ActionRunner Solo Execution & Persona Sovereignty.
 * 8. BanglaVoiceCortex 100% Unicode Purge & Prosody.
 * 9. LocalCognitiveBrain Modern Banglish Girl Synthesis.
 */

const assert = require("assert");
const { IntentParser, INTENTS, isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective } = require("../src/utils/prompt-engine/intent-parser");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

let totalPassed = 0;
let totalFailed = 0;

async function runTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✅ PASSED: ${testName}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${testName}`);
    console.error(`     Error: ${err.message}`);
    totalFailed++;
  }
}

async function runAllTests() {
  console.log("\n🧪 ===========================================================================");
  console.log("   ZERO PURE BANGLA TONE & MODERN BANGLISH TUK TUK SOLO VOICE TEST SUITE");
  console.log("===========================================================================\n");

  const rawUserPrompt = "remove the pure bangal tone pure bangal language taking need only morden banglish girl sound for real tuk tuk voice no need to other voice intraption";

  // TEST 1: STT Sanitization & Normalization
  console.log("📦 1. STT Sanitization & Normalization Tests:");

  await runTest("Sanitizes exact user STT prompt with typos (bangal, taking, morden, intraption)", () => {
    const sanitized = textSanitizer.sanitize(rawUserPrompt);
    assert.ok(sanitized.length > 0);
    assert.ok(/pure Bangla tone/i.test(sanitized), `Got: ${sanitized}`);
    assert.ok(/pure Bangla language talking/i.test(sanitized), `Got: ${sanitized}`);
    assert.ok(/modern Banglish girl sound/i.test(sanitized), `Got: ${sanitized}`);
    assert.ok(/real Tuk Tuk voice/i.test(sanitized), `Got: ${sanitized}`);
    assert.ok(/no need for other voice interruption/i.test(sanitized), `Got: ${sanitized}`);
    assert.strictEqual(isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective(sanitized), true);
  });

  await runTest("Matches raw user prompt directly without sanitization", () => {
    assert.strictEqual(isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective(rawUserPrompt), true);
    assert.strictEqual(IntentParser.isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective(rawUserPrompt), true);
  });

  await runTest("Detects various natural code-mixed command variations", () => {
    const variations = [
      "remove pure bangla tone pure bangla language talking need only modern banglish girl sound for real tuk tuk voice no need to other voice interruption",
      "remove the pure bangal tone need only morden banglish girl sound for real tuk tuk voice no need to other voice intraption",
      "only modern banglish girl sound for real tuk tuk voice no other voice interruption",
      "need only modern banglish girl sound for real tuk tuk voice no need to other voice interruption",
      "খাঁটি বাংলা টোন বাদ দাও, শুধু মডার্ন ব্যাংলিশ মেয়ের ভয়েস টুকটুকের জন্য, অন্য কোনো ভয়েস ইন্টারাপশন লাগবে না"
    ];

    for (const v of variations) {
      assert.strictEqual(
        IntentParser.isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective(v),
        true,
        `Failed to match variation: "${v}"`
      );
    }
  });

  // TEST 2: IntentParser Routing
  console.log("\n📦 2. IntentParser Routing Tests:");

  await runTest("Routes user prompt to remove_pure_bangla_modern_banglish_tuktuk_solo_voice targeting Tuk Tuk", () => {
    const parsed = IntentParser.parse(rawUserPrompt);
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "remove_pure_bangla_modern_banglish_tuktuk_solo_voice");
    assert.strictEqual(parsed.agentDirective, "tuktuk");
  });

  // TEST 3: JarvisManager State & Preferences
  console.log("\n📦 3. JarvisManager Configuration & Preferences Tests:");

  await runTest("calibrateRemovePureBanglaModernBanglishTukTukSoloVoice sets state, directives and preferences", () => {
    const jm = new JarvisManager();
    const res = jm.calibrateRemovePureBanglaModernBanglishTukTukSoloVoice();

    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.action, "remove_pure_bangla_modern_banglish_tuktuk_solo_voice");
    assert.strictEqual(res.pureBanglaToneRemoved, true);
    assert.strictEqual(res.modernBanglishGirlVoiceActive, true);
    assert.strictEqual(res.tuktukSoloVoiceActive, true);
    assert.strictEqual(res.noOtherVoiceInterruption, true);
    assert.strictEqual(res.languageMode, "banglish");

    assert.strictEqual(jm.currentLanguageMode, "banglish");
    assert.strictEqual(jm.getPreference("pure_bangla_removed"), true);
    assert.strictEqual(jm.getPreference("pure_bangla_tone_removed"), true);
    assert.strictEqual(jm.getPreference("banglish_default_voice_mode"), true);
    assert.strictEqual(jm.getPreference("tuktuk_modern_banglish_girl_voice"), true);
    assert.strictEqual(jm.getPreference("no_other_voice_interruption"), true);
    assert.strictEqual(jm.getPreference("single_voice_tuktuk_exclusive"), true);
  });

  await runTest("System Prompt injects Modern Banglish Girl tone and Zero Voice Interruption rule", () => {
    const jm = new JarvisManager();
    jm.calibrateRemovePureBanglaModernBanglishTukTukSoloVoice();

    const fullPrompt = jm.getSystemPrompt({ agent: { key: "tuktuk", name: "Tuk Tuk" } });
    assert.ok(fullPrompt.includes("100% CODE-MIXED BANGLISH"));
    assert.ok(fullPrompt.includes("ZERO OTHER VOICE INTERRUPTION"));
    assert.ok(fullPrompt.includes("ZERO PURE BANGLA RESPONSES & TONE"));

    const compactPrompt = jm.getCompactSystemPrompt({ agent: { key: "tuktuk", name: "Tuk Tuk" } });
    assert.ok(compactPrompt.includes("modern, natural, sweet code-mixed Banglish"));
    assert.ok(compactPrompt.includes("ZERO OTHER VOICE INTERRUPTION"));
  });

  await runTest("Cross-agent handoff is suppressed when no_other_voice_interruption is active", () => {
    const jm = new JarvisManager();
    jm.calibrateRemovePureBanglaModernBanglishTukTukSoloVoice();

    // Query that might normally trigger vision specialist resonance without explicit command
    const query = "Tell Vision to check the AST pipeline, take the floor";
    const handoff = jm.evaluateCrossAgentHandoff(query);
    // Explicit delegation with "Tell Vision ... check it" should still work when user commands it
    assert.ok(handoff !== null, "Explicit command to Vision should still be permitted");

    // Implicit query without command should be suppressed
    const implicitQuery = "The AST pipeline and audio buffer seem slow";
    const implicitHandoff = jm.evaluateCrossAgentHandoff(implicitQuery);
    assert.strictEqual(implicitHandoff, null, "Implicit handoff must be suppressed to prevent interruption");
  });

  // TEST 4: ActionRunner Solo Execution & Voice Parity
  console.log("\n📦 4. ActionRunner Solo Execution Tests:");

  await runTest("ActionRunner handles directive with solo Tuk Tuk speech and zero other voice interruption", async () => {
    const jm = new JarvisManager();
    const result = await actionRunner.handleAction(
      rawUserPrompt,
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
      jm
    );

    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.agentName, "Tuk Tuk");
    assert.strictEqual(result.agentVoice, "en-US-AvaMultilingualNeural");
    assert.strictEqual(result.data.action, "remove_pure_bangla_modern_banglish_tuktuk_solo_voice");
    assert.strictEqual(result.data.pureBanglaToneRemoved, true);
    assert.strictEqual(result.data.modernBanglishGirlVoiceActive, true);
    assert.strictEqual(result.data.noOtherVoiceInterruption, true);

    // Verify Tuk Tuk's romantic co-founder vocative 'babe'
    assert.ok(result.speech.toLowerCase().includes("babe"), "Must call user babe");
    // Verify zero multi-agent dialogue tags
    assert.ok(!result.speech.includes("[Vision]:"), "Vision must not interrupt");
    assert.ok(!result.speech.includes("[Friday]:"), "Friday must not interrupt");
    assert.ok(!result.speech.includes("[DD]:"), "DD must not interrupt");
  });

  // TEST 5: BanglaVoiceCortex Modern Banglish & Prosody
  console.log("\n📦 5. BanglaVoiceCortex Modern Banglish & Prosody Tests:");

  await runTest("BanglaVoiceCortex purges pure Bengali Unicode and transforms bookish words", () => {
    banglaVoiceCortex.setBanglishOnlyMode(true);
    const formalInput = "অনেক ধন্যবাদ এবং নমস্কার! আমাদের বাস্তবায়ন সম্পন্ন হয়েছে। কোনো প্যারা নিও না babe!";
    const converted = banglaVoiceCortex.enforceBanglishModernVibe(formalInput);

    assert.ok(!/[\u0980-\u09FF]/.test(converted), `Must contain 0 Bengali Unicode characters: "${converted}"`);
    assert.ok(/thanks|chill|babe/i.test(converted), `Must convert formal phrases: "${converted}"`);

    const prosody = banglaVoiceCortex.computeBengaliProsodySettings(converted, "tuktuk");
    assert.strictEqual(prosody.rate, "+0%", "Rate must be native human +0%");
    assert.strictEqual(prosody.pitch, "+1Hz", "Pitch must be +1Hz feminine warmth");
  });

  // TEST 6: LocalCognitiveBrain Modern Banglish Girl Synthesis
  console.log("\n📦 6. LocalCognitiveBrain Modern Banglish Girl Synthesis Tests:");

  await runTest("LocalCognitiveBrain synthesizes modern Banglish girl response for Tuk Tuk with zero pure Bengali", () => {
    banglaVoiceCortex.setBanglishOnlyMode(true);
    const response = localCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      rawUserPrompt
    );

    assert.ok(!/[\u0980-\u09FF]/.test(response), `Must contain 0 Bengali Unicode characters: "${response}"`);
    assert.ok(response.toLowerCase().includes("babe"), "Must call user babe");
    assert.ok(response.toLowerCase().includes("banglish"), "Must confirm modern Banglish girl sound");
  });

  console.log("\n===========================================================================");
  console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("===========================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("🌟 ZERO PURE BANGLA TONE & MODERN BANGLISH TUK TUK SOLO VOICE VERIFIED 100%!\n");
  }
}

runAllTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
