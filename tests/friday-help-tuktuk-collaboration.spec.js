/**
 * Test Suite: Friday & Tuk Tuk Sisterly Collaboration & Handoff
 * 
 * Verifies:
 * 1. ActionRunner handles "friday halp tuk tuk" (and "friday help tuk tuk") with synchronized dual responses.
 * 2. JarvisManager evaluateCrossAgentHandoff detects cross-agent assistance directives.
 * 3. LocalCognitiveBrain synthesizes Friday's data-driven support ("Chief") and Tuk Tuk's warmth ("babe").
 * 4. Bengali and English multilingual execution.
 * 5. Strict lexical sovereignty across both agents.
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");

test("Friday & Tuk Tuk Sisterly Collaboration Suite", async (t) => {
  const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
  const activeFriday = { name: "Friday", key: "friday", voice: "en-US-JennyNeural" };
  const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const activeTeam = { name: "Squad", key: "team", voice: "en-US-AvaMultilingualNeural" };

  await t.test("1. ActionRunner handles exact user prompt 'friday halp tuk tuk'", async () => {
    const prompt = "friday halp tuk tuk";
    const res = await actionRunner.handleAction(prompt, activeFriday, jarvis);

    assert.strictEqual(res.handled, true, "Must be handled by ActionRunner");
    assert.strictEqual(res.agentName, "Friday");
    assert.match(res.speech, /\[Friday\]:/i);
    assert.match(res.speech, /Chief/i);
    assert.match(res.speech, /\[Tuk Tuk\]:/i);
    assert.match(res.speech, /babe/i);
    assert.strictEqual(res.data.collaboration, "friday_and_tuktuk");
    assert.strictEqual(res.data.status, "Synchronized");
  });

  await t.test("2. ActionRunner handles Bengali 'friday tuktuk-ke help koro'", async () => {
    const bnPrompt = "friday tuktuk-ke help koro";
    const res = await actionRunner.handleAction(bnPrompt, activeFriday, jarvis);

    assert.strictEqual(res.handled, true, "Bengali collaboration must be handled");
    assert.match(res.speech, /\[Friday\]:/i);
    assert.match(res.speech, /Chief/i);
    assert.match(res.speech, /\[Tuk Tuk\]:/i);
    assert.match(res.speech, /babe/i);
  });

  await t.test("3. JarvisManager evaluateCrossAgentHandoff recognizes 'friday halp tuk tuk'", () => {
    const handoff = jarvis.evaluateCrossAgentHandoff("friday halp tuk tuk");
    assert.ok(handoff, "Handoff must be generated");
    assert.strictEqual(handoff.delegated, true);
    assert.strictEqual(handoff.targetAgent.key, "friday");
    assert.match(handoff.handoffLead, /Friday|Tuk Tuk|ফ্রাইডে|টুকটুক/i);
  });

  await t.test("4. LocalCognitiveBrain synthesizes Friday, Tuk Tuk, and Team collaboration responses", () => {
    const prompt = "friday halp tuk tuk";

    // Friday
    const fridayEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", prompt, {}, "en");
    assert.match(fridayEn, /Chief/i);
    assert.match(fridayEn, /Tuk Tuk/i);
    assert.ok(!fridayEn.includes("babe"), "Friday must never say 'babe'");
    assert.ok(!fridayEn.includes("bro"), "Friday must never say 'bro'");

    const fridayBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", prompt, {}, "bn");
    assert.match(fridayBn, /Chief/i);
    assert.match(fridayBn, /টুকটুক/i);

    // Tuk Tuk
    const tuktukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "en");
    assert.match(tuktukEn, /babe/i);
    assert.match(tuktukEn, /Friday/i);
    assert.ok(!tuktukEn.includes("bro"), "Tuk Tuk must never call user 'bro'");

    const tuktukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "bn");
    assert.match(tuktukBn, /babe/i);
    assert.match(tuktukBn, /ফ্রাইডে/i);

    // Team
    const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", prompt, {}, "en");
    assert.match(teamEn, /\[Friday\]:/i);
    assert.match(teamEn, /\[Tuk Tuk\]:/i);
  });
});
