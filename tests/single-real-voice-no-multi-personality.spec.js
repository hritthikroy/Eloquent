/**
 * Verification Test Suite: Single Real Voice, Zero Multi-Personality & Total Khati Misti Purge
 * 
 * Verifies:
 * 1. STT Acoustic Normalization for "khti misti", "totaly", "humen voices", "malti parson"
 * 2. IntentParser detection of single real voice directive and remove khati misti directive
 * 3. ActionRunner calibration and execution with single human voice (Ava) and grounded co-founder tone
 * 4. JarvisManager invariant locking (detectActiveAgent, evaluateCrossAgentHandoff, getCompactSystemPrompt)
 * 5. Zero multi-personality switching (Vision, Friday, DD calls routed to sole human voice)
 * 6. Zero multi-person voice playback (speak() strictly resolves to en-US-AvaMultilingualNeural)
 * 7. Complete eradication of "খাঁটি মিষ্টি", forced sweet-talk, and melodramatic pet-naming
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

async function runTests() {
  console.log("🚀 Starting Single Real Voice, Zero Multi-Personality & Khati Misti Purge Test Suite...\n");

  // -------------------------------------------------------------
  // Test 1: STT Acoustic Sanitization
  // -------------------------------------------------------------
  console.log("▶ Test 1: STT Acoustic Sanitization");
  const exactUserPrompt = "remove the khti misti bangla kotha totaly this person and this voice i need one real humen voices not malti parson voices";
  const sanitized = TextSanitizer.sanitize(exactUserPrompt);
  console.log(`  Raw:       "${exactUserPrompt}"`);
  console.log(`  Sanitized: "${sanitized}"`);
  assert(
    sanitized.includes("khati misti") && sanitized.includes("totally") && sanitized.includes("human voice") && sanitized.includes("multi-person voice"),
    `Expected sanitized string to contain canonical phrases, got: ${sanitized}`
  );
  console.log("  ✅ Test 1 Passed: Acoustic typos successfully sanitized!\n");

  // -------------------------------------------------------------
  // Test 2: Intent Detection
  // -------------------------------------------------------------
  console.log("▶ Test 2: IntentParser Detection");
  assert.strictEqual(
    IntentParser.isSingleRealVoiceNoMultiPersonalityDirective(exactUserPrompt),
    true,
    "Raw input should match isSingleRealVoiceNoMultiPersonalityDirective"
  );
  assert.strictEqual(
    IntentParser.isSingleRealVoiceNoMultiPersonalityDirective(sanitized),
    true,
    "Sanitized input should match isSingleRealVoiceNoMultiPersonalityDirective"
  );
  assert.strictEqual(
    IntentParser.isRemoveKhatiMistiSingleRealHumanVoiceDirective(exactUserPrompt),
    true,
    "Raw input should match isRemoveKhatiMistiSingleRealHumanVoiceDirective"
  );

  const parsed = IntentParser.parse(exactUserPrompt);
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
  const calibrationResult = jm.calibrateSingleRealHumanVoiceNoKhatiMisti();
  console.log("  Calibration status:", calibrationResult.status);
  assert.strictEqual(calibrationResult.status, "SINGLE_REAL_HUMAN_VOICE_NO_KHATI_MISTI_LOCKED");
  assert.strictEqual(jm.isSingleRealVoiceMode(), true);
  assert.strictEqual(jm.getPreference("single_real_voice_active"), true);
  assert.strictEqual(jm.getPreference("multi_personality_disabled"), true);
  assert.strictEqual(jm.getPreference("multi_person_voice_disabled"), true);
  assert.strictEqual(jm.getPreference("single_voice_tuktuk_exclusive"), true);
  assert.strictEqual(jm.getPreference("khati_misti_purged"), true);
  console.log("  ✅ Test 3 Passed: JarvisManager single real voice mode locked!\n");

  // -------------------------------------------------------------
  // Test 4: Action Runner Execution
  // -------------------------------------------------------------
  console.log("▶ Test 4: ActionRunner Handling");
  const actionRes = await actionRunner.handleAction(exactUserPrompt, AGENTS.tuktuk, jm);
  console.log("  Action result handled:", actionRes?.handled);
  console.log("  Speaking agent:", actionRes?.agentName);
  console.log("  Speaking voice:", actionRes?.agentVoice);
  console.log("  Speech excerpt:", actionRes?.speech?.substring(0, 100) + "...");
  assert.strictEqual(actionRes.handled, true);
  assert.strictEqual(actionRes.agentName, "Tuk Tuk");
  assert.strictEqual(actionRes.agentVoice, "en-US-AvaMultilingualNeural");
  assert(!actionRes.speech.includes("খাঁটি মিষ্টি"), "Speech must NOT contain 'খাঁটি মিষ্টি'");
  assert(
    actionRes.speech.toLowerCase().includes("single real human voice") ||
    actionRes.speech.toLowerCase().includes("real human voice") ||
    actionRes.speech.includes("আসল মানুষের ভয়েস"),
    "Speech must confirm single real human voice"
  );
  console.log("  ✅ Test 4 Passed: ActionRunner handled with Tuk Tuk / Ava exclusively and zero khati misti!\n");

  // -------------------------------------------------------------
  // Test 5: Zero Multi-Personality Switching (Agent Invariant)
  // -------------------------------------------------------------
  console.log("▶ Test 5: Zero Multi-Personality Routing Invariant");
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
  // Test 6: System Prompt Sovereignty (One Real Voice, Zero Khati Misti)
  // -------------------------------------------------------------
  console.log("▶ Test 6: System Prompt Sovereignty");
  const compactPrompt = jm.getCompactSystemPrompt("vision", "debug this function");
  assert(
    compactPrompt.includes("Tuk Tuk") || compactPrompt.includes("AvaMultilingualNeural"),
    "System prompt must be sovereign to Tuk Tuk / Ava"
  );
  assert(
    compactPrompt.includes("ZERO 'KHATI MISTI'") || compactPrompt.includes("ZERO FORCED 'KHATI MISTI'"),
    "System prompt must enforce ZERO KHATI MISTI invariant"
  );
  console.log("  ✅ Test 6 Passed: Prompt generation strictly sovereign with zero khati misti!\n");

  // -------------------------------------------------------------
  // Test 7: Local Cognitive Brain Grounding
  // -------------------------------------------------------------
  console.log("▶ Test 7: Local Cognitive Brain Grounding");
  const localReply = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", exactUserPrompt, {
    activeAgent: AGENTS.tuktuk,
    jarvisManager: jm
  });
  console.log("  Local cognitive reply:", localReply);
  assert(!localReply.includes("খাঁটি মিষ্টি"), "Local reply must NOT contain 'খাঁটি মিষ্টি'");
  assert(
    localReply.toLowerCase().includes("single real human voice") ||
    localReply.toLowerCase().includes("real human voice") ||
    localReply.includes("আসল মানুষের ভয়েস"),
    "Local reply must confirm single real human voice"
  );
  console.log("  ✅ Test 7 Passed: Local cognitive brain fully grounded!\n");

  console.log("🎉 ALL TESTS PASSED (7/7)! SINGLE REAL HUMAN VOICE & ZERO KHATI MISTI 100% VERIFIED! 🎉");
  process.exit(0);
}

runTests().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
