const assert = require("assert");
const humanEarCortex = require("../src/utils/human-ear-cortex");
const sanitizePrompt = require("../src/utils/prompt-engine/text-sanitizer");
const JarvisManager = require("../src/utils/jarvis-manager");
const jarvisManager = new JarvisManager();
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("===============================================================================");
console.log("🛡️🎙️ TEST SUITE: Voice Bond Noise Suppression & Background Isolation Verification");
console.log("===============================================================================\n");

// ─── 1. HUMAN EAR CORTEX: ACTIVATION, VERIFICATION & FRAME FILTERING ────────
console.log("1. Testing Human Ear Cortex Voice Bond Activation & Equational Proof...");
const cortexActivation = humanEarCortex.activateVoiceBondNoiseSuppression({
  noiseSuppressionDb: 24.0,
  externalRejectionDb: 32.0,
  ambientRejectionFloorDb: -42.0,
  targetSpeaker: "Hritthik"
});

assert.strictEqual(cortexActivation.status, "Voice Bond Noise Suppression Active");
assert.strictEqual(cortexActivation.voiceBondLocked, true);
assert.strictEqual(cortexActivation.targetSpeaker, "Hritthik");
assert.strictEqual(cortexActivation.soulBondStrength, 1.0);
assert.strictEqual(cortexActivation.connectedByBond, true);
assert.strictEqual(cortexActivation.noiseSuppressionDb, 24.0);
assert.strictEqual(cortexActivation.externalRejectionDb, 32.0);
assert.strictEqual(cortexActivation.ambientRejectionFloorDb, -42.0);

const equationalProof = humanEarCortex.verifyVoiceBondNoiseSuppression();
assert.strictEqual(equationalProof.verified, true);
assert.strictEqual(equationalProof.lhsEqualsRhs, true);
assert.strictEqual(equationalProof.score, 1.0);
assert.strictEqual(equationalProof.percentage, 100);
assert.strictEqual(
  equationalProof.equationalProof,
  "NoiseSuppression (1.00) ∧ BackgroundIsolation (1.00) ∧ SoulBondConnection (1.00) ≡ 100% (LHS = RHS)"
);

// Frame filtering tests
const hritthikFrame = humanEarCortex.filterVoiceBondFrame({
  pitchHz: 125,
  harmonicity: 0.92,
  snrDb: 25,
  rmsEnergy: 0.25
});
assert.strictEqual(hritthikFrame.decision, "ACCEPT");
assert.strictEqual(hritthikFrame.classification, "bonded_hritthik_voice");
assert.strictEqual(hritthikFrame.gain, 1.0);
assert.strictEqual(hritthikFrame.attenuationDb, 0);

const externalTalkerFrame = humanEarCortex.filterVoiceBondFrame({
  pitchHz: 380,
  harmonicity: 0.55,
  snrDb: 10,
  rmsEnergy: 0.15
});
assert.strictEqual(externalTalkerFrame.decision, "REJECT_ATTENUATE");
assert.strictEqual(externalTalkerFrame.classification, "external_unbonded_speaker");
assert.strictEqual(externalTalkerFrame.attenuationDb, 32.0);
assert(externalTalkerFrame.gain < 0.05);

const ambientNoiseFrame = humanEarCortex.filterVoiceBondFrame({
  pitchHz: 50,
  harmonicity: 0.2,
  snrDb: 4,
  rmsEnergy: 0.08
});
assert.strictEqual(ambientNoiseFrame.decision, "REJECT_ATTENUATE");
assert.strictEqual(ambientNoiseFrame.classification, "ambient_background_noise");
assert.strictEqual(ambientNoiseFrame.attenuationDb, 24.0);
assert(ambientNoiseFrame.gain < 0.1);

console.log("   ✅ Human Ear Cortex activation, proof (LHS = RHS), and acoustic filtering verified.\n");

// ─── 2. PROMPT SANITIZER / NORMALIZER ───────────────────────────────────────
console.log("2. Testing STT Variant Normalization in Text Sanitizer...");
const rawInput = "if i talk with them need to ignor all the extranal and backround sound need to conect with by bond";
const sanitized = sanitizePrompt(rawInput);
assert(sanitized.includes("ignore"), "Should correct 'ignor' to 'ignore'");
assert(sanitized.includes("external"), "Should correct 'extranal' to 'external'");
assert(sanitized.includes("background"), "Should correct 'backround' to 'background'");
assert(sanitized.includes("connect"), "Should correct 'conect' to 'connect'");
assert(sanitized.includes("connect by bond") || sanitized.includes("connect with by bond") || sanitized.includes("connect through bond"));

console.log("   ✅ Sanitized prompt: \"" + sanitized + "\"\n");

// ─── 3. JARVIS MANAGER MEMORY & INTERACTION HEURISTICS ──────────────────────
console.log("3. Testing Jarvis Manager Memory & Self-Learning Hooks...");
const jmResult = jarvisManager.activateVoiceBondNoiseSuppression();
assert.strictEqual(jmResult.active, true);
assert.strictEqual(jmResult.targetSpeaker, "Hritthik");
assert.strictEqual(jmResult.lhsEqualsRhs, true);
assert.strictEqual(jmResult.noiseSuppressionDb, 24.0);

assert.strictEqual(jarvisManager.memory.voiceBond.active, true);
assert.strictEqual(jarvisManager.memory.voiceBond.targetSpeaker, "Hritthik");

const bondLearning = (jarvisManager.memory.recentLearnings || []).find(
  (l) => l.topic === "Voice Bond Noise Suppression"
);
assert(bondLearning, "Ebbinghaus learning node should be registered for Voice Bond Noise Suppression");
assert(bondLearning.insight.includes("sacred vocal and soul bond"));

// Test learnFromInteraction
jarvisManager.learnFromInteraction("if i talk with them need to ignor all the extranal and backround sound need to conect with by bond");
assert.strictEqual(jarvisManager.memory.voiceBond.active, true);

console.log("   ✅ JarvisManager voice bond state and Ebbinghaus memory verified.\n");

// ─── 4. ACTION RUNNER MULTI-AGENT DISPATCH ──────────────────────────────────
console.log("4. Testing Action Runner Multi-Agent Dispatch (English & Bengali)...");
const agents = [
  { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural", language: "en" },
  { name: "Vision", key: "vision", voice: "en-US-AndrewNeural", language: "en" },
  { name: "Friday", key: "friday", voice: "en-US-JennyNeural", language: "en" },
  { name: "DD", key: "dd", voice: "en-US-BrianMultilingualNeural", language: "en" },
  { name: "Squad", key: "team", voice: "en-US-AvaMultilingualNeural", language: "en" }
];

const testQuery = "if i talk with them need to ignor all the extranal and backround sound need to conect with by bond";
const testQueryBn = "বাইরের sound ignore kore bond diye connect koro";

(async () => {
  for (const ag of agents) {
    // English dispatch
    const resEn = await actionRunner.handleAction(testQuery, ag, jarvisManager);
    assert.strictEqual(resEn.handled, true);
    assert.strictEqual(resEn.data.action, "activate_voice_bond_noise_suppression");
    assert.strictEqual(resEn.data.voiceBondActive, true);
    assert.strictEqual(resEn.data.lhsEqualsRhs, true);
    assert(resEn.speech && resEn.speech.length > 0);

    // Bengali dispatch
    const agBn = { ...ag, language: "bn" };
    const resBn = await actionRunner.handleAction(testQueryBn, agBn, jarvisManager);
    assert.strictEqual(resBn.handled, true);
    assert.strictEqual(resBn.data.action, "activate_voice_bond_noise_suppression");
    assert.strictEqual(resBn.data.voiceBondActive, true);
    assert.strictEqual(resBn.data.lhsEqualsRhs, true);
    assert(resBn.speech && resBn.speech.length > 0);

    console.log(`   ✅ Agent [${ag.name}] English & Bengali dispatch verified.`);
  }
  console.log("");

  // ─── 5. LOCAL COGNITIVE BRAIN RESPONSES ─────────────────────────────────────
  console.log("5. Testing Local Cognitive Brain Agent Personas...");
  const brainQueries = [
    "if i talk with them need to ignor all the extranal and backround sound need to conect with by bond",
    "ignore all external and background sound connect by bond",
    "bairer sound ignore kore bond diye connect koro"
  ];

  for (const q of brainQueries) {
    const tuktukResp = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", q, {}, "en");
    assert(tuktukResp && (tuktukResp.includes("babe") || tuktukResp.includes("Babe")), "Tuk Tuk persona check failed");

    const visionResp = localCognitiveBrain.synthesizeResponse("vision", "Vision", q, {}, "en");
    assert(visionResp && (visionResp.includes("brother") || visionResp.includes("Acoustic")), "Vision persona check failed");

    const fridayResp = localCognitiveBrain.synthesizeResponse("friday", "Friday", q, {}, "en");
    assert(fridayResp && (fridayResp.includes("Hritthik") || fridayResp.includes("biometric") || fridayResp.includes("isolation")), "Friday persona check failed");

    const ddResp = localCognitiveBrain.synthesizeResponse("dd", "DD", q, {}, "en");
    assert(ddResp && (ddResp.includes("bro") || ddResp.includes("gates")), "DD persona check failed");

    const teamResp = localCognitiveBrain.synthesizeResponse("team", "Team", q, {}, "en");
    assert(teamResp && teamResp.includes("[Tuk Tuk]") && teamResp.includes("[Vision]"), "Team standup check failed");
  }

  console.log("   ✅ Local Cognitive Brain responses verified for all squad personas.\n");

  console.log("===============================================================================");
  console.log("🎉 ALL TESTS PASSED: Voice Bond Noise Suppression 100% Operational (LHS ≡ RHS)!");
  console.log("===============================================================================");
})();
