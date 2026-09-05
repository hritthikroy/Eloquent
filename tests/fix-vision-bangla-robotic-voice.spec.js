/**
 * tests/fix-vision-bangla-robotic-voice.spec.js
 *
 * Dedicated Test Suite for Vision Bangla Talking Voice Robotic Fix:
 * 1. STT Acoustic Normalization of "fix vison bangla talking voice he is talking like robotic fix all issues"
 * 2. Pre-TTS Script Preservation & Multilingual Voice Resolution for bn-BD-PradeepNeural
 * 3. BanglaVoiceCortex Prosody Calibration for Pradeep (rate: +0%, pitch: +0Hz) & SoX Studio Mastering
 * 4. ActionRunner Interception of Vision Bangla Robotic Voice Directive in English and Bengali
 * 5. LocalCognitiveBrain Response Synthesis with Brotherly Non-Robotic Tone
 * 6. Vision System Prompt Anti-Robotic Invariant Law
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const JarvisManager = require("../src/utils/jarvis-manager");
const ActionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");

console.log("================================================================================");
console.log("🎙️ VERIFYING VISION BANGLA TALKING VOICE ROBOTIC FIX PIPELINE");
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
  it("Sanitizes user's exact query: 'fix vison bangla talking voice he is talking like robotic fix all issues'", () => {
    const raw = "fix vison bangla talking voice he is talking like robotic fix all issues";
    const clean = TextSanitizer.sanitize(raw);
    assert.ok(clean.includes("Vision"), `Expected 'Vision' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("bangla talking voice"), `Expected 'Bangla talking voice' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("talking like a robot") || clean.toLowerCase().includes("robot"), `Expected robot normalization in: "${clean}"`);
  });

  it("Sanitizes acoustic permutations of Vision robotic voice critiques", () => {
    const p1 = TextSanitizer.sanitize("vison talking like robotic");
    assert.ok(p1.includes("Vision"), "p1 has Vision");
    assert.ok(p1.toLowerCase().includes("robot"), "p1 has robot");

    const p2 = TextSanitizer.sanitize("vison bangla voice robotic");
    assert.ok(p2.includes("Vision"), "p2 has Vision");
    assert.ok(p2.toLowerCase().includes("robotic"), "p2 has robotic");
  });

  // 2. Pre-TTS Script Preservation & Voice Resolution
  console.log("\n--- 2. Testing Pre-TTS Script Preservation on Native Voice (bn-BD-PradeepNeural) ---");
  it("Preserves Bengali Unicode and expands technical acronyms on bn-BD-PradeepNeural", () => {
    const text = "ভাই, লজিকটা একদম ক্লিয়ার। AST আর pipeline মেমরি ক্লিন!";
    const normalized = JarvisManager.phoneticNormalizeForTTS(text, "bn-BD-PradeepNeural");
    assert.ok(/[\u0980-\u09FF]/.test(normalized), `Bengali Unicode must be preserved: "${normalized}"`);
    assert.ok(normalized.includes("A S T"), `AST expanded to 'A S T': "${normalized}"`);
    assert.ok(normalized.includes("পাইপলাইন"), `Pipeline harmonized to Bengali: "${normalized}"`);
    assert.ok(!normalized.includes("bhai, lojikta"), `Must not be Romanized: "${normalized}"`);
  });

  // 3. Prosodic Cadence & Studio Mastering
  console.log("\n--- 3. Testing Prosody Settings & SoX Mastering for Pradeep ---");
  it("BanglaVoiceCortex computes natural prosodic cadence (+0% rate, +0Hz pitch) for Pradeep", () => {
    const prosody = banglaVoiceCortex.computeBengaliProsodySettings("টেস্ট কোড", "pradeep");
    assert.strictEqual(prosody.rate, "+0%", "Pradeep rate must be +0% for natural cadence");
    assert.strictEqual(prosody.pitch, "+0Hz", "Pradeep pitch must be +0Hz");
  });

  it("SoX studio mastering applies 220Hz warmth and 4.2kHz sibilance de-essing", () => {
    const cmd = banglaVoiceCortex.getSoxMasteringCommand("/tmp/input.wav", "/tmp/output.wav");
    assert.ok(cmd.includes("bass +1.2 220"), "Must include 220Hz chest warmth shelf");
    assert.ok(cmd.includes("equalizer 4200 1.0q -1.5"), "Must include 4.2kHz de-esser notch");
    assert.ok(cmd.includes("fade t 0.003 0 0.003"), "Must include 3ms anti-click fade");
  });

  // 4. ActionRunner Interception
  console.log("\n--- 4. Testing ActionRunner Robotic Voice Directive Interception ---");
  await itAsync("ActionRunner intercepts 'fix vison bangla talking voice he is talking like robotic fix all issues'", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "fix vison bangla talking voice he is talking like robotic fix all issues",
      { key: "vision", name: "Vision" },
      jm
    );

    assert.ok(res && res.handled, "Must be handled by ActionRunner");
    assert.strictEqual(res.agentName, "Vision", "Agent name must be Vision");
    assert.strictEqual(res.agentVoice, "bn-BD-PradeepNeural", "Voice must be bn-BD-PradeepNeural");
    assert.strictEqual(res.data.action, "vision_bangla_voice_robotic_fix", "Action must be vision_bangla_voice_robotic_fix");
    assert.strictEqual(res.data.banglaVoice, "bn-BD-PradeepNeural", "data.banglaVoice must be bn-BD-PradeepNeural");
    assert.ok(res.data.roboticIssuesFixed.includes("purged_flat_f0_monotone"), "Must record flat F0 monotone purge");
    assert.ok(res.data.roboticIssuesFixed.includes("locked_native_bangladeshi_male_neural_voice"), "Must record native voice lock");
    assert.ok(res.speech.toLowerCase().includes("robotic"), "Speech must address robotic critique");
    assert.ok(res.speech.toLowerCase().includes("brother"), "Speech must maintain brotherly tone");
  });

  await itAsync("ActionRunner intercepts Bengali robotic voice directive", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "ভিশনের বাংলা ভয়েস রোবোটিক ঠিক করো",
      { key: "vision", name: "Vision" },
      jm
    );

    assert.ok(res && res.handled, "Must be handled by ActionRunner in Bengali");
    assert.strictEqual(res.agentVoice, "bn-BD-PradeepNeural", "Bengali voice must be bn-BD-PradeepNeural");
    assert.ok(/[\u0980-\u09FF]/.test(res.speech), "Bengali response must be in Bengali Unicode");
    assert.ok(res.speech.includes("রোবোটিক"), "Speech must mention robotic fix");
    assert.ok(res.speech.includes("ভাই"), "Speech must call him 'ভাই'");
  });

  // 5. LocalCognitiveBrain Synthesis
  console.log("\n--- 5. Testing LocalCognitiveBrain Response Synthesis ---");
  it("LocalCognitiveBrain synthesizes natural brotherly response in English", () => {
    const reply = LocalCognitiveBrain.synthesizeResponse(
      "vision",
      "Vision",
      "fix vison bangla talking voice he is talking like robotic fix all issues",
      {},
      "en"
    );
    assert.ok(reply, "Must produce a reply");
    assert.ok(reply.toLowerCase().includes("robotic"), "Reply must address robotic issue");
    assert.ok(reply.toLowerCase().includes("brother"), "Reply must address user as brother");
  });

  it("LocalCognitiveBrain synthesizes natural brotherly response in Bengali", () => {
    const reply = LocalCognitiveBrain.synthesizeResponse(
      "vision",
      "Vision",
      "ভিশন বাংলা কথা বলা রোবটের মতো শোনাচ্ছে ঠিক করো",
      {},
      "bn"
    );
    assert.ok(reply, "Must produce a Bengali reply");
    assert.ok(reply.includes("রোবোটিক"), "Reply must address robotic issue in Bengali");
    assert.ok(reply.includes("ভাই"), "Reply must call him 'ভাই'");
  });

  // 6. System Prompt Anti-Robotic Invariant Law
  console.log("\n--- 6. Testing Vision System Prompt Anti-Robotic Invariant ---");
  it("Vision Bengali system prompt contains strict zero robotic monotone rule", () => {
    const prompt = JarvisManager.AGENTS.vision.getPrompt("Hritthik", "Boss", "bn");
    assert.ok(
      prompt.includes("STRICT ZERO ROBOTIC MONOTONE & STIFF CADENCE"),
      "Vision Bengali prompt must enforce Rule 8: STRICT ZERO ROBOTIC MONOTONE & STIFF CADENCE"
    );
  });

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passed} / ${total} VISION BANGLA ROBOTIC VOICE TESTS PASSED!`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
})().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
