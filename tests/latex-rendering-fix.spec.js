/**
 * Test Suite: LaTeX / KaTeX Rendering Fix & Equational Proof Re-Render
 *
 * Verifies that when LaTeX / KaTeX rendering errors or fix requests occur:
 * 1. TextSanitizer normalizes error strings into clean intent
 * 2. ActionRunner intercepts LaTeX render error directives across Tuk Tuk, Vision, Friday, DD & Squad
 * 3. LocalCognitiveBrain provides offline neural fallback responses in English and Bengali
 * 4. Mathematical proof invariants hold with zero KaTeX parsing errors
 */

const test = require("node:test");
const assert = require("node:assert");

const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");

const jarvisManager = new JarvisManager();

test("LaTeX / KaTeX Rendering Fix & Equational Proof Suite", async (t) => {
  const latexErrorInput = "⚠️ Failed to render LaTeX: KaTeX parse error: Expected 'EOF', got '&' at position 12: \\text{LHS} &= \\text{Seeing}… fix all";

  await t.test("1. TextSanitizer normalizes LaTeX / KaTeX error inputs", () => {
    const sanitized = TextSanitizer.sanitize(latexErrorInput);
    assert.strictEqual(sanitized.toLowerCase(), "fix all latex equations and rendering");

    const genericError = "Failed to render LaTeX: KaTeX parse error: Something broke";
    const sanitizedGeneric = TextSanitizer.sanitize(genericError);
    assert.strictEqual(sanitizedGeneric.toLowerCase(), "fix latex rendering");
  });

  await t.test("2. ActionRunner handles exact user prompt with Tuk Tuk", async () => {
    const agent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const res = await actionRunner.handleAction(
      latexErrorInput,
      agent,
      jarvisManager
    );

    assert.ok(res, "ActionRunner must handle LaTeX error directive");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.status, "LATEX_KATEX_CLEAN_AND_VERIFIED");
    assert.strictEqual(res.data.syntaxErrorCount, 0);
    assert.strictEqual(res.data.lhsEqualsRhs, true);
    assert.ok(res.speech.includes("babe") || res.speech.includes("Babe"));
    assert.ok(res.speech.includes("LaTeX") || res.speech.includes("KaTeX"));
  });

  await t.test("3. ActionRunner handles LaTeX fix with Vision", async () => {
    const agent = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
    const res = await actionRunner.handleAction(
      "fix all LaTeX equations and rendering",
      agent,
      jarvisManager
    );

    assert.ok(res);
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Vision");
    assert.strictEqual(res.data.status, "LATEX_KATEX_CLEAN_AND_VERIFIED");
    assert.ok(res.speech.includes("brother") || res.speech.includes("KaTeX") || res.speech.includes("LaTeX"));
  });

  await t.test("4. ActionRunner handles LaTeX fix with Friday", async () => {
    const agent = { name: "Friday", key: "friday", voice: "en-US-JennyNeural" };
    const res = await actionRunner.handleAction(
      "KaTeX parse error fix all",
      agent,
      jarvisManager
    );

    assert.ok(res);
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Friday");
    assert.ok(res.speech.includes("Hritthik") || res.speech.includes("KaTeX") || res.speech.includes("mathematical"));
  });

  await t.test("5. ActionRunner handles LaTeX fix with DD", async () => {
    const agent = { name: "DD", key: "dd", voice: "en-US-BrianMultilingualNeural" };
    const res = await actionRunner.handleAction(
      "Failed to render LaTeX fix it",
      agent,
      jarvisManager
    );

    assert.ok(res);
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "DD");
    assert.ok(res.speech.includes("bro") || res.speech.includes("KaTeX") || res.speech.includes("pipeline"));
  });

  await t.test("6. ActionRunner handles Bengali LaTeX fix directive", async () => {
    const agent = { name: "Tuk Tuk", key: "tuktuk", language: "bn", voice: "en-US-AvaMultilingualNeural" };
    const res = await actionRunner.handleAction(
      "LaTeX সমীকরণ আর KaTeX সব ঠিক করে দাও",
      agent,
      jarvisManager
    );

    assert.ok(res);
    assert.strictEqual(res.handled, true);
    assert.ok(res.speech.includes("babe") || res.speech.includes("LaTeX") || res.speech.includes("KaTeX") || res.speech.includes("সমীকরণ"));
  });

  await t.test("7. ActionRunner handles Team mode LaTeX fix directive", async () => {
    const agent = { name: "Team", key: "team" };
    const res = await actionRunner.handleAction(
      latexErrorInput,
      agent,
      jarvisManager
    );

    assert.ok(res);
    assert.strictEqual(res.handled, true);
    assert.ok(res.speech.includes("[Tuk Tuk]:"));
    assert.ok(res.speech.includes("[Vision]:"));
    assert.ok(res.speech.includes("[Friday]:"));
    assert.ok(res.speech.includes("[DD]:"));
  });

  await t.test("8. LocalCognitiveBrain offline responses for all agents & Team mode", () => {
    const query = "fix all LaTeX equations and rendering";

    const ttEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "en");
    const ttBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "bn");
    assert.ok(ttEn.includes("babe") || ttEn.includes("LaTeX"));
    assert.ok(ttBn.includes("babe") || ttBn.includes("LaTeX") || ttBn.includes("KaTeX"));

    const visEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "en");
    const visBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "bn");
    assert.ok(visEn.includes("brother") || visEn.includes("KaTeX"));
    assert.ok(visBn.includes("ভাই") || visBn.includes("KaTeX"));

    const friEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "en");
    const friBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "bn");
    assert.ok(friEn.includes("Hritthik") || friEn.includes("KaTeX"));
    assert.ok(friBn.includes("ঋত্বিক") || friBn.includes("Chief") || friBn.includes("KaTeX"));

    const ddEn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "en");
    const ddBn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "bn");
    assert.ok(ddEn.includes("bro") || ddEn.includes("KaTeX"));
    assert.ok(ddBn.includes("bro") || ddBn.includes("KaTeX"));

    const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Team", query, {}, "en");
    const teamBn = LocalCognitiveBrain.synthesizeResponse("team", "Team", query, {}, "bn");
    assert.ok(teamEn.includes("[Tuk Tuk]:") && teamEn.includes("[Vision]:"));
    assert.ok(teamBn.includes("[Tuk Tuk]:") && teamBn.includes("[Vision]:"));
  });
});
