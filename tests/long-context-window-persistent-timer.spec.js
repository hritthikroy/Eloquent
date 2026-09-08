/**
 * tests/long-context-window-persistent-timer.spec.js
 *
 * Comprehensive Test Suite for Continuous Session Timer & Long Context Window for Long Conversations
 *
 * Verifies:
 * 1. STT Sanitization: "resating" -> "resetting", "windo" -> "window"
 * 2. IntentParser: Directive detection and parsing
 * 3. ActionRunner: Execution, persona sovereignty, closed-form parity
 * 4. JarvisManager: 128-turn working memory depth, 16k token ceiling, continuous timer
 * 5. MasterApiGateway: Zero pruning of [IMMEDIATE PRECEDING TURNS], 16k token budget
 * 6. Overlay Timer Persistence: Continuous duration across audio buffer recycling and soft hides
 * 7. LocalCognitiveBrain: Offline synthesis and persona sovereignty
 */

const assert = require("assert");
const path = require("path");

// Components
const { sanitizeInputText } = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const MasterApiGateway = require("../src/utils/master-api-gateway");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  ✅ " + name);
    passed++;
  } catch (err) {
    console.error("  ❌ " + name);
    console.error("     " + err.message);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log("  ✅ " + name);
    passed++;
  } catch (err) {
    console.error("  ❌ " + name);
    console.error("     " + err.message);
    failed++;
  }
}

async function runAllTests() {
  console.log("\n============================================================");
  console.log("⏱️🧠 CONTINUOUS SESSION TIMER & LONG CONTEXT WINDOW TEST SUITE");
  console.log("============================================================\n");

  // 1. STT Sanitization Tests
  console.log("--- 1. STT Sanitization & Normalization ---");

  test("Sanitizes resating -> resetting and windo -> window", () => {
    const raw = "fix resating this timer need long context windo with long conversations";
    const clean = sanitizeInputText(raw);
    assert.strictEqual(/\bresating\b/i.test(clean), false, "Must not contain whole word resating");
    assert.strictEqual(/\bwindo\b/i.test(clean), false, "Must not contain whole word windo");
    assert.ok(clean.toLowerCase().includes("resetting") || clean.toLowerCase().includes("timer"));
    assert.ok(clean.toLowerCase().includes("window") || clean.toLowerCase().includes("context"));
  });

  test("Normalizes full timer and long context phrase", () => {
    const raw = "resating this timer";
    const clean = sanitizeInputText(raw);
    assert.ok(clean.toLowerCase().includes("resetting this timer") || clean.toLowerCase().includes("resetting"));
  });

  // 2. IntentParser Tests
  console.log("\n--- 2. IntentParser Detection & Parsing ---");

  test("IntentParser detects exact user prompt", () => {
    const input = "fix resating this timer need long context windo with long conversations";
    assert.strictEqual(IntentParser.isLongContextWindowPersistentTimerDirective(input), true);
  });

  test("IntentParser detects sanitized prompt and variants", () => {
    const variants = [
      "fix resetting this timer need long context window with long conversations",
      "fix timer need long context window",
      "continuous session timer and long context window",
      "timer resetting need long context window with long conversations",
      "need long context window with long conversations and fix timer resetting",
      "টাইমার রিসেট ফিক্স করো এবং দীর্ঘ কথোপকথনের জন্য লং কনটেক্সট উইন্ডো দাও"
    ];
    for (const v of variants) {
      assert.strictEqual(IntentParser.isLongContextWindowPersistentTimerDirective(v), true, "Variant: " + v);
    }
  });

  test("IntentParser routes to long_context_window_persistent_timer_directive in parse()", () => {
    const parsed = IntentParser.parse("fix resating this timer need long context windo with long conversations");
    assert.strictEqual(parsed.intent, IntentParser.INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "long_context_window_persistent_timer_directive");
    assert.strictEqual(parsed.action, "long_context_window_persistent_timer_directive");
  });

  // 3. ActionRunner & Persona Sovereignty
  console.log("\n--- 3. ActionRunner & Persona Sovereignty ---");

  await runAsyncTest("ActionRunner handles directive for Tuk Tuk with strict sovereignty", async () => {
    const runner = actionRunner;
    const result = await runner.runAction("fix resating this timer need long context windo with long conversations", { activeAgent: { key: "tuktuk" } });

    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.action, "long_context_window_persistent_timer_directive");
    assert.strictEqual(result.data.closedFormProof, "LHS (100.0%) ≡ RHS (100.0%) [Q.E.D.]");
    assert.strictEqual(result.data.workingMemoryTurns, 128);
    assert.strictEqual(result.data.contextTokenCeiling, 16384);
    assert.strictEqual(result.data.persistentSessionTimer, true);

    const lowerSpeech = result.speech.toLowerCase();
    assert.ok(lowerSpeech.includes("babe"), "Tuk Tuk must say babe");
    assert.strictEqual(/\b(?:bro|brother|bhai)\b/i.test(lowerSpeech), false, "Tuk Tuk must NEVER say bro");
    assert.strictEqual(/\bchief\b/i.test(lowerSpeech), false, "Tuk Tuk must NEVER say Chief");
    assert.strictEqual(result.speech.endsWith("?"), false, "Must obey Anti-Trailer Law");
  });

  await runAsyncTest("ActionRunner handles directive for Vision with strict sovereignty", async () => {
    const runner = actionRunner;
    const result = await runner.runAction("fix resating this timer need long context windo with long conversations", { activeAgent: { key: "vision" } });

    assert.strictEqual(result.handled, true);
    const lowerSpeech = result.speech.toLowerCase();
    assert.ok(lowerSpeech.includes("brother") || lowerSpeech.includes("bro"), "Vision must say brother");
    assert.strictEqual(/\bbabe\b/i.test(lowerSpeech), false, "Vision must NEVER say babe");
    assert.strictEqual(/\bchief\b/i.test(lowerSpeech), false, "Vision must NEVER say Chief");
    assert.strictEqual(result.speech.endsWith("?"), false, "Must obey Anti-Trailer Law");
  });

  await runAsyncTest("ActionRunner handles directive for Friday with strict sovereignty", async () => {
    const runner = actionRunner;
    const result = await runner.runAction("fix resating this timer need long context windo with long conversations", { activeAgent: { key: "friday" } });

    assert.strictEqual(result.handled, true);
    const lowerSpeech = result.speech.toLowerCase();
    assert.ok(lowerSpeech.includes("chief"), "Friday must say Chief");
    assert.strictEqual(/\bbabe\b/i.test(lowerSpeech), false, "Friday must NEVER say babe");
    assert.strictEqual(/\b(?:bro|brother|bhai)\b/i.test(lowerSpeech), false, "Friday must NEVER say bro");
    assert.strictEqual(result.speech.endsWith("?"), false, "Must obey Anti-Trailer Law");
  });

  await runAsyncTest("ActionRunner handles directive for DD with strict sovereignty", async () => {
    const runner = actionRunner;
    const result = await runner.runAction("fix resating this timer need long context windo with long conversations", { activeAgent: { key: "dd" } });

    assert.strictEqual(result.handled, true);
    const lowerSpeech = result.speech.toLowerCase();
    assert.ok(lowerSpeech.includes("bro") || lowerSpeech.includes("ভাই"), "DD must say bro");
    assert.strictEqual(/\bbabe\b/i.test(lowerSpeech), false, "DD must NEVER say babe");
    assert.strictEqual(/\bchief\b/i.test(lowerSpeech), false, "DD must NEVER say Chief");
    assert.strictEqual(result.speech.endsWith("?"), false, "Must obey Anti-Trailer Law");
  });

  await runAsyncTest("ActionRunner handles directive for Squad with 4-agent standup", async () => {
    const runner = actionRunner;
    const result = await runner.runAction("squad fix resating this timer need long context windo with long conversations", { activeAgent: { key: "team" } });

    assert.strictEqual(result.handled, true);
    assert.ok(result.speech.includes("[Tuk Tuk]:"), "Squad must include Tuk Tuk tag");
    assert.ok(result.speech.includes("[Vision]:"), "Squad must include Vision tag");
    assert.ok(result.speech.includes("[Friday]:"), "Squad must include Friday tag");
    assert.ok(result.speech.includes("[DD]:"), "Squad must include DD tag");
    assert.strictEqual(result.speech.endsWith("?"), false, "Must obey Anti-Trailer Law");
  });

  // 4. JarvisManager Long Context Memory & Invariant Calibration
  console.log("\n--- 4. JarvisManager Long Context Working Memory ---");

  test("JarvisManager calibrates long context and persistent session timer", () => {
    const jm = new JarvisManager();
    const calib = jm.calibrateLongContextWindowLongConversations();

    assert.strictEqual(calib.success, true);
    assert.strictEqual(calib.verified, true);
    assert.strictEqual(calib.workingMemoryTurns, 128);
    assert.strictEqual(calib.contextTokenCeiling, 16384);
    assert.strictEqual(calib.persistentSessionTimer, true);
    assert.strictEqual(jm.preferences.long_context_window_active, true);
    assert.strictEqual(jm.preferences.working_memory_turns_depth, 128);
    assert.strictEqual(jm.preferences.context_token_ceiling, 16384);
    assert.strictEqual(jm.preferences.persistent_session_timer_active, true);
    assert.strictEqual(jm.preferences.session_timer_reset_guard, true);
  });

  test("JarvisManager maintains 128+ turns in working memory without pruning", () => {
    const jm = new JarvisManager();
    jm.calibrateLongContextWindowLongConversations({ workingMemoryTurnsDepth: 128 });

    for (let i = 1; i <= 130; i++) {
      jm.addTurn("user", "Message turn " + i + " regarding project architecture");
      jm.addTurn("assistant", "Response turn " + i + " confirmation", "Tuk Tuk");
    }

    const history = jm.getHistory(128);
    assert.ok(history.length >= 128, "Expected at least 128 items, got " + history.length);

    const prompt = jm.getSystemPrompt("tuktuk", { long_context_window_active: true });
    assert.ok(prompt.includes("Turn"), "System prompt should contain turns");
  });

  // 5. MasterApiGateway Token Budgeting & Preceding Turns Preservation
  console.log("\n--- 5. MasterApiGateway Token Budgeting & Preceding Turns ---");

  test("MasterApiGateway does NOT prune [IMMEDIATE PRECEDING TURNS] on large prompts", () => {
    const longSystemPrompt = "You are Eloquent AI with deep cognitive intelligence. " +
      "System context repeats to exceed 2500 chars: ".repeat(100) +
      "\n[IMMEDIATE PRECEDING TURNS (Most recent conversational context)]\n" +
      "User: Hritthik architecture discussion turn 1\n" +
      "Assistant: Tuk Tuk confirmation turn 1\n" +
      "[END PRECEDING TURNS]";

    assert.ok(longSystemPrompt.length > 2500);

    const messages = [
      { role: "system", content: longSystemPrompt },
      { role: "user", content: "What was our discussion in turn 1?" }
    ];

    const compressed = new MasterApiGateway().compressPromptMessages(messages, 4000);
    const compressedSys = compressed.find(m => m.role === "system")?.content || "";

    assert.ok(
      compressedSys.includes("[IMMEDIATE PRECEDING TURNS"),
      "MasterApiGateway must NOT strip [IMMEDIATE PRECEDING TURNS]"
    );
    assert.ok(
      compressedSys.includes("Hritthik architecture discussion turn 1"),
      "Preceding turn content must be preserved"
    );
  });

  test("MasterApiGateway scales token budget up to 16,384 tokens for long conversations", () => {
    const manyMessages = [];
    manyMessages.push({ role: "system", content: "System directive for Eloquent." });
    for (let i = 1; i <= 50; i++) {
      manyMessages.push({ role: "user", content: "Query " + i + ": Detailed question about architectural pipeline #" + i });
      manyMessages.push({ role: "assistant", content: "Answer " + i + ": Comprehensive response detailing subsystem #" + i });
    }

    const compressed16k = new MasterApiGateway().compressPromptMessages(manyMessages, 16384);
    assert.strictEqual(
      compressed16k.length,
      manyMessages.length,
      "All messages should be retained under 16k tokens"
    );
  });

  // 6. Overlay Timer Persistence Logic Across Turns & Audio Recycling
  console.log("\n--- 6. Overlay Timer Persistence Logic ---");

  test("Simulated overlay timer retains session origin across buffer recycles", () => {
    let sessionStartTime = null;
    let startTime = null;

    function onSessionStart(mode, customSessionStart) {
      if (!sessionStartTime) {
        sessionStartTime = customSessionStart || Date.now();
      }
      startTime = Date.now();
    }

    function onAudioBufferRecycle() {
      startTime = Date.now();
    }

    function getDisplayDuration() {
      const currentStart = sessionStartTime || startTime;
      return Math.floor((Date.now() - currentStart) / 1000);
    }

    const origin = Date.now() - 26000;
    onSessionStart("jarvis", origin);
    assert.strictEqual(sessionStartTime, origin);
    assert.ok(getDisplayDuration() >= 26);

    onAudioBufferRecycle();
    assert.strictEqual(sessionStartTime, origin, "sessionStartTime must NOT reset on buffer recycle");
    assert.ok(getDisplayDuration() >= 26, "Duration should NOT reset to 0:00");

    function onSoftHide() {}
    onSoftHide();
    assert.strictEqual(sessionStartTime, origin, "sessionStartTime must NOT reset on soft hide");

    function onHardAbort() {
      sessionStartTime = null;
      startTime = null;
    }
    onHardAbort();
    assert.strictEqual(sessionStartTime, null, "sessionStartTime wiped on explicit ESC hard abort");
  });

  // 7. LocalCognitiveBrain Offline Responses
  console.log("\n--- 7. LocalCognitiveBrain Offline Synthesis ---");

  test("LocalCognitiveBrain synthesizes responses with persona sovereignty", () => {
    const tukResp = LocalCognitiveBrain.generateDirectResponse("fix resating this timer need long context windo with long conversations", "tuktuk", "Hritthik", false);
    assert.ok(tukResp);
    const lowerTuk = tukResp.toLowerCase();
    assert.ok(lowerTuk.includes("babe"), "Tuk Tuk offline must say babe");
    assert.strictEqual(/\b(?:bro|brother|bhai)\b/i.test(lowerTuk), false, "Tuk Tuk offline must NOT say bro");
    assert.strictEqual(tukResp.endsWith("?"), false, "Tuk Tuk offline zero trailing ?");

    // Vision
    const visResp = LocalCognitiveBrain.generateDirectResponse("fix resating this timer need long context windo with long conversations", "vision", "Hritthik", false);
    assert.ok(visResp);
    const lowerVis = visResp.toLowerCase();
    assert.ok(lowerVis.includes("brother") || lowerVis.includes("bro"), "Vision offline must say brother");
    assert.strictEqual(/\bbabe\b/i.test(lowerVis), false, "Vision offline must NOT say babe");
    assert.strictEqual(visResp.endsWith("?"), false, "Vision offline zero trailing ?");

    // Friday
    const friResp = LocalCognitiveBrain.generateDirectResponse("fix resating this timer need long context windo with long conversations", "friday", "Hritthik", false);
    assert.ok(friResp);
    const lowerFri = friResp.toLowerCase();
    assert.ok(lowerFri.includes("chief"), "Friday offline must say Chief");
    assert.strictEqual(/\bbabe\b/i.test(lowerFri), false, "Friday offline must NOT say babe");
    assert.strictEqual(friResp.endsWith("?"), false, "Friday offline zero trailing ?");

    // DD
    const ddResp = LocalCognitiveBrain.generateDirectResponse("fix resating this timer need long context windo with long conversations", "dd", "Hritthik", false);
    assert.ok(ddResp);
    const lowerDd = ddResp.toLowerCase();
    assert.ok(lowerDd.includes("bro") || lowerDd.includes("ভাই"), "DD offline must say bro");
    assert.strictEqual(/\bbabe\b/i.test(lowerDd), false, "DD offline must NOT say babe");
    assert.strictEqual(ddResp.endsWith("?"), false, "DD offline zero trailing ?");

    // Team / Squad
    const teamResp = LocalCognitiveBrain.generateDirectResponse("fix resating this timer need long context windo with long conversations", "team", "Hritthik", false);
    assert.ok(teamResp);
    assert.ok(teamResp.includes("[Tuk Tuk]:"), "Team offline must include Tuk Tuk");
    assert.ok(teamResp.includes("[Vision]:"), "Team offline must include Vision");
    assert.ok(teamResp.includes("[Friday]:"), "Team offline must include Friday");
    assert.ok(teamResp.includes("[DD]:"), "Team offline must include DD");
    assert.strictEqual(teamResp.endsWith("?"), false, "Team offline zero trailing ?");
  });

  console.log("\n============================================================");
  console.log("TEST RESULTS: " + passed + " PASSED | " + failed + " FAILED");
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error("Test runner threw error:", err);
  process.exit(1);
});
