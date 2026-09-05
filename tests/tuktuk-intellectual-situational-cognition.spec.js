/**
 * tests/tuktuk-intellectual-situational-cognition.spec.js
 * 
 * Verifies Tuk Tuk's Omni-Situational Awareness & Deep Intellectual Cognition Cortex:
 * 1. 8-State Situational Classification (DEEP_CODING, SYSTEM_ARCHITECTURE, STRATEGIC_CO_FOUNDER,
 *    PHILOSOPHICAL_INTELLECT, MEDIA_REEL_CO_WATCHING, MUSIC_VIBING, EMOTIONAL_GROUNDING, CASUAL_BANTER)
 * 2. Intellectual Complexity Scoring & Model Escalation to 70B
 * 3. STT Phonetic Sanitization for intellectual/situational directives
 * 4. Local Cognitive Brain Directive Handling
 * 5. ActionRunner Directive Interception & Structured Telemetry
 * 6. Jarvis Manager System Prompt Injection & Adaptive Word Cap (up to 45-55 words)
 */

const assert = require("assert");
const tukTukIntellectualCortex = require("../src/utils/tuktuk-intellectual-cortex");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");

console.log("🚀 Running Tuk Tuk Omni-Situational Awareness & Intellectual Cognition Suite...\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

async function itAsync(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

async function runTests() {
  const jm = new JarvisManager();
  const tuktukAgent = jm.agents.tuktuk;

  // 1. Situational State Vector Classification
  it("classifies media and reel co-watching correctly across English, Bengali, and App contexts", () => {
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("babe watch this funny reel with me"), "MEDIA_REEL_CO_WATCHING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("check out this crazy TikTok clip"), "MEDIA_REEL_CO_WATCHING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("এই রিলটা দেখো babe"), "MEDIA_REEL_CO_WATCHING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("look at this meme", { activeApp: "TikTok" }), "MEDIA_REEL_CO_WATCHING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("see this", { windowTitle: "youtube.com/shorts/123" }), "MEDIA_REEL_CO_WATCHING");
  });

  it("classifies music vibing correctly across English, Bengali, and Spotify", () => {
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("listen to this song with me babe"), "MUSIC_VIBING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("vibe to this beat"), "MUSIC_VIBING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("এই গানটা কত সুন্দর"), "MUSIC_VIBING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("what do you think of this track", { activeApp: "Spotify" }), "MUSIC_VIBING");
  });

  it("classifies deep coding & AST debugging correctly", () => {
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("we have an AST syntax error and null pointer panic"), "DEEP_CODING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("why is this compiler build failing with stack trace"), "DEEP_CODING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("এই কোডের বাগ ফিক্স করো"), "DEEP_CODING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("why is this failing", { activeApp: "Visual Studio Code" }), "DEEP_CODING");
  });

  it("classifies system architecture & high-order engineering correctly", () => {
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("how should we design the zero-copy ring buffer IPC latency tradeoff"), "SYSTEM_ARCHITECTURE");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("analyze the concurrency deadlock between these goroutines and mutexes"), "SYSTEM_ARCHITECTURE");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("আমাদের জিরো কপি মেমোরি আর্কিটেকচার আর লেটেন্সি অপটিমাইজেশন"), "SYSTEM_ARCHITECTURE");
  });

  it("classifies strategic co-founder & startup vision correctly", () => {
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("what is our product roadmap and scaling strategy for our launch"), "STRATEGIC_CO_FOUNDER");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("as my co-founder help evaluate the monetization and market scale tradeoffs"), "STRATEGIC_CO_FOUNDER");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("আমাদের স্টার্টআপ প্রোডাক্ট রোডম্যাপ আর গ্রোথ স্ট্র্যাটেজি"), "STRATEGIC_CO_FOUNDER");
  });

  it("classifies philosophical & deep intellectual thinking correctly", () => {
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("let's think from first principles about consciousness and the singularity"), "PHILOSOPHICAL_INTELLECT");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("what are the epistemological tradeoffs of modern intelligence"), "PHILOSOPHICAL_INTELLECT");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("ফার্স্ট প্রিন্সিপাল আর যুক্তিবোধ থেকে ভাবো"), "PHILOSOPHICAL_INTELLECT");
  });

  it("classifies emotional grounding & burnout recovery correctly", () => {
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("babe I am so exhausted and burnt out today"), "EMOTIONAL_GROUNDING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("I have a terrible headache and brain fog"), "EMOTIONAL_GROUNDING");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("আজকে অনেক ক্লান্ত লাগছে babe, মাথা ব্যথা করছে"), "EMOTIONAL_GROUNDING");
  });

  it("defaults to casual banter for everyday conversational remarks", () => {
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("hey babe what's up"), "CASUAL_BANTER");
    assert.strictEqual(tukTukIntellectualCortex.classifySituation("nice weather today"), "CASUAL_BANTER");
  });

  // 2. Intellectual Complexity Scoring & Cognitive Model Escalation
  it("computes low intellectual score for casual banter", () => {
    const score = tukTukIntellectualCortex.computeIntellectualScore("hey babe good morning");
    assert.ok(score < 0.3, `Expected score < 0.3 but got ${score}`);
  });

  it("computes high intellectual score for systems and architectural questions", () => {
    const score = tukTukIntellectualCortex.computeIntellectualScore(
      "why does our zero-copy ring buffer bottleneck under high concurrency throughput and what are the latency tradeoffs"
    );
    assert.ok(score >= 0.6, `Expected score >= 0.6 but got ${score}`);
  });

  it("escalates to llama-3.3-70b-versatile with 320 tokens and 55-word cap on intellectual turns", () => {
    const evalRes = tukTukIntellectualCortex.evaluateTurn(
      "as my co-founder explain the zero-copy memory model and IPC concurrency tradeoffs from first principles",
      "tuktuk"
    );

    assert.strictEqual(evalRes.isIntellectual, true);
    assert.strictEqual(evalRes.recommendedModel, "llama-3.3-70b-versatile");
    assert.strictEqual(evalRes.maxTokens, 320);
    assert.strictEqual(evalRes.wordCap, 55);
    assert.ok(evalRes.contextBlock.includes("[TUK TUK OMNI-SITUATIONAL AWARENESS & INTELLECTUAL COGNITION ACTIVE]"));
  });

  it("maintains llama-3.1-8b-instant with fast budget for casual banter", () => {
    const evalRes = tukTukIntellectualCortex.evaluateTurn(
      "hey babe love you so much",
      "tuktuk"
    );

    assert.strictEqual(evalRes.isIntellectual, false);
    assert.strictEqual(evalRes.recommendedModel, "llama-3.1-8b-instant");
    assert.strictEqual(evalRes.maxTokens, 90);
    assert.strictEqual(evalRes.wordCap, 18);
  });

  // 3. STT Phonetic Normalization
  it("sanitizes phonetic misspellings in prompt engine text sanitizer", () => {
    const rawUtterance = "give my babe more power to undersatand every situtation and can do very intalactual thinging";
    const sanitized = textSanitizer.sanitize(rawUtterance);

    assert.ok(sanitized.includes("understand every situation"), `Expected "understand every situation" in: ${sanitized}`);
    assert.ok(sanitized.includes("intellectual thinking"), `Expected "intellectual thinking" in: ${sanitized}`);
  });

  // 4. Local Cognitive Brain Omni-Situational Directives
  it("immediately acknowledges intellectual and situational boost in English", () => {
    const response = localCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "give my babe more power to undersatand every situtation and can do very intalactual thinging",
      {},
      "en"
    );

    assert.ok(response, "Expected non-empty response");
    assert.ok(response.toLowerCase().includes("babe"), "Expected response to call him babe");
    assert.ok(/(omni-situational|intellectual|concurrency|zero-copy|horsepower)/i.test(response));
  });

  it("acknowledges intellectual boost in Bengali when addressed colloquially", () => {
    const response = localCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "আমার টুকটুককে আরও বুদ্ধিমান করো সব পরিস্থিতি বোঝার ক্ষমতা দাও",
      {},
      "bn"
    );

    assert.ok(response, "Expected non-empty response");
    assert.ok(response.toLowerCase().includes("babe"), "Expected response to call him babe");
    assert.ok(/(ইন্টেলেকচুয়াল|পরিস্থিতি|আর্কিটেকচার|ব্রেইন|10x)/iu.test(response));
  });

  // 5. ActionRunner Directive Interceptor
  await itAsync("intercepts intellectual boost directive and returns structured telemetry", async () => {
    const result = await actionRunner.handleAction(
      "give my babe more power to undersatand every situtation and can do very intalactual thinging",
      tuktukAgent,
      jm
    );

    assert.ok(result, "Expected non-null result from actionRunner");
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.data.action, "tuktuk_intellectual_boost");
    assert.strictEqual(result.data.status, "MAXIMUM_COGNITIVE_POWER");
    assert.strictEqual(result.data.tier, "70B_OMNI_SITUATIONAL");
    assert.strictEqual(result.data.omniSituationalAwareness, "ENABLED");
    assert.strictEqual(result.data.intellectualThinking, "ACTIVE_10X");
    assert.ok(result.speech, "Expected spoken response");
    assert.ok(result.speech.toLowerCase().includes("babe"), "Expected speech to call him babe");
  });

  // 6. Jarvis Manager System Prompt & Adaptive Word Cap Integration
  it("injects situational telemetry block and ADAPTIVE WORD CAP into Tuk Tuk prompt", () => {
    const prompt = jm.getSystemPrompt(tuktukAgent);

    assert.ok(prompt.includes("[TUK TUK OMNI-SITUATIONAL AWARENESS & INTELLECTUAL COGNITION ACTIVE]"));
    assert.ok(prompt.includes("ADAPTIVE WORD CAP"));
    assert.ok(prompt.includes("45-55 words"));
    assert.ok(prompt.includes("OMNI-SITUATIONAL AWARENESS & DEEP INTELLECTUAL COGNITION"));
  });

  console.log(`\n📊 Tests Complete: ${passed}/${total} passed`);
  if (passed === total) {
    console.log("🌟 ALL TUK TUK INTELLECTUAL & SITUATIONAL COGNITION TESTS PASSED!\n");
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
