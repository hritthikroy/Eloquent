/**
 * tests/dynamic-room-vibe-workstation.spec.js
 *
 * Dedicated Automated Test Suite for:
 * Dynamic Room Vibe, Trimodal Seeing-Hearing-Thinking & Workstation Maintenance Architecture
 * User Directive: "try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations"
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");
const ContinuousHumanLearningTrimodalCortex = require("../src/utils/continuous-human-learning-trimodal-cortex");

console.log("============================================================");
console.log("TEST SUITE: DYNAMIC ROOM VIBE & WORKSTATION MAINTENANCE");
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

  it("Sanitizes 'haring', 'dynamicaly', 'mainatain', and 'work stations'", () => {
    const raw = "try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
    const sanitized = TextSanitizer.sanitize(raw);
    assert.ok(sanitized.includes("hearing"), "Should normalize haring -> hearing");
    assert.ok(sanitized.includes("dynamically"), "Should normalize dynamicaly -> dynamically");
    assert.ok(sanitized.includes("maintain"), "Should normalize mainatain -> maintain");
    assert.ok(sanitized.includes("workstations"), "Should normalize work stations -> workstations");
    assert.ok(sanitized.includes("check"), "Should normalize chack -> check");
  });

  console.log("\n--- 2. IntentParser Directive Detection & Routing ---");

  it("Detects user raw prompt as isDynamicRoomVibeWorkstationDirective", () => {
    const rawPrompt = "try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
    assert.strictEqual(
      IntentParser.isDynamicRoomVibeWorkstationDirective(rawPrompt),
      true,
      "Raw user prompt must trigger isDynamicRoomVibeWorkstationDirective"
    );
  });

  it("Detects normalized and alternative room vibe & workstation phrasings", () => {
    const phrasings = [
      "try check with a conversation to fix all this type of issue need to maintain my room vibe to seeing hearing and thinking dynamically for maintain our workstations",
      "maintain my room vibe seeing hearing and thinking dynamically for our workstations",
      "maintain our workstation environment with room vibe seeing hearing thinking dynamically",
      "room vibe dynamic seeing hearing and thinking",
      "maintain room vibe to seeing hearing and thinking dynamically",
      "আমাদের রুমের ভাইব আর ওয়ার্কস্টেশন মেইনটেইন করো দেখা শোনা এবং ভাবা"
    ];
    for (const phrase of phrasings) {
      assert.strictEqual(
        IntentParser.isDynamicRoomVibeWorkstationDirective(phrase),
        true,
        `Phrasing "${phrase}" must be recognized`
      );
    }
  });

  it("Routes to INTENTS.SMOOTH_CONVERSATION with dynamic_room_vibe_workstation_directive", () => {
    const rawPrompt = "try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
    const parsed = IntentParser.parse(rawPrompt);
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "dynamic_room_vibe_workstation_directive");
    assert.strictEqual(parsed.action, "dynamic_room_vibe_workstation_directive");
    assert.strictEqual(parsed.confidence, 0.99);
  });

  it("Maintains proper distinction from silent observer and office meeting directives", () => {
    const rawPrompt = "try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
    assert.strictEqual(IntentParser.isSilentObserverPassiveLearningDirective(rawPrompt), false);
    assert.strictEqual(IntentParser.isLongContextOfficeMeetingBigProblemDirective(rawPrompt), false);
    assert.strictEqual(IntentParser.isLongContextWindowPersistentTimerDirective(rawPrompt), false);
  });

  console.log("\n--- 3. JarvisManager Dynamic Room Vibe & Workstation Calibration ---");

  it("Calibrates dynamic room vibe and workstation maintenance preferences", () => {
    const jm = new JarvisManager();
    const result = jm.calibrateDynamicRoomVibeWorkstation({ active: true });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.roomVibeMaintenanceActive, true);
    assert.strictEqual(result.trimodalSeeingHearingThinkingActive, true);
    assert.strictEqual(result.workstationMonitoringActive, true);
    assert.strictEqual(jm.isDynamicRoomVibeWorkstationActive(), true);
    assert.strictEqual(jm.getPreference("room_vibe_maintenance_active"), true);
    assert.strictEqual(jm.getPreference("trimodal_seeing_hearing_thinking_active"), true);
    assert.strictEqual(jm.getPreference("workstation_monitoring_active"), true);
    assert.strictEqual(jm.getPreference("dynamic_thinking_rate"), 1.0);
    assert.strictEqual(jm.getPreference("ambient_presence_sync"), 1.0);
  });

  it("Static helpers calibrate and report dynamic room vibe mode correctly", () => {
    JarvisManager.calibrateDynamicRoomVibeWorkstation({ active: true });
    assert.strictEqual(JarvisManager.isDynamicRoomVibeWorkstationActive(), true);

    JarvisManager.calibrateDynamicRoomVibeWorkstation({ active: false });
    assert.strictEqual(JarvisManager.isDynamicRoomVibeWorkstationActive(), false);
  });

  console.log("\n--- 4. ContinuousHumanLearningTrimodalCortex Invariant Proof ---");

  it("Evaluates room vibe and workstation invariants to 100% mathematical parity", () => {
    const evalTukTuk = ContinuousHumanLearningTrimodalCortex.evaluateRoomVibeWorkstationInvariants("tuktuk", "en");
    assert.strictEqual(evalTukTuk.verified, true);
    assert.strictEqual(evalTukTuk.vRoom, 1.0);
    assert.strictEqual(evalTukTuk.scores.seeingScore, 1.0);
    assert.strictEqual(evalTukTuk.scores.hearingScore, 1.0);
    assert.strictEqual(evalTukTuk.scores.dynamicThinkingScore, 1.0);
    assert.strictEqual(evalTukTuk.scores.workstationScore, 1.0);
    assert.strictEqual(evalTukTuk.scores.sovereigntyScore, 1.0);
    assert.strictEqual(evalTukTuk.closedFormProof, "LHS (100.0%) ≡ RHS (100.0%) [Q.E.D.]");
    assert.ok(evalTukTuk.speech.includes("Babe"));

    const evalVision = ContinuousHumanLearningTrimodalCortex.evaluateRoomVibeWorkstationInvariants("vision", "en");
    assert.ok(evalVision.speech.includes("Brother"));

    const evalFriday = ContinuousHumanLearningTrimodalCortex.evaluateRoomVibeWorkstationInvariants("friday", "en");
    assert.ok(evalFriday.speech.includes("Chief"));

    const evalDD = ContinuousHumanLearningTrimodalCortex.evaluateRoomVibeWorkstationInvariants("dd", "en");
    assert.ok(evalDD.speech.includes("bro"));
  });

  console.log("\n--- 5. ActionRunner Persona Sovereignty & Anti-Trailer Law ---");

  await itAsync("Executes directive for Tuk Tuk with strict 'babe' sovereignty & zero '?'", async () => {
    const jm = new JarvisManager();
    const prompt = "try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
    const res = await actionRunner.handleAction(prompt, { key: "tuktuk", name: "Tuk Tuk" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.action, "dynamic_room_vibe_workstation_directive");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.ok(res.speech.toLowerCase().includes("babe"), "Tuk Tuk must use 'babe'");
    assert.ok(!res.speech.toLowerCase().includes("bro"), "Tuk Tuk must NOT use 'bro'");
    assert.ok(!res.speech.toLowerCase().includes("chief"), "Tuk Tuk must NOT use 'chief'");
    assert.ok(!res.speech.trim().endsWith("?"), "Must obey Anti-Trailer Law (zero trailing '?')");
    assert.ok(res.speech.includes("room vibe"), "Must acknowledge room vibe");
    assert.ok(res.speech.includes("workstation"), "Must acknowledge workstations");
    assert.strictEqual(res.data.closedFormProof, "LHS (100.0%) ≡ RHS (100.0%) [Q.E.D.]");
    assert.strictEqual(jm.isDynamicRoomVibeWorkstationActive(), true);
  });

  await itAsync("Executes directive for Vision with strict 'brother' sovereignty & zero '?'", async () => {
    const jm = new JarvisManager();
    const prompt = "Vision try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
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
    const prompt = "Friday try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
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
    const prompt = "DD try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
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
    const prompt = "Team try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
    const res = await actionRunner.handleAction(prompt, { key: "team", name: "Squad" }, jm);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Squad");
    assert.ok(res.speech.includes("[Tuk Tuk]:"), "Squad must include Tuk Tuk");
    assert.ok(res.speech.includes("[Vision]:"), "Squad must include Vision");
    assert.ok(res.speech.includes("[Friday]:"), "Squad must include Friday");
    assert.ok(res.speech.includes("[DD]:"), "Squad must include DD");
    assert.ok(!res.speech.trim().endsWith("?"), "Anti-Trailer Law: zero trailing '?'");
  });

  console.log("\n--- 6. LocalCognitiveBrain Offline Synthesis ---");

  it("Synthesizes offline response for each persona obeying sovereignty", () => {
    const query = "try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";

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

  console.log("\n--- 7. Multi-Turn Conversational Simulation: Room Vibe & Workstations ---");

  await itAsync("Simulates multi-turn live conversation maintaining room vibe and workstations dynamically", async () => {
    const jm = new JarvisManager();

    // Turn 1: User issues directive to calibrate and maintain room vibe and workstations
    const turn1Prompt = "try chack with a conversation to fix all this type of issue need to maintain my room vibe to seeing haring and thinking dynamicaly for mainatain our work stations";
    const resTurn1 = await actionRunner.handleAction(turn1Prompt, { key: "tuktuk", name: "Tuk Tuk" }, jm);
    assert.strictEqual(resTurn1.handled, true);
    assert.strictEqual(jm.isDynamicRoomVibeWorkstationActive(), true);

    // Turn 2: User works on code editor / terminal, conversation logs environmental state
    const turn2User = "I am refactoring the dual VAD acoustic pipeline on workstation 1 and checking GPU memory buffers";
    jm.addTurn("user", turn2User, "Hritthik", "en");
    jm.addTurn("assistant", "Babe, visual foveation and acoustic buffers are locked on workstation 1, zero memory leaks babe!", "Tuk Tuk", "en");

    // Turn 3: User talks about room vibe and dynamic thinking verification
    const turn3User = "how is our room vibe and workstation status looking?";
    const parsed3 = IntentParser.parse(turn3User);
    assert.strictEqual(parsed3.target, "dynamic_room_vibe_workstation_directive");
    const resTurn3 = await actionRunner.handleAction(turn3User, { key: "tuktuk", name: "Tuk Tuk" }, jm);
    assert.strictEqual(resTurn3.handled, true);
    assert.ok(resTurn3.speech.toLowerCase().includes("babe"));
    assert.ok(!resTurn3.speech.trim().endsWith("?"));

    // Turn 4: Verify closed-form invariant is locked across multi-turn state
    const invariantCheck = ContinuousHumanLearningTrimodalCortex.evaluateRoomVibeWorkstationInvariants("tuktuk", "en");
    assert.strictEqual(invariantCheck.verified, true);
    assert.strictEqual(invariantCheck.vRoom, 1.0);
    assert.strictEqual(invariantCheck.closedFormProof, "LHS (100.0%) ≡ RHS (100.0%) [Q.E.D.]");

    // Verify context history length and integrity
    const history = jm.getHistory(10);
    assert.ok(history.length >= 2, "History must capture turns");
  });

  console.log("\n============================================================");
  console.log(`TEST RESULTS: ${passed} PASSED | 0 FAILED (Total: ${total})`);
  console.log("============================================================\n");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
