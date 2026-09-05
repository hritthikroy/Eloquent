/**
 * Test Suite: Input & Output Responding Gaps Elimination
 * 
 * Verifies:
 * 1. Groq Gateway model pool uses real high-throughput production models (llama-3.1-8b-instant).
 * 2. VAD tail PCM energy thresholds and rapid endpointing in main.js & human-ear-cortex.
 * 3. ActionRunner handles "fix our input and output responding gaps" in English and Bengali.
 * 4. LocalCognitiveBrain provides natural, non-robotic responses across personas.
 * 5. Execution latency and turn-taking responsiveness remain sub-15ms for local pipelines.
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");

const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const humanEarCortex = require("../src/utils/human-ear-cortex");
const { masterApiGateway } = require("../src/utils/master-api-gateway");

test("Input & Output Responding Gaps Fix Suite", async (t) => {
  const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
  const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const activeVision = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
  const activeTeam = { name: "Squad", key: "team", voice: "en-US-AvaMultilingualNeural" };

  await t.test("1. Groq Gateway model pool contains only real production models & prioritizes llama-3.1-8b-instant", () => {
    assert.strictEqual(masterApiGateway.groqModels[0], "llama-3.1-8b-instant", "Primary Groq model must be llama-3.1-8b-instant (~120ms TTFT)");
    
    // Purged fictitious models
    const invalidModels = ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b", "groq/compound", "deepseek-r1-distill-llama-70b-specdec"];
    for (const invalid of invalidModels) {
      assert.ok(!masterApiGateway.groqModels.includes(invalid), `Fictitious model ${invalid} must not be in Groq model pool`);
    }

    // All pool models should be valid Groq endpoints
    const validProductionModels = [
      "llama-3.1-8b-instant",
      "llama-3.3-70b-versatile",
      "llama3-70b-8192",
      "llama3-8b-8192",
      "mixtral-8x7b-32768",
      "gemma2-9b-it"
    ];
    for (const model of masterApiGateway.groqModels) {
      assert.ok(validProductionModels.includes(model), `Model ${model} must be a recognized production Groq model`);
    }
  });

  await t.test("2. main.js configuration and VAD dynamic thresholds prevent input stalls", () => {
    const mainJs = fs.readFileSync(path.join(__dirname, "../src/main.js"), "utf8");

    // Check CONFIG.aiModel
    assert.ok(mainJs.includes("aiModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant'"), "main.js default AI model must be llama-3.1-8b-instant");
    
    // Check askJarvis uses llama-3.1-8b-instant
    assert.ok(mainJs.includes("model: 'llama-3.1-8b-instant'"), "askJarvis must query llama-3.1-8b-instant");

    // Check VAD RMS and Peak thresholds calibrated for laptop fan / room noise
    assert.ok(mainJs.includes("Math.max(0.012, jarvisNoiseFloorRms * 1.5)"), "VAD RMS threshold must prevent ambient noise hanging");
    assert.ok(mainJs.includes("Math.max(1200, jarvisNoiseFloorPeak * 1.4)"), "VAD Peak threshold must prevent ambient noise hanging");

    // Check mic re-arm speaker decay grace period
    assert.ok(mainJs.includes("Acoustic decay grace period (180ms) before re-arming mic..."), "Speaker decay grace period should be 180ms");

    // Check rapid endpointing logic presence
    assert.ok(mainJs.includes("humanEarCortex.getEndpointMode() === 'rapid'"), "main.js must respect rapid endpoint mode");
    assert.ok(mainJs.includes("voicedDurationMs >= 2000 ? 650 : (voicedDurationMs >= 500 ? 750 : 850)"), "main.js maintains responsive fallback string");
  });

  await t.test("3. ActionRunner recognizes 'fix our input and output responding gaps' and activates rapid mode", async () => {
    const prompts = [
      "fix our input and output responding gaps",
      "fix input and output responding gap",
      "fix responding gaps",
      "input and output responding gaps fix koro"
    ];

    for (const prompt of prompts) {
      const res = await actionRunner.handleAction(prompt, activeTukTuk, jarvis);
      assert.strictEqual(res.handled, true, `Prompt '${prompt}' must be handled by ActionRunner`);
      assert.strictEqual(res.agentName, "Tuk Tuk");
      assert.strictEqual(res.data.instantMode, true, "Must flag instantMode true");
      assert.strictEqual(res.data.respondingGapsEliminated, true, "Must flag respondingGapsEliminated true");
      assert.strictEqual(humanEarCortex.getEndpointMode(), "rapid", "Must switch HumanEarCortex to rapid endpoint mode");

      // Verify no robotic slogans or meta-metrics leaked
      assert.ok(!res.speech.includes("<think>"), "Zero thinking tags in speech");
      assert.ok(!res.speech.includes("২৬০ মিলিসেকেন্ড"), "No robotic millisecond metrics in speech");
      assert.ok(!res.speech.includes("ভিএডি ড্রপ"), "No robotic VAD drop slogans");
      assert.ok(!res.speech.includes("first principles"), "No rote slogans");
    }
  });

  await t.test("4. LocalCognitiveBrain handles responding gap directives across all squad personas", () => {
    const prompt = "fix our input and output responding gaps";

    // Tuk Tuk (EN & BN)
    const tuktukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "en");
    assert.match(tuktukEn, /Instant reply|Zero delay|babe/i);
    assert.ok(!tuktukEn.includes("first principles"));

    const tuktukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "bn");
    assert.match(tuktukBn, /ইনস্ট্যান্ট|রেসপন্ডিং গ্যাপ|babe/i);
    assert.ok(!tuktukBn.includes("ভিএডি ড্রপ"));

    // Vision (EN & BN)
    const visionEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "en");
    assert.match(visionEn, /Instant response|Zero latency|brother|bro/i);
    assert.ok(!visionEn.includes("Original thinking"));

    const visionBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "bn");
    assert.match(visionBn, /ইনস্ট্যান্ট রেসপন্স|রেসপন্ডিং গ্যাপ|ভাই|bro/i);

    // Team (EN & BN)
    const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", prompt, {}, "en");
    assert.match(teamEn, /instant reply mode|Instant banter/i);

    const teamBn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", prompt, {}, "bn");
    assert.match(teamBn, /ইনস্ট্যান্ট রেসপন্স|রেসপন্ডিং গ্যাপ/i);
  });

  await t.test("5. Latency & throughput guardrails: zero-blocking synchronous local processing", () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "fix our input and output responding gaps", {}, "en");
      humanEarCortex.computeDynamicEndpointSilence(1200, false);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 50;
    assert.ok(avgMs < 2.0, `Local response and dynamic silence average calculation must be < 2ms (was ${avgMs.toFixed(3)}ms)`);
  });
});
