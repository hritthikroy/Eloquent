/**
 * Continue Deep Research (Phase 2 Runtime Integration) Verification Suite
 * Validates continue-deep-research directives, STT normalizations,
 * HumanIdentityRecognitionCortex wiring into JarvisManager,
 * ActionRunner telemetry, LocalCognitiveBrain responses, and persona sovereignty invariants.
 */

const assert = require("assert");
const { sanitize } = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");
const humanIdentityRecognitionCortex = require("../src/utils/human-identity-recognition-cortex");

console.log("================================================================================");
console.log("🚀 RUNNING CONTINUE DEEP RESEARCH & RUNTIME INTEGRATION SUITE");
console.log("================================================================================");

let passedCount = 0;

function recordPass(testName) {
  passedCount++;
  console.log(`  ✅ [PASS ${passedCount}] ${testName}`);
}

async function run() {
  const jarvis = new JarvisManager({ userName: "Hritthik" });

  // 1. TextSanitizer normalizes 'continiue with deep resserch' and variants
  const rawQuery = "continiue with deep resserch";
  const sanitizedQuery = sanitize(rawQuery);
  assert.strictEqual(sanitizedQuery, "Continue with deep research");
  assert.ok(!sanitizedQuery.includes("continiue"));
  assert.ok(!sanitizedQuery.includes("resserch"));
  assert.ok(sanitizedQuery.includes("deep research"));
  recordPass("1. TextSanitizer normalizes 'continiue with deep resserch' to clean syntax");

  // 2. IntentParser detects isContinueDeepResearchDirective
  const parsedIntent = IntentParser.parse(sanitizedQuery);
  assert.strictEqual(parsedIntent.intent, INTENTS.SMOOTH_CONVERSATION);
  assert.strictEqual(parsedIntent.target, "continue_deep_research");
  assert.ok(IntentParser.isContinueDeepResearchDirective("continue with deep research"));
  assert.ok(IntentParser.isContinueDeepResearchDirective("proceed with deep research"));
  assert.ok(IntentParser.isContinueDeepResearchDirective("continue the biometric research"));
  assert.ok(IntentParser.isContinueDeepResearchDirective("চালিয়ে যাও ডিপ রিসার্চ"));
  recordPass("2. IntentParser detects continue_deep_research intent across variants");

  // 3. JarvisManager constructor instantiates this.identityCortex
  assert.ok(jarvis.identityCortex, "JarvisManager must instantiate this.identityCortex");
  assert.ok(typeof jarvis.identityCortex.recognizeIdentity === "function" || typeof jarvis.identityCortex.verifyAllEquations === "function");
  recordPass("3. JarvisManager constructor wires HumanIdentityRecognitionCortex");

  // 4. JarvisManager system prompt incorporates Law 21 (Trimodal Identity Recognition)
  const prompt = jarvis.getSystemPrompt({ key: "tuktuk" });
  assert.ok(prompt.includes("TRIMODAL IDENTITY RECOGNITION"), "Prompt must include Rule 21");
  assert.ok(prompt.includes("BAYESIAN POSTERIOR FUSION"), "Prompt must include Bayesian Fusion");
  assert.ok(prompt.includes("IMPOSTER & LIVENESS DETECTION"), "Prompt must include Liveness detection");
  recordPass("4. JarvisManager system prompt embeds Trimodal Identity Recognition & Imposter Law");

  // 5. ActionRunner handles isContinueDeepResearchDirective and sets preferences
  const actionRes = await actionRunner.handleAction(
    "continue with deep research",
    { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural", language: "en" },
    jarvis
  );
  assert.strictEqual(actionRes.handled, true);
  assert.strictEqual(actionRes.action, "continue_deep_research_directive");
  assert.strictEqual(actionRes.data.researchPhase, "PHASE_2_RUNTIME_BIOMETRIC_INTEGRATION");
  assert.strictEqual(actionRes.data.equationsVerified, 6);
  assert.strictEqual(actionRes.data.livenessGate, 0.70);
  assert.strictEqual(actionRes.data.multimodalFusion, true);
  assert.ok(actionRes.speech.includes("babe"));
  recordPass("5. ActionRunner returns structured telemetry and sets Phase 2 runtime integration state");

  // 6. LocalCognitiveBrain Tuk Tuk response (Strictly 'babe')
  const tuktukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "continue with deep research", {}, "en");
  assert.ok(tuktukEn.includes("babe"), "Tuk Tuk English must call user 'babe'");
  assert.ok(!/\bbros?\b/i.test(tuktukEn), "Tuk Tuk English must not call user 'bro'");

  const tuktukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "চালিয়ে যাও ডিপ রিসার্চ", {}, "bn");
  assert.ok(tuktukBn.includes("babe"), "Tuk Tuk Bengali must call user 'babe'");
  assert.ok(!/\bভাই\b/.test(tuktukBn), "Tuk Tuk Bengali must not call user 'ভাই'");
  recordPass("6. LocalCognitiveBrain Tuk Tuk responses adhere to exclusive 'babe' invariant");

  // 7. LocalCognitiveBrain Vision response (Strictly brother/bro/ভাই)
  const visionEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "continue with deep research", {}, "en");
  assert.ok(/\b(?:brother|bro)\b/i.test(visionEn), "Vision English must address user as brother/bro");
  assert.ok(!visionEn.includes("babe"), "Vision English must never call user 'babe'");

  const visionBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "চালিয়ে যাও ডিপ রিসার্চ", {}, "bn");
  assert.ok(/\b(?:ভাই|brother|bro)\b/i.test(visionBn), "Vision Bengali must address user as ভাই/brother");
  assert.ok(!visionBn.includes("babe"), "Vision Bengali must never call user 'babe'");
  recordPass("7. LocalCognitiveBrain Vision responses adhere to brother/bro/ভাই invariant");

  // 8. LocalCognitiveBrain Friday response (Strictly Chief/Hritthik)
  const fridayEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", "continue with deep research", {}, "en");
  assert.ok(/\b(?:Chief|Hritthik)\b/i.test(fridayEn), "Friday English must address user as Chief/Hritthik");
  assert.ok(!fridayEn.includes("babe"), "Friday English must never call user 'babe'");

  const fridayBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", "চালিয়ে যাও ডিপ রিসার্চ", {}, "bn");
  assert.ok(/\b(?:Chief|Hritthik)\b/i.test(fridayBn), "Friday Bengali must address user as Chief/Hritthik");
  assert.ok(!fridayBn.includes("babe"), "Friday Bengali must never call user 'babe'");
  recordPass("8. LocalCognitiveBrain Friday responses adhere to Chief/Hritthik invariant");

  // 9. LocalCognitiveBrain DD response (Strictly bro/ভাই)
  const ddEn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", "continue with deep research", {}, "en");
  assert.ok(/\b(?:bro)\b/i.test(ddEn), "DD English must address user as bro");
  assert.ok(!ddEn.includes("babe"), "DD English must never call user 'babe'");

  const ddBn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", "চালিয়ে যাও ডিপ রিসার্চ", {}, "bn");
  assert.ok(/\b(?:bro|ভাই)\b/i.test(ddBn), "DD Bengali must address user as bro/ভাই");
  assert.ok(!ddBn.includes("babe"), "DD Bengali must never call user 'babe'");
  recordPass("9. LocalCognitiveBrain DD responses adhere to bro/ভাই invariant");

  // 10. LocalCognitiveBrain Team response
  const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "continue with deep research", {}, "en");
  assert.ok(teamEn.includes("[Tuk Tuk]") && teamEn.includes("[Vision]") && teamEn.includes("[Friday]") && teamEn.includes("[DD]"));
  assert.ok(/\bbabe\b/i.test(teamEn), "Team Tuk Tuk section must have 'babe'");
  assert.ok(/\bbrother\b/i.test(teamEn), "Team Vision section must have 'brother'");
  assert.ok(/\bChief\b/i.test(teamEn), "Team Friday section must have 'Chief'");
  assert.ok(/\bbro\b/i.test(teamEn), "Team DD section must have 'bro'");

  const teamBn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "চালিয়ে যাও ডিপ রিসার্চ", {}, "bn");
  assert.ok(teamBn.includes("[Tuk Tuk]") && teamBn.includes("[Vision]") && teamBn.includes("[Friday]") && teamBn.includes("[DD]"));
  recordPass("10. LocalCognitiveBrain Team response maintains squad multi-agent harmony");

  // 11. HumanIdentityRecognitionCortex closed-form verification proof (LHS = RHS = 100%)
  const verificationProof = humanIdentityRecognitionCortex.verifyAllEquations();
  assert.strictEqual(verificationProof.verified, true);
  assert.strictEqual(verificationProof.lhsEqualsRhs, true);
  assert.strictEqual(verificationProof.equations.eq1_voiceVoiceprint.verified, true);
  assert.strictEqual(verificationProof.equations.eq2_faceEigenspace.verified, true);
  assert.strictEqual(verificationProof.equations.eq3_energyPresence.verified, true);
  assert.strictEqual(verificationProof.equations.eq4_trimodalFusion.verified, true);
  assert.strictEqual(verificationProof.equations.eq5_livenessDetection.verified, true);
  assert.strictEqual(verificationProof.equations.eq6_episodicMemory.verified, true);
  recordPass("11. HumanIdentityRecognitionCortex verifies all 6 mathematical equations (LHS ≡ RHS = 100%)");

  console.log("================================================================================");
  console.log(`🎉 ALL ${passedCount} / 11 CONTINUE DEEP RESEARCH TESTS PASSED (100% SUCCESS)`);
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("❌ TEST FAILURE:", err);
  process.exit(1);
});
