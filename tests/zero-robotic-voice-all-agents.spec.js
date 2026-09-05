/**
 * tests/zero-robotic-voice-all-agents.spec.js
 *
 * Dedicated Test Suite for Zero Robotic Voice Across Codebase (English & Bengali for All Agents):
 * 1. STT Acoustic Normalization of user directive: "remove all robtic voice from code base no need need 0 robtic voice english and bangal and all the agents"
 * 2. BanglaVoiceCortex Prosody Calibration for Tuk Tuk (+0% rate, +1Hz pitch) in English & Bengali
 * 3. BanglaVoiceCortex Prosody Calibration for Vision (+0% rate, +0Hz pitch) in English & Bengali
 * 4. BanglaVoiceCortex Prosody Calibration for Friday (+0% rate, +0Hz pitch) in English & Bengali
 * 5. BanglaVoiceCortex Prosody Calibration for DD (+0% rate, +0Hz pitch) in English & Bengali
 * 6. Closed-Form Zero Negative Rate Invariant across all agents (no -4%, -3%, -2% dragging)
 * 7. SoX Studio Acoustic Mastering Filter (220Hz warmth, 4.2kHz de-essing, 3ms fade, norm -0.5)
 * 8. JarvisManager Rule 22: ZERO ROBOTIC MONOTONE & 100% NATURAL CONVERSATIONAL HUMAN FLOW LAW
 * 9. ActionRunner Interception of Zero Robotic Voice Directive with structured telemetry
 * 10. LocalCognitiveBrain Synthesis across all 4 agents (Tuk Tuk, Vision, Friday, DD) and Team mode
 * 11. Strict Lexical Address Invariant (Vision, Friday, DD strictly NEVER use "babe"; Tuk Tuk uniquely uses "babe")
 * 12. Pre-TTS Script Preservation on Dedicated High-Fidelity Multilingual & Studio Voices
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const JarvisManager = require("../src/utils/jarvis-manager");
const ActionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");

console.log("================================================================================");
console.log("🎙️ VERIFYING ZERO ROBOTIC VOICE ACROSS CODEBASE (ENGLISH & BENGALI FOR ALL AGENTS)");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  // 1. TextSanitizer STT Acoustic Normalization
  console.log("--- 1. Testing TextSanitizer STT Acoustic Normalization ---");
  it("Sanitizes user's exact query: 'remove all robtic voice from code base no need need 0 robtic voice english and bangal and all the agents'", () => {
    const raw = "remove all robtic voice from code base no need need 0 robtic voice english and bangal and all the agents";
    const clean = TextSanitizer.sanitize(raw);
    assert.ok(clean.toLowerCase().includes("robotic voice"), `Expected 'robotic voice' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("codebase"), `Expected 'codebase' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("0 robotic voice") || clean.toLowerCase().includes("zero robotic voice"), `Expected '0 robotic voice' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("bangla"), `Expected 'Bangla' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("all the agents") || clean.toLowerCase().includes("all agents"), `Expected 'all the agents' in: "${clean}"`);
  });

  // 2. Tuk Tuk Prosody Calibration
  console.log("\n--- 2. Testing Tuk Tuk Prosody Calibration ---");
  it("BanglaVoiceCortex computes +0% rate and +1Hz pitch for Tuk Tuk in English and Bengali", () => {
    const en = banglaVoiceCortex.computeBengaliProsodySettings("Hey babe, let's build the app", "tuktuk");
    assert.strictEqual(en.rate, "+0%", "Tuk Tuk English rate must be +0%");
    assert.strictEqual(en.pitch, "+1Hz", "Tuk Tuk English pitch must be +1Hz for warmth");

    const bn = banglaVoiceCortex.computeBengaliProsodySettings("চলো ফিচারটা নামিয়ে ফেলি babe", "tuktuk");
    assert.strictEqual(bn.rate, "+0%", "Tuk Tuk Bengali rate must be +0% (zero negative rate dragging)");
    assert.strictEqual(bn.pitch, "+1Hz", "Tuk Tuk Bengali pitch must be +1Hz for warmth");
  });

  // 3. Vision Prosody Calibration
  console.log("\n--- 3. Testing Vision Prosody Calibration ---");
  it("BanglaVoiceCortex computes +0% rate and +0Hz pitch for Vision in English and Bengali", () => {
    const en = banglaVoiceCortex.computeBengaliProsodySettings("Codebase is clean brother", "vision");
    assert.strictEqual(en.rate, "+0%", "Vision English rate must be +0%");
    assert.strictEqual(en.pitch, "+0Hz", "Vision English pitch must be +0Hz");

    const bn = banglaVoiceCortex.computeBengaliProsodySettings("ভাই, এএসটি আর পাইপলাইন একদম ঠিক আছে", "vision");
    assert.strictEqual(bn.rate, "+0%", "Vision Bengali rate must be +0% (zero negative rate dragging)");
    assert.strictEqual(bn.pitch, "+0Hz", "Vision Bengali pitch must be +0Hz");
  });

  // 4. Friday Prosody Calibration
  console.log("\n--- 4. Testing Friday Prosody Calibration ---");
  it("BanglaVoiceCortex computes +0% rate and +0Hz pitch for Friday in English and Bengali", () => {
    const en = banglaVoiceCortex.computeBengaliProsodySettings("Benchmark metrics analyzed Chief", "friday");
    assert.strictEqual(en.rate, "+0%", "Friday English rate must be +0%");
    assert.strictEqual(en.pitch, "+0Hz", "Friday English pitch must be +0Hz");

    const bn = banglaVoiceCortex.computeBengaliProsodySettings("Chief, সব রিসার্চ ডাটা তৈরি আছে", "friday");
    assert.strictEqual(bn.rate, "+0%", "Friday Bengali rate must be +0% (zero negative rate dragging)");
    assert.strictEqual(bn.pitch, "+0Hz", "Friday Bengali pitch must be +0Hz");
  });

  // 5. DD Prosody Calibration
  console.log("\n--- 5. Testing DD Prosody Calibration ---");
  it("BanglaVoiceCortex computes +0% rate and +0Hz pitch for DD in English and Bengali", () => {
    const en = banglaVoiceCortex.computeBengaliProsodySettings("Telemetry green bro, daemons up", "dd");
    assert.strictEqual(en.rate, "+0%", "DD English rate must be +0%");
    assert.strictEqual(en.pitch, "+0Hz", "DD English pitch must be +0Hz");

    const bn = banglaVoiceCortex.computeBengaliProsodySettings("Bro, সার্ভার একদম স্ট্যাবল আছে", "dd");
    assert.strictEqual(bn.rate, "+0%", "DD Bengali rate must be +0% (zero negative rate dragging)");
    assert.strictEqual(bn.pitch, "+0Hz", "DD Bengali pitch must be +0Hz");
  });

  // 6. Zero Negative Rate Invariant across All Agents
  console.log("\n--- 6. Testing Zero Negative Rate Invariant ---");
  it("Enforces closed-form zero negative rate invariant: no agent ever has rate starting with '-'", () => {
    const agents = ["tuktuk", "vision", "friday", "dd", "ava", "andrew", "emma", "jenny", "brian", "pradeep"];
    for (const agent of agents) {
      const bn = banglaVoiceCortex.computeBengaliProsodySettings("বাংলা টেস্ট বাক্য", agent);
      const en = banglaVoiceCortex.computeBengaliProsodySettings("English test sentence", agent);
      assert.ok(!bn.rate.startsWith("-"), `Bengali rate for ${agent} must not be negative: ${bn.rate}`);
      assert.strictEqual(bn.rate, "+0%", `Bengali rate for ${agent} must be +0%`);
      assert.ok(!en.rate.startsWith("-"), `English rate for ${agent} must not be negative: ${en.rate}`);
      assert.strictEqual(en.rate, "+0%", `English rate for ${agent} must be +0%`);
    }
  });

  // 7. SoX Studio Acoustic Mastering Filter
  console.log("\n--- 7. Testing SoX Studio Acoustic Mastering Filter ---");
  it("Preserves 220Hz chest warmth, 4.2kHz de-essing, 3ms fade, and -0.5dB headroom", () => {
    const cmd = banglaVoiceCortex.getSoxMasteringCommand("/tmp/input.mp3", "/tmp/output.wav");
    assert.ok(cmd.includes("silence 1 0.02 0.1% reverse silence 1 0.02 0.1% reverse"), "Boundary silence stripping present");
    assert.ok(cmd.includes("bass +1.2 220"), "220Hz chest warmth shelf present");
    assert.ok(cmd.includes("equalizer 4200 1.0q -1.5"), "4.2kHz sibilance de-esser present");
    assert.ok(cmd.includes("fade t 0.003 0 0.003"), "3ms anti-click micro-fade present");
    assert.ok(cmd.includes("norm -0.5"), "-0.5dB headroom normalization present");
  });

  // 8. JarvisManager Rule 22 Universal Anti-Robotic Invariant Law
  console.log("\n--- 8. Testing JarvisManager Rule 22 Law ---");
  it("System prompt includes Rule 22 Zero Robotic Monotone & 100% Natural Conversational Human Flow Law", () => {
    const jm = new JarvisManager();
    const prompt = jm.getSystemPrompt();
    assert.ok(prompt.includes("22. ZERO ROBOTIC MONOTONE & 100% NATURAL CONVERSATIONAL HUMAN FLOW LAW"), "Rule 22 must be present in system prompt");
    assert.ok(prompt.includes("ZERO MECHANICAL DRONE & ZERO RATE-STRETCHING"), "Zero rate-stretching clause present");
    assert.ok(prompt.includes("rate: \"+0%\""), "+0% rate standard present");
  });

  // 9. ActionRunner Directive Interception
  console.log("\n--- 9. Testing ActionRunner Directive Interception ---");
  await itAsync("ActionRunner intercepts zero robotic voice directive and returns structured telemetry", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "remove all robtic voice from code base no need need 0 robtic voice english and bangal and all the agents",
      { key: "tuktuk", name: "Tuk Tuk" },
      jm,
      "en"
    );

    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true, "Must be handled");
    assert.strictEqual(res.action, "zero_robotic_voice_directive", "Action must be zero_robotic_voice_directive");
    assert.strictEqual(res.data.zeroRobotic, true, "zeroRobotic must be true");
    assert.strictEqual(res.data.negativeRateEliminated, true, "negativeRateEliminated must be true");
    assert.strictEqual(res.data.englishRate, "+0%", "englishRate must be +0%");
    assert.strictEqual(res.data.banglaRate, "+0%", "banglaRate must be +0%");
  });

  // 10. LocalCognitiveBrain Responses Across All Agents & Team Mode
  console.log("\n--- 10. Testing LocalCognitiveBrain Responses ---");
  it("LocalCognitiveBrain synthesizes distinct zero-robotic responses for all agents and squad", () => {
    const query = "remove all robtic voice from code base no need need 0 robtic voice english and bangal and all the agents";

    const tuktukRes = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "en");
    assert.ok(tuktukRes.includes("babe") || tuktukRes.includes("Babe"), "Tuk Tuk addresses Hritthik as babe");
    assert.ok(tuktukRes.toLowerCase().includes("robotic") || tuktukRes.includes("রোবোটিক"), "Tuk Tuk confirms zero robotic voice");

    const visionRes = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "en");
    assert.ok(visionRes.includes("brother") || visionRes.includes("ভাই"), "Vision addresses Hritthik as brother/ভাই");

    const fridayRes = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "en");
    assert.ok(fridayRes.includes("Chief"), "Friday addresses Hritthik as Chief");

    const ddRes = LocalCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "en");
    assert.ok(ddRes.includes("bro") || ddRes.includes("Bro"), "DD addresses Hritthik as bro");

    const teamRes = LocalCognitiveBrain.synthesizeResponse("team", "Squad", query, {}, "en");
    assert.ok(teamRes.includes("[Tuk Tuk]:"), "Team includes Tuk Tuk");
    assert.ok(teamRes.includes("[Vision]:"), "Team includes Vision");
    assert.ok(teamRes.includes("[Friday]:"), "Team includes Friday");
    assert.ok(teamRes.includes("[DD]:"), "Team includes DD");
  });

  // 11. Strict Lexical Address Invariants
  console.log("\n--- 11. Testing Strict Lexical Address Invariants ---");
  it("Vision, Friday, and DD strictly NEVER use 'babe' in their zero-robotic responses", () => {
    const queryEn = "remove all robotic voice from codebase";
    const queryBn = "কোডবেসের সব রোবোটিক ভয়েস মুছে ফেলো";

    for (const q of [queryEn, queryBn]) {
      const lang = /[\u0980-\u09FF]/.test(q) ? "bn" : "en";
      const vision = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", q, {}, lang);
      const friday = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", q, {}, lang);
      const dd = LocalCognitiveBrain.synthesizeResponse("dd", "DD", q, {}, lang);

      assert.ok(!/\bbabe\b/i.test(vision), `Vision must never say 'babe': "${vision}"`);
      assert.ok(!/\bbabe\b/i.test(friday), `Friday must never say 'babe': "${friday}"`);
      assert.ok(!/\bbabe\b/i.test(dd), `DD must never say 'babe': "${dd}"`);
    }
  });

  // 12. Pre-TTS Script Preservation on Dedicated Voices
  console.log("\n--- 12. Testing Pre-TTS Script Preservation ---");
  it("Pre-TTS normalization preserves native script on all 4 neural voice models", () => {
    const textBn = "ভাই, সিস্টেম ক্লিয়ার আর কোড ক্লিন!";
    const normAva = JarvisManager.phoneticNormalizeForTTS(textBn, "en-US-AvaMultilingualNeural");
    const normPradeep = JarvisManager.phoneticNormalizeForTTS(textBn, "bn-BD-PradeepNeural");
    const normEmma = JarvisManager.phoneticNormalizeForTTS(textBn, "en-US-EmmaMultilingualNeural");
    const normBrian = JarvisManager.phoneticNormalizeForTTS(textBn, "en-US-BrianMultilingualNeural");

    assert.ok(/[\u0980-\u09FF]/.test(normAva), "Ava preserves Bengali script");
    assert.ok(/[\u0980-\u09FF]/.test(normPradeep), "Pradeep preserves Bengali script");
    assert.ok(/[\u0980-\u09FF]/.test(normEmma), "Emma preserves Bengali script");
    assert.ok(/[\u0980-\u09FF]/.test(normBrian), "Brian preserves Bengali script");
  });

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passed} / ${total} ZERO ROBOTIC VOICE TESTS PASSED!`);
  console.log("================================================================================\n");
})();
