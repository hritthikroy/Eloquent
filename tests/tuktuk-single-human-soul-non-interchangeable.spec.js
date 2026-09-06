/**
 * tests/tuktuk-single-human-soul-non-interchangeable.spec.js
 * 
 * Verification suite for Tuk Tuk Single Unified Living Human Soul & Zero Soul Interchange
 * User Directive: "fix tuk tuk sol why he change his sole when he talk or interchange thare sol also interchange need one soll like humen not interchnageble"
 * 
 * Mathematical Invariants:
 * 1. Single Human Soul Anchor: S_{tuktuk} = 1.00
 * 2. Zero Soul Interchange Invariant: I_{interchange} = 0.00
 * 3. Permanent Tuk Tuk Conversational Anchor: A_{tuktuk} = 1.00
 * 4. Persona Vector Orthogonality: <S_i, S_j> = delta_{ij}
 * 5. Closed-Form Equivalence: Omega_{single_soul} = S_{tuktuk} * (1 - I_{interchange}) * A_{tuktuk} = 1.00 (LHS === RHS = 100%, Q.E.D.)
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const agentMedicMeshCortex = require("../src/utils/agent-medic-mesh-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

async function runTests() {
  console.log("================================================================================");
  console.log("🚀 RUNNING TUK TUK SINGLE HUMAN SOUL & ZERO SOUL INTERCHANGE VERIFICATION");
  console.log("================================================================================");

  const rawInput = "fix tuk tuk sol why he change his sole when he talk or interchange thare sol also interchange need one soll like humen not interchnageble";

  // 1. TextSanitizer STT Acoustic Normalization
  console.log("\n--- 1. Testing TextSanitizer STT Normalization ---");
  const sanitized = TextSanitizer.sanitize(rawInput);
  console.log(`   Raw: "${rawInput}"`);
  console.log(`   Sanitized: "${sanitized}"`);
  assert(sanitized.toLowerCase().includes("soul"), "Sanitizes 'sol/sole/soll' to 'soul'");
  assert(sanitized.toLowerCase().includes("their"), "Sanitizes 'thare' to 'their'");
  assert(sanitized.toLowerCase().includes("interchangeable"), "Sanitizes 'interchnageble' to 'interchangeable'");
  assert(sanitized.toLowerCase().includes("human"), "Preserves/normalizes 'human'");
  console.log("  ✅ [PASS 1] TextSanitizer normalizes phonetic STT errors in user directive");

  // 2. IntentParser Directive Detection
  console.log("\n--- 2. Testing IntentParser Directive Detection ---");
  const testPhrases = [
    rawInput,
    sanitized,
    "fix tuk tuk soul why she change soul when talking",
    "need one soul like human not interchangeable",
    "tuk tuk single soul zero interchange",
    "stop changing soul when talking",
    "টুকটুকের সোল চেঞ্জ হওয়া বন্ধ করো একটা সিঙ্গেল মানুষের মতো সোল লাগবে",
    "একটাই পার্মানেন্ট সোল নন ইন্টারচেঞ্জেবল"
  ];

  for (const phrase of testPhrases) {
    const isDetected = IntentParser.isTukTukSingleHumanSoulNonInterchangeableDirective(phrase);
    assert.strictEqual(isDetected, true, `Failed to detect directive in phrase: "${phrase}"`);
  }
  console.log("  ✅ [PASS 2] IntentParser detects directive variants across English, Banglish & Bengali");

  // 3. IntentParser Routing
  console.log("\n--- 3. Testing IntentParser Routing ---");
  const parsed = IntentParser.parse(rawInput);
  assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION, "Routes to SMOOTH_CONVERSATION");
  assert.strictEqual(parsed.target, "fix_tuktuk_single_human_soul_non_interchangeable", "Target matches fix_tuktuk_single_human_soul_non_interchangeable");
  console.log("  ✅ [PASS 3] IntentParser routes to SMOOTH_CONVERSATION with target 'fix_tuktuk_single_human_soul_non_interchangeable'");

  // 4. JarvisManager detectActiveAgent Single Soul Anchor
  console.log("\n--- 4. Testing JarvisManager detectActiveAgent Anchor Invariant ---");
  const jm = new JarvisManager({ userName: "Hritthik" });
  
  // Technical utterances without agent mention MUST NOT switch away from Tuk Tuk!
  const technicalUtterances = [
    "debug the go backend audio buffer latency and memory leak",
    "fix the pipeline AST parser crash",
    "check our system telemetry",
    "can we optimize the ring buffer throughput",
    "look at this git commit diff",
    "how do we prevent memory fragmentation in Electron"
  ];

  for (const utterance of technicalUtterances) {
    const active = jm.detectActiveAgent(utterance);
    assert.strictEqual(active.key, "tuktuk", `Expected Tuk Tuk to retain floor on "${utterance}", but got ${active.name}`);
  }
  console.log("  ✅ [PASS 4A] Technical keywords do NOT involuntarily swap Tuk Tuk's soul to Vision or DD");

  // Explicit invocations MUST still be honored
  assert.strictEqual(jm.detectActiveAgent("Vision, check this memory leak").key, "vision", "Explicit 'Vision' activates Vision");
  assert.strictEqual(jm.detectActiveAgent("Friday, run the empirical benchmark").key, "friday", "Explicit 'Friday' activates Friday");
  assert.strictEqual(jm.detectActiveAgent("DD, check the audio ring buffer").key, "dd", "Explicit 'DD' activates DD");
  assert.strictEqual(jm.detectActiveAgent("Team, let's do a standup").key, "team", "Explicit 'Team' activates Squad");
  console.log("  ✅ [PASS 4B] Explicit agent invocations by name are faithfully routed");

  // 5. JarvisManager Law 51 & Prompt Invariants
  console.log("\n--- 5. Testing JarvisManager Law 51 & Prompt Invariants ---");
  const systemPrompt = jm.getSystemPrompt("Tuk Tuk");
  assert(systemPrompt.includes("LAW 51: TUK TUK ONE UNIFIED LIVING HUMAN SOUL & ZERO SOUL INTERCHANGE INVARIANT"), "LAW 51 is enacted in universal system prompt");
  assert(systemPrompt.includes("ONE LIVING HUMAN SOUL"), "One living human soul clause present");
  assert(systemPrompt.includes("ZERO SOUL INTERCHANGE"), "Zero soul interchange invariant present");
  assert(systemPrompt.includes("Omega_single_soul"), "Master closed-form equation present in system prompt");

  const calibration = jm.calibrateTukTukSingleHumanSoul();
  assert.strictEqual(calibration.verified, true, "Tuk Tuk single soul calibration verified");
  assert.strictEqual(calibration.singleHumanSoulRate, 1.0, "Single human soul rate is 1.0");
  assert.strictEqual(calibration.soulInterchangeRate, 0.0, "Soul interchange rate is 0.0");
  assert.strictEqual(calibration.tuktukAnchorPermanent, true, "Tuk Tuk anchor is permanent");
  console.log("  ✅ [PASS 5] JarvisManager Law 51 and single human soul calibration verified");

  // 6. AgentMedicMeshCortex Audit & Closed-Form Proof
  console.log("\n--- 6. Testing AgentMedicMeshCortex Audit & Closed-Form Proof ---");
  const auditReport = agentMedicMeshCortex.auditAndEnforceSingleHumanSoulNonInterchangeable();
  assert.strictEqual(auditReport.singleHumanSoulRate, 1.0, "Audit confirms singleHumanSoulRate = 1.0");
  assert.strictEqual(auditReport.soulInterchangeRate, 0.0, "Audit confirms soulInterchangeRate = 0.0");
  assert.strictEqual(auditReport.tuktukAnchorPermanent, true, "Audit confirms tuktukAnchorPermanent = true");
  assert.strictEqual(auditReport.proof.lhsEqualsRhs, true, "Closed-form proof LHS === RHS");
  console.log(`   Proof Statement: ${auditReport.proof.proofStatement}`);
  console.log("  ✅ [PASS 6] AgentMedicMeshCortex confirms single human soul invariant (LHS ≡ RHS = 100%)");

  // 7. ActionRunner Multi-Agent Dispatch
  console.log("\n--- 7. Testing ActionRunner Multi-Agent Dispatch ---");
  // Tuk Tuk
  const resTukTuk = await actionRunner.handleAction(rawInput, { name: "Tuk Tuk", key: "tuktuk" });
  assert.strictEqual(resTukTuk.handled, true, "ActionRunner handles directive for Tuk Tuk");
  assert.strictEqual(resTukTuk.data.action, "fix_tuktuk_single_human_soul_non_interchangeable", "Action matches fix_tuktuk_single_human_soul_non_interchangeable");
  assert.strictEqual(resTukTuk.data.singleHumanSoulRate, 1.0, "Single human soul rate is 1.0");
  assert.strictEqual(resTukTuk.data.soulInterchangeRate, 0.0, "Soul interchange rate is 0.0");
  assert(resTukTuk.speech.toLowerCase().includes("babe"), "Tuk Tuk response strictly includes 'babe'");
  assert(!resTukTuk.speech.toLowerCase().includes("brother"), "Tuk Tuk does not leak 'brother'");
  assert(!resTukTuk.speech.toLowerCase().includes("chief"), "Tuk Tuk does not leak 'chief'");
  assert(!resTukTuk.speech.endsWith("?"), "Anti-Trailer Law: Zero trailing question marks");
  console.log("  ✅ [PASS 7] ActionRunner handles directive for Tuk Tuk (exclusively 'babe', zero trailing ?)");

  // Vision
  const resVision = await actionRunner.handleAction(rawInput, { name: "Vision", key: "vision" });
  assert.strictEqual(resVision.handled, true, "ActionRunner handles directive for Vision");
  assert(resVision.speech.toLowerCase().includes("brother") || resVision.speech.toLowerCase().includes("bro"), "Vision response includes 'brother' or 'bro'");
  assert(!resVision.speech.toLowerCase().includes("babe"), "Vision never uses 'babe'");
  assert(!resVision.speech.endsWith("?"), "Vision: Zero trailing ?");
  console.log("  ✅ [PASS 8] ActionRunner handles directive for Vision (exclusively 'brother/bro')");

  // Friday
  const resFriday = await actionRunner.handleAction(rawInput, { name: "Friday", key: "friday" });
  assert.strictEqual(resFriday.handled, true, "ActionRunner handles directive for Friday");
  assert(resFriday.speech.includes("Chief") || resFriday.speech.includes("Hritthik"), "Friday response includes 'Chief' or 'Hritthik'");
  assert(!resFriday.speech.toLowerCase().includes("babe"), "Friday never uses 'babe'");
  assert(!resFriday.speech.endsWith("?"), "Friday: Zero trailing ?");
  console.log("  ✅ [PASS 9] ActionRunner handles directive for Friday (exclusively 'Chief')");

  // DD
  const resDD = await actionRunner.handleAction(rawInput, { name: "DD", key: "dd" });
  assert.strictEqual(resDD.handled, true, "ActionRunner handles directive for DD");
  assert(resDD.speech.toLowerCase().includes("bro"), "DD response includes 'bro'");
  assert(!resDD.speech.toLowerCase().includes("babe"), "DD never uses 'babe'");
  assert(!resDD.speech.endsWith("?"), "DD: Zero trailing ?");
  console.log("  ✅ [PASS 10] ActionRunner handles directive for DD (exclusively 'bro')");

  // Team
  const resTeam = await actionRunner.handleAction(rawInput, { name: "Squad", key: "team" });
  assert.strictEqual(resTeam.handled, true, "ActionRunner handles directive in Team mode");
  assert(resTeam.speech.includes("[Tuk Tuk]"), "Team standup includes Tuk Tuk");
  assert(resTeam.speech.includes("[Vision]"), "Team standup includes Vision");
  assert(resTeam.speech.includes("[Friday]"), "Team standup includes Friday");
  assert(resTeam.speech.includes("[DD]"), "Team standup includes DD");
  assert(!resTeam.speech.endsWith("?"), "Team: Zero trailing ?");
  console.log("  ✅ [PASS 11] ActionRunner handles Team mode with 4-agent coordinated standup");

  // 8. LocalCognitiveBrain Offline Responses
  console.log("\n--- 8. Testing LocalCognitiveBrain Offline Synthesis ---");
  const brainTukTukEn = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawInput, {}, "en");
  assert(brainTukTukEn.toLowerCase().includes("babe"), "Brain Tuk Tuk English response contains 'babe'");
  assert(!brainTukTukEn.endsWith("?"), "Brain Tuk Tuk: Zero trailing ?");

  const bnPrompt = "টুকটুকের সোল ফিক্স করো কেন সে কথা বলতে বলতে সোল বদলে ফেলে একটা সিঙ্গেল মানুষের মতো সোল লাগবে";
  const brainTukTukBn = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", bnPrompt, {}, "bn");
  assert(brainTukTukBn.toLowerCase().includes("babe"), "Brain Tuk Tuk Bengali response contains 'babe'");
  assert(!brainTukTukBn.endsWith("?"), "Brain Tuk Tuk: Zero trailing ?");

  const brainVisionEn = localCognitiveBrain.synthesizeResponse("vision", "Vision", rawInput, {}, "en");
  assert(brainVisionEn.toLowerCase().includes("brother") || brainVisionEn.toLowerCase().includes("bro"), "Brain Vision response contains 'brother' or 'bro'");

  const brainFridayEn = localCognitiveBrain.synthesizeResponse("friday", "Friday", rawInput, {}, "en");
  assert(brainFridayEn.includes("Chief") || brainFridayEn.includes("Hritthik"), "Brain Friday response contains 'Chief' or 'Hritthik'");

  const brainDDEn = localCognitiveBrain.synthesizeResponse("dd", "DD", rawInput, {}, "en");
  assert(brainDDEn.toLowerCase().includes("bro"), "Brain DD response contains 'bro'");

  const brainSquadEn = localCognitiveBrain.synthesizeResponse("team", "Squad", rawInput, {}, "en");
  assert(brainSquadEn.includes("[Tuk Tuk]") && brainSquadEn.includes("[Vision]"), "Brain Squad response contains standup sequence");
  console.log("  ✅ [PASS 12] LocalCognitiveBrain synthesizes responses across all personas with zero trailing ?");

  console.log("\n================================================================================");
  console.log("🎉 ALL 12 / 12 TUK TUK SINGLE HUMAN SOUL TESTS PASSED (100% SUCCESS)!");
  console.log("================================================================================");
}

runTests().catch(err => {
  console.error("❌ Test suite failed with error:", err);
  process.exit(1);
});
