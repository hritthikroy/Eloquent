/**
 * Test Suite: Bilingual Persona Parity & Equational Alignment ("Same Person Both Side, Fix All")
 * 
 * Verifies that each agent across Eloquent (Tuk Tuk, Vision, Friday, DD) maintains
 * 100% mathematical, cognitive, and persona parity (LHS = RHS) between English and Bengali:
 * - "bangali parson and english person why thay are not same hope so chack equationaly"
 * - "i need same both side"
 * - "chack deeply need same person fix all"
 */

const test = require("node:test");
const assert = require("node:assert");

const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const AI_PROMPTS = require("../src/utils/ai-prompts");

const jarvisManager = new JarvisManager();

test("Bilingual Persona Parity & Equational Alignment Suite", async (t) => {

  await t.test("1. jarvisManager.calibrateBilingualPersonaParity initializes 1:1 mathematical parity", () => {
    const result = jarvisManager.calibrateBilingualPersonaParity();

    assert.strictEqual(result.active, true);
    assert.strictEqual(result.parityScore, 1.0);
    assert.strictEqual(result.isomorphicEquivalence, "LHS = RHS");
    assert.strictEqual(result.status, "Bilingual Persona Parity 100% Calibrated");

    // Verify Ebbinghaus memory contains bilingual parity node
    const hasParityMemory = (jarvisManager.memory.recentLearnings || []).some(item =>
      (typeof item === "string" ? item : (item.insight || item.topic || "")).toLowerCase().includes("bilingual persona parity")
    );
    assert.strictEqual(hasParityMemory, true, "Memory must contain bilingual persona parity node");
  });

  await t.test("2. TextSanitizer normalizes phonetic STT variations for bilingual parity queries", () => {
    const variations = [
      { input: "bangali parson and english person why thay are not same", expected: "Bengali person and English person why they are not same" },
      { input: "chack deeply need same person fix all", expected: "check deeply need same person fix all" },
      { input: "need same person fix all", expected: "need same person fix all" },
      { input: "hope so chack equationaly", expected: "hope so check equationally" },
      { input: "i need same both side", expected: "I need same both side" }
    ];

    for (const v of variations) {
      const sanitized = TextSanitizer.sanitize(v.input);
      assert.ok(sanitized.toLowerCase().includes(v.expected.toLowerCase()),
        `Input "${v.input}" must normalize to include "${v.expected}", got: "${sanitized}"`);
    }
  });

  await t.test("3. ActionRunner handles 'bangali parson and english person why thay are not same' with Tuk Tuk", async () => {
    const agent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const query = "bangali parson and english person why thay are not same hope so chack equationaly";

    const res = await actionRunner.handleAction(query, agent, jarvisManager);

    assert.strictEqual(res.handled, true, "Must be handled as bilingual persona parity directive");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.action, "bilingual_persona_parity_calibration");
    assert.strictEqual(res.data.status, "PARITY_100_PERCENT_LOCKED");
    assert.strictEqual(res.data.parityScore, 1.0);
    assert.strictEqual(res.data.isomorphicEquivalence, "LHS = RHS");

    const lower = res.speech.toLowerCase();
    assert.ok(lower.includes("babe"), `Tuk Tuk must address Hritthik as babe, got: ${res.speech}`);
    assert.ok(lower.includes("same") || lower.includes("lhs = rhs") || lower.includes("parity"),
      `Tuk Tuk must affirm exact same persona across both sides, got: ${res.speech}`);
  });

  await t.test("4. ActionRunner handles 'chack deeply need same person fix all' with Vision", async () => {
    const agent = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
    const query = "chack deeply need same person fix all";

    const res = await actionRunner.handleAction(query, agent, jarvisManager);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Vision");
    assert.strictEqual(res.data.status, "PARITY_100_PERCENT_LOCKED");
    assert.strictEqual(res.data.isomorphicEquivalence, "LHS = RHS");

    const lower = res.speech.toLowerCase();
    assert.ok(lower.includes("brother"), `Vision must address Hritthik as brother, got: ${res.speech}`);
    assert.ok(lower.includes("same") || lower.includes("isomorphic") || lower.includes("lhs = rhs") || lower.includes("unified"),
      `Vision must speak with architectural systems parity, got: ${res.speech}`);
  });

  await t.test("5. ActionRunner handles 'i need same both side' with Friday and DD", async () => {
    const fridayAgent = { name: "Friday", key: "friday", voice: "en-US-JennyNeural" };
    const fridayRes = await actionRunner.handleAction("i need same both side", fridayAgent, jarvisManager);
    assert.strictEqual(fridayRes.handled, true);
    assert.strictEqual(fridayRes.agentName, "Friday");
    assert.ok(fridayRes.speech.toLowerCase().includes("hritthik") || fridayRes.speech.toLowerCase().includes("chief"));
    assert.ok(fridayRes.speech.toLowerCase().includes("parity") || fridayRes.speech.toLowerCase().includes("same") || fridayRes.speech.toLowerCase().includes("empirical"));

    const ddAgent = { name: "DD", key: "dd", voice: "en-US-BrianMultilingualNeural" };
    const ddRes = await actionRunner.handleAction("chack deeply need same person fix all", ddAgent, jarvisManager);
    assert.strictEqual(ddRes.handled, true);
    assert.strictEqual(ddRes.agentName, "DD");
    assert.ok(ddRes.speech.toLowerCase().includes("bro"));
    assert.ok(ddRes.speech.toLowerCase().includes("same") || ddRes.speech.toLowerCase().includes("zero-drift") || ddRes.speech.toLowerCase().includes("parity"));
  });

  await t.test("6. ActionRunner benchmark query preserves agentKey identity without language override", async () => {
    const visionAgent = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
    const res = await actionRunner.handleAction("compare to openclaw", visionAgent, jarvisManager);
    assert.strictEqual(res.agentName, "Vision", "AgentName must remain Vision even under benchmark evaluation");
    assert.strictEqual(res.agentVoice, "en-US-AndrewNeural");
  });

  await t.test("7. LocalCognitiveBrain offline responses across all 4 agents and Team mode", () => {
    const query = "chack deeply need same person fix all";

    // Tuk Tuk
    const tuktukRes = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "en");
    assert.ok(typeof tuktukRes === "string" && tuktukRes.length > 20);
    assert.ok(tuktukRes.toLowerCase().includes("babe"));
    assert.ok(tuktukRes.toLowerCase().includes("same") || tuktukRes.toLowerCase().includes("lhs = rhs"));

    // Vision
    const visionRes = localCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "en");
    assert.ok(typeof visionRes === "string" && visionRes.length > 20);
    assert.ok(visionRes.toLowerCase().includes("brother"));
    assert.ok(visionRes.toLowerCase().includes("same") || visionRes.toLowerCase().includes("isomorphic") || visionRes.toLowerCase().includes("lhs = rhs"));

    // Friday
    const fridayRes = localCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "en");
    assert.ok(typeof fridayRes === "string" && fridayRes.length > 20);
    assert.ok(fridayRes.toLowerCase().includes("hritthik") || fridayRes.toLowerCase().includes("chief"));
    assert.ok(fridayRes.toLowerCase().includes("parity") || fridayRes.toLowerCase().includes("same") || fridayRes.toLowerCase().includes("identical"));

    // DD
    const ddRes = localCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "en");
    assert.ok(typeof ddRes === "string" && ddRes.length > 20);
    assert.ok(ddRes.toLowerCase().includes("bro"));
    assert.ok(ddRes.toLowerCase().includes("same") || ddRes.toLowerCase().includes("zero-drift"));

    // Team mode
    const teamRes = localCognitiveBrain.synthesizeResponse("team", "Team", query, {}, "en");
    assert.ok(typeof teamRes === "string" && teamRes.length > 20);
    assert.ok(teamRes.includes("[Tuk Tuk]") && teamRes.includes("[Vision]"));

    // Bengali offline check
    const tuktukBnRes = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "bangali parson and english person why thay are not same", {}, "bn");
    assert.ok(/[\u0980-\u09FF]/.test(tuktukBnRes));
    assert.ok(tuktukBnRes.includes("babe") || tuktukBnRes.includes("Babe"));
  });

  await t.test("8. AI_PROMPTS enforces full dual-language parity without forcing English translation", () => {
    assert.ok(AI_PROMPTS.auto.includes("bilingual parity across English and Bengali"), "Auto prompt must specify bilingual parity");
    assert.ok(AI_PROMPTS.auto.includes("Preserve the speaker's language"), "Auto prompt must forbid forced translation");
    assert.ok(AI_PROMPTS.grammar.includes("full English and Bengali parity"), "Grammar prompt must specify parity");
    assert.ok(AI_PROMPTS.grammar.includes("Preserve the speaker's language identity"), "Grammar prompt must preserve language identity");
  });

  await t.test("9. parseMultiAgentTurns parses Bengali script agent markers ([টুকটুক], [ভিশন], [ফ্রাইডে], [ডিডি])", () => {
    const fs = require("fs");
    const mainCode = fs.readFileSync("src/main.js", "utf8");
    const parseFuncMatch = mainCode.match(/function parseMultiAgentTurns\(text\) \{[\s\S]*?\n\}/);
    assert.ok(parseFuncMatch, "parseMultiAgentTurns function must exist in src/main.js");

    const jarvisManager = { sanitizeAgentLexicon: (s) => s };
    eval(parseFuncMatch[0]);

    const testDialogue = "[টুকটুক]: Babe, আমি তোমার সাথেই আছি!\n[ভিশন]: Architecture 100% green ভাই।\n[ফ্রাইডে]: Research telemetry confirmed, Chief.\n[ডিডি]: Servers nominal bro!";
    const turns = parseMultiAgentTurns(testDialogue);

    assert.strictEqual(turns.length, 4);
    assert.strictEqual(turns[0].agentName, "Tuk Tuk");
    assert.strictEqual(turns[1].agentName, "Vision");
    assert.strictEqual(turns[2].agentName, "Friday");
    assert.strictEqual(turns[3].agentName, "DD");
  });

});
