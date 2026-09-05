/**
 * Test Suite: Instant Human-Like Response Pipeline Verification
 * 
 * Verifies:
 * 1. TextSanitizer Whisper STT mishearing normalization of "instent humen like responds".
 * 2. ActionRunner execution and rapid endpointing activation for Tuk Tuk, Vision, and Team.
 * 3. LocalCognitiveBrain multi-agent synthesis across personas with strict lexical sovereignty.
 * 4. Zero thinking delay, rapid VAD endpointing, and natural prosody enforcement.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");

test("Instant Human-Like Response Pipeline Suite", async (t) => {
  const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
  const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const activeVision = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
  const activeTeam = { name: "Squad", key: "team", voice: "en-US-AvaMultilingualNeural" };

  await t.test("1. TextSanitizer normalizes 'need instent humen like responds'", () => {
    const raw = "need instent humen like responds";
    const sanitized = textSanitizer.sanitize(raw);
    assert.strictEqual(sanitized, "Need instant human-like response", "Expected sanitized text: " + sanitized);

    const raw2 = "instent humen like responds";
    const sanitized2 = textSanitizer.sanitize(raw2);
    assert.strictEqual(sanitized2, "Instant human-like response", "Expected sanitized text: " + sanitized2);
  });

  await t.test("2. ActionRunner handles 'need instent humen like responds' for Tuk Tuk", async () => {
    const res = await actionRunner.handleAction("need instent humen like responds", activeTukTuk, jarvis);

    assert.strictEqual(res.handled, true, "Must be handled by ActionRunner");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.action, "instant_human_like_response");
    assert.strictEqual(res.data.instantMode, true);
    assert.strictEqual(res.data.humanLikeResponse, true);
    assert.strictEqual(res.data.rapidEndpointing, true);
    assert.strictEqual(res.data.roboticDelayEliminated, true);
    assert.strictEqual(res.data.status, "INSTANT_HUMAN_LIKE_OPTIMAL");

    // Check lexical sovereignty: Tuk Tuk exclusively addresses Hritthik as babe
    assert.ok(res.speech.includes("babe") || res.speech.includes("Babe"), "Tuk Tuk must address Hritthik as babe");
    assert.ok(res.speech.toLowerCase().includes("human-like") || res.speech.toLowerCase().includes("instant"), "Must mention instant human-like response");
  });

  await t.test("3. ActionRunner handles 'need instent humen like responds' for Vision", async () => {
    const res = await actionRunner.handleAction("need instent humen like responds", activeVision, jarvis);

    assert.strictEqual(res.handled, true, "Must be handled by ActionRunner");
    assert.strictEqual(res.agentName, "Vision");
    assert.strictEqual(res.data.action, "instant_human_like_response");
    assert.strictEqual(res.data.instantMode, true);
    assert.strictEqual(res.data.humanLikeResponse, true);

    // Check lexical sovereignty: Vision exclusively addresses Hritthik as brother
    assert.ok(res.speech.includes("brother") || res.speech.includes("ভাই"), "Vision must address Hritthik as brother");
  });

  await t.test("4. ActionRunner handles 'need instent humen like responds' in Team Mode", async () => {
    const res = await actionRunner.handleAction("need instent humen like responds", activeTeam, jarvis);

    assert.strictEqual(res.handled, true, "Must be handled by ActionRunner");
    assert.ok(res.speech.includes("[Tuk Tuk]"), "Must include Tuk Tuk dialogue");
    assert.ok(res.speech.includes("[Vision]"), "Must include Vision dialogue");
    assert.ok(res.speech.includes("babe") || res.speech.includes("Babe"), "Tuk Tuk must call Hritthik babe in squad context");
    assert.ok(res.speech.includes("brother") || res.speech.includes("bro"), "Vision/DD must address Hritthik properly");
  });

  await t.test("5. ActionRunner handles Bengali 'instant manusher moto response dorkar'", async () => {
    const res = await actionRunner.handleAction("instant manusher moto response dorkar", activeTukTuk, jarvis);

    assert.strictEqual(res.handled, true, "Must be handled by ActionRunner");
    assert.strictEqual(res.data.action, "instant_human_like_response");
    assert.ok(res.speech.includes("মানুষের মতো") || res.speech.includes("ইনস্ট্যান্ট"), "Must respond in natural Bengali");
  });

  await t.test("6. LocalCognitiveBrain synthesizes responses for instant human-like response across personas", () => {
    const tuktukResponse = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "need instent humen like responds");
    assert.ok(tuktukResponse.includes("babe") || tuktukResponse.includes("Babe"), "Tuk Tuk must address Hritthik as babe");
    assert.ok(tuktukResponse.toLowerCase().includes("instant") || tuktukResponse.toLowerCase().includes("human"), "Must acknowledge instant human-like response");

    const visionResponse = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "need instent humen like responds");
    assert.ok(visionResponse.includes("brother") || visionResponse.includes("ভাই"), "Vision must address Hritthik as brother");

    const teamResponse = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "need instent humen like responds");
    assert.ok(teamResponse.includes("[Tuk Tuk]"), "Team response must include Tuk Tuk");
    assert.ok(teamResponse.includes("[Vision]"), "Team response must include Vision");
  });
});
