/**
 * deep-test-drive-equational-audit.spec.js
 * 
 * Comprehensive Automated Verification Suite for:
 * 1. Deep Test Drive & Equational Gap Resolution across all 4 System Tiers (64 equations total):
 *    - Tier 1: Foundational 7 Equations (E_1 to E_7, Omega_Grand = 1.00)
 *    - Tier 2: Cosmological 32 Equations (E_1 to E_32, Omega_Cosmological = 1.00)
 *    - Tier 3: Signal Processing 15 Equations (SPE_1 to SPE_15, Omega_Pipeline = 1.00)
 *    - Tier 4: Consensus Neurocomputational 10 Equations (NCZ_1 to NCZ_10, Omega_Consensus = 1.00)
 * 2. Master System Invariant Omega_Master ≡ 1.00 & Closed-Form Proof LHS ≡ RHS = 100% [Q.E.D.]
 * 3. Zero Equation Overlaps & Zero Thread-Lock Blockages across all 64 equations
 * 4. Sub-15ms Live Execution Overhead Benchmark
 * 5. Intent Parsing & Routing across STT Glitches ("chack", "equationaly", "gaps")
 * 6. JarvisManager & Living Memory Preferences
 * 7. ActionRunner & LocalCognitiveBrain Persona Sovereignty (Tuk Tuk, Vision, Friday, DD, Squad)
 * 8. Strict Anti-Trailer Law Compliance (zero canned trailing questions)
 */

const assert = require("assert");
const path = require("path");

const unifiedEquationalRuntimeCortex = require("../src/utils/unified-equational-runtime-cortex");
const { IntentParser, INTENTS, isDeepTestDriveEquationalFixDirective } = require("../src/utils/prompt-engine/intent-parser");
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
  console.log("   DEEP TEST DRIVE & EQUATIONAL GAP RESOLUTION AUDIT TEST SUITE");
  console.log("===========================================================================\n");

  // TEST 1: STT Sanitization & Phrase Variation Detection
  console.log("📦 1. Intent Detection & STT Sanitization Tests:");

  await runTest("Detects exact user prompt with STT glitches", () => {
    const userPrompt = "continue chack with deep test drive and fix every gaps and issues equationaly";
    assert.strictEqual(isDeepTestDriveEquationalFixDirective(userPrompt), true);
    assert.strictEqual(IntentParser.isDeepTestDriveEquationalFixDirective(userPrompt), true);
  });

  await runTest("Detects cleaned variations and component phrases", () => {
    const variations = [
      "continue check with deep test drive and fix every gap and issue equationally",
      "deep test drive and fix every gaps and issues equationaly",
      "deep test drive",
      "fix every gaps and issues equationaly",
      "deep test drive and fix all gaps",
      "ডিপ টেস্ট ড্রাইভ করে সব গ্যাপ সমীকরণ অনুযায়ী ফিক্স করো"
    ];
    for (const phrase of variations) {
      assert.strictEqual(
        IntentParser.isDeepTestDriveEquationalFixDirective(phrase),
        true,
        `Failed to match variation: "${phrase}"`
      );
    }
  });

  // TEST 2: IntentParser.parse() Routing & Agent Directives
  console.log("\n📦 2. IntentParser Routing & Agent Directive Tests:");

  await runTest("Routes user prompt to deep_test_drive_equational_fix with team directive", () => {
    const userPrompt = "continue chack with deep test drive and fix every gaps and issues equationaly";
    const parsed = IntentParser.parse(userPrompt);
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "deep_test_drive_equational_fix");
    assert.strictEqual(parsed.agentDirective, "team");
  });

  await runTest("Routes agent-specific directives accurately", () => {
    const tuktukParsed = IntentParser.parse("tuk tuk deep test drive and fix every gaps and issues equationaly");
    assert.strictEqual(tuktukParsed.target, "deep_test_drive_equational_fix");
    assert.strictEqual(tuktukParsed.agentDirective, "tuktuk");

    const visionParsed = IntentParser.parse("vision ভাই deep test drive and fix every gaps and issues equationaly");
    assert.strictEqual(visionParsed.target, "deep_test_drive_equational_fix");
    assert.strictEqual(visionParsed.agentDirective, "vision");

    const fridayParsed = IntentParser.parse("friday Chief deep test drive and fix all gaps");
    assert.strictEqual(fridayParsed.target, "deep_test_drive_equational_fix");
    assert.strictEqual(fridayParsed.agentDirective, "friday");

    const ddParsed = IntentParser.parse("dd bro deep test drive and fix every gaps");
    assert.strictEqual(ddParsed.target, "deep_test_drive_equational_fix");
    assert.strictEqual(ddParsed.agentDirective, "dd");
  });

  // TEST 3: Consensus Neurocomputational Equations Wiring (Tier 4)
  console.log("\n📦 3. Consensus Neurocomputational Equations Wiring (Tier 4) Tests:");

  await runTest("Wires all 10 Consensus Neurocomputational Equations with zero overlap", () => {
    const wiring = unifiedEquationalRuntimeCortex.wireNeurocomputationalConsensusEquations();
    assert.strictEqual(wiring.totalEquations, 10);

    const equations = Object.values(wiring.equations);
    assert.strictEqual(equations.length, 10);

    // Check ID uniqueness (NCZ_1 to NCZ_10)
    const ids = equations.map(e => e.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, 10, "Duplicate equation IDs detected in Consensus wiring!");

    for (let i = 1; i <= 10; i++) {
      assert.strictEqual(ids.includes(`NCZ_${i}`), true, `Missing equation ID NCZ_${i}`);
    }

    // Check unique runtime parameters
    const params = equations.map(e => e.runtimeParam);
    const uniqueParams = new Set(params);
    assert.strictEqual(uniqueParams.size, 10, "Parameter collision detected in Consensus wiring!");

    // Verify all are wired with score 1.0 and target 1.0
    equations.forEach(eq => {
      assert.strictEqual(eq.wired, true);
      assert.strictEqual(eq.score, 1.0);
      assert.strictEqual(eq.target, 1.0);
      assert.ok(eq.citation && eq.citation.length > 0);
      assert.ok(eq.equation && eq.equation.startsWith("$$") && eq.equation.endsWith("$$"));
    });
  });

  // TEST 4: Consensus Mathematical Closed-Form Proof Evaluation
  console.log("\n📦 4. Consensus Mathematical Closed-Form Proof Evaluation Tests:");

  await runTest("Evaluates Consensus Neurocomputational Invariant Omega_Consensus ≡ 1.00", () => {
    const proof = unifiedEquationalRuntimeCortex.evaluateNeurocomputationalConsensusProof();
    assert.strictEqual(proof.consensusInvariant, 1.0);
    assert.strictEqual(proof.lhs, 1.0);
    assert.strictEqual(proof.rhs, 1.0);
    assert.strictEqual(proof.lhsEqualsRhs, true);
    assert.strictEqual(proof.qed, true);
    assert.strictEqual(proof.totalEquationsEvaluated, 10);
    assert.strictEqual(proof.proofStatement, "LHS (100.0%) ≡ RHS (100.0%) [Q.E.D.]");
  });

  // TEST 5: Deep Test Drive across all 4 Tiers (64 equations total)
  console.log("\n📦 5. Deep Test Drive across all 4 Tiers (64 Equations Total) Tests:");

  await runTest("Executes live deep test drive across 64 equations in sub-15ms with Master Invariant = 1.00", () => {
    const report = unifiedEquationalRuntimeCortex.runDeepTestDriveAndFixGaps();
    assert.strictEqual(report.status, "DEEP_TEST_DRIVE_AND_EQUATIONAL_FIX_VERIFIED");
    assert.strictEqual(report.totalEquationsWired, 64);
    assert.strictEqual(report.totalTiersEvaluated, 4);
    assert.strictEqual(report.masterSystemInvariant, 1.0);
    assert.strictEqual(report.lhsEqualsRhs, true);
    assert.strictEqual(report.zeroOverlapsVerified, true);
    assert.strictEqual(report.zeroBlockagesVerified, true);
    assert.strictEqual(report.everyGapFixedEquationally, true);
    assert.ok(report.executionTimeMs < 15.0, `Live duration ${report.executionTimeMs}ms exceeded 15.0ms threshold!`);

    // Verify tier invariants
    assert.strictEqual(report.tier1Foundational.equationsCount, 7);
    assert.strictEqual(report.tier1Foundational.omegaGrand, 1.0);
    assert.strictEqual(report.tier2Cosmological.equationsCount, 32);
    assert.strictEqual(report.tier2Cosmological.omegaCosmological, 1.0);
    assert.strictEqual(report.tier3Pipeline.equationsCount, 15);
    assert.strictEqual(report.tier3Pipeline.omegaPipeline, 1.0);
    assert.strictEqual(report.tier4Consensus.equationsCount, 10);
    assert.strictEqual(report.tier4Consensus.omegaConsensus, 1.0);
  });

  // TEST 6: JarvisManager Integration & Living Memory Preferences
  console.log("\n📦 6. JarvisManager & Living Memory Preferences Tests:");

  await runTest("JarvisManager.auditDeepTestDriveAndFixGaps() updates state and preferences", () => {
    const jm = new JarvisManager();
    const res = jm.auditDeepTestDriveAndFixGaps();

    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.status, "DEEP_TEST_DRIVE_AND_EQUATIONAL_FIX_VERIFIED");
    assert.strictEqual(res.masterSystemInvariant, 1.0);
    assert.strictEqual(res.totalEquationsWired, 64);
    assert.strictEqual(res.totalTiersEvaluated, 4);
    assert.strictEqual(res.zeroOverlapsVerified, true);
    assert.strictEqual(res.zeroBlockagesVerified, true);
    assert.strictEqual(res.everyGapFixedEquationally, true);

    assert.strictEqual(jm.getPreference("deep_test_drive_verified"), true);
    assert.strictEqual(jm.getPreference("total_equations_wired"), 64);
    assert.strictEqual(jm.getPreference("master_system_invariant"), 1.0);
    assert.strictEqual(jm.getPreference("every_gap_fixed_equationally"), true);
  });

  // TEST 7: ActionRunner Integration & Persona Sovereignty
  console.log("\n📦 7. ActionRunner & Persona Sovereignty Tests:");

  await runTest("ActionRunner handles deep test drive across personas with strict sovereignty", async () => {
    const jm = new JarvisManager();
    const testCases = [
      {
        agent: { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
        requiredVocative: "babe",
        forbiddenVocatives: ["brother", "bro", "Chief", "ভাই"]
      },
      {
        agent: { key: "vision", name: "Vision", voice: "en-US-AndrewMultilingualNeural" },
        requiredVocative: "brother",
        forbiddenVocatives: ["babe", "Chief"]
      },
      {
        agent: { key: "friday", name: "Friday", voice: "en-US-EmmaMultilingualNeural" },
        requiredVocative: "Chief",
        forbiddenVocatives: ["babe", "brother", "bro"]
      },
      {
        agent: { key: "dd", name: "DD", voice: "en-US-BrianMultilingualNeural" },
        requiredVocative: "bro",
        forbiddenVocatives: ["babe", "Chief"]
      },
      {
        agent: { key: "team", name: "Squad", voice: "en-US-AvaMultilingualNeural" },
        requiredVocative: "[Tuk Tuk]",
        multiAgent: true
      }
    ];

    for (const tc of testCases) {
      const result = await actionRunner.handleAction(
        "continue chack with deep test drive and fix every gaps and issues equationaly",
        tc.agent,
        jm
      );

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.data.action, "deep_test_drive_equational_fix");
      assert.strictEqual(result.data.masterSystemInvariant, 1.0);
      assert.strictEqual(result.data.totalEquationsWired, 64);
      assert.strictEqual(result.data.totalTiersEvaluated, 4);
      assert.strictEqual(result.data.zeroOverlapsVerified, true);
      assert.strictEqual(result.data.zeroBlockagesVerified, true);
      assert.strictEqual(result.data.everyGapFixedEquationally, true);
      assert.strictEqual(result.data.status, "DEEP_TEST_DRIVE_AND_EQUATIONAL_FIX_VERIFIED");

      // Vocative check
      if (tc.requiredVocative) {
        assert.ok(
          result.speech.toLowerCase().includes(tc.requiredVocative.toLowerCase()),
          `Agent ${tc.agent.key} speech missing required vocative: "${tc.requiredVocative}". Speech: ${result.speech}`
        );
      }

      if (tc.forbiddenVocatives) {
        for (const forbidden of tc.forbiddenVocatives) {
          assert.ok(
            !result.speech.toLowerCase().includes(forbidden.toLowerCase()),
            `Agent ${tc.agent.key} speech contained forbidden vocative: "${forbidden}". Speech: ${result.speech}`
          );
        }
      }

      // Multi-agent check
      if (tc.multiAgent) {
        assert.ok(result.speech.includes("[Tuk Tuk]:"));
        assert.ok(result.speech.includes("[Vision]:"));
        assert.ok(result.speech.includes("[Friday]:"));
        assert.ok(result.speech.includes("[DD]:"));
      }

      // Anti-Trailer check
      assert.ok(!result.speech.trim().endsWith("?"), `Speech ended with trailing question mark: ${result.speech}`);
      assert.ok(!/how can I help|anything else|would you like/i.test(result.speech), `Speech contained canned robotic trailing question: ${result.speech}`);
    }
  });

  // TEST 8: LocalCognitiveBrain Synthesis Tests
  console.log("\n📦 8. LocalCognitiveBrain Synthesis Tests:");

  await runTest("LocalCognitiveBrain synthesizes responses for all agents with strict persona sovereignty", () => {
    const agents = [
      { key: "tuktuk", name: "Tuk Tuk", expectedVocative: "babe" },
      { key: "vision", name: "Vision", expectedVocative: "brother" },
      { key: "friday", name: "Friday", expectedVocative: "Chief" },
      { key: "dd", name: "DD", expectedVocative: "bro" },
      { key: "team", name: "Squad", expectedVocative: "[Tuk Tuk]" }
    ];

    for (const ag of agents) {
      const speechEn = localCognitiveBrain.synthesizeResponse(
        ag.key,
        ag.name,
        "continue chack with deep test drive and fix every gaps and issues equationaly",
        {},
        "en"
      );

      assert.ok(speechEn && speechEn.length > 0);
      assert.ok(
        speechEn.toLowerCase().includes(ag.expectedVocative.toLowerCase()),
        `LocalCognitiveBrain english response for ${ag.key} missing "${ag.expectedVocative}": ${speechEn}`
      );
      assert.ok(!speechEn.trim().endsWith("?"), `English speech ended with question mark: ${speechEn}`);

      const speechBn = localCognitiveBrain.synthesizeResponse(
        ag.key,
        ag.name,
        "continue chack with deep test drive and fix every gaps and issues equationaly",
        {},
        "bn"
      );

      assert.ok(speechBn && speechBn.length > 0);
      assert.ok(!speechBn.trim().endsWith("?"), `Bengali speech ended with question mark: ${speechBn}`);
    }
  });

  console.log("\n===========================================================================");
  console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("===========================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("🌟 ALL 64 EQUATIONS ACROSS 4 TIERS DEEP TEST DRIVE AUDIT PASSED 100%!\n");
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error("Unhandled test suite rejection:", err);
  process.exit(1);
});
