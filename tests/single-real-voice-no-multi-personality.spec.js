/**
 * Verification Test Suite: Single Real Voice & Zero Multi-Personality / Multi-Person Voice
 * 
 * Verifies:
 * 1. STT Acoustic Normalization for "malti personalyti" and "malti person voice"
 * 2. IntentParser detection of single real voice directive
 * 3. ActionRunner calibration and execution with Tuk Tuk / Ava voice
 * 4. JarvisManager invariant locking (detectActiveAgent, evaluateCrossAgentHandoff, getCompactSystemPrompt)
 * 5. Zero multi-personality switching (Vision, Friday, DD calls routed to Tuk Tuk)
 * 6. Zero multi-person voice playback (speak() strictly resolves to en-US-AvaMultilingualNeural)
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

async function runTests() {
  console.log("🚀 Starting Single Real Voice & Zero Multi-Personality Test Suite...\n");

  // -------------------------------------------------------------
  // Test 1: STT Acoustic Sanitization
  // -------------------------------------------------------------
  console.log("▶ Test 1: STT Acoustic Sanitization");
  const rawInput = "need one real voice not malti personalyti and malti person voice";
  const sanitized = TextSanitizer.sanitize(rawInput);
  console.log(`  Raw:       "${rawInput}"`);
  console.log(`  Sanitized: "${sanitized}"`);
  assert(
    sanitized.includes("multi-personality") && sanitized.includes("multi-person voice"),
    `Expected sanitized string to contain canonical phrases, got: ${sanitized}`
  );
  console.log("  ✅ Test 1 Passed: Acoustic typos successfully sanitized!\n");

  // -------------------------------------------------------------
  // Test 2: Intent Detection
  // -------------------------------------------------------------
  console.log("▶ Test 2: IntentParser Detection");
  assert.strictEqual(
    IntentParser.isSingleRealVoiceNoMultiPersonalityDirective(rawInput),
    true,
    "Raw input should match isSingleRealVoiceNoMultiPersonalityDirective"
  );
  assert.strictEqual(
    IntentParser.isSingleRealVoiceNoMultiPersonalityDirective(sanitized),
    true,
    "Sanitized input should match isSingleRealVoiceNoMultiPersonalityDirective"
  );

  const parsed = IntentParser.parse(rawInput);
  console.log("  Parsed Intent:", parsed);
  assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
  assert.strictEqual(parsed.target, "single_real_voice_no_multi_personality");
  assert.strictEqual(parsed.action, "single_real_voice_no_multi_personality");
  assert.strictEqual(parsed.agentDirective, "tuktuk");
  console.log("  ✅ Test 2 Passed: Single real voice directive cleanly parsed!\n");

  // -------------------------------------------------------------
  // Test 3: JarvisManager Calibration & Mode Locking
  // -------------------------------------------------------------
  console.log("▶ Test 3: JarvisManager Calibration & Invariant Locking");
  const jm = new JarvisManager();
  const AGENTS = jm.agents;
  const calibrationResult = jm.calibrateSingleRealVoiceNoMultiPersonality();
  console.log("  Calibration status:", calibrationResult.status);
  assert.strictEqual(calibrationResult.status, "SINGLE_REAL_VOICE_NO_MULTI_PERSONALITY_LOCKED");
  assert.strictEqual(jm.isSingleRealVoiceMode(), true);
  assert.strictEqual(jm.getPreference("single_real_voice_active"), true);
  assert.strictEqual(jm.getPreference("multi_personality_disabled"), true);
  assert.strictEqual(jm.getPreference("multi_person_voice_disabled"), true);
  assert.strictEqual(jm.getPreference("single_voice_tuktuk_exclusive"), true);
  console.log("  ✅ Test 3 Passed: JarvisManager single real voice mode locked!\n");

  // -------------------------------------------------------------
  // Test 4: Action Runner Execution
  // -------------------------------------------------------------
  console.log("▶ Test 4: ActionRunner Handling");
  const actionRes = await actionRunner.handleAction(rawInput, AGENTS.tuktuk, jm);
  console.log("  Action result handled:", actionRes?.handled);
  console.log("  Speaking agent:", actionRes?.agentName);
  console.log("  Speaking voice:", actionRes?.agentVoice);
  console.log("  Speech excerpt:", actionRes?.speech?.substring(0, 80) + "...");
  assert.strictEqual(actionRes.handled, true);
  assert.strictEqual(actionRes.agentName, "Tuk Tuk");
  assert.strictEqual(actionRes.agentVoice, "en-US-AvaMultilingualNeural");
  assert(actionRes.speech.includes("babe"), "Speech must address Hritthik as 'babe'");
  assert(
    actionRes.speech.toLowerCase().includes("one real voice") ||
    actionRes.speech.toLowerCase().includes("single real voice") ||
    actionRes.speech.toLowerCase().includes("ekta real voice"),
    "Speech must confirm single real voice"
  );
  console.log("  ✅ Test 4 Passed: ActionRunner handled with Tuk Tuk / Ava exclusively!\n");

  // -------------------------------------------------------------
  // Test 5: Zero Multi-Personality Switching (Agent Invariant)
  // -------------------------------------------------------------
  console.log("▶ Test 5: Zero Multi-Personality Routing Invariant");
  // Even if user mentions Vision, Friday, or DD keywords, in single real voice mode,
  // Tuk Tuk is the SOLE active agent answering all questions!
  const agentForVision = jm.detectActiveAgent("tell vision to debug the memory leak");
  const agentForFriday = jm.detectActiveAgent("Friday give me the market research analysis");
  const agentForDD = jm.detectActiveAgent("DD check the audio latency telemetry");
  const agentForSquad = jm.detectActiveAgent("Squad standup meeting everyone report");

  console.log("  Detected for Vision prompt:", agentForVision.name);
  console.log("  Detected for Friday prompt:", agentForFriday.name);
  console.log("  Detected for DD prompt:    ", agentForDD.name);
  console.log("  Detected for Squad prompt: ", agentForSquad.name);

  assert.strictEqual(agentForVision.key, "tuktuk");
  assert.strictEqual(agentForFriday.key, "tuktuk");
  assert.strictEqual(agentForDD.key, "tuktuk");
  assert.strictEqual(agentForSquad.key, "tuktuk");

  const handoff = jm.evaluateCrossAgentHandoff("tell vision to fix the bug");
  assert.strictEqual(handoff, null, "Cross-agent handoff must be null in single real voice mode");
  console.log("  ✅ Test 5 Passed: Zero multi-personality switching verified!\n");

  // -------------------------------------------------------------
  // Test 6: System Prompt Sovereignty (One Persona)
  // -------------------------------------------------------------
  console.log("▶ Test 6: System Prompt Sovereignty");
  const compactPrompt = jm.getCompactSystemPrompt("vision", "debug this function");
  assert(
    compactPrompt.includes("Tuk Tuk"),
    "System prompt must be for Tuk Tuk even when requested for another agent key"
  );
  assert(
    compactPrompt.includes("babe"),
    "System prompt must enforce 'babe' salutation"
  );
  console.log("  ✅ Test 6 Passed: Prompt generation strictly sovereign to Tuk Tuk!\n");

  // -------------------------------------------------------------
  // Test 7: Local Cognitive Brain Grounding
  // -------------------------------------------------------------
  console.log("▶ Test 7: Local Cognitive Brain Grounding");
  const localReply = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawInput, {
    activeAgent: AGENTS.tuktuk,
    jarvisManager: jm
  });
  console.log("  Local cognitive reply:", localReply);
  assert(
    localReply.includes("babe") || localReply.includes("Babe"),
    "Local reply must address Hritthik as babe"
  );
  assert(
    localReply.toLowerCase().includes("one real voice") ||
    localReply.toLowerCase().includes("single real voice") ||
    localReply.toLowerCase().includes("ekta real voice"),
    "Local reply must confirm single real voice"
  );
  console.log("  ✅ Test 7 Passed: Local cognitive brain fully grounded!\n");

  console.log("🎉 ALL TESTS PASSED (7/7)! SINGLE REAL VOICE & ZERO MULTI-PERSONALITY 100% VERIFIED! 🎉");
  process.exit(0);
}

runTests().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
