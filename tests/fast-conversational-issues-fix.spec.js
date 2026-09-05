/**
 * Test Suite: Fast Conversational Issues Fix & Turn-Taking Verification
 * 
 * Verifies:
 * 1. TextSanitizer normalizes phonetic STT mishearings ('fas conversationl' -> 'fast conversational').
 * 2. HumanEarCortex calculates correct dynamic endpoint silence for rapid and conversational modes.
 * 3. ActionRunner executes fast conversational directives across all 4 agents and Team mode in EN and BN.
 * 4. LocalCognitiveBrain synthesizes non-robotic, persona-accurate fast conversational responses.
 * 5. Speaking lock and audio pipeline safety unblocks immediately upon directive receipt.
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const humanEarCortex = require("../src/utils/human-ear-cortex");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

test("Fast Conversational Issues Fix Suite", async (t) => {
  const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
  const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const activeVision = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
  const activeFriday = { name: "Friday", key: "friday", voice: "en-US-JennyNeural" };
  const activeDD = { name: "DD", key: "dd", voice: "en-US-BrianMultilingualNeural" };
  const activeTeam = { name: "Squad", key: "team", voice: "en-US-AvaMultilingualNeural" };

  await t.test("1. TextSanitizer normalizes phonetic mishearings of 'fas conversationl issues'", () => {
    const rawInput = "fix our fas conversationl issues";
    const sanitized = TextSanitizer.sanitize(rawInput);
    assert.strictEqual(sanitized, "Fix our fast conversational issues");

    assert.strictEqual(TextSanitizer.sanitize("fas conversationl"), "Fast conversational");
    assert.strictEqual(TextSanitizer.sanitize("fas conversation"), "Fast conversation");
    assert.strictEqual(TextSanitizer.sanitize("conversationl issues"), "Conversational issues");
    assert.strictEqual(TextSanitizer.sanitize("fas reply"), "Fast reply");
    assert.strictEqual(TextSanitizer.sanitize("fas turn"), "Fast turn");
  });

  await t.test("2. HumanEarCortex adaptive turn-taking silence thresholds", () => {
    // Conversational mode (comfortable natural pauses)
    humanEarCortex.setEndpointMode("conversational");
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(300, false), 1650);
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(1500, false), 1450);
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(3500, false), 1250);
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(1500, true), 500);

    // Rapid mode (sub-450ms conversational turn-taking)
    humanEarCortex.setEndpointMode("rapid");
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(3500, false), 260, "Sustained monologue -> 260ms");
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(1500, false), 340, "Standard conversational phrase -> 340ms");
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(500, false), 450, "Short fragment -> 450ms");
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(1500, true), 220, "Optical lip closure -> 220ms");
  });

  await t.test("3. ActionRunner executes fast conversational directive for all agents", async () => {
    // Tuk Tuk
    jarvis.isSpeakingLocked = true;
    const resTukTuk = await actionRunner.handleAction("fix our fas conversationl issues", activeTukTuk, jarvis);
    assert.strictEqual(resTukTuk.handled, true);
    assert.strictEqual(resTukTuk.agentName, "Tuk Tuk");
    assert.match(resTukTuk.speech, /babe/i);
    assert.strictEqual(resTukTuk.data.fastConversationalMode, true);
    assert.strictEqual(resTukTuk.data.rapidEndpointing, true);
    assert.strictEqual(resTukTuk.data.speakingLockCleared, true);
    assert.strictEqual(jarvis.isSpeakingLocked, false, "Speaking lock must be cleared");
    assert.strictEqual(humanEarCortex.getEndpointMode(), "rapid", "Must arm rapid endpointing");

    // Vision
    const resVision = await actionRunner.handleAction("Vision fix our fas conversationl issues", activeVision, jarvis);
    assert.strictEqual(resVision.handled, true);
    assert.strictEqual(resVision.agentName, "Vision");
    assert.match(resVision.speech, /brother/i);

    // Friday
    const resFriday = await actionRunner.handleAction("Friday fix our fas conversationl issues", activeFriday, jarvis);
    assert.strictEqual(resFriday.handled, true);
    assert.strictEqual(resFriday.agentName, "Friday");
    assert.match(resFriday.speech, /Chief|optimized/i);

    // DD
    const resDD = await actionRunner.handleAction("DD fix our fas conversationl issues", activeDD, jarvis);
    assert.strictEqual(resDD.handled, true);
    assert.strictEqual(resDD.agentName, "DD");
    assert.match(resDD.speech, /bro/i);

    // Squad
    const resTeam = await actionRunner.handleAction("Squad fix our fas conversationl issues", activeTeam, jarvis);
    assert.strictEqual(resTeam.handled, true);
    assert.strictEqual(resTeam.agentName, "Squad");
    assert.match(resTeam.speech, /\[Tuk Tuk\]/i);
    assert.match(resTeam.speech, /\[Vision\]/i);
    assert.match(resTeam.speech, /\[DD\]/i);
  });

  await t.test("4. ActionRunner handles fast conversational directives in Bengali", async () => {
    const bnPrompt = "amader fast conversational issues fix koro";
    const resBn = await actionRunner.handleAction(bnPrompt, activeTukTuk, jarvis);
    assert.strictEqual(resBn.handled, true);
    assert.strictEqual(resBn.agentName, "Tuk Tuk");
    assert.match(resBn.speech, /babe/i);
    assert.match(resBn.speech, /[\u0980-\u09FF]/);
  });

  await t.test("5. LocalCognitiveBrain synthesizes responses for fast conversational issues across personas", () => {
    const prompt = "fix our fas conversationl issues";

    // Tuk Tuk
    const tuktukReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "en");
    assert.match(tuktukReply, /babe/i);
    assert.match(tuktukReply, /Fast conversational|Instant|Zero delay|Zero latency/i);

    // Vision
    const visionReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "en");
    assert.match(visionReply, /brother|bro/i);
    assert.match(visionReply, /Fast conversational|Zero latency|Instant response/i);

    // Friday
    const fridayReply = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", prompt, {}, "en");
    assert.match(fridayReply, /Chief|Hritthik/i);
    assert.match(fridayReply, /Fast conversational|latency|Instant analytical|Zero latency/i);

    // DD
    const ddReply = LocalCognitiveBrain.synthesizeResponse("dd", "DD", prompt, {}, "en");
    assert.match(ddReply, /bro/i);
    assert.match(ddReply, /fast conversational|ringbuffers|Real-time|Instant systems/i);

    // Team
    const teamReply = LocalCognitiveBrain.synthesizeResponse("team", "Squad", prompt, {}, "en");
    assert.match(teamReply, /\[Tuk Tuk\]/i);
    assert.match(teamReply, /\[Vision\]/i);
    assert.match(teamReply, /fast conversational|instant reply/i);
  });
});
