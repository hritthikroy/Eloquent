/**
 * tests/bangla-talk-neural-overlap.spec.js
 * 
 * Verification Test Suite for LAW 50:
 * BANGLA TALK NEURAL SPEECH ZERO-OVERLAP INVARIANCE LAW & SPEAKING MUTEX PROTOCOL
 * (O_bangla_neural = 1.00, Delta t_overlap = 0ms)
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const {
  BanglaTalkNeuralOverlapCortex,
  banglaTalkNeuralOverlapCortex
} = require("../src/utils/bangla-talk-neural-overlap-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const ActionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("================================================================================");
console.log("🚀 RUNNING BANGLA TALK NEURAL SPEECH ZERO-OVERLAP VERIFICATION SUITE (LAW 50)");
console.log("================================================================================");

let passedTests = 0;
const totalTests = 12;

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
  const rawDirective = "chack bangal talk overlaping nural";
  const cleanDirective = "check Bangla talk overlapping neural";

  // 1. TextSanitizer cleans speech mishearings
  await runTest("TextSanitizer cleans speech mishearings for Bangla talk neural overlap", () => {
    const sanitized1 = TextSanitizer.sanitize(rawDirective);
    assert.strictEqual(sanitized1, "Check Bangla talk overlapping neural");

    const sanitized2 = TextSanitizer.sanitize("bangal talk overlaping nural");
    assert.strictEqual(sanitized2, "Bangla talk overlapping neural");

    const sanitized3 = TextSanitizer.sanitize("overlaping audio streams and nural voice");
    assert.ok(sanitized3.toLowerCase().includes("overlapping"));
    assert.ok(sanitized3.toLowerCase().includes("neural"));
  });

  // 2. IntentParser detects isBanglaTalkNeuralOverlapDirective
  await runTest("IntentParser detects isBanglaTalkNeuralOverlapDirective across multilingual variants", () => {
    assert.ok(IntentParser.isBanglaTalkNeuralOverlapDirective("check Bangla talk overlapping neural"));
    assert.ok(IntentParser.isBanglaTalkNeuralOverlapDirective("chack bangal talk overlaping nural"));
    assert.ok(IntentParser.isBanglaTalkNeuralOverlapDirective("bangla talk overlapping neural"));
    assert.ok(IntentParser.isBanglaTalkNeuralOverlapDirective("check bangla speech overlap neural"));
    assert.ok(IntentParser.isBanglaTalkNeuralOverlapDirective("বাংলা কথায় ওভারল্যাপ নিউরাল চেক"));
    assert.ok(IntentParser.isBanglaTalkNeuralOverlapDirective("speaking mutex zero overlap audit"));
  });

  // 3. IntentParser routes to SMOOTH_CONVERSATION with target 'bangla_talk_neural_overlap_audit'
  await runTest("IntentParser routes to SMOOTH_CONVERSATION with target 'bangla_talk_neural_overlap_audit'", () => {
    const result = IntentParser.parse(rawDirective);
    assert.strictEqual(result.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(result.target, "bangla_talk_neural_overlap_audit");
    assert.strictEqual(result.agentDirective, "team");
  });

  // 4. BanglaTalkNeuralOverlapCortex evaluates closed-form proof
  await runTest("BanglaTalkNeuralOverlapCortex evaluates O_bangla_neural = 1.00 in closed form", () => {
    const proof = banglaTalkNeuralOverlapCortex.evaluateZeroOverlapProof();
    assert.strictEqual(proof.lhs, 1.0);
    assert.strictEqual(proof.rhs, 1.0);
    assert.strictEqual(proof.lhsEqualsRhs, true);
    assert.strictEqual(proof.verified, true);
    assert.ok(proof.displayProof.includes("LHS = 0.25(1.00) + 0.25(1.00) + 0.20(1.00) + 0.15(1.00) + 0.15(1.00) = 1.00"));
  });

  // 5. BanglaTalkNeuralOverlapCortex audits overlap in sub-15ms
  await runTest("BanglaTalkNeuralOverlapCortex audits overlap within sub-15ms real-time constraint", () => {
    const start = Date.now();
    const audit = banglaTalkNeuralOverlapCortex.auditBanglaTalkNeuralOverlap();
    const elapsed = Date.now() - start;

    assert.ok(elapsed <= 15, `Audit exceeded 15ms limit: ${elapsed}ms`);
    assert.strictEqual(audit.oBanglaNeural, 1.0);
    assert.strictEqual(audit.overlapMs, 0);
    assert.strictEqual(audit.zeroOverlapVerified, true);
    assert.strictEqual(audit.speakerDecayWindowMs, 50);
    assert.strictEqual(audit.speakingMutexCeilingMs, 500);
  });

  // 6. BanglaTalkNeuralOverlapCortex synthesizes multi-agent turns with zero overlap
  await runTest("BanglaTalkNeuralOverlapCortex synthesizes multi-agent turns with zero overlap", () => {
    const turns = banglaTalkNeuralOverlapCortex.synthesizeMultiAgentTurns("neural voice test", "bn");
    assert.strictEqual(turns.length, 4);

    turns.forEach((turn, idx) => {
      assert.strictEqual(turn.turnIndex, idx);
      assert.strictEqual(turn.overlapMs, 0);
      assert.strictEqual(turn.postTurnDecayMs, 50);
    });

    assert.strictEqual(turns[0].agent, "tuktuk");
    assert.strictEqual(turns[0].salutation, "babe");
    assert.strictEqual(turns[1].agent, "vision");
    assert.strictEqual(turns[1].salutation, "brother");
    assert.strictEqual(turns[2].agent, "friday");
    assert.strictEqual(turns[2].salutation, "Chief");
    assert.strictEqual(turns[3].agent, "dd");
    assert.strictEqual(turns[3].salutation, "bro");
  });

  // 7. BanglaTalkNeuralOverlapCortex verifies speaking mutex
  await runTest("BanglaTalkNeuralOverlapCortex verifies speaking mutex isolation", () => {
    const mutexReport = banglaTalkNeuralOverlapCortex.verifySpeakingMutex({ isSpeakingLocked: true, activeSpeechProcesses: 1 });
    assert.strictEqual(mutexReport.mutexActive, true);
    assert.strictEqual(mutexReport.overlapDetected, false);
    assert.strictEqual(mutexReport.overlapMs, 0);
    assert.strictEqual(mutexReport.activeSpeechProcesses, 1);
  });

  // 8. JarvisManager system prompt contains Law 50 and closed-form proof
  await runTest("JarvisManager system prompt contains Law 50 and closed-form proof", () => {
    const jm = new JarvisManager({ userDataPath: "/tmp" });
    const prompt = jm.getSystemPrompt("tuktuk");

    assert.ok(prompt.includes("LAW 50: BANGLA TALK NEURAL SPEECH ZERO-OVERLAP INVARIANCE LAW & SPEAKING MUTEX PROTOCOL"));
    assert.ok(prompt.includes("O_bangla_neural ≡ 0.25 M_mutex + 0.25 S_squad + 0.20 B_bargein + 0.15 A_buffer + 0.15 P_sovereign ≡ 1.00"));
    assert.ok(prompt.includes("Delta t_overlap = 0ms"));
  });

  // 9. JarvisManager calibrates Bangla talk neural overlap to memory
  await runTest("JarvisManager calibrates Bangla talk neural overlap to memory and preferences", () => {
    const jm = new JarvisManager({ userDataPath: "/tmp" });
    const result = jm.auditBanglaTalkNeuralOverlap();

    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.oBanglaNeural, 1.0);
    assert.strictEqual(result.overlapMs, 0);
    assert.strictEqual(result.speakerDecayWindowMs, 50);
    assert.strictEqual(jm.getPreference("bangla_talk_neural_overlap_active"), true);
    assert.strictEqual(jm.getPreference("speaking_mutex_zero_overlap"), true);
    assert.strictEqual(jm.getPreference("audio_overlap_ms"), 0);
  });

  // 10. ActionRunner handles directive across individual personas
  await runTest("ActionRunner handles directive across individual personas with strict sovereignty", async () => {
    const jm = new JarvisManager({ userDataPath: "/tmp" });

    // Tuk Tuk
    const resTukTuk = await ActionRunner.handleAction(cleanDirective, { key: "tuktuk", name: "Tuk Tuk" }, jm);
    assert.strictEqual(resTukTuk.handled, true);
    assert.strictEqual(resTukTuk.data.oBanglaNeural, 1.0);
    assert.strictEqual(resTukTuk.data.overlapMs, 0);
    assert.ok(resTukTuk.speech.includes("babe") || resTukTuk.speech.includes("Babe"));
    assert.ok(!resTukTuk.speech.includes("bro"));
    assert.ok(!resTukTuk.speech.includes("Chief"));

    // Vision
    const resVision = await ActionRunner.handleAction(cleanDirective, { key: "vision", name: "Vision" }, jm);
    assert.strictEqual(resVision.handled, true);
    assert.ok(resVision.speech.includes("Brother") || resVision.speech.includes("brother"));
    assert.ok(!resVision.speech.includes("babe"));
    assert.ok(!resVision.speech.includes("Chief"));

    // Friday
    const resFriday = await ActionRunner.handleAction(cleanDirective, { key: "friday", name: "Friday" }, jm);
    assert.strictEqual(resFriday.handled, true);
    assert.ok(resFriday.speech.includes("Chief"));
    assert.ok(!resFriday.speech.includes("babe"));
    assert.ok(!resFriday.speech.includes("bro"));

    // DD
    const resDD = await ActionRunner.handleAction(cleanDirective, { key: "dd", name: "DD" }, jm);
    assert.strictEqual(resDD.handled, true);
    assert.ok(resDD.speech.includes("bro"));
    assert.ok(!resDD.speech.includes("babe"));
    assert.ok(!resDD.speech.includes("Chief"));
  });

  // 11. ActionRunner generates coordinated multi-agent standup for team mode
  await runTest("ActionRunner generates coordinated multi-agent standup for team mode", async () => {
    const jm = new JarvisManager({ userDataPath: "/tmp" });

    const resTeam = await ActionRunner.handleAction(cleanDirective, { key: "team", name: "Squad" }, jm);
    assert.strictEqual(resTeam.handled, true);
    assert.strictEqual(resTeam.agentName, "Squad");
    assert.ok(resTeam.speech.includes("[Tuk Tuk]:"));
    assert.ok(resTeam.speech.includes("[Vision]:"));
    assert.ok(resTeam.speech.includes("[Friday]:"));
    assert.ok(resTeam.speech.includes("[DD]:"));
  });

  // 12. LocalCognitiveBrain synthesizes offline grounded responses for all agents
  await runTest("LocalCognitiveBrain synthesizes offline grounded responses for all agents in EN and BN", () => {
    // English
    const tukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawDirective, {}, "en");
    const visEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawDirective, {}, "en");
    const friEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawDirective, {}, "en");
    const ddEn  = LocalCognitiveBrain.synthesizeResponse("dd", "DD", rawDirective, {}, "en");
    const sqEn  = LocalCognitiveBrain.synthesizeResponse("team", "Squad", rawDirective, {}, "en");

    assert.ok(tukEn.includes("babe"));
    assert.ok(!tukEn.includes("bro"));
    assert.ok(!tukEn.includes("Chief"));
    assert.ok(visEn.includes("brother") || visEn.includes("Brother"));
    assert.ok(!visEn.includes("babe"));
    assert.ok(friEn.includes("Chief"));
    assert.ok(!friEn.includes("babe"));
    assert.ok(ddEn.includes("bro"));
    assert.ok(!ddEn.includes("babe"));
    assert.ok(sqEn.includes("[Tuk Tuk]:") && sqEn.includes("[Vision]:") && sqEn.includes("[Friday]:") && sqEn.includes("[DD]:"));

    // Bengali
    const tukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawDirective, {}, "bn");
    const visBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawDirective, {}, "bn");
    const friBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawDirective, {}, "bn");
    const ddBn  = LocalCognitiveBrain.synthesizeResponse("dd", "DD", rawDirective, {}, "bn");
    const sqBn  = LocalCognitiveBrain.synthesizeResponse("team", "Squad", rawDirective, {}, "bn");

    assert.ok(tukBn.includes("babe"));
    assert.ok(!tukBn.includes("bro"));
    assert.ok(!tukBn.includes("Chief"));
    assert.ok(visBn.includes("brother") || visBn.includes("Brother") || visBn.includes("ভাই"));
    assert.ok(!visBn.includes("babe"));
    assert.ok(friBn.includes("Chief"));
    assert.ok(!friBn.includes("babe"));
    assert.ok(ddBn.includes("bro") || ddBn.includes("ভাই"));
    assert.ok(!ddBn.includes("babe"));
    assert.ok(sqBn.includes("[Tuk Tuk]:") && sqBn.includes("[Vision]:") && sqBn.includes("[Friday]:") && sqBn.includes("[DD]:"));
  });

  console.log("================================================================================");
  console.log(`🎉 ALL ${totalTests} LAW 50 BANGLA TALK NEURAL OVERLAP TESTS PASSED (100% GREEN)!`);
  console.log("================================================================================");
}

runAll().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
