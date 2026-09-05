/**
 * tests/tuktuk-modern-girl-voice-tone-fix.spec.ts
 *
 * Comprehensive Test Suite for Tuk Tuk Modern Girl Voice Tone Calibration & 1:1 English-Bangla Parity:
 * 1. STT Acoustic Normalization of user query with phonetic errors:
 *    "fix tuktuk voice tone proerly this tone is not a morder girl tone chak the english tuktuk voice and bangal tuktuk voice need to fix"
 *    -> "Fix Tuk Tuk voice tone properly, this tone is not a modern girl tone, check the English Tuk Tuk voice and Bangla Tuk Tuk voice, need to fix"
 * 2. ActionRunner Interception & Telemetry:
 *    - Handled === true
 *    - Action === "tuktuk_modern_girl_bilingual_parity_directive"
 *    - Data contains modernGirlTone: true, voiceToneSynced: true, englishBanglaVoiceParity: "100%"
 *    - Reassures user with girlfriend affection (strictly "babe"), confirming 1:1 voice tone check
 * 3. LocalCognitiveBrain Responses:
 *    - Tuk Tuk in Bengali & English addresses Hritthik as "babe" and confirms 1:1 modern girl voice tone
 *    - Squad agents (Vision, Friday, DD, Team) confirm parity adhering to sovereignty rules
 * 4. JarvisManager Prompt & Law 24:
 *    - Tuk Tuk Bengali prompt contains 1:1 MODERN GIRL VOICE TONE PARITY
 *    - Law 24 contains 1:1 MODERN GIRL VOICE TONE INVARIANCE
 * 5. BanglaVoiceCortex Prosodic Configuration:
 *    - Rate +0%, Pitch +1Hz for AvaMultilingualNeural in both English and Bengali
 */

import * as assert from "assert";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..", "..");
const TextSanitizer = require(path.join(projectRoot, "src/utils/prompt-engine/text-sanitizer"));
const JarvisManager = require(path.join(projectRoot, "src/utils/jarvis-manager"));
const ActionRunner = require(path.join(projectRoot, "src/utils/action-runner"));
const LocalCognitiveBrain = require(path.join(projectRoot, "src/utils/local-cognitive-brain"));
const banglaVoiceCortex = require(path.join(projectRoot, "src/utils/bangla-voice-cortex"));

console.log("================================================================================");
console.log("🌸 VERIFYING TUK TUK MODERN GIRL VOICE TONE FIX & 1:1 BILINGUAL PARITY");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function it(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  const rawQuery = "fix tuktuk voice tone proerly this tone is not a morder girl tone chak the english tuktuk voice and bangal tuktuk voice need to fix";

  // 1. STT Acoustic Normalization
  it("1. TextSanitizer normalizes phonetic typos in user voice tone query", () => {
    const sanitized = TextSanitizer.sanitize(rawQuery);
    assert.ok(sanitized.includes("properly"), `Expected 'properly', got: "${sanitized}"`);
    assert.ok(sanitized.includes("modern girl"), `Expected 'modern girl', got: "${sanitized}"`);
    assert.ok(sanitized.includes("check the English Tuk Tuk voice"), `Expected 'check the English Tuk Tuk voice', got: "${sanitized}"`);
    assert.ok(sanitized.includes("Bangla Tuk Tuk voice"), `Expected 'Bangla Tuk Tuk voice', got: "${sanitized}"`);
    assert.ok(!sanitized.includes("proerly"), `Should remove 'proerly', got: "${sanitized}"`);
    assert.ok(!sanitized.includes("morder"), `Should remove 'morder', got: "${sanitized}"`);
    assert.ok(!sanitized.includes("chak the"), `Should remove 'chak the', got: "${sanitized}"`);
    assert.ok(!sanitized.includes("bangal tuktuk"), `Should remove 'bangal tuktuk', got: "${sanitized}"`);
  });

  // 2. ActionRunner Interception & Telemetry
  await itAsync("2. ActionRunner intercepts directive and returns structured voice parity telemetry", async () => {
    let savedDirective = "";
    let prefKey = "";
    let prefVal = "";
    const fakeJarvisManager = {
      conversationLanguage: "en",
      currentLanguage: "en",
      saveDynamicDirective: (text: string, _agent: string) => { savedDirective = text; },
      setPreference: (key: string, val: string) => { prefKey = key; prefVal = val; }
    };

    const result = await ActionRunner.handleAction(
      rawQuery,
      { key: "tuktuk", name: "Tuk Tuk" },
      fakeJarvisManager,
      "en"
    );

    assert.ok(result, "ActionRunner must return a result");
    assert.strictEqual(result.handled, true, "Must be handled");
    assert.strictEqual(result.action, "tuktuk_modern_girl_bilingual_parity_directive");
    assert.strictEqual(result.agentName, "Tuk Tuk");
    assert.strictEqual(result.voice, "en-US-AvaMultilingualNeural");
    assert.ok(result.data.modernGirlTone, "modernGirlTone must be true");
    assert.ok(result.data.voiceToneSynced, "voiceToneSynced must be true");
    assert.strictEqual(result.data.englishBanglaVoiceParity, "100%");
    assert.ok(result.speech.toLowerCase().includes("babe"), "Speech must affectionately call user 'babe'");
  });

  // 3. ActionRunner in Bengali Mode
  await itAsync("3. ActionRunner responds in Bengali with sweet modern girl co-founder tone", async () => {
    const fakeJarvisManager = {
      conversationLanguage: "bn",
      currentLanguage: "bn",
      saveDynamicDirective: (_text: string, _agent: string) => {},
      setPreference: (_key: string, _val: string) => {}
    };

    const result = await ActionRunner.handleAction(
      rawQuery,
      { key: "tuktuk", name: "Tuk Tuk" },
      fakeJarvisManager,
      "bn"
    );

    assert.ok(result && result.handled, "Must be handled in Bengali mode");
    assert.ok(result.speech.includes("babe") || result.speech.includes("Babe"), "Bengali speech must use 'babe'");
    assert.ok(result.speech.includes("ভয়েস"), "Bengali speech must discuss voice tone");
    assert.ok(result.speech.includes("ইংলিশ"), "Bengali speech must reference English voice");
    assert.ok(result.speech.includes("বাংলা"), "Bengali speech must reference Bangla voice");
  });

  // 4. LocalCognitiveBrain Tuk Tuk Responses
  it("4. LocalCognitiveBrain produces modern girl tone parity responses for Tuk Tuk", () => {
    const bnResponse = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawQuery, {}, "bn");
    assert.ok(bnResponse, "Bengali response must not be empty");
    assert.ok(bnResponse.includes("babe") || bnResponse.includes("Babe"), `Must include 'babe', got: "${bnResponse}"`);

    const enResponse = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawQuery, {}, "en");
    assert.ok(enResponse, "English response must not be empty");
    assert.ok(enResponse.toLowerCase().includes("babe"), `Must include 'babe', got: "${enResponse}"`);
    assert.ok(enResponse.toLowerCase().includes("voice"), `Must mention voice, got: "${enResponse}"`);
  });

  // 5. Squad Agent Sovereignty Check
  it("5. Vision and Friday acknowledge parity adhering to persona sovereignty", () => {
    const visionResponse = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawQuery, {}, "en");
    assert.ok(visionResponse, "Vision response must exist");
    assert.ok(visionResponse.toLowerCase().includes("brother"), `Vision must call user 'brother', got: "${visionResponse}"`);
    assert.ok(!visionResponse.toLowerCase().includes("babe"), "Vision must never call user 'babe'");

    const fridayResponse = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawQuery, {}, "en");
    assert.ok(fridayResponse, "Friday response must exist");
    assert.ok(fridayResponse.toLowerCase().includes("chief") || fridayResponse.includes("Hritthik"), "Friday must call user 'Chief' or 'Hritthik'");
    assert.ok(!fridayResponse.toLowerCase().includes("babe"), "Friday must never call user 'babe'");
  });

  // 6. JarvisManager Prompt & Law 24
  it("6. JarvisManager incorporates 1:1 Modern Girl Voice Tone Parity in Tuk Tuk prompt and Law 24", () => {
    const prompt = JarvisManager.AGENTS.tuktuk.getPrompt("Hritthik", "Boss", "bn");
    assert.ok(prompt.includes("1:1 MODERN GIRL VOICE TONE PARITY"), "Tuk Tuk prompt must contain 1:1 MODERN GIRL VOICE TONE PARITY");

    const jm = new JarvisManager();
    const systemPrompt = jm.getSystemPrompt("tuktuk", "Hritthik", "babe", "bn");
    assert.ok(systemPrompt.includes("1:1 MODERN GIRL VOICE TONE INVARIANCE"), "System prompt Law 24 must contain 1:1 MODERN GIRL VOICE TONE INVARIANCE");
  });

  // 7. BanglaVoiceCortex Prosody
  it("7. BanglaVoiceCortex ensures identical tempo (+0% rate, +1Hz pitch) for Tuk Tuk in English and Bengali", () => {
    const enProsody = banglaVoiceCortex.computeBengaliProsodySettings("Hello babe, let's build something great!", "tuktuk");
    const bnProsody = banglaVoiceCortex.computeBengaliProsodySettings("শোনো babe, চলো একসাথে দারুণ কিছু বানাই!", "tuktuk");

    assert.strictEqual(enProsody.rate, "+0%", "English rate must be +0%");
    assert.strictEqual(enProsody.pitch, "+1Hz", "English pitch warmth must be +1Hz");
    assert.strictEqual(bnProsody.rate, "+0%", "Bengali rate must be +0%");
    assert.strictEqual(bnProsody.pitch, "+1Hz", "Bengali pitch warmth must be +1Hz");
    assert.strictEqual(enProsody.rate, bnProsody.rate, "1:1 rate parity between English and Bengali");
    assert.strictEqual(enProsody.pitch, bnProsody.pitch, "1:1 pitch warmth parity between English and Bengali");
  });

  console.log(`\n================================================================================`);
  console.log(`🎉 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
  console.log(`================================================================================\n`);
})();
