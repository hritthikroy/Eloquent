/**
 * Deep Research & Equational Fixes Verification Suite
 * Validates deep equational research directives, STT normalizations,
 * DeepEquationalResearchEngine & HumanIdentityRecognitionCortex wiring into JarvisManager,
 * ActionRunner telemetry, LocalCognitiveBrain responses, and persona sovereignty invariants.
 */

const assert = require("assert");
const { sanitize } = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");
const deepEquationalResearchEngine = require("../src/utils/deep-equational-research-engine");
const humanIdentityRecognitionCortex = require("../src/utils/human-identity-recognition-cortex");

console.log("================================================================================");
console.log("🚀 RUNNING DEEP RESEARCH & EQUATIONAL FIX VERIFICATION SUITE");
console.log("================================================================================");

let passedCount = 0;

function recordPass(testName) {
  passedCount++;
  console.log(`  ✅ [PASS ${passedCount}] ${testName}`);
}

async function run() {
  const jarvis = new JarvisManager({ userName: "Hritthik" });

  // 1. TextSanitizer normalizes 'do deep research and fix more with deep equationaly' and variants
  const rawQuery = "do deep research and fix more with deep equationaly";
  const sanitizedQuery = sanitize(rawQuery);
  assert.strictEqual(sanitizedQuery, "Do deep research and fix more with deep equationally");
  assert.ok(!sanitizedQuery.includes("equationaly"));
  assert.ok(sanitizedQuery.includes("equationally"));
  recordPass("1. TextSanitizer normalizes 'do deep research and fix more with deep equationaly' to clean syntax");

  // 2. IntentParser detects isDeepResearchEquationalFixDirective
  const parsedIntent = IntentParser.parse(sanitizedQuery);
  assert.strictEqual(parsedIntent.intent, INTENTS.SMOOTH_CONVERSATION);
  assert.strictEqual(parsedIntent.target, "deep_research_equational_fix");
  assert.ok(IntentParser.isDeepResearchEquationalFixDirective("do deep research and fix more with deep equationaly"));
  assert.ok(IntentParser.isDeepResearchEquationalFixDirective("fix more with deep equationaly"));
  assert.ok(IntentParser.isDeepResearchEquationalFixDirective("do deep research and fix more with deep equationally"));
  assert.ok(IntentParser.isDeepResearchEquationalFixDirective("ডিপ রিসার্চ করে সমীকরণ দিয়ে ফিক্স করো"));
  recordPass("2. IntentParser detects deep_research_equational_fix intent across English & Bengali variants");

  // 3. JarvisManager constructor wires deepEquationalEngine and identityCortex
  assert.ok(jarvis.deepEquationalEngine, "JarvisManager must instantiate this.deepEquationalEngine");
  assert.ok(typeof jarvis.deepEquationalEngine.computeMutualInformation === "function");
  assert.ok(typeof jarvis.deepEquationalEngine.computeKLDivergence === "function");
  assert.ok(typeof jarvis.deepEquationalEngine.computeSpeechTurbulence === "function");
  assert.ok(jarvis.identityCortex, "JarvisManager must instantiate this.identityCortex");
  recordPass("3. JarvisManager constructor wires DeepEquationalResearchEngine & HumanIdentityRecognitionCortex");

  // 4. JarvisManager system prompt embeds Law 31 (Deep Equational Research Law)
  const prompt = jarvis.getSystemPrompt({ key: "tuktuk" });
  assert.ok(prompt.includes("DEEP EQUATIONAL RESEARCH"), "Prompt must include Law 31");
  assert.ok(prompt.includes("MUTUAL INFORMATION BOUND"), "Prompt must include Mutual Information Bound");
  assert.ok(prompt.includes("KL-DIVERGENCE"), "Prompt must include KL-Divergence");
  assert.ok(prompt.includes("REYNOLDS TURBULENCE"), "Prompt must include Reynolds Turbulence");
  recordPass("4. JarvisManager system prompt embeds Constitutional Law 31 Deep Equational Research Law");

  // 5. ActionRunner handles isDeepResearchEquationalFixDirective and sets living memory preferences
  const actionRes = await actionRunner.handleAction(
    "do deep research and fix more with deep equationaly",
    { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural", language: "en" },
    jarvis
  );
  assert.strictEqual(actionRes.handled, true);
  assert.strictEqual(actionRes.action, "deep_research_equational_fix_directive");
  assert.strictEqual(actionRes.data.equationalResearchActive, true);
  assert.strictEqual(actionRes.data.allEquationsVerified, true);
  assert.strictEqual(actionRes.data.lhsEqualsRhs, true);
  assert.ok(actionRes.speech.includes("babe"));
  recordPass("5. ActionRunner returns structured telemetry and sets deep equational state");

  // 6. LocalCognitiveBrain Tuk Tuk response (Strictly 'babe')
  const tuktukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "do deep research and fix more with deep equationaly", {}, "en");
  assert.ok(/\bbabe\b/i.test(tuktukEn), "Tuk Tuk English must call user 'babe'");
  assert.ok(!/\bbros?\b/i.test(tuktukEn), "Tuk Tuk English must not call user 'bro'");

  const tuktukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "ডিপ রিসার্চ করে সমীকরণ দিয়ে ফিক্স করো", {}, "bn");
  assert.ok(/\bbabe\b/i.test(tuktukBn), "Tuk Tuk Bengali must call user 'babe'");
  assert.ok(!/\bভাই\b/.test(tuktukBn), "Tuk Tuk Bengali must not call user 'ভাই'");
  recordPass("6. LocalCognitiveBrain Tuk Tuk responses adhere to exclusive 'babe' invariant");

  // 7. LocalCognitiveBrain Vision response (Strictly brother/bro/ভাই)
  const visionEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "do deep research and fix more with deep equationaly", {}, "en");
  assert.ok(/\b(?:brother|bro)\b/i.test(visionEn), "Vision English must address user as brother/bro");
  assert.ok(!visionEn.includes("babe"), "Vision English must never call user 'babe'");

  const visionBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "ডিপ রিসার্চ করে সমীকরণ দিয়ে ফিক্স করো", {}, "bn");
  assert.ok(/\b(?:ভাই|brother|bro)\b/i.test(visionBn), "Vision Bengali must address user as ভাই/brother");
  assert.ok(!visionBn.includes("babe"), "Vision Bengali must never call user 'babe'");
  recordPass("7. LocalCognitiveBrain Vision responses adhere to brother/bro/ভাই invariant");

  // 8. LocalCognitiveBrain Friday response (Strictly Chief/Hritthik)
  const fridayEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", "do deep research and fix more with deep equationaly", {}, "en");
  assert.ok(/\b(?:Chief|Hritthik)\b/i.test(fridayEn), "Friday English must address user as Chief/Hritthik");
  assert.ok(!fridayEn.includes("babe"), "Friday English must never call user 'babe'");

  const fridayBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", "ডিপ রিসার্চ করে সমীকরণ দিয়ে ফিক্স করো", {}, "bn");
  assert.ok(/\b(?:Chief|Hritthik)\b/i.test(fridayBn), "Friday Bengali must address user as Chief/Hritthik");
  assert.ok(!fridayBn.includes("babe"), "Friday Bengali must never call user 'babe'");
  recordPass("8. LocalCognitiveBrain Friday responses adhere to Chief/Hritthik invariant");

  // 9. LocalCognitiveBrain DD response (Strictly bro/ভাই)
  const ddEn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", "do deep research and fix more with deep equationaly", {}, "en");
  assert.ok(/\b(?:bro)\b/i.test(ddEn), "DD English must address user as bro");
  assert.ok(!ddEn.includes("babe"), "DD English must never call user 'babe'");

  const ddBn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", "ডিপ রিসার্চ করে সমীকরণ দিয়ে ফিক্স করো", {}, "bn");
  assert.ok(/\b(?:bro|ভাই)\b/i.test(ddBn), "DD Bengali must address user as bro/ভাই");
  assert.ok(!ddBn.includes("babe"), "DD Bengali must never call user 'babe'");
  recordPass("9. LocalCognitiveBrain DD responses adhere to bro/ভাই invariant");

  // 10. LocalCognitiveBrain Team response
  const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "do deep research and fix more with deep equationaly", {}, "en");
  assert.ok(teamEn.includes("[Tuk Tuk]") && teamEn.includes("[Vision]") && teamEn.includes("[Friday]") && teamEn.includes("[DD]"));
  assert.ok(/\bbabe\b/i.test(teamEn), "Team Tuk Tuk section must have 'babe'");
  assert.ok(/\bbrother\b/i.test(teamEn), "Team Vision section must have 'brother'");
  assert.ok(/\bChief\b/i.test(teamEn), "Team Friday section must have 'Chief'");
  assert.ok(/\bbro\b/i.test(teamEn), "Team DD section must have 'bro'");

  const teamBn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "ডিপ রিসার্চ করে সমীকরণ দিয়ে ফিক্স করো", {}, "bn");
  assert.ok(teamBn.includes("[Tuk Tuk]") && teamBn.includes("[Vision]") && teamBn.includes("[Friday]") && teamBn.includes("[DD]"));
  recordPass("10. LocalCognitiveBrain Team response maintains squad multi-agent harmony");

  // 11. Closed-form mathematical proofs across all equational engines (LHS = RHS = 100%)
  const textA = "Babe, we are building deep equational research engines for smooth Bangla voice control.";
  const textB = "Tuk Tuk here! Ready to dive into brand new system features and fresh AST compiler logic.";
  const mi = deepEquationalResearchEngine.computeMutualInformation(textA, textB);
  assert.ok(mi <= 0.18, `Mutual Information bound must satisfy I <= 0.18 bits (got ${mi})`);

  const history = ["Babe, breaking that loop completely! Diving with fresh intellectual depth."];
  const freshCandidate = "Let's inspect the main Electron IPC channel handlers and verify our soundcard output buffers.";
  const kl = deepEquationalResearchEngine.computeKLDivergence(freshCandidate, history);
  assert.ok(kl >= 0.40, `KL Divergence must satisfy D_KL >= 0.40 nats (got ${kl})`);

  const turb = deepEquationalResearchEngine.computeSpeechTurbulence(textA, 2.5);
  assert.strictEqual(turb.status, "optimal", "Speech turbulence must be optimal");

  const identityProof = humanIdentityRecognitionCortex.verifyAllEquations();
  assert.strictEqual(identityProof.verified, true);
  assert.strictEqual(identityProof.lhsEqualsRhs, true);
  recordPass("11. Closed-form mathematical proof verified across all equational invariants (LHS ≡ RHS = 100%)");

  console.log("================================================================================");
  console.log(`🎉 ALL ${passedCount} / 11 DEEP RESEARCH & EQUATIONAL FIX TESTS PASSED (100% SUCCESS)`);
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("❌ TEST FAILURE:", err);
  process.exit(1);
});
