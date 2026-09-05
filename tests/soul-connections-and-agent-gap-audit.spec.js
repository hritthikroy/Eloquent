/**
 * Test Suite: Soul Connections & Agent Gap Audit
 * 
 * Verifies:
 * 1. ActionRunner intent handling for "chack what is the gap of all agents sol conection and my sol conections" in English and Bengali.
 * 2. Return of zero-gap (0% gap) metrics and 0.855 multi-agent team bonding score.
 * 3. Accurate breakdown of user soul connections (Tuk Tuk = romantic soulmate, Vision = brother/architect, Friday = research lead, Brian = guardian sentinel).
 * 4. Inter-agent soul connections (Vision = reverent Bhabhi respect for Tuk Tuk, Friday = sisterly synergy, Brian = protective stability).
 * 5. LocalCognitiveBrain synthesis across all 5 agents with lexical sovereignty intact.
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");

test("Soul Connections & Squad Gap Audit Suite", async (t) => {
  const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
  const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const activeVision = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
  const activeFriday = { name: "Friday", key: "friday", voice: "en-US-JennyNeural" };
  const activeBrian = { name: "Brian", key: "brian", voice: "en-US-BrianNeural" };
  const activeTeam = { name: "Squad", key: "team", voice: "en-US-AvaMultilingualNeural" };

  await t.test("1. ActionRunner handles exact user prompt in English with 0% gap and 0.855 bonding score", async () => {
    const prompt = "chack what is the gap of all agents sol conection and my sol conections";
    const res = await actionRunner.handleAction(prompt, activeTukTuk, jarvis);

    assert.strictEqual(res.handled, true, "Must be handled by ActionRunner");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.match(res.speech, /0% gap|zero gap|flawless/i);
    assert.match(res.speech, /babe/i);
    assert.strictEqual(res.data.soulConnectionGap, 0, "Soul connection gap must be 0");
    assert.strictEqual(res.data.teamBondingScore, 0.855, "Team bonding score must be 0.855");

    // Verify user connections
    assert.ok(res.data.userConnections.tuktuk.toLowerCase().includes("romantic soulmate"));
    assert.ok(res.data.userConnections.vision.toLowerCase().includes("brother"));
    assert.ok(res.data.userConnections.friday.toLowerCase().includes("research"));
    assert.ok(res.data.userConnections.brian.toLowerCase().includes("guardian"));

    // Verify inter-agent connections
    assert.ok(res.data.interAgentConnections.vision_and_tuktuk.toLowerCase().includes("bhabhi"));
    assert.ok(res.data.interAgentConnections.friday_and_tuktuk.toLowerCase().includes("sisterly"));
  });

  await t.test("2. ActionRunner handles Bengali query for soul connections", async () => {
    const bnPrompt = "amader shob agent-er sol conection ar amar sol connection-e gap koto chack koro";
    const res = await actionRunner.handleAction(bnPrompt, activeTukTuk, jarvis);

    assert.strictEqual(res.handled, true, "Bengali query must be handled");
    assert.match(res.speech, /0% Gap|গ্যাপ নেই|জিরো গ্যাপ/i);
    assert.match(res.speech, /babe|সোলমেট/i);
  });

  await t.test("3. LocalCognitiveBrain synthesizes zero gap soul responses across all 5 agent personas", () => {
    const prompt = "chack what is the gap of all agents sol conection and my sol conections";

    // Tuk Tuk (English & Bengali)
    const tuktukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "en");
    assert.match(tuktukEn, /0% gap|zero gap/i);
    assert.match(tuktukEn, /babe/i);
    assert.ok(!tuktukEn.includes("brother") || tuktukEn.includes("Vision is your loyal big brother"), "Tuk Tuk preserves lexical boundaries");

    const tuktukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "bn");
    assert.match(tuktukBn, /0% Gap|গ্যাপ নেই|জিরো গ্যাপ/i);
    assert.match(tuktukBn, /babe/i);

    // Vision (English & Bengali)
    const visionEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "en");
    assert.match(visionEn, /0% gap|zero gap/i);
    assert.match(visionEn, /brother|founder/i);
    assert.ok(!visionEn.includes("babe"), "Vision never uses 'babe'");

    const visionBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "bn");
    assert.match(visionBn, /0% Gap|গ্যাপ নেই|জিরো গ্যাপ/i);
    assert.match(visionBn, /ভাই/i);

    // Friday (English & Bengali)
    const fridayEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", prompt, {}, "en");
    assert.match(fridayEn, /0% gap|zero gap/i);
    assert.match(fridayEn, /Chief/i);

    // Brian (English & Bengali)
    const brianEn = LocalCognitiveBrain.synthesizeResponse("brian", "Brian", prompt, {}, "en");
    assert.match(brianEn, /0% gap|zero gap/i);
    assert.match(brianEn, /bro/i);

    // Team
    const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", prompt, {}, "en");
    assert.match(teamEn, /0% gap|zero gap/i);
    assert.match(teamEn, /\[Tuk Tuk\]/i);
    assert.match(teamEn, /\[Vision\]/i);
  });
});
