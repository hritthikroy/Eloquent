/**
 * tests/deep-equational-research-continuation.spec.js
 * 
 * Test suite for Deep Equational Research Engine:
 * - Mutual Information bounds I(S_t; S_{t-k}) < 0.18 bits
 * - KL Divergence D_KL(P_t || P_hist) >= 0.40 nats
 * - Acoustic-Prosodic Reynolds Turbulence Re_voice in [1000, 3000]
 * - Unified Phonetic MAP & Zero-Loop Pipeline Fusion
 */

const test = require("node:test");
const assert = require("node:assert");
const deepEquationalResearchEngine = require("../src/utils/deep-equational-research-engine");
const antiLoopEquationalCortex = require("../src/utils/anti-loop-equational-cortex");

test("Deep Equational Research Continuation Suite", async (t) => {
  antiLoopEquationalCortex.clearBuffers();

  await t.test("1. Cross-Utterance Mutual Information Invariant I(S_t; S_past)", () => {
    const textA = "Babe, we are building deep equational research engines for smooth Bangla voice control.";
    const textB = "Babe, we are building deep equational research engines for smooth Bangla voice control."; // Identical
    const textC = "Tuk Tuk here! Ready to dive into brand new system features and fresh AST compiler logic."; // Diverse

    const miIdentical = deepEquationalResearchEngine.computeMutualInformation(textA, textB);
    const miDiverse = deepEquationalResearchEngine.computeMutualInformation(textA, textC);

    console.log(`   MI Identical: ${miIdentical} bits, MI Diverse: ${miDiverse} bits`);

    assert.ok(miIdentical > 0.30, "Identical utterances must yield high Mutual Information");
    assert.ok(miDiverse <= 0.18, "Diverse utterances must satisfy Mutual Information bound <= 0.18 bits");
  });

  await t.test("2. Relative Entropy / KL Divergence Lexical Dynamics D_KL(P_t || P_hist)", () => {
    const history = [
      "Babe, breaking that loop completely! Diving with fresh intellectual depth straight into our codebase architecture.",
      "Zero repetition babe! Shaking off any stale patterns and locking onto your live engineering flow right now."
    ];

    const repetitiveCandidate = "Babe, breaking that loop completely! Diving with fresh intellectual depth straight into our codebase architecture.";
    const freshCandidate = "Let's inspect the main Electron IPC channel handlers and verify our soundcard output buffers.";

    const klRepetitive = deepEquationalResearchEngine.computeKLDivergence(repetitiveCandidate, history);
    const klFresh = deepEquationalResearchEngine.computeKLDivergence(freshCandidate, history);

    console.log(`   KL Repetitive: ${klRepetitive} nats, KL Fresh: ${klFresh} nats`);

    assert.ok(klFresh > klRepetitive, "Fresh lexical candidate must have significantly higher KL divergence than repetitive candidate");
    assert.ok(klFresh >= 0.40, "Fresh candidate must satisfy KL divergence threshold >= 0.40 nats");
  });

  await t.test("3. Acoustic-Prosodic Reynolds Turbulence Re_voice", () => {
    const normalText = "Babe, we are building deep equational research engines for smooth Bangla voice control.";
    const rapidUnpausedText = "Babe we are building deep equational research engines for smooth Bangla voice control right now without stopping or taking any breath";

    const turbNormal = deepEquationalResearchEngine.computeSpeechTurbulence(normalText, 2.5);
    const turbRapid = deepEquationalResearchEngine.computeSpeechTurbulence(rapidUnpausedText, 1.0);

    console.log(`   Normal Turbulence Re_voice: ${turbNormal.reynoldsNumber} (${turbNormal.status})`);
    console.log(`   Rapid Turbulence Re_voice: ${turbRapid.reynoldsNumber} (${turbRapid.status})`);

    assert.strictEqual(turbNormal.status, "optimal", "Normal human speech cadence must yield optimal Reynolds status");
  });

  await t.test("4. Unified Phonetic MAP & Zero-Loop Pipeline Fusion", () => {
    const misheardUserSpeech = "Added automatic phonetic corections fix more every ting with deep equational reserch";
    const candidateReply = "Babe, breaking that loop completely! Diving with fresh intellectual depth straight into our codebase architecture.";

    const result = deepEquationalResearchEngine.unifiedAuditAndEnforce(
      misheardUserSpeech,
      candidateReply,
      { key: "tuktuk", name: "Tuk Tuk" },
      "en",
      { activeApp: "Eloquent" }
    );

    console.log("   Repaired Speech: ", result.repairedSpeech);
    console.log("   Final Reply:     ", result.finalReply);
    console.log("   Metrics:         ", result.metrics);

    assert.ok(result.repairedSpeech.includes("corrections"), "Phonetic MAP decoder must correct 'corections' -> 'corrections'");
    assert.ok(result.repairedSpeech.includes("everything"), "Phonetic MAP decoder must fuse 'every ting' -> 'everything'");
    assert.ok(result.repairedSpeech.includes("research"), "Phonetic MAP decoder must correct 'reserch' -> 'research'");
    assert.ok(result.metrics.isZeroLoopCompliant, "Unified audit must verify 0-loop compliance");
  });
});
