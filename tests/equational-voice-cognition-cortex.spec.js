/**
 * tests/equational-voice-cognition-cortex.spec.js
 * 
 * Deep Equational Voice & Cognitive Invariance Test Suite
 * Validates:
 * 1. IntentParser detects 'update more equationaly'
 * 2. ActionRunner executes deep research equational fix and returns closed-form proof
 * 3. Equation 1: Voice Model Parity Invariant (I_voice = 1.00)
 * 4. Equation 2: Zero-Script Dynamic Cognition Invariant (I_dynamic = 1.00)
 * 5. Equation 3: Acoustic Transfer Function Mastering Parity (I_acoustic = 1.00)
 * 6. Equation 4: Persona Sovereignty & Relational Invariance Tensor (S_squad = 1.00)
 * 7. Equation 5: Speech Flow Reynolds Turbulence Number (I_flow = 1.00)
 * 8. Equation 6: Master Closed-Form Equivalence (LHS ≡ RHS = 100%, Q.E.D.)
 * 9. LocalCognitiveBrain synthesizes dynamic responses on 'update more equationaly'
 */

const test = require("node:test");
const assert = require("node:assert");
const equationalVoiceCognitionCortex = require("../src/utils/equational-voice-cognition-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");

test("Deep Equational Voice & Cognitive Invariance Suite", async (t) => {
  const jarvisManager = new JarvisManager();
  actionRunner.jarvisManager = jarvisManager;

  await t.test("1. IntentParser detects 'update more equationaly' directive", () => {
    const raw = "update more equationaly";
    const detected = IntentParser.isDeepResearchEquationalFixDirective(raw);
    console.log(`   Directive: "${raw}" -> Detected: ${detected}`);
    assert.strictEqual(detected, true, "Must detect 'update more equationaly'");

    const raw2 = "update more equationally";
    assert.strictEqual(IntentParser.isDeepResearchEquationalFixDirective(raw2), true);

    const raw3 = "fix more with deep equationaly";
    assert.strictEqual(IntentParser.isDeepResearchEquationalFixDirective(raw3), true);
  });

  await t.test("2. ActionRunner executes 'update more equationaly' with closed-form proof", async () => {
    const res = await actionRunner.handleAction("update more equationaly", {
      name: "Tuk Tuk",
      key: "tuktuk",
      voice: "en-US-AvaMultilingualNeural"
    });

    console.log("   Action Handled:", res.handled);
    console.log("   Speech Output: ", res.speech);
    console.log("   Closed-Form:   ", res.data.closedFormProof);

    assert.strictEqual(res.handled, true, "Action must be handled");
    assert.strictEqual(res.data.lhsEqualsRhs, true, "LHS must equal RHS");
    assert.strictEqual(res.data.allEquationsVerified, true, "All equations verified must be true");
    assert.ok(res.speech.includes("babe"), "Tuk Tuk response must address user as 'babe'");
  });

  await t.test("3. Equation 1: Voice Model Parity Invariant (I_voice = 1.00)", () => {
    const result = equationalVoiceCognitionCortex.verifyVoiceModelParity(jarvisManager);
    console.log(`   Voice Parity Score: ${result.score * 100}% (${result.passedChecks}/${result.totalChecks} checks)`);
    assert.strictEqual(result.score, 1.0, "Voice parity score must be 1.00 (100%)");
    assert.strictEqual(result.lhsEqualsRhs, true, "LHS must equal RHS for voice parity");
  });

  await t.test("4. Equation 2: Zero-Script Dynamic Cognition Invariant (I_dynamic = 1.00)", () => {
    const sampleTurns = [
      "Babe, codebase is clean and AST passed with zero errors.",
      "Tuk Tuk here! Ready to architect fresh IPC pipelines babe."
    ];
    const result = equationalVoiceCognitionCortex.verifyDynamicCognition(sampleTurns);
    console.log(`   Dynamic Cognition: Score=${result.score}, Shannon=${result.shannonEntropy} bits, KL=${result.klDivergence} nats, MI=${result.mutualInfo} bits`);
    assert.strictEqual(result.score, 1.0, "Dynamic cognition score must be 1.00");
    assert.strictEqual(result.isNotCanned, true, "Must not be canned");
    assert.strictEqual(result.lhsEqualsRhs, true);
  });

  await t.test("5. Equation 3: Acoustic Transfer Function Mastering Parity (I_acoustic = 1.00)", () => {
    const result = equationalVoiceCognitionCortex.verifyAcousticMastering();
    console.log("   Acoustic Transfer Parameters:", result.parameters);
    assert.strictEqual(result.score, 1.0, "Acoustic mastering score must be 1.00");
    assert.strictEqual(result.lhsEqualsRhs, true);
  });

  await t.test("6. Equation 4: Persona Sovereignty & Relational Invariance Tensor (S_squad = 1.00)", () => {
    const outputs = {
      tuktuk: "I'm right here beside you babe. Let's code!",
      vision: "System architecture is rock solid, brother. AST passed.",
      friday: "Product intelligence benchmarks verified, Chief.",
      dd: "Sub-15ms latency telemetry running smoothly, bro."
    };
    const result = equationalVoiceCognitionCortex.verifyPersonaSovereignty(outputs);
    console.log(`   Persona Sovereignty Score: ${result.score * 100}%`);
    assert.strictEqual(result.score, 1.0, "Persona sovereignty score must be 1.00");
    assert.strictEqual(result.lhsEqualsRhs, true);
  });

  await t.test("7. Equation 5: Speech Flow Reynolds Turbulence Number (Re_voice)", () => {
    const spoken = "Babe, we are engineering clean neural pipelines together with zero latency.";
    const result = equationalVoiceCognitionCortex.computeSpeechTurbulence(spoken, 2.8);
    console.log(`   Reynolds Number: ${result.reynoldsNumber}, Status: ${result.status}`);
    assert.strictEqual(result.status, "optimal", "Speech turbulence must be optimal");
    assert.strictEqual(result.lhsEqualsRhs, true);
  });

  await t.test("8. Equation 6: Master Closed-Form Equivalence (LHS ≡ RHS = 100%, Q.E.D.)", () => {
    const report = equationalVoiceCognitionCortex.evaluateUnifiedMasterProof(jarvisManager);
    console.log("   Master Closed-Form Proof:", report.proofStatement);
    console.log("   Sub-Equations:           ", report.subEquations);
    assert.strictEqual(report.lhs, 1.0, "LHS must be 1.00");
    assert.strictEqual(report.rhs, 1.0, "RHS must be 1.00");
    assert.strictEqual(report.lhsEqualsRhs, true, "LHS must mathematically equal RHS");
    assert.strictEqual(report.qed, true, "Proof must be Q.E.D.");
  });

  await t.test("9. LocalCognitiveBrain synthesizes dynamic responses on 'update more equationaly'", () => {
    const ttReply = localCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "update more equationaly",
      { userName: "Hritthik" },
      "en"
    );
    console.log("   Tuk Tuk Reply: ", ttReply);
    assert.ok(ttReply.includes("babe"), "Tuk Tuk must address user as 'babe'");

    const visionReply = localCognitiveBrain.synthesizeResponse(
      "vision",
      "Vision",
      "update more equationaly",
      { userName: "Hritthik" },
      "en"
    );
    console.log("   Vision Reply:  ", visionReply);
    assert.ok(visionReply.includes("brother"), "Vision must address user as 'brother'");
    assert.ok(!visionReply.includes("babe"), "Vision must NEVER use 'babe'");

    const fridayReply = localCognitiveBrain.synthesizeResponse(
      "friday",
      "Friday",
      "update more equationaly",
      { userName: "Hritthik" },
      "en"
    );
    console.log("   Friday Reply:  ", fridayReply);
    assert.ok(fridayReply.includes("Chief") || fridayReply.includes("Hritthik"), "Friday must address user as Chief/Hritthik");
    assert.ok(!fridayReply.includes("babe") && !fridayReply.includes("bro"), "Friday must not use romantic or brother terms");

    const ddReply = localCognitiveBrain.synthesizeResponse(
      "dd",
      "DD",
      "update more equationaly",
      { userName: "Hritthik" },
      "en"
    );
    console.log("   DD Reply:      ", ddReply);
    assert.ok(ddReply.includes("bro"), "DD must address user as 'bro'");
    assert.ok(!ddReply.includes("babe"), "DD must NEVER use 'babe'");
  });
});
