/**
 * tests/banglish-modern-vibe-same-soul.spec.js
 * 
 * Verification Test Suite for Banglish & Modern English Same-Soul Vibe Architecture:
 * 1. TextSanitizer cleans speech mishearings.
 * 2. IntentParser detects banglish_modern_vibe_same_soul intent.
 * 3. BanglaVoiceCortex enforces 100% zero pure Bengali Unicode script.
 * 4. ActionRunner handles prompt with 0 pure Bengali script.
 * 5. LocalCognitiveBrain synthesizes responses for all 4 agents with zero pure Bengali script and strict persona sovereignty.
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const ActionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("================================================================================");
console.log("🚀 RUNNING BANGLISH & MODERN ENGLISH SAME-SOUL VIBE VERIFICATION SUITE");
console.log("================================================================================");

let passedTests = 0;
const totalTests = 5;

async function runTest(description, fn) {
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS ${passedTests}/${totalTests}] ${description}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAll() {
  const userPrompt = "need bangla english same sol dont use pure bangla remove pure bangal conversation use banglish mordern vibe all the time";

  // 1. TextSanitizer normalizes STT mishearings
  await runTest("TextSanitizer normalizes phonetic STT mishearings", () => {
    const sanitized = TextSanitizer.sanitize(userPrompt);
    assert.ok(/Bangla and English same soul/i.test(sanitized), `Got: ${sanitized}`);
    assert.ok(/don't use pure Bangla/i.test(sanitized), `Got: ${sanitized}`);
    assert.ok(/remove pure Bangla conversation/i.test(sanitized), `Got: ${sanitized}`);
    assert.ok(/use Banglish modern vibe all the time/i.test(sanitized), `Got: ${sanitized}`);
  });

  // 2. IntentParser classifies banglish_modern_vibe_same_soul intent
  await runTest("IntentParser classifies banglish_modern_vibe_same_soul intent", () => {
    const sanitized = TextSanitizer.sanitize(userPrompt);
    const parsed = IntentParser.parse(sanitized);
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "banglish_modern_vibe_same_soul");
    assert.ok(parsed.confidence >= 0.95);
  });

  // 3. BanglaVoiceCortex.enforceBanglishModernVibe strips 100% of pure Bengali Unicode script
  await runTest("BanglaVoiceCortex.enforceBanglishModernVibe strips 100% of pure Bengali Unicode script", () => {
    banglaVoiceCortex.setBanglishOnlyMode(true);
    const samplePureBengali = "তুমি কেমন আছো babe? আমাদের সিস্টেম এখন একদম রেডি!";
    const converted = banglaVoiceCortex.enforceBanglishModernVibe(samplePureBengali);
    assert.ok(!/[\u0980-\u09FF]/.test(converted), `Contains Bengali Unicode: ${converted}`);
    assert.ok(/tumi|achho|babe|amader|system|ekdom|ready/i.test(converted), `Got: ${converted}`);
  });

  // 4. ActionRunner handles Banglish modern vibe prompt with 0 pure Bengali script
  await runTest("ActionRunner handles Banglish modern vibe prompt with 0 pure Bengali script", async () => {
    const ActionRunner = require("../src/utils/action-runner");
    const result = await ActionRunner.handleAction(userPrompt);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.data.sameSoulActive, true);
    assert.strictEqual(result.data.pureBanglaRemoved, true);
    assert.strictEqual(result.data.zeroPureBanglaScript, true);
    assert.ok(!/[\u0980-\u09FF]/.test(result.speech), `Speech contains Bengali script: ${result.speech}`);
  });

  // 5. LocalCognitiveBrain synthesizes responses for all 4 agents with zero pure Bengali script and strict persona sovereignty
  await runTest("LocalCognitiveBrain synthesizes responses for all 4 agents with zero pure Bengali script and strict persona sovereignty", () => {
    banglaVoiceCortex.setBanglishOnlyMode(true);

    const agents = [
      { key: "tuktuk", name: "Tuk Tuk", personaTerm: "babe" },
      { key: "vision", name: "Vision", personaTerm: "brother" },
      { key: "friday", name: "Friday", personaTerm: "Chief" },
      { key: "dd", name: "DD", personaTerm: "bro" },
      { key: "team", name: "Squad", personaTerm: "Tuk Tuk" }
    ];

    for (const agent of agents) {
      const response = LocalCognitiveBrain.synthesizeResponse(
        agent.key,
        agent.name,
        userPrompt,
        { banglishModernVibe: true }
      );

      // Assert 0 pure Bengali script in output
      assert.ok(!/[\u0980-\u09FF]/.test(response), `Agent ${agent.name} response contains Bengali Unicode: ${response}`);

      // Assert persona lexical sovereignty
      if (agent.key === "tuktuk") {
        assert.ok(response.toLowerCase().includes("babe"), `Tuk Tuk missing babe: ${response}`);
      } else if (agent.key === "vision") {
        assert.ok(response.toLowerCase().includes("brother"), `Vision missing brother: ${response}`);
      } else if (agent.key === "friday") {
        assert.ok(response.includes("Chief"), `Friday missing Chief: ${response}`);
      } else if (agent.key === "dd") {
        assert.ok(response.toLowerCase().includes("bro"), `DD missing bro: ${response}`);
      }
    }
  });

  console.log("================================================================================");
  console.log(`🌟 ALL ${totalTests} SUBTESTS PASSED CLEANLY (100% VERIFIED)! 🚀`);
  console.log("================================================================================");
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
