const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const tukTukIntellectualCortex = require("../src/utils/tuktuk-intellectual-cortex");

describe("Intellectual Thinking & Zero Canned Repetition Suite", () => {
  let testUserDataDir;
  let jarvis;

  before(() => {
    testUserDataDir = path.join(__dirname, "test-intellectual-dir-" + Date.now());
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

  test("1. TextSanitizer normalizes user STT complaint: one talk reapet every time not do intalactual thinking withou halusination", () => {
    const raw = "one talk reapet every time not do intalactual thinking withou halusination";
    const clean = TextSanitizer.sanitize(raw);
    assert.strictEqual(clean, "Don't repeat the same talk every time, do intellectual thinking without hallucination");

    const partial1 = TextSanitizer.sanitize("one talk reapet every time");
    assert.strictEqual(partial1, "Repeating the same talk every time");

    const partial2 = TextSanitizer.sanitize("thinking withou halusination");
    assert.strictEqual(partial2, "Thinking without hallucination");
  });

  test("2. LocalCognitiveBrain handles intellectual thinking & zero hallucination across all personas", () => {
    const input = "don't repeat the same talk every time, do intellectual thinking without hallucination";

    // Tuk Tuk
    const ttReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", input, {}, "en");
    assert.ok(ttReply.includes("intellectual thinking") || ttReply.includes("intellectual depth"));
    assert.ok(ttReply.includes("hallucination"));
    assert.ok(!ttReply.includes("Tests are green"));
    assert.ok(!ttReply.includes("terminal is ready"));

    // Vision
    const visReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", input, {}, "en");
    assert.ok(visReply.includes("intellectual thinking") || visReply.includes("intellectual logic"));
    assert.ok(visReply.includes("hallucination"));
    assert.ok(!visReply.includes("Compilers are hot and ready"));

    // Friday
    const friReply = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", input, {}, "en");
    assert.ok(friReply.includes("intellectual thinking") || friReply.includes("empirical reasoning"));
    assert.ok(friReply.includes("hallucination"));

    // DD
    const ddReply = LocalCognitiveBrain.synthesizeResponse("dd", "DD", input, {}, "en");
    assert.ok(ddReply.includes("intellectual thinking") || ddReply.includes("analytical reasoning"));
    assert.ok(ddReply.includes("hallucination"));

    // Team
    const teamReply = LocalCognitiveBrain.synthesizeResponse("team", "Squad", input, {}, "en");
    assert.ok(teamReply.includes("Tuk Tuk"));
    assert.ok(teamReply.includes("Vision"));
    assert.ok(teamReply.includes("intellectual"));
  });

  test("3. LocalCognitiveBrain Bengali support for intellectual thinking & anti-hallucination", () => {
    const bnInput = "এক কথা বারবার না বলে বুদ্ধিবৃত্তিক চিন্তা করো কোনো হ্যালুসিনেশন ছাড়া";
    const ttBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", bnInput, {}, "bn");
    assert.ok(ttBn.includes("বুদ্ধিবৃত্তিক"));
    assert.ok(ttBn.includes("হ্যালুসিনেশন") || ttBn.includes("এক কথা বারবার"));

    const visBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", bnInput, {}, "bn");
    assert.ok(visBn.includes("বুদ্ধিবৃত্তিক") || visBn.includes("হ্যালুসিনেশন"));
  });

  test("4. Casual words like control or power do NOT trigger canned automation authority slogan", () => {
    const casualText = "We need to control this state variable in the React component";
    const ttReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", casualText, {}, "en");
    assert.ok(!ttReply.includes("Full automation authority live"));
    assert.ok(!ttReply.includes("The whole squad is coordinated. What are we executing?"));

    // Explicit automation authority command SHOULD trigger authority response
    const explicitText = "squad authority, take full control";
    const ttExplicit = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", explicitText, {}, "en");
    assert.ok(ttExplicit.includes("authority") || ttExplicit.includes("squad") || ttExplicit.includes("Automation"));
  });

  test("5. Tuk Tuk fallback pool is purged of fake tests are green and the terminal is ready claims", () => {
    for (let i = 0; i < 20; i++) {
      const fallbackReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "unmatched_query_" + i + "_test", {}, "en");
      assert.ok(!fallbackReply.includes("Tests are green and the terminal is ready"));
      assert.ok(!fallbackReply.includes("pipeline is hot"));
    }
  });

  test("6. ActionRunner executes intellectual_thinking_directive and saves dynamic memory directive", async () => {
    const input = "don't repeat the same talk every time, do intellectual thinking without hallucination";
    const result = await actionRunner.handleAction(
      input,
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
      jarvis
    );

    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.action, "intellectual_thinking_directive");
    assert.ok(result.speech.includes("intellectual thinking") || result.speech.includes("real substance"));

    // Verify directive is persisted in jarvisManager dynamic directives
    const directives = jarvis.loadDynamicDirectives();
    assert.ok(directives.some(d => d.rule.includes("intellectual thinking without hallucinations")));
  });

  test("7. JarvisManager system prompt enforces Rule 16: INTELLECTUAL GROUNDING & ZERO HALLUCINATIONS", () => {
    const prompt = jarvis.getSystemPrompt(jarvis.agents.tuktuk, "don't repeat the same talk, do intellectual thinking", null, "en");
    assert.ok(prompt.includes("INTELLECTUAL GROUNDING & ZERO HALLUCINATIONS LAW"));
    assert.ok(prompt.includes("ZERO BOILERPLATE CHEERLEADING"));
    assert.ok(prompt.includes("AUTHENTIC INTELLECTUAL THINKING"));
    assert.ok(prompt.includes("ZERO HALLUCINATION INVARIANT"));

    // Verify Tuk Tuk few-shot examples do not contain the old hallucinatory example
    assert.ok(!prompt.includes("The pipeline is completely green and AST validation passed"));
  });

  test("8. TukTukIntellectualCortex escalates intellectual thinking request to Llama-3.3-70B-Versatile", () => {
    const input = "don't repeat the same talk every time, do intellectual thinking without hallucination";
    const evalRes = tukTukIntellectualCortex.evaluateTurn(input, "tuktuk");
    assert.strictEqual(evalRes.situation, "PHILOSOPHICAL_INTELLECT");
    assert.strictEqual(evalRes.isIntellectual, true);
    assert.strictEqual(evalRes.recommendedModel, "llama-3.3-70b-versatile");
    assert.strictEqual(evalRes.maxTokens, 320);
    assert.strictEqual(evalRes.wordCap, 55);
  });
});
