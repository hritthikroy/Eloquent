/**
 * tests/conversation-gap-and-duplicate-soul-voices.spec.js
 *
 * Verification suite for Running Conversation Gap Audit & Duplicate Soul Voice Elimination
 * Directive: "chack our runi conversation listen with me and chack and find the real conversation gaps to remove all overlap duplicate sol voices and all"
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const agentMedicMeshCortex = require("../src/utils/agent-medic-mesh-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");

async function runTests() {
  console.log("================================================================================");
  console.log("🚀 RUNNING CONVERSATION GAP & DUPLICATE SOUL VOICE ELIMINATION VERIFICATION");
  console.log("================================================================================");

  let passedTests = 0;
  let totalTests = 6;

  // 1. TextSanitizer STT Acoustic Normalization
  console.log("\n--- 1. Testing TextSanitizer STT Normalization ---");
  const rawInput = "chack our runi conversation listen with me and chack and find the real conversation gaps to remove all overlap duplicate sol voices and all";
  const sanitized = TextSanitizer.sanitize(rawInput);
  console.log(`   Raw: "${rawInput}" -> Sanitized: "${sanitized}"`);
  assert(sanitized.toLowerCase().includes("check"), "Sanitizes 'chack' to 'check'");
  assert(sanitized.toLowerCase().includes("running conversation"), "Sanitizes 'runi conversation' to 'running conversation'");
  assert(sanitized.toLowerCase().includes("duplicate soul voices"), "Sanitizes 'duplicate sol voices' to 'duplicate soul voices'");
  console.log("  ✅ [PASS 1/6] TextSanitizer normalizes running conversation and duplicate soul voice artifacts");
  passedTests++;

  // 2. IntentParser Directive Detection
  console.log("\n--- 2. Testing IntentParser Directive Detection ---");
  const testPhrases = [
    "chack our runi conversation listen with me and chack and find the real conversation gaps to remove all overlap duplicate sol voices and all",
    "check our running conversation and remove all overlap duplicate soul voices",
    "find real conversation gaps to remove duplicate sol voices",
    "check running conversation gap and overlap duplicate voices"
  ];

  for (const phrase of testPhrases) {
    const isDetected = IntentParser.isSoulDuplicationMismatchHardcodedFixDirective(phrase);
    assert.strictEqual(isDetected, true, `Failed to detect directive in phrase: "${phrase}"`);
  }
  console.log("  ✅ [PASS 2/6] IntentParser detects running conversation gap & duplicate soul voice directives");
  passedTests++;

  // 3. IntentParser Routing
  console.log("\n--- 3. Testing IntentParser Routing ---");
  const parsed = IntentParser.parse(rawInput);
  assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION, "Routes to SMOOTH_CONVERSATION");
  assert.strictEqual(parsed.target, "fix_soul_duplication_mismatch_hardcoded", "Target matches fix_soul_duplication_mismatch_hardcoded");
  console.log("  ✅ [PASS 3/6] IntentParser routes to SMOOTH_CONVERSATION with target 'fix_soul_duplication_mismatch_hardcoded'");
  passedTests++;

  // 4. AgentMedicMeshCortex Audit & Orthogonality
  console.log("\n--- 4. Testing AgentMedicMeshCortex Audit ---");
  const auditReport = agentMedicMeshCortex.auditAndEliminateSoulDuplicationMismatchHardcoded();
  assert.strictEqual(auditReport.soulDuplicationRate, 0.0, "Soul duplication rate is 0.0");
  assert.strictEqual(auditReport.mismatchRate, 0.0, "Mismatch rate is 0.0");
  assert.strictEqual(auditReport.dynamicDecouplingRate, 1.0, "Dynamic decoupling rate is 1.0");
  assert.strictEqual(auditReport.orthogonalSoulInvariantVerified, true, "Orthogonal soul invariant verified");
  console.log("  ✅ [PASS 4/6] AgentMedicMeshCortex confirms zero soul duplication and zero voice overlap");
  passedTests++;

  // 5. ActionRunner Multi-Agent Dispatch
  console.log("\n--- 5. Testing ActionRunner Multi-Agent Dispatch ---");
  const resTukTuk = await actionRunner.handleAction(rawInput, { name: "Tuk Tuk", key: "tuktuk" });
  assert.strictEqual(resTukTuk.handled, true, "ActionRunner handles directive for Tuk Tuk");
  assert.strictEqual(resTukTuk.data.action, "fix_soul_duplication_mismatch_hardcoded", "Action is fix_soul_duplication_mismatch_hardcoded");
  assert.strictEqual(resTukTuk.data.soulDuplicationRate, 0.0, "Soul duplication rate is 0.0");
  assert(resTukTuk.speech.toLowerCase().includes("babe"), "Tuk Tuk response strictly includes 'babe'");
  console.log("  ✅ [PASS 5/6] ActionRunner executes directive and produces clean persona speech");
  passedTests++;

  // 6. Single-Voice Mutual Exclusion & Turn Filler Suppression
  console.log("\n--- 6. Testing Single-Voice Mutual Exclusion & Turn Filler Suppression ---");
  const jm = new JarvisManager();
  assert.strictEqual(jm.playInstantTurnFiller('Tuk Tuk'), false, 'playInstantTurnFiller returns false and plays no audio');
  assert.strictEqual(jm.playMicroBackchannel(), false, 'playMicroBackchannel returns false and produces no background noise');
  console.log("  ✅ [PASS 6/6] Mutual exclusion & zero audio filler overlap verified");
  passedTests++;

  console.log(`\n🌟 All ${passedTests}/${totalTests} Conversation Gap & Duplicate Soul Voice Elimination Tests Passed Successfully! 🚀`);
}

runTests().catch(err => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
