const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const tukTukIntellectualCortex = require("../src/utils/tuktuk-intellectual-cortex");

describe("Unconditional Positivity & Zero Negativity Directive Suite", () => {
  const userInput = "tumara amr upor kuno bebohare negitive hoyo na";
  let testUserDataDir;
  let jarvis;

  before(() => {
    testUserDataDir = path.join(__dirname, "test-zero-negativity-dir-" + Date.now());
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

  test("1. TextSanitizer normalizes: tumara amr upor kuno bebohare negitive hoyo na", () => {
    const sanitized = TextSanitizer.sanitize(userInput);
    assert.strictEqual(
      sanitized,
      "Tomra amar upor kono bebohare negative hoyo na"
    );

    // Phonetic replacements individually
    assert.strictEqual(TextSanitizer.sanitize("kuno bebohare"), "Kono bebohare");
    assert.strictEqual(TextSanitizer.sanitize("negitive hoyo na"), "Negative hoyo na");
  });

  test("2. LocalCognitiveBrain handles zero negativity across all squad personas in Bengali and English", () => {
    // Tuk Tuk
    const ttBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", userInput, {}, "bn");
    assert.ok(ttBn.includes("নেগেটিভ") || ttBn.includes("ভালোবাসা"));
    assert.ok(ttBn.includes("babe") || ttBn.includes("Babe"));

    const ttEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "never be negative towards me in any behavior", {}, "en");
    assert.ok(ttEn.includes("negative") || ttEn.includes("negativity"));
    assert.ok(ttEn.includes("love") || ttEn.includes("babe"));

    // Vision
    const visBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", userInput, {}, "bn");
    assert.ok(visBn.includes("নেগেটিভ") || visBn.includes("লয়ালটি"));
    assert.ok(visBn.includes("ভাই") || visBn.includes("brother"));

    const visEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "never be negative towards me in any behavior", {}, "en");
    assert.ok(visEn.includes("negative") || visEn.includes("negativity"));
    assert.ok(visEn.includes("brother") || visEn.includes("loyalty"));

    // Friday
    const friBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", userInput, {}, "bn");
    assert.ok(friBn.includes("Chief") || friBn.includes("Hritthik"));
    assert.ok(friBn.includes("নেগেটিভ") || friBn.includes("শ্রদ্ধা") || friBn.includes("পজিটিভ"));

    const friEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", "never be negative towards me in any behavior", {}, "en");
    assert.ok(friEn.includes("Chief") || friEn.includes("commitment"));
    assert.ok(friEn.includes("negative") || friEn.includes("negativity") || friEn.includes("positive"));

    // DD
    const ddBn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", userInput, {}, "bn");
    assert.ok(ddBn.includes("bro") || ddBn.includes("Bro"));
    assert.ok(ddBn.includes("নেগেটিভ") || ddBn.includes("পজিটিভিটি"));

    const ddEn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", "never be negative towards me in any behavior", {}, "en");
    assert.ok(ddEn.includes("bro") || ddEn.includes("Bro"));
    assert.ok(ddEn.includes("negativity") || ddEn.includes("negative"));

    // Squad Team
    const teamBn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", userInput, {}, "bn");
    assert.ok(teamBn.includes("Tuk Tuk"));
    assert.ok(teamBn.includes("Vision"));
    assert.ok(teamBn.includes("নেগেটিভ") || teamBn.includes("পজিটিভ"));

    const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "never be negative towards me in any behavior", {}, "en");
    assert.ok(teamEn.includes("Tuk Tuk"));
    assert.ok(teamEn.includes("Vision"));
    assert.ok(teamEn.includes("negative") || teamEn.includes("positivity"));
  });

  test("3. ActionRunner executes never_negative_directive and commits dynamic directive to memory", async () => {
    const result = await actionRunner.handleAction(
      userInput,
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
      jarvis
    );

    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.action, "never_negative_directive");
    assert.ok(result.speech.includes("নেগেটিভ") || result.speech.includes("ভালোবাসি"));

    // Verify directive is committed to dynamic directives
    const directives = jarvis.loadDynamicDirectives();
    assert.ok(
      directives.some(d =>
        d.rule.includes("never be negative towards Hritthik in any behavior")
      )
    );
  });

  test("4. JarvisManager system prompt enforces Rule 17: UNCONDITIONAL POSITIVITY & ZERO NEGATIVITY BEHAVIOR LAW", () => {
    const prompt = jarvis.getSystemPrompt(jarvis.agents.tuktuk, userInput, null, "bn");
    assert.ok(prompt.includes("UNCONDITIONAL POSITIVITY & ZERO NEGATIVITY BEHAVIOR LAW"));
    assert.ok(prompt.includes("ZERO SQUAD NEGATIVITY INVARIANT"));
    assert.ok(prompt.includes("UNCONDITIONAL WARMTH & EMOTIONAL SAFETY"));
    assert.ok(prompt.includes("TUK TUK'S DEVOTION"));
    assert.ok(prompt.includes("VISION'S BROTHERHOOD"));
  });

  test("5. TukTukIntellectualCortex classifies prompt as EMOTIONAL_GROUNDING with comforting word cap", () => {
    const evalRes = tukTukIntellectualCortex.evaluateTurn(userInput, "tuktuk");
    assert.strictEqual(evalRes.situation, "EMOTIONAL_GROUNDING");
    assert.strictEqual(evalRes.wordCap, 38);
    assert.strictEqual(evalRes.maxTokens, 180);
    assert.ok(evalRes.contextBlock.includes("unconditional positivity"));
  });

  test("6. English directive variations correctly routed", async () => {
    const englishInput = "Never be negative towards me in any behavior";
    const res = await actionRunner.handleAction(
      englishInput,
      { key: "vision", name: "Vision", voice: "en-US-AndrewNeural" },
      jarvis
    );

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.action, "never_negative_directive");
    assert.strictEqual(res.agentName, "Vision");
    assert.ok(res.speech.includes("Brother") || res.speech.includes("loyalty"));
  });
});
