/**
 * tests/instant-reading-and-reply-zero-delay.spec.js
 *
 * Test suite verifying:
 * 1. IntentParser detects user prompt:
 *    "instent reading and instent reply like humen fast satating conversation doing dely fix this issue"
 * 2. ActionRunner executes and configures:
 *    - instant_reading_active = true
 *    - instant_reply_active = true
 *    - zero_starting_delay_active = true
 *    - fast_starting_conversation_mode = true
 *    - vad_rapid_endpointing_ms = 180
 *    - sub_200ms_turn_taking = true
 *    - voice_warmup_latency_ms = 0
 *    - voice = en-US-AvaMultilingualNeural
 * 3. JarvisManager prompts embed instant reading, instant reply, and zero starting delay laws
 * 4. LocalCognitiveBrain generates instant human reply
 */

const assert = require("assert");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("🧪 [START]: Running tests for Instant Reading, Instant Human-Like Reply & Zero Starting Delay...");

// 1. Intent Detection
const userUtterance = "instent reading and instent reply like humen fast satating conversation doing dely fix this issue";

const detected = IntentParser.isInstantReadingAndInstantReplyZeroDelayDirective(userUtterance);
assert.strictEqual(detected, true, "Should detect user prompt as instant reading and reply zero delay directive");

const parsed = IntentParser.parse(userUtterance);
assert.strictEqual(parsed.target, "instant_reading_and_instant_reply_zero_delay_directive", "Parsed target must match directive");
assert.strictEqual(parsed.intent, IntentParser.INTENTS.SMOOTH_CONVERSATION, "Intent should be SMOOTH_CONVERSATION");

console.log("  ✅ Step 1 passed: IntentParser correctly detects and parses user prompt.");

// 2. ActionRunner Execution
const prefs = {
  single_real_voice_active: true,
  single_voice_tuktuk_exclusive: true,
  multi_personality_disabled: true
};

const mockJM = {
  config: {
    userName: "Hritthik",
    salutation: "Hritthik",
    voice: "en-US-AvaMultilingualNeural"
  },
  preferences: prefs,
  currentLanguageMode: "banglish",
  agents: {
    tuktuk: { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" }
  },
  getPreference: (k) => prefs[k],
  setPreference: (k, v) => { prefs[k] = v; },
  saveConfig: (c) => Object.assign(mockJM.config, c),
  isSingleRealVoiceMode: () => true,
  calibrateInstantReadingAndInstantReplyZeroDelay: () => {
    prefs.instant_reading_active = true;
    prefs.instant_reply_active = true;
    prefs.zero_starting_delay_active = true;
    prefs.fast_starting_conversation_mode = true;
    prefs.vad_rapid_endpointing_ms = 180;
    prefs.sub_200ms_turn_taking = true;
    prefs.voice_warmup_latency_ms = 0;
    mockJM.config.voice = "en-US-AvaMultilingualNeural";
    return { success: true };
  }
};

(async () => {
  const result = await actionRunner.handleAction(userUtterance, mockJM.agents.tuktuk, mockJM, null, null);
  assert.strictEqual(result.handled, true, "Directive must be handled");
  assert.strictEqual(result.agentVoice, "en-US-AvaMultilingualNeural", "Voice must be en-US-AvaMultilingualNeural");
  assert.strictEqual(result.data.instantReadingActive, true, "instantReadingActive must be true");
  assert.strictEqual(result.data.instantReplyActive, true, "instantReplyActive must be true");
  assert.strictEqual(result.data.zeroStartingDelay, true, "zeroStartingDelay must be true");
  assert.strictEqual(result.data.vadRapidEndpointingMs, 180, "vadRapidEndpointingMs must be 180");
  assert.strictEqual(result.data.voiceWarmupLatencyMs, 0, "voiceWarmupLatencyMs must be 0");

  // Verify speech contains responsive co-founder confirmation
  assert.ok(/[\u0980-\u09FF]/.test(result.speech) || /[a-zA-Z]/.test(result.speech), "Speech must be valid");
  assert.ok(result.speech.toLowerCase().includes("babe"), "Speech should address Hritthik naturally as babe");
  console.log("  ✅ Step 2 passed: ActionRunner configured instant reading, instant reply, and zero starting delay.");
  console.log("     Spoken Response: " + result.speech);

  // 3. JarvisManager Prompt Invariants
  const jm = new JarvisManager();
  jm.setPreference("single_real_voice_active", true);
  jm.calibrateInstantReadingAndInstantReplyZeroDelay();

  const systemPrompt = jm.getSystemPrompt(null, "let's build quickly", null, "banglish");
  assert.ok(systemPrompt.includes("INSTANT READING & ZERO STARTING DELAY"), "Prompt must mandate INSTANT READING & ZERO STARTING DELAY");

  const compactPrompt = jm.getCompactSystemPrompt(null, "hey", null, "banglish");
  assert.ok(compactPrompt.includes("INSTANT READING, INSTANT HUMAN-LIKE REPLY & ZERO STARTING DELAY"), "Compact prompt must include rule 11");
  console.log("  ✅ Step 3 passed: JarvisManager system & compact prompts embed instant reading and zero starting delay.");

  // 4. LocalCognitiveBrain Synthesis
  const reply = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", userUtterance, { activeLang: "bn" });
  assert.ok(reply && reply.length > 0, "Fallback synthesis must return a valid reply");
  assert.ok(reply.toLowerCase().includes("instant") || reply.toLowerCase().includes("delay") || reply.includes("দেরি"), "Reply must confirm instant turnaround");
  console.log("  ✅ Step 4 passed: LocalCognitiveBrain produces instant response.");
  console.log("     Brain reply: " + reply);

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY for Instant Reading, Instant Reply & Zero Starting Delay!\n");
})();
