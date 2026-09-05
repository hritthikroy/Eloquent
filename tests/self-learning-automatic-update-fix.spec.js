const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const JarvisManager = require("../src/utils/jarvis-manager");
const ZeroLossMemoryEngine = require("../src/utils/zero-loss-memory");
const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

describe("Self-Learning System & Automatic Background Memory Update Suite", () => {
  let testUserDataDir;
  let jarvis;

  before(() => {
    testUserDataDir = path.join(__dirname, `test-self-learning-dir-${Date.now()}`);
    if (!fs.existsSync(testUserDataDir)) {
      fs.mkdirSync(testUserDataDir, { recursive: true });
    }
    jarvis = new JarvisManager(testUserDataDir);
    jarvis.config.userName = "Hritthik";
  });

  after(() => {
    if (fs.existsSync(testUserDataDir)) {
      try {
        fs.rmSync(testUserDataDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  test("1. TextSanitizer normalizes phonetic STT mishearings of self-learning update directives", () => {
    const raw1 = "fix self learning system thay are not update thay are automaticaly";
    const clean1 = TextSanitizer.sanitize(raw1);
    assert.strictEqual(clean1, "Fix self learning system they are not updating automatically");

    const raw2 = "self learnig thay not update";
    const clean2 = TextSanitizer.sanitize(raw2);
    assert.ok(clean2.toLowerCase().includes("self learning"));
    assert.ok(clean2.toLowerCase().includes("don't update") || clean2.toLowerCase().includes("not updating"));

    const raw3 = "thay are automaticaly updating";
    const clean3 = TextSanitizer.sanitize(raw3);
    assert.ok(clean3.toLowerCase().includes("automatically updating"));
  });

  test("2. JarvisManager healAndAuditMemory cleanses corrupt preferences and synchronizes roles", () => {
    // Inject corrupt items typical of previous heuristic leaks
    jarvis.memory.learnedPreferences = [
      "Theme: light",
      "Preference: Next.js",
      "don't: need to be a good thing",
      "don't: fix koro",
      "Preference: Fix yourself.",
      "don't: even",
      "never: known",
      "Prefers: you",
      "Preference: May I fix yourself?",
      "Prefers: tailwind css and typescript"
    ];

    jarvis.memory.profile.family = [
      "Tuk Tuk (Soulmate & Co-Founder)",
      "Vision (Big Brother & Lead Engineer)",
      "Jenny (Sister & Head of Intel)",
      "Brian (Guardian Brother & DevOps)"
    ];

    const auditResult = jarvis.healAndAuditMemory();
    assert.strictEqual(auditResult.success, true);
    assert.ok(auditResult.prunedPreferencesCount >= 5, "Should prune corrupt preferences");

    // Valid preferences remain
    assert.ok(jarvis.memory.learnedPreferences.some(p => p.includes("Next.js")));
    assert.ok(jarvis.memory.learnedPreferences.some(p => p.includes("tailwind css")));

    // Corrupted items purged
    assert.ok(!jarvis.memory.learnedPreferences.some(p => p.toLowerCase().includes("fix yourself")));
    assert.ok(!jarvis.memory.learnedPreferences.some(p => p.toLowerCase().includes("don't: need")));
    assert.ok(!jarvis.memory.learnedPreferences.some(p => p.toLowerCase().includes("don't: even")));
    assert.ok(!jarvis.memory.learnedPreferences.some(p => p.toLowerCase() === "prefers: you"));

    // Family roles updated
    assert.ok(jarvis.memory.profile.family.some(m => m.includes("DD (Guardian Brother & DevOps)")));
    assert.ok(jarvis.memory.profile.family.some(m => m.includes("Friday (Sister & Head of Intel)")));
  });

  test("3. JarvisManager learnFromInteraction ignores casual speech and captures genuine directives", () => {
    const beforeCount = jarvis.memory.learnedPreferences.length;

    // Casual conversational phrases should NOT be captured as directives
    jarvis.learnFromInteraction("I do not need to hear this right now", "Understood", "Tuk Tuk");
    jarvis.learnFromInteraction("Never heard of that framework before", "Got it", "Vision");
    jarvis.learnFromInteraction("Don't worry about it", "Sure thing", "Tuk Tuk");
    jarvis.learnFromInteraction("Fix yourself.", "Apologies babe", "Tuk Tuk");

    assert.strictEqual(jarvis.memory.learnedPreferences.length, beforeCount, "Casual phrases must not be added to preferences");

    // Genuine technical & workflow directives MUST be captured
    jarvis.learnFromInteraction("Always use TypeScript for all backend services", "Locked in brother", "Vision");
    jarvis.learnFromInteraction("Amar pochondo Rust and Go", "Noted babe!", "Tuk Tuk");

    assert.ok(jarvis.memory.learnedPreferences.some(p => p.toLowerCase().includes("typescript")));
    assert.ok(jarvis.memory.learnedPreferences.some(p => p.toLowerCase().includes("rust and go")));
  });

  test("4. ZeroLossMemoryEngine unblockAndDrainBacklog handles retries without head-of-line blocking", async () => {
    const engine = new ZeroLossMemoryEngine({ userDataPath: testUserDataDir, jarvisManager: jarvis });

    // Seed backlog with one repeatedly failing item and one valid item
    engine.backlog = [
      { id: 101, userSpeech: "unparseable gibberish", assistantReply: "...", queuedAt: new Date().toISOString(), attempts: 3 },
      { id: 102, userSpeech: "I prefer dark theme with OLED contrast", assistantReply: "Noted", queuedAt: new Date().toISOString(), attempts: 0 }
    ];

    engine.unblockAndDrainBacklog(null, jarvis);

    // Failing item with attempts >= 3 should be dropped to prevent head-of-line queue stalling
    assert.ok(!engine.backlog.some(b => b.id === 101), "Failing item must be pruned from backlog");

    engine.destroy();
  });

  test("5. ActionRunner handles 'fix self learning system they are not updating automatically' across agents", async () => {
    const prompt = "fix self learning system they are not updating automatically";

    // Tuk Tuk
    const resTukTuk = await actionRunner.handleAction(prompt, { key: "tuktuk", name: "Tuk Tuk" }, jarvis);
    assert.strictEqual(resTukTuk.handled, true);
    assert.strictEqual(resTukTuk.agentName, "Tuk Tuk");
    assert.match(resTukTuk.speech, /babe/i);
    assert.match(resTukTuk.speech, /self-learning|fixed|automatic/i);
    assert.strictEqual(resTukTuk.data.selfLearningActive, true);
    assert.strictEqual(resTukTuk.data.automaticUpdatesArmed, true);

    // Vision
    const resVision = await actionRunner.handleAction(prompt, { key: "vision", name: "Vision" }, jarvis);
    assert.strictEqual(resVision.handled, true);
    assert.strictEqual(resVision.agentName, "Vision");
    assert.match(resVision.speech, /brother/i);
    assert.match(resVision.speech, /self-learning|repaired|backlog/i);

    // Friday
    const resFriday = await actionRunner.handleAction(prompt, { key: "friday", name: "Friday" }, jarvis);
    assert.strictEqual(resFriday.handled, true);
    assert.strictEqual(resFriday.agentName, "Friday");
    assert.match(resFriday.speech, /Chief|operational/i);

    // DD
    const resDD = await actionRunner.handleAction(prompt, { key: "dd", name: "DD" }, jarvis);
    assert.strictEqual(resDD.handled, true);
    assert.strictEqual(resDD.agentName, "DD");
    assert.match(resDD.speech, /bro/i);

    // Squad (Team Mode)
    const resSquad = await actionRunner.handleAction(prompt, { key: "team", name: "Squad" }, jarvis);
    assert.strictEqual(resSquad.handled, true);
    assert.match(resSquad.speech, /\[Tuk Tuk\]/i);
    assert.match(resSquad.speech, /\[Vision\]/i);
    assert.match(resSquad.speech, /\[DD\]/i);
  });

  test("6. ActionRunner handles Bengali self-learning repair prompt", async () => {
    const bnPrompt = "self learning system update hocche na, fix koro";
    const res = await actionRunner.handleAction(bnPrompt, { key: "tuktuk", name: "Tuk Tuk" }, jarvis);
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.match(res.speech, /[\u0980-\u09FF]/, "Must return Bengali script");
    assert.match(res.speech, /সেলফ-লার্নিং|ফিক্স|babe/i);
  });

  test("7. LocalCognitiveBrain synthesizes self-learning responses across all personas", () => {
    const query = "fix self learning system thay are not update thay are automaticaly";

    // Tuk Tuk
    const ttReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "en");
    assert.match(ttReply, /babe/i);
    assert.match(ttReply, /self-learning|fixed|automatic/i);

    // Vision
    const visReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "en");
    assert.match(visReply, /brother/i);
    assert.match(visReply, /Self-learning|repaired|backlog/i);

    // Friday
    const friReply = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "en");
    assert.match(friReply, /Chief/i);
    assert.match(friReply, /self-learning|operational/i);

    // DD
    const ddReply = LocalCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "en");
    assert.match(ddReply, /bro/i);
    assert.match(ddReply, /Memory|daemons|backlog/i);

    // Team
    const squadReply = LocalCognitiveBrain.synthesizeResponse("team", "Squad", query, {}, "en");
    assert.match(squadReply, /\[Tuk Tuk\]/i);
    assert.match(squadReply, /\[Vision\]/i);
    assert.match(squadReply, /self-learning/i);
  });
});
