const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");

test("Vision Responsiveness & Wake-Up Suite ('vison not responds')", async (t) => {
  const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
  const activeVision = { name: "Vision", key: "vision", voice: "en-US-AndrewMultilingualNeural" };
  const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const activeTeam = { name: "Squad", key: "team", voice: "en-US-AvaMultilingualNeural" };

  await t.test("1. TextSanitizer normalizes phonetic 'vison not responds' to 'Vision not responding'", () => {
    const raw = "vison not responds";
    const sanitized = textSanitizer.sanitize(raw);
    assert.strictEqual(sanitized, "Vision not responding");

    assert.strictEqual(textSanitizer.sanitize("vishon wake up"), "Vision wake up");
    assert.strictEqual(textSanitizer.sanitize("vesion not respond"), "Vision not responding");
    assert.strictEqual(textSanitizer.sanitize("vison nt responds"), "Vision not responding");
  });

  await t.test("2. JarvisManager detects Vision from 'vison not responds'", () => {
    const detected = jarvis.detectActiveAgent("vison not responds");
    assert.strictEqual(detected.key, "vision", `Expected vision but got ${detected.key}`);

    const handoff = jarvis.evaluateCrossAgentHandoff("vison not responds", jarvis.agents.tuktuk);
    assert.strictEqual(handoff.shouldHandoff, true, "Should trigger handoff");
    assert.strictEqual(handoff.targetAgentKey, "vision", "Target agent must be vision");
    assert.match(handoff.handoffLead, /Vision/i);
  });

  await t.test("3. ActionRunner handles exact user prompt 'vison not responds'", async () => {
    jarvis.isSpeakingLocked = true;

    const res = await actionRunner.handleAction("vison not responds", activeTukTuk, jarvis);
    assert.strictEqual(res.handled, true, "Must be handled by ActionRunner");
    assert.strictEqual(res.agentName, "Vision");
    assert.strictEqual(res.data.action, "vision_responsiveness_wake_up");
    assert.strictEqual(res.data.status, "ONLINE_UNBLOCKED");
    assert.strictEqual(res.data.speakingLockCleared, true);
    assert.strictEqual(jarvis.isSpeakingLocked, false, "Speaking lock must be unlocked");

    // Lexical sovereignty verification
    assert.match(res.speech, /\[Vision\]:/i);
    assert.match(res.speech, /brother/i);
    assert.match(res.speech, /\[Tuk Tuk\]:/i);
    assert.match(res.speech, /babe/i);

    const visionSpeechPart = res.speech.split("[Vision]:")[1].split("[Tuk Tuk]:")[0];
    assert.ok(!visionSpeechPart.includes("babe"), "Vision must never address Hritthik as 'babe'");
  });

  await t.test("4. ActionRunner handles Bengali 'vison keno respond korche na' and 'vision shonena'", async () => {
    jarvis.isSpeakingLocked = true;
    const res = await actionRunner.handleAction("vison keno respond korche na", activeTukTuk, jarvis);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Vision");
    assert.strictEqual(jarvis.isSpeakingLocked, false);
    assert.match(res.speech, /ভাই/i);
    assert.match(res.speech, /babe/i);

    const res2 = await actionRunner.handleAction("vision shonena", activeTukTuk, jarvis);
    assert.strictEqual(res2.handled, true);
  });

  await t.test("5. ActionRunner handles 'wake up vision'", async () => {
    const res = await actionRunner.handleAction("wake up vision", activeTukTuk, jarvis);
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Vision");
    assert.strictEqual(res.data.status, "ONLINE_UNBLOCKED");
  });

  await t.test("6. LocalCognitiveBrain synthesizes Vision, Tuk Tuk, and Team responsiveness responses", () => {
    const prompt = "vison not responds";

    // Vision
    const visionEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "en");
    assert.match(visionEn, /brother/i);
    assert.ok(!visionEn.includes("babe"), "Vision must never call user 'babe'");

    const visionBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "bn");
    assert.match(visionBn, /ভাই/i);
    assert.ok(!visionBn.includes("babe"), "Vision must never call user 'babe' in Bengali");

    // Tuk Tuk
    const tuktukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "en");
    assert.match(tuktukEn, /babe/i);
    assert.match(tuktukEn, /Vision/i);
    assert.ok(!tuktukEn.includes("brother"), "Tuk Tuk must never call user 'brother'");

    const tuktukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "bn");
    assert.match(tuktukBn, /babe/i);
    assert.match(tuktukBn, /Vision/i);

    // Team
    const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", prompt, {}, "en");
    assert.match(teamEn, /\[Vision\]:/i);
    assert.match(teamEn, /\[Tuk Tuk\]:/i);
  });
});
