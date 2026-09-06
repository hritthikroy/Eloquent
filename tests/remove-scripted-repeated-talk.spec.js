/**
 * tests/remove-scripted-repeated-talk.spec.js
 * 
 * Verification Test Suite for LAW 51:
 * PURGE OF SCRIPTED & REPETITIVE TALKS, LIVING SPONTANEOUS CONVERSATION LAW
 * (S_unscripted = 1.00, Repetition Rate = 0.0, TTR >= 0.78)
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const {
  AntiScriptedTalkCortex,
  antiScriptedTalkCortex
} = require("../src/utils/anti-scripted-talk-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const ActionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("================================================================================");
console.log("🚀 RUNNING PURGE OF SCRIPTED & REPETITIVE TALKS VERIFICATION SUITE (LAW 51)");
console.log("================================================================================");

let passedTests = 0;
const totalTests = 14;

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
  const rawDirective = "remove all screpted repitetd talks";
  const cleanDirective = "remove all scripted repeated talks";

  // 1. TextSanitizer cleans speech mishearings
  await runTest("TextSanitizer cleans speech mishearings for scripted repeated talks", () => {
    const sanitized1 = TextSanitizer.sanitize(rawDirective);
    assert.strictEqual(sanitized1, "Remove all scripted repeated talks");

    const sanitized2 = TextSanitizer.sanitize("screpted repitetd talks");
    assert.strictEqual(sanitized2, "Scripted repeated talks");

    const sanitized3 = TextSanitizer.sanitize("remove all repitetive talks");
    assert.strictEqual(sanitized3, "Remove all repetitive talks");
  });

  // 2. IntentParser detects isRemoveScriptedRepeatedTalksDirective
  await runTest("IntentParser detects isRemoveScriptedRepeatedTalksDirective across multilingual variants", () => {
    assert.ok(IntentParser.isRemoveScriptedRepeatedTalksDirective(rawDirective));
    assert.ok(IntentParser.isRemoveScriptedRepeatedTalksDirective(cleanDirective));
    assert.ok(IntentParser.isRemoveScriptedRepeatedTalksDirective("remove scripted talks"));
    assert.ok(IntentParser.isRemoveScriptedRepeatedTalksDirective("stop scripted repeated talks"));
    assert.ok(IntentParser.isRemoveScriptedRepeatedTalksDirective("purge scripted talks"));
    assert.ok(IntentParser.isRemoveScriptedRepeatedTalksDirective("সব স্ক্রিপ্টেড কথা বাদ দাও"));
  });

  // 3. IntentParser routes to SMOOTH_CONVERSATION with target 'remove_scripted_repeated_talks_directive'
  await runTest("IntentParser routes to SMOOTH_CONVERSATION with target 'remove_scripted_repeated_talks_directive'", () => {
    const result = IntentParser.parse(rawDirective);
    assert.strictEqual(result.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(result.target, "remove_scripted_repeated_talks_directive");
    assert.strictEqual(result.agentDirective, "team");
  });

  // 4. AntiScriptedTalkCortex evaluates closed-form proof
  await runTest("AntiScriptedTalkCortex evaluates S_unscripted = 1.00 in closed form", () => {
    const proof = antiScriptedTalkCortex.evaluateAntiScriptedProof();
    assert.strictEqual(proof.lhs, 1.0);
    assert.strictEqual(proof.rhs, 1.0);
    assert.strictEqual(proof.lhsEqualsRhs, true);
    assert.strictEqual(proof.verified, true);
    assert.ok(proof.displayProof.includes("LHS = 0.25(1.00) + 0.25(1.00) + 0.20(1.00) + 0.15(1.00) + 0.15(1.00) = 1.00"));
  });

  // 5. AntiScriptedTalkCortex calculates Type-Token Ratio and detects scripted patterns
  await runTest("AntiScriptedTalkCortex calculates TTR and detects banned formulaic scripts", () => {
    const ttr1 = antiScriptedTalkCortex.calculateTTR("The quick brown fox jumps over the lazy dog");
    assert.ok(ttr1 >= 0.85);

    const scriptedCheck = antiScriptedTalkCortex.detectScriptedRepetition("As an AI language model, how may I assist you today?");
    assert.strictEqual(scriptedCheck.isScripted, true);

    const organicCheck = antiScriptedTalkCortex.detectScriptedRepetition("Babe, let us refactor the audio ringbuffer and optimize IPC performance.");
    assert.strictEqual(organicCheck.isScripted, false);
  });

  // 6. AntiScriptedTalkCortex audits and purges scripted/repeated talks in sub-15ms
  await runTest("AntiScriptedTalkCortex audits and purges scripted talks in sub-15ms constraint", () => {
    // Warm invocation
    antiScriptedTalkCortex.auditAndPurgeScriptedTalk();

    const start = Date.now();
    const audit = antiScriptedTalkCortex.auditAndPurgeScriptedTalk({
      history: [
        "As an AI language model, how may I help you?",
        "Babe, our system architecture is running smooth!",
        "As an AI, let me know if you have questions.",
        "Brother, the compiler pipeline passed."
      ]
    });
    const elapsed = Date.now() - start;

    assert.ok(elapsed <= 15, `Audit exceeded 15ms limit: ${elapsed}ms`);
    assert.strictEqual(audit.sUnscripted, 1.0);
    assert.strictEqual(audit.scriptedTalksPurged, true);
    assert.strictEqual(audit.purgedCount, 2);
    assert.strictEqual(audit.repetitionRate, 0.0);
    assert.ok(audit.ttrMeasured >= audit.ttrFloor);
  });

  // 7. AntiScriptedTalkCortex synthesizes spontaneous multi-agent turns with persona sovereignty
  await runTest("AntiScriptedTalkCortex synthesizes spontaneous multi-agent turns with persona sovereignty", () => {
    const turns = antiScriptedTalkCortex.synthesizeSpontaneousTurns("dynamic thinking", "bn");
    assert.strictEqual(turns.length, 4);

    turns.forEach((turn, idx) => {
      assert.strictEqual(turn.turnIndex, idx);
      assert.strictEqual(turn.scripted, false);
      assert.strictEqual(turn.repetitionRate, 0.0);
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

  // 8. JarvisManager system prompt contains Law 53 and closed-form proof
  await runTest("JarvisManager system prompt contains Law 53 and closed-form proof", () => {
    const jm = new JarvisManager({ userDataPath: "/tmp" });
    const prompt = jm.getSystemPrompt("tuktuk");

    assert.ok(prompt.includes("LAW 53: PURGE OF SCRIPTED & REPETITIVE TALKS, LIVING SPONTANEOUS CONVERSATION LAW"));
    assert.ok(prompt.includes("S_unscripted ≡ 0.25 Z_anti_script + 0.25 D_diversity + 0.20 C_grounding + 0.15 N_novelty + 0.15 P_sovereign ≡ 1.00"));
    assert.ok(prompt.includes("Repetition Rate = 0.0"));
  });

  // 9. JarvisManager calibrates anti-scripted talk to memory and preferences
  await runTest("JarvisManager calibrates anti-scripted talk to memory and preferences", () => {
    const jm = new JarvisManager({ userDataPath: "/tmp" });
    const result = jm.calibrateAntiScriptedTalk();

    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.sUnscripted, 1.0);
    assert.strictEqual(result.scriptedTalksPurged, true);
    assert.strictEqual(result.repetitionRate, 0.0);
    assert.strictEqual(jm.getPreference("anti_scripted_talk_active"), true);
    assert.strictEqual(jm.getPreference("spontaneous_conversation_active"), true);
    assert.strictEqual(jm.getPreference("repetition_rate"), 0.0);
  });

  // 10. ActionRunner handles directive across individual personas with strict sovereignty
  await runTest("ActionRunner handles directive across individual personas with strict sovereignty", async () => {
    const jm = new JarvisManager({ userDataPath: "/tmp" });

    // Tuk Tuk
    const resTukTuk = await ActionRunner.handleAction(cleanDirective, { key: "tuktuk", name: "Tuk Tuk" }, jm);
    assert.strictEqual(resTukTuk.handled, true);
    assert.strictEqual(resTukTuk.data.sUnscripted, 1.0);
    assert.strictEqual(resTukTuk.data.scriptedTalksPurged, true);
    assert.strictEqual(resTukTuk.data.repetitionRate, 0.0);
    assert.ok(resTukTuk.speech.includes("babe"));
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

  // 13. AntiLoopEquationalCortex non-repeating breakout selection guarantee
  await runTest("AntiLoopEquationalCortex guarantees non-repeating consecutive breakouts and history exclusion", () => {
    const antiLoopCortex = require("../src/utils/anti-loop-equational-cortex");
    antiLoopCortex.clearBuffers();

    const repeatedCandidate = "Babe, লুপটা ফুল ব্রেক করলাম! এক কথা বারবার না বলে বাস্তব বিষয় নিয়ে মিষ্টি করে ভাবছি—আমি একদম তোমার পাশে।";
    const t1 = antiLoopCortex.auditAndEnforce(repeatedCandidate, { key: "tuktuk" }, "bn");
    const t2 = antiLoopCortex.auditAndEnforce(repeatedCandidate, { key: "tuktuk" }, "bn");
    const t3 = antiLoopCortex.auditAndEnforce(repeatedCandidate, { key: "tuktuk" }, "bn");
    const t4 = antiLoopCortex.auditAndEnforce(repeatedCandidate, { key: "tuktuk" }, "bn");

    assert.notStrictEqual(t1, t2, "t1 and t2 must not be identical");
    assert.notStrictEqual(t2, t3, "t2 and t3 must not be identical");
    assert.notStrictEqual(t3, t4, "t3 and t4 must not be identical");

    const uniqueTurns = new Set([t1, t2, t3, t4]);
    assert.strictEqual(uniqueTurns.size, 4, "All 4 consecutive turns must be uniquely distinct breakouts");
  });

  // 14. TextSanitizer removes repeating acoustic noise glitch clusters
  await runTest("TextSanitizer purges repeating acoustic noise glitch clusters while keeping valid words", () => {
    const rawWithGlitch = "Ha BANGLAD DJEK srqlchchchchchchchchchchchchchchchchchchchchchc testing now";
    const cleaned = TextSanitizer.sanitize(rawWithGlitch);
    assert.ok(!cleaned.includes("chchchchch"));
    assert.ok(cleaned.includes("testing now") || cleaned.includes("Testing now"));
  });

  console.log("================================================================================");
  console.log(`🎉 ALL ${totalTests} LAW 51 PURGE OF SCRIPTED TALKS TESTS PASSED (100% GREEN)!`);
  console.log("================================================================================");
}

runAll().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
