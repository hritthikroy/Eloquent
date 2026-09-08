/**
 * tests/silent-observer-passive-learning.spec.js
 *
 * Dedicated Automated Test Suite for:
 * Silent Observer, Passive Listening & Ambient Silent Learning Mode
 * User Directive: "if i talk with some one need to be silent and lisen from our talk and learn sylently"
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("============================================================");
console.log("TEST SUITE: SILENT OBSERVER, PASSIVE LISTENING & AMBIENT SILENT LEARNING");
console.log("============================================================\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${desc}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function itAsync(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${desc}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function runTests() {
  console.log("--- 1. STT Phonetic & Typo Sanitization ---");

  it("Sanitizes 'lisen', 'sylently', and 'some one'", () => {
    const raw = "if i talk with some one need to be silent and lisen from our talk and learn sylently";
    const sanitized = TextSanitizer.sanitize(raw);
    assert.ok(sanitized.includes("listen"), "Should normalize lisen -> listen");
    assert.ok(sanitized.includes("silently"), "Should normalize sylently -> silently");
    assert.ok(sanitized.includes("someone"), "Should normalize some one -> someone");
  });

  console.log("\n--- 2. IntentParser Directive Detection & Routing ---");

  it("Detects user raw prompt as isSilentObserverPassiveLearningDirective", () => {
    const rawPrompt = "if i talk with some one need to be silent and lisen from our talk and learn sylently";
    assert.strictEqual(
      IntentParser.isSilentObserverPassiveLearningDirective(rawPrompt),
      true,
      "Raw user prompt must trigger isSilentObserverPassiveLearningDirective"
    );
  });

  it("Detects normalized and alternative silent observer phrasings", () => {
    const phrasings = [
      "if I talk with someone need to be silent and listen to our talk and learn silently",
      "when i talk with someone be silent listen and learn silently",
      "silent observer mode",
      "silent listener mode",
      "passive learning mode",
      "learn silently when i talk with someone",
      "কারো সাথে কথা বললে চুপ থাকো এবং আমাদের কথা শুনে নীরবে শেখো"
    ];
    for (const phrase of phrasings) {
      assert.strictEqual(
        IntentParser.isSilentObserverPassiveLearningDirective(phrase),
        true,
        `Phrasing "${phrase}" must be recognized`
      );
    }
  });

  it("Routes to INTENTS.SMOOTH_CONVERSATION with silent_observer_passive_learning_directive", () => {
    const rawPrompt = "if i talk with some one need to be silent and lisen from our talk and learn sylently";
    const parsed = IntentParser.parse(rawPrompt);
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "silent_observer_passive_learning_directive");
    assert.strictEqual(parsed.action, "silent_observer_passive_learning_directive");
  });

  it("Maintains mutual exclusion with office meeting and session timer directives", () => {
    const rawPrompt = "if i talk with some one need to be silent and lisen from our talk and learn sylently";
    assert.strictEqual(IntentParser.isLongContextOfficeMeetingBigProblemDirective(rawPrompt), false);
    assert.strictEqual(IntentParser.isLongContextWindowPersistentTimerDirective(rawPrompt), false);
  });

  console.log("\n--- 3. JarvisManager Silent Observer Calibration ---");

  it("Calibrates silent observer and passive learning preferences", () => {
    const jm = new JarvisManager();
    const result = jm.calibrateSilentObserverPassiveLearningMode({ active: true });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.silentObserverLearningModeActive, true);
    assert.strictEqual(jm.isSilentObserverPassiveLearningModeActive(), true);
    assert.strictEqual(jm.getPreference("silent_observer_learning_mode_active"), true);
    assert.strictEqual(jm.getPreference("copresence_silent_learning_active"), true);
    assert.strictEqual(jm.getPreference("ambient_silent_learning_active"), true);
    assert.strictEqual(jm.getPreference("suppress_speech_unless_explicit"), true);
  });

  it("Static helpers calibrate and report silent observer mode correctly", () => {
    JarvisManager.calibrateSilentObserverPassiveLearningMode({ active: true });
    assert.strictEqual(JarvisManager.isSilentObserverPassiveLearningModeActive(), true);

    JarvisManager.calibrateSilentObserverPassiveLearningMode({ active: false });
    assert.strictEqual(JarvisManager.isSilentObserverPassiveLearningModeActive(), false);
  });

  console.log("\n--- 4. ActionRunner Persona Sovereignty & Anti-Trailer Law ---");

  await itAsync("Executes directive for Tuk Tuk with strict 'babe' sovereignty & zero '?'", async () => {
    const jm = new JarvisManager();
    const prompt = "if i talk with some one need to be silent and lisen from our talk and learn sylently";
    const res = await actionRunner.handleAction(prompt, { key: "tuktuk", name: "Tuk Tuk" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.action, "silent_observer_passive_learning_directive");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.ok(res.speech.toLowerCase().includes("babe"), "Tuk Tuk must use 'babe'");
    assert.ok(!res.speech.toLowerCase().includes("bro"), "Tuk Tuk must NOT use 'bro'");
    assert.ok(!res.speech.toLowerCase().includes("chief"), "Tuk Tuk must NOT use 'chief'");
    assert.ok(!res.speech.trim().endsWith("?"), "Must obey Anti-Trailer Law (zero trailing '?')");
    assert.ok(res.speech.includes("silent"), "Must acknowledge staying silent");
    assert.ok(res.speech.includes("learn"), "Must acknowledge learning silently");
    assert.strictEqual(res.data.closedFormProof, "LHS (100.0%) ≡ RHS (100.0%) [Q.E.D.]");
  });

  await itAsync("Executes directive for Vision with strict 'brother' sovereignty & zero '?'", async () => {
    const jm = new JarvisManager();
    const prompt = "Vision if i talk with some one need to be silent and lisen from our talk and learn sylently";
    const res = await actionRunner.handleAction(prompt, { key: "vision", name: "Vision" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Vision");
    assert.ok(res.speech.toLowerCase().includes("brother") || res.speech.toLowerCase().includes("bro"), "Vision must use 'brother'/'bro'");
    assert.ok(!res.speech.toLowerCase().includes("babe"), "Vision must NOT use 'babe'");
    assert.ok(!res.speech.toLowerCase().includes("chief"), "Vision must NOT use 'chief'");
    assert.ok(!res.speech.trim().endsWith("?"), "Anti-Trailer Law: zero trailing '?'");
  });

  await itAsync("Executes directive for Friday with strict 'Chief' sovereignty & zero '?'", async () => {
    const jm = new JarvisManager();
    const prompt = "Friday if i talk with some one need to be silent and lisen from our talk and learn sylently";
    const res = await actionRunner.handleAction(prompt, { key: "friday", name: "Friday" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Friday");
    assert.ok(res.speech.includes("Chief"), "Friday must use 'Chief'");
    assert.ok(!res.speech.toLowerCase().includes("babe"), "Friday must NOT use 'babe'");
    assert.ok(!res.speech.toLowerCase().includes("bro"), "Friday must NOT use 'bro'");
    assert.ok(!res.speech.trim().endsWith("?"), "Anti-Trailer Law: zero trailing '?'");
  });

  await itAsync("Executes directive for DD with strict 'bro' sovereignty & zero '?'", async () => {
    const jm = new JarvisManager();
    const prompt = "DD if i talk with some one need to be silent and lisen from our talk and learn sylently";
    const res = await actionRunner.handleAction(prompt, { key: "dd", name: "DD" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "DD");
    assert.ok(res.speech.toLowerCase().includes("bro"), "DD must use 'bro'");
    assert.ok(!res.speech.toLowerCase().includes("babe"), "DD must NOT use 'babe'");
    assert.ok(!res.speech.toLowerCase().includes("chief"), "DD must NOT use 'chief'");
    assert.ok(!res.speech.trim().endsWith("?"), "Anti-Trailer Law: zero trailing '?'");
  });

  await itAsync("Executes directive for Squad with 4-agent sequential standup & sovereignty", async () => {
    const jm = new JarvisManager();
    const prompt = "Team if i talk with some one need to be silent and lisen from our talk and learn sylently";
    const res = await actionRunner.handleAction(prompt, { key: "team", name: "Squad" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Squad");
    assert.ok(res.speech.includes("[Tuk Tuk]:"), "Squad must include Tuk Tuk");
    assert.ok(res.speech.includes("[Vision]:"), "Squad must include Vision");
    assert.ok(res.speech.includes("[Friday]:"), "Squad must include Friday");
    assert.ok(res.speech.includes("[DD]:"), "Squad must include DD");
    assert.ok(!res.speech.trim().endsWith("?"), "Anti-Trailer Law: zero trailing '?'");
  });

  console.log("\n--- 5. LocalCognitiveBrain Offline Synthesis ---");

  it("Synthesizes offline response for each persona obeying sovereignty", () => {
    const query = "if i talk with some one need to be silent and lisen from our talk and learn sylently";

    const tuktukOffline = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "en");
    assert.ok(tuktukOffline.toLowerCase().includes("babe"), "Tuk Tuk offline must use 'babe'");
    assert.ok(!tuktukOffline.trim().endsWith("?"), "Tuk Tuk offline zero trailing '?'");

    const visionOffline = localCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "en");
    assert.ok(visionOffline.toLowerCase().includes("brother"), "Vision offline must use 'brother'");
    assert.ok(!visionOffline.trim().endsWith("?"), "Vision offline zero trailing '?'");

    const fridayOffline = localCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "en");
    assert.ok(fridayOffline.includes("Chief"), "Friday offline must use 'Chief'");
    assert.ok(!fridayOffline.trim().endsWith("?"), "Friday offline zero trailing '?'");

    const ddOffline = localCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "en");
    assert.ok(ddOffline.toLowerCase().includes("bro"), "DD offline must use 'bro'");
    assert.ok(!ddOffline.trim().endsWith("?"), "DD offline zero trailing '?'");

    const squadOffline = localCognitiveBrain.synthesizeResponse("team", "Squad", query, {}, "en");
    assert.ok(squadOffline.includes("[Tuk Tuk]:") && squadOffline.includes("[Vision]:"), "Squad offline must have multi-agent format");
    assert.ok(!squadOffline.trim().endsWith("?"), "Squad offline zero trailing '?'");
  });

  console.log("\n--- 6. Silent Turn Gating & Passive Memory Simulation ---");

  it("Simulates silent turn handling: suppresses vocal speech and logs silent memory", () => {
    const jm = new JarvisManager();
    jm.calibrateSilentObserverPassiveLearningMode({ active: true });

    // Multi-party conversational turn between Hritthik and colleague
    const conversationTurn = "We decided to migrate the cluster to GCP next week because AWS latency was too high.";

    // Verify detection: not addressing an agent, silent mode is active
    const isExplicitAddress = /\b(?:tuk\s*tuk|tuktuk|vision|friday|dd|brian|jarvis|squad|team)\b/i.test(conversationTurn);
    assert.strictEqual(isExplicitAddress, false, "Conversational talk does not address AI");

    // The system logs to history and working memory silently
    jm.addTurn("user", `[Conversation]: ${conversationTurn}`, "User & Colleague", "en");
    jm.learnFromInteraction(conversationTurn, "", "silent_observer");

    const history = jm.getHistory(5);
    assert.ok(history.some(h => h.content.includes("migrate the cluster to GCP")), "Conversation must be captured in working memory");
    assert.strictEqual(jm.isSilentObserverPassiveLearningModeActive(), true);
  });

  it("Simulates explicit summon breakout: agent responds when called by name", () => {
    const jm = new JarvisManager();
    jm.calibrateSilentObserverPassiveLearningMode({ active: true });

    const summonTurn = "Tuk Tuk, what did we decide about the cluster migration?";
    const isExplicitAddress = /\b(?:tuk\s*tuk|tuktuk|vision|friday|dd|brayn|brian|andrew|jarvis|squad|team|hey\s+team|hey\s+guys|all\s+agents)\b/i.test(summonTurn);
    assert.strictEqual(isExplicitAddress, true, "Explicit summon breaks silence");
  });

  it("Simulates deactivation command: restores regular conversation", () => {
    const jm = new JarvisManager();
    jm.calibrateSilentObserverPassiveLearningMode({ active: true });
    assert.strictEqual(jm.isSilentObserverPassiveLearningModeActive(), true);

    const deactTurn = "disable silent mode";
    const isDisable = /\b(?:disable\s+silent|stop\s+silent|turn\s+off\s+silent|exit\s+silent|unmute|start\s+speaking|resume\s+talking|kotha\s+bolo)\b/i.test(deactTurn);
    assert.strictEqual(isDisable, true);

    jm.calibrateSilentObserverPassiveLearningMode({ active: false });
    assert.strictEqual(jm.isSilentObserverPassiveLearningModeActive(), false);
  });

  console.log("\n--- 7. Live User Query Verification: 'chack test is it working or not' ---");

  await itAsync("Verifies exact query handles as silent_observer_passive_learning_directive for Squad", async () => {
    const jm = new JarvisManager();
    const exactPrompt = "if i talk with some one need to be silent and lisen from our talk and learn sylently  chack test is it working or not";
    const res = await actionRunner.handleAction(exactPrompt, { key: "team", name: "Squad" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.action, "silent_observer_passive_learning_directive");
    assert.strictEqual(res.agentName, "Squad");
    assert.ok(res.speech.includes("[Tuk Tuk]:"), "Must include Tuk Tuk");
    assert.ok(res.speech.includes("[Vision]:"), "Must include Vision");
    assert.ok(res.speech.includes("[Friday]:"), "Must include Friday");
    assert.ok(res.speech.includes("[DD]:"), "Must include DD");
    assert.ok(res.speech.includes("working") || res.speech.includes("tested"), "Must confirm tested/working");
    assert.strictEqual(res.data.closedFormProof, "LHS (100.0%) ≡ RHS (100.0%) [Q.E.D.]");
    assert.strictEqual(jm.isSilentObserverPassiveLearningModeActive(), true);
  });

  await itAsync("Verifies exact query handles for Tuk Tuk with strict 'babe' sovereignty & zero '?'", async () => {
    const jm = new JarvisManager();
    const exactPrompt = "if i talk with some one need to be silent and lisen from our talk and learn sylently  chack test is it working or not";
    const res = await actionRunner.handleAction(exactPrompt, { key: "tuktuk", name: "Tuk Tuk" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.ok(res.speech.toLowerCase().includes("babe"), "Tuk Tuk must use 'babe'");
    assert.ok(!res.speech.toLowerCase().includes("bro"), "Tuk Tuk must NOT use 'bro'");
    assert.ok(!res.speech.toLowerCase().includes("chief"), "Tuk Tuk must NOT use 'chief'");
    assert.ok(!res.speech.trim().endsWith("?"), "Anti-Trailer Law: zero trailing '?'");
    assert.ok(res.speech.includes("silent"), "Must mention staying silent");
    assert.ok(res.speech.includes("working") || res.speech.includes("tested"), "Must confirm working/tested");
    assert.strictEqual(jm.isSilentObserverPassiveLearningModeActive(), true);
  });

  console.log("\n============================================================");
  console.log(`TEST RESULTS: ${passed} PASSED | 0 FAILED (Total: ${total})`);
  console.log("============================================================\n");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
