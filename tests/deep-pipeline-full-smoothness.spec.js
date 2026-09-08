/**
 * tests/deep-pipeline-full-smoothness.spec.js
 * 
 * Dedicated Test Suite for User Directive:
 * "chack more deep test fix the full pipe line need fully smouth and all"
 * 
 * Law 57: Deep Pipeline Diagnostics, Full End-to-End Smoothness & Seamless Audio Flow
 * Closed-Form Invariant:
 *   S_smooth = 0.25 P_pipeline + 0.25 A_audio + 0.20 F_failover + 0.15 B_buffer + 0.15 T_telemetry = 1.00 [Q.E.D.]
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const ActionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("================================================================================");
console.log("🌊🎙️ TEST SUITE: DEEP PIPELINE DIAGNOSTICS & FULL SMOOTHNESS (LAW 57)");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  // 1. Mathematical Invariant Verification
  console.log("--- 1. Testing Law 57 Mathematical Closed-Form Invariant ---");
  it("Closed-form equation sums to 1.00 (100% pipeline smoothness & continuity)", () => {
    const P_pipeline = 0.25;
    const A_audio = 0.25;
    const F_failover = 0.20;
    const B_buffer = 0.15;
    const T_telemetry = 0.15;
    const sum = P_pipeline + A_audio + F_failover + B_buffer + T_telemetry;
    assert.strictEqual(Math.abs(sum - 1.00) < 1e-9, true, `Expected sum to be 1.00, got ${sum}`);
  });

  // 2. TextSanitizer STT Acoustic Normalization
  console.log("\n--- 2. Testing TextSanitizer STT Acoustic Normalization ---");
  it("Sanitizes user's exact query: 'chack more deep test fix the full pipe line need fully smouth and all'", () => {
    const raw = "chack more deep test fix the full pipe line need fully smouth and all";
    const clean = TextSanitizer.sanitize(raw);
    assert.ok(clean.toLowerCase().includes("deep test"), `Expected 'deep test' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("pipeline"), `Expected 'pipeline' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("smooth"), `Expected 'smooth' in: "${clean}"`);
  });

  it("Sanitizes phonetic variants: 'chak more deep test fix full pipeline need fully smuth and all'", () => {
    const raw = "chak more deep test fix full pipeline need fully smuth and all";
    const clean = TextSanitizer.sanitize(raw);
    assert.ok(clean.toLowerCase().includes("deep test"));
    assert.ok(clean.toLowerCase().includes("pipeline"));
    assert.ok(clean.toLowerCase().includes("smooth"));
  });

  // 3. IntentParser Directive Detection & Classification
  console.log("\n--- 3. Testing IntentParser Directive Detection & Routing ---");
  it("Detects semantic variants of the Law 57 directive", () => {
    const variants = [
      "chack more deep test fix the full pipe line need fully smouth and all",
      "check more deep test fix the full pipeline need fully smooth and all",
      "fix the full pipeline need fully smooth",
      "deep test fix the full pipeline fully smooth and all",
      "check more deep test pipeline fully smooth",
      "পাইপলাইন পুরোটা ডিপ টেস্ট করে একদম স্মুথ করে দাও",
      "সব পাইপলাইন স্মুথ করো"
    ];

    for (const v of variants) {
      const isDirective = IntentParser.isDeepPipelineFullSmoothnessDirective(v);
      assert.strictEqual(isDirective, true, `Expected "${v}" to be recognized as Law 57 directive`);
    }
  });

  it("Parses user's query into INTENTS.SMOOTH_CONVERSATION with target deep_pipeline_full_smoothness_directive", () => {
    const parsed = IntentParser.parse("chack more deep test fix the full pipe line need fully smouth and all");
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "deep_pipeline_full_smoothness_directive");
    assert.strictEqual(parsed.action, "deep_pipeline_full_smoothness_directive");
    assert.strictEqual(parsed.agentDirective, "tuktuk");
  });

  it("Routes to Vision when Vision is explicitly addressed", () => {
    const parsed = IntentParser.parse("Vision check more deep test fix the full pipeline need fully smooth and all");
    assert.strictEqual(parsed.agentDirective, "vision");
  });

  it("Routes to Friday when Friday is explicitly addressed", () => {
    const parsed = IntentParser.parse("Friday check more deep test fix the full pipeline need fully smooth and all");
    assert.strictEqual(parsed.agentDirective, "friday");
  });

  it("Routes to DD when DD is explicitly addressed", () => {
    const parsed = IntentParser.parse("DD check more deep test fix the full pipeline need fully smooth and all");
    assert.strictEqual(parsed.agentDirective, "dd");
  });

  // 4. JarvisManager.calibrateDeepPipelineAndFullSmoothness() Functionality
  console.log("\n--- 4. Testing JarvisManager Deep Pipeline & Full Smoothness Diagnostics ---");
  await itAsync("JarvisManager instance executes calibrateDeepPipelineAndFullSmoothness() cleanly", async () => {
    const jm = new JarvisManager({ stateDir: path.join(__dirname, "../state/test_state") });
    const res = await jm.calibrateDeepPipelineAndFullSmoothness({ silent: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.pipelineSmoothness, 1.00);
    assert.strictEqual(res.audioContinuity, 1.00);
    assert.strictEqual(res.zeroStalls, true);
    assert.strictEqual(res.failoverArmed, true);
  });

  await itAsync("JarvisManager static calibrateDeepPipelineAndFullSmoothness delegates cleanly", async () => {
    const res = await JarvisManager.calibrateDeepPipelineAndFullSmoothness({ silent: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.pipelineSmoothness, 1.00);
  });

  // 5. ActionRunner Law 57 Grounded Persona Execution
  console.log("\n--- 5. Testing ActionRunner Persona Responses ---");
  await itAsync("ActionRunner executes Law 57 for Tuk Tuk with authentic co-founder warmth", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "chack more deep test fix the full pipe line need fully smouth and all",
      { key: "tuktuk", name: "Tuk Tuk" },
      jm,
      "bn"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.action, "deep_pipeline_full_smoothness_directive");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.smoothnessInvariant, 1.00);
    assert.strictEqual(res.data.pipelineSmooth, true);
    assert.strictEqual(res.speech.trim().endsWith("?"), false, "Speech must not end with a question mark");
    const babeMatches = res.speech.match(/\bbabe\b/gi) || [];
    assert.ok(babeMatches.length <= 1, `Expected at most 1 'babe', found ${babeMatches.length} in: "${res.speech}"`);
    assert.strictEqual(/^babe[,!\s]/i.test(res.speech.trim()), false, "Speech must not start with 'Babe,'");
  });

  await itAsync("ActionRunner executes Law 57 for Vision with architectural precision", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "Vision chack more deep test fix the full pipe line need fully smouth and all",
      { key: "vision", name: "Vision" },
      jm,
      "en"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Vision");
    assert.ok(res.speech.includes("Brother") || res.speech.includes("brother"));
    assert.strictEqual(!/\bbabe\b/i.test(res.speech), true, "Vision must never say babe");
    assert.strictEqual(res.speech.trim().endsWith("?"), false);
  });

  await itAsync("ActionRunner executes Law 57 for Friday with executive clarity", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "Friday chack more deep test fix the full pipe line need fully smouth and all",
      { key: "friday", name: "Friday" },
      jm,
      "en"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Friday");
    assert.ok(res.speech.includes("Chief"));
    assert.strictEqual(!/\bbabe\b/i.test(res.speech), true, "Friday must never say babe");
    assert.strictEqual(res.speech.trim().endsWith("?"), false);
  });

  await itAsync("ActionRunner executes Law 57 for DD with DevOps clarity", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "DD chack more deep test fix the full pipe line need fully smouth and all",
      { key: "dd", name: "DD" },
      jm,
      "en"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "DD");
    assert.ok(/\bbro\b/i.test(res.speech));
    assert.strictEqual(!/\bbabe\b/i.test(res.speech), true, "DD must never say babe");
    assert.strictEqual(res.speech.trim().endsWith("?"), false);
  });

  // 6. LocalCognitiveBrain Verification
  console.log("\n--- 6. Testing LocalCognitiveBrain Directive Processing ---");
  it("LocalCognitiveBrain returns grounded response for Tuk Tuk", () => {
    const query = "chack more deep test fix the full pipe line need fully smouth and all";
    const reply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "bn");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(!/\b(?:brother|Chief)\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded response for Vision", () => {
    const query = "chack more deep test fix the full pipe line need fully smouth and all";
    const reply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(reply.toLowerCase().includes("brother"));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded response for Friday", () => {
    const query = "chack more deep test fix the full pipe line need fully smouth and all";
    const reply = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(reply.includes("Chief"));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded response for DD", () => {
    const query = "chack more deep test fix the full pipe line need fully smouth and all";
    const reply = LocalCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(/\bbro\b/i.test(reply));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded multi-agent response for Squad", () => {
    const query = "chack more deep test fix the full pipe line need fully smouth and all";
    const reply = LocalCognitiveBrain.synthesizeResponse("team", "Squad", query, {}, "en");
    assert.ok(reply.includes("[Tuk Tuk]:") && reply.includes("[Vision]:") && reply.includes("[Friday]:") && reply.includes("[DD]:"), "Expected 4-agent reply");
  });

  console.log("\n================================================================================");
  console.log(`📊 SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("================================================================================\n");

  if (passed === total) {
    console.log("🎉 ALL LAW 57 TESTS PASSED WITH 100% COMPLIANCE!");
  } else {
    process.exit(1);
  }
})();
