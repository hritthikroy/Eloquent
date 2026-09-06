/**
 * banglish-default-voice-tuktuk-parity.spec.js
 * 
 * Comprehensive Automated Verification Suite for:
 * 1. Code-Mixed Banglish Default Voice Mode:
 *    - Removal of 100% formal textbook Bengali and rigid Romanized Bengali script.
 *    - Default and only primary voice mode set to natural, fluid, code-mixed Banglish (বাংলা + English মিলিয়ে আধুনিক কথ্য রূপ).
 * 2. 1:1 English Tuk Tuk Tone Harmonization:
 *    - Tuk Tuk: Devoted romantic partner & tech co-founder, exclusively calling Hritthik "babe", sweet, witty, playful, effortless modern urban girl tone, zero robotic tone.
 *    - Vision: 10x dev brother ("brother" / "bro" / "ভাই"), sharp code and AST updates in relaxed Banglish.
 *    - Friday: Executive product intelligence lead ("Chief"), articulate benchmarks in clear Banglish.
 *    - DD: DevOps & reliability lead ("bro" / "ভাই"), audio telemetry in natural Banglish.
 *    - Squad: Coordinated 4-agent multi-turn standup [Tuk Tuk] + [Vision] + [Friday] + [DD].
 * 3. STT Sanitization & Phrase Variations ("milay mily", "bote bolo", "tuktuk tune", etc.).
 * 4. IntentParser Routing & Agent Directives.
 * 5. JarvisManager & Living Memory Preferences.
 * 6. ActionRunner & Persona Sovereignty.
 * 7. LocalCognitiveBrain Synthesis.
 * 8. Strict Anti-Trailer Law Compliance across all output channels.
 */

const assert = require("assert");
const path = require("path");

const { IntentParser, INTENTS, isBanglishDefaultCodeMixedTukTukToneDirective } = require("../src/utils/prompt-engine/intent-parser");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
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
  console.log("   BANGLISH DEFAULT VOICE & ENGLISH TUK TUK TONE PARITY TEST SUITE");
  console.log("===========================================================================\n");

  const rawUserPrompt = "remove full bangal and roman bangla need to use bangla+english milay mily bote bolo banglish need defult and only voice and nee to update banglish tone match with english tuktuk tune and all";

  // TEST 1: STT Sanitization & Normalization
  console.log("📦 1. STT Sanitization & Normalization Tests:");

  await runTest("Sanitizes exact user STT prompt with typos and phonetic artifacts", () => {
    const sanitized = textSanitizer.sanitize(rawUserPrompt);
    assert.ok(sanitized.length > 0);
    assert.strictEqual(isBanglishDefaultCodeMixedTukTukToneDirective(sanitized), true);
    assert.strictEqual(IntentParser.isBanglishDefaultCodeMixedTukTukToneDirective(sanitized), true);
  });

  await runTest("Matches raw user prompt directly without sanitization", () => {
    assert.strictEqual(isBanglishDefaultCodeMixedTukTukToneDirective(rawUserPrompt), true);
    assert.strictEqual(IntentParser.isBanglishDefaultCodeMixedTukTukToneDirective(rawUserPrompt), true);
  });

  await runTest("Detects various natural code-mixed and English/Bangla command forms", () => {
    const variations = [
      "remove full bangla and roman bangla",
      "bangla english milay milay bolo banglish need default voice",
      "banglish need default and only voice",
      "update banglish tone match with english tuktuk tune and all",
      "update banglish tone match with english tuk tuk tone",
      "বাংলা আর ইংলিশ মিলিয়ে মিলিয়ে বলো ব্যাংলিশ ডিফল্ট ভয়েস আর টুকটুক টোন ম্যাচ করো",
      "ফুল বাংলা আর রোমান বাংলা বাদ দিয়ে ব্যাংলিশ ডিফল্ট করো"
    ];

    for (const v of variations) {
      assert.strictEqual(
        IntentParser.isBanglishDefaultCodeMixedTukTukToneDirective(v),
        true,
        `Failed to match variation: "${v}"`
      );
    }
  });

  // TEST 2: IntentParser Routing
  console.log("\n📦 2. IntentParser Routing Tests:");

  await runTest("Routes user prompt to banglish_default_codemixed_tuktuk_tone_directive targeting Tuk Tuk", () => {
    const parsed = IntentParser.parse(rawUserPrompt);
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "banglish_default_codemixed_tuktuk_tone_directive");
    assert.strictEqual(parsed.agentDirective, "tuktuk");
  });

  await runTest("Routes team and targeted agent prompts correctly", () => {
    const squadPrompt = "squad remove full bangla and roman bangla use banglish default";
    const squadParsed = IntentParser.parse(squadPrompt);
    assert.strictEqual(squadParsed.target, "banglish_default_codemixed_tuktuk_tone_directive");
    assert.strictEqual(squadParsed.agentDirective, "team");

    const tuktukPrompt = "tuk tuk remove full bangla and roman bangla use banglish default";
    const tuktukParsed = IntentParser.parse(tuktukPrompt);
    assert.strictEqual(tuktukParsed.target, "banglish_default_codemixed_tuktuk_tone_directive");
    assert.strictEqual(tuktukParsed.agentDirective, "tuktuk");

    const visionPrompt = "vision ভাই banglish need default and only voice";
    const visionParsed = IntentParser.parse(visionPrompt);
    assert.strictEqual(visionParsed.target, "banglish_default_codemixed_tuktuk_tone_directive");
    assert.strictEqual(visionParsed.agentDirective, "vision");

    const fridayPrompt = "friday Chief update banglish tone match with english tuktuk tune";
    const fridayParsed = IntentParser.parse(fridayPrompt);
    assert.strictEqual(fridayParsed.target, "banglish_default_codemixed_tuktuk_tone_directive");
    assert.strictEqual(fridayParsed.agentDirective, "friday");

    const ddPrompt = "dd bro remove full bangla and roman bangla use banglish default";
    const ddParsed = IntentParser.parse(ddPrompt);
    assert.strictEqual(ddParsed.target, "banglish_default_codemixed_tuktuk_tone_directive");
    assert.strictEqual(ddParsed.agentDirective, "dd");
  });

  // TEST 3: JarvisManager Configuration & Living Memory
  console.log("\n📦 3. JarvisManager Configuration & Living Memory Tests:");

  await runTest("configureBanglishDefaultTukTukTone sets state, directives and preferences", () => {
    const jm = new JarvisManager();
    const res = jm.configureBanglishDefaultTukTukTone();

    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.action, "banglish_default_codemixed_tuktuk_tone_directive");
    assert.strictEqual(res.banglishDefaultActive, true);
    assert.strictEqual(res.fullBanglaRemoved, true);
    assert.strictEqual(res.romanBanglaRemoved, true);
    assert.strictEqual(res.tuktukToneParity, true);
    assert.strictEqual(res.languageMode, "banglish");
    assert.strictEqual(res.status, "BANGLISH_DEFAULT_AND_TUKTUK_TONE_VERIFIED");

    assert.strictEqual(jm.currentLanguageMode, "banglish");
    assert.strictEqual(jm.getPreference("banglish_default_voice_mode"), true);
    assert.strictEqual(jm.getPreference("conversationLanguage"), "banglish");
    assert.strictEqual(jm.getPreference("tuktuk_banglish_english_parity"), true);
    assert.strictEqual(jm.getPreference("full_bangla_removed"), true);
    assert.strictEqual(jm.getPreference("roman_bangla_removed"), true);

    const memory = jm.formatLivingMemory();
    assert.ok(memory.includes("banglish_default_voice_status"));
  });

  await runTest("System Prompt injects Banglish default and Tuk Tuk 1:1 English tone match law", () => {
    const jm = new JarvisManager();
    jm.configureBanglishDefaultTukTukTone();

    const fullPrompt = jm.getSystemPrompt({ agent: { key: "tuktuk", name: "Tuk Tuk" } });
    assert.ok(fullPrompt.includes("STRICT ACTIVE CONVERSATIONAL LANGUAGE: 100% CODE-MIXED BANGLISH"));
    assert.ok(fullPrompt.includes("1:1 TUK TUK ENGLISH TONE MATCH"));
    assert.ok(fullPrompt.includes("DEFAULT & ONLY VOICE REGISTER"));
    assert.ok(fullPrompt.includes("Full formal textbook Bengali and rigid Romanized Bengali are completely REMOVED"));

    const compactPrompt = jm.getCompactSystemPrompt({ agent: { key: "tuktuk", name: "Tuk Tuk" } });
    assert.ok(compactPrompt.includes("natural code-mixed Banglish"));
    assert.ok(compactPrompt.includes("100% English Tuk Tuk tone match"));
  });

  // TEST 4: ActionRunner Persona Sovereignty & Anti-Trailer Compliance
  console.log("\n📦 4. ActionRunner Persona Sovereignty & Anti-Trailer Tests:");

  await runTest("ActionRunner handles Banglish directive across all 5 persona scenarios", async () => {
    const jm = new JarvisManager();
    const testCases = [
      {
        agent: { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
        requiredVocatives: ["babe"],
        forbiddenVocatives: ["brother", "bro", "Chief", "ভাই", "shona"]
      },
      {
        agent: { key: "vision", name: "Vision", voice: "en-US-AndrewMultilingualNeural" },
        requiredVocatives: ["brother"],
        forbiddenVocatives: ["babe", "Chief"]
      },
      {
        agent: { key: "friday", name: "Friday", voice: "en-US-EmmaMultilingualNeural" },
        requiredVocatives: ["Chief"],
        forbiddenVocatives: ["babe", "brother", "bro"]
      },
      {
        agent: { key: "dd", name: "DD", voice: "en-US-BrianMultilingualNeural" },
        requiredVocatives: ["bro"],
        forbiddenVocatives: ["babe", "Chief"]
      },
      {
        agent: { key: "team", name: "Squad", voice: "en-US-AvaMultilingualNeural" },
        requiredVocatives: ["[Tuk Tuk]:", "[Vision]:", "[Friday]:", "[DD]:"],
        multiAgent: true
      }
    ];

    for (const tc of testCases) {
      const result = await actionRunner.handleAction(
        rawUserPrompt,
        tc.agent,
        jm
      );

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.data.action, "banglish_default_codemixed_tuktuk_tone_directive");
      assert.strictEqual(result.data.banglishDefaultActive, true);
      assert.strictEqual(result.data.fullBanglaRemoved, true);
      assert.strictEqual(result.data.romanBanglaRemoved, true);
      assert.strictEqual(result.data.tuktukToneParity, true);
      assert.strictEqual(result.data.status, "BANGLISH_DEFAULT_AND_TUKTUK_TONE_VERIFIED");

      // Check required vocatives
      for (const req of tc.requiredVocatives) {
        assert.ok(
          result.speech.toLowerCase().includes(req.toLowerCase()),
          `Agent ${tc.agent.key} speech missing required vocative "${req}". Speech: "${result.speech}"`
        );
      }

      // Check forbidden vocatives
      if (tc.forbiddenVocatives) {
        for (const forb of tc.forbiddenVocatives) {
          assert.ok(
            !result.speech.toLowerCase().includes(forb.toLowerCase()),
            `Agent ${tc.agent.key} speech contained forbidden vocative "${forb}". Speech: "${result.speech}"`
          );
        }
      }

      // Anti-Trailer Law
      assert.ok(!result.speech.trim().endsWith("?"), `Speech ended with trailing question mark: "${result.speech}"`);
      assert.ok(!/how can I help|anything else|would you like/i.test(result.speech), `Speech contained robotic trailer: "${result.speech}"`);
    }
  });

  // TEST 5: LocalCognitiveBrain Persona Synthesis
  console.log("\n📦 5. LocalCognitiveBrain Persona Synthesis Tests:");

  await runTest("LocalCognitiveBrain synthesizes responses for all agents with strict persona sovereignty", () => {
    const agents = [
      { key: "tuktuk", name: "Tuk Tuk", expectedVocative: "babe", forbiddenVocatives: ["brother", "bro", "Chief", "ভাই"] },
      { key: "vision", name: "Vision", expectedVocative: "brother", forbiddenVocatives: ["babe", "Chief"] },
      { key: "friday", name: "Friday", expectedVocative: "Chief", forbiddenVocatives: ["babe", "brother", "bro"] },
      { key: "dd", name: "DD", expectedVocative: "bro", forbiddenVocatives: ["babe", "Chief"] },
      { key: "team", name: "Squad", expectedVocative: "[Tuk Tuk]", multiAgent: true }
    ];

    for (const ag of agents) {
      const speech = localCognitiveBrain.synthesizeResponse(
        ag.key,
        ag.name,
        rawUserPrompt,
        {},
        "banglish"
      );

      assert.ok(speech && speech.length > 0, `Empty speech returned for agent ${ag.key}`);
      assert.ok(
        speech.toLowerCase().includes(ag.expectedVocative.toLowerCase()),
        `Agent ${ag.key} response missing "${ag.expectedVocative}": "${speech}"`
      );

      if (ag.forbiddenVocatives) {
        for (const f of ag.forbiddenVocatives) {
          assert.ok(
            !speech.toLowerCase().includes(f.toLowerCase()),
            `Agent ${ag.key} response contains forbidden vocative "${f}": "${speech}"`
          );
        }
      }

      if (ag.multiAgent) {
        assert.ok(speech.includes("[Tuk Tuk]:"), "Squad missing [Tuk Tuk]");
        assert.ok(speech.includes("[Vision]:"), "Squad missing [Vision]");
        assert.ok(speech.includes("[Friday]:"), "Squad missing [Friday]");
        assert.ok(speech.includes("[DD]:"), "Squad missing [DD]");
      }

      // Anti-Trailer Law
      assert.ok(!speech.trim().endsWith("?"), `Speech ended with trailing question mark: "${speech}"`);
      assert.ok(!/how can I help|anything else|would you like/i.test(speech), `Speech contained robotic trailer: "${speech}"`);
    }
  });

  console.log("\n===========================================================================");
  console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("===========================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("🌟 CODE-MIXED BANGLISH DEFAULT VOICE & ENGLISH TUK TUK TONE PARITY VERIFIED 100%!\n");
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error("Unhandled test suite rejection:", err);
  process.exit(1);
});
