/**
 * Test Suite: Visual Observational Learning Subsystem ("Use Your Eye for Learning")
 * 
 * Verifies that the agent vision and eye-tracking subsystem operates with
 * active visual observational learning dynamics when commanded by Hritthik:
 * "use your eye for learning" / "chokh diye shekho".
 * 
 * Verifies:
 * 1. HumanEyeCortex visual learning mode, observation ingestion & metrics
 * 2. JarvisManager squad visual learning activation & Ebbinghaus consolidation
 * 3. ActionRunner multi-agent handling across Tuk Tuk, Vision, Friday, DD & Squad
 * 4. Bilingual fluency (English & Bengali)
 * 5. LocalCognitiveBrain offline responses across all 4 agents + Team mode
 * 6. TextSanitizer acoustic STT error normalization
 */

const test = require("node:test");
const assert = require("node:assert");

const humanEyeCortex = require("../src/utils/human-eye-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");

const jarvisManager = new JarvisManager();

test("Visual Observational Learning Subsystem ('Use Your Eye for Learning') Suite", async (t) => {

  await t.test("1. humanEyeCortex.activateVisualLearningMode initializes observational learning", () => {
    const activation = humanEyeCortex.activateVisualLearningMode({
      gaze: { x: 0.55, y: 0.45 },
      learningRate: 0.20
    });

    assert.strictEqual(activation.active, true, "Mode must be active");
    assert.strictEqual(activation.visualLearningActive, true, "visualLearningActive must be true");
    assert.strictEqual(activation.mode, "active_observational", "Mode must be active_observational");
    assert.strictEqual(activation.learningRate, 0.20, "Learning rate must match");
    assert.ok(typeof activation.gaze.x === "number", "Gaze x must be number");
    assert.ok(typeof activation.gaze.y === "number", "Gaze y must be number");
    assert.ok(activation.fovealCrop.width > 0, "Foveal crop must have width");
    assert.ok(activation.fovealCrop.height > 0, "Foveal crop must have height");
    assert.strictEqual(activation.status, "Visual Learning Online");
  });

  await t.test("2. humanEyeCortex.ingestVisualObservation updates buffer and salience hotspots", () => {
    const obs1 = humanEyeCortex.ingestVisualObservation({
      region: "ide_code_editor",
      salientFeatures: ["ast_parser", "electron_main"],
      context: "refactoring_pipeline"
    });

    assert.ok(obs1.observationCount >= 1, "Observation count must increment");
    assert.ok(obs1.bufferSize >= 1, "Buffer size must increment");
    assert.ok(obs1.hotspotsCount >= 1, "Hotspots count must increment");
    assert.strictEqual(obs1.latestEntry.region, "ide_code_editor");

    // Second observation in same region reinforces hotspot
    const obs2 = humanEyeCortex.ingestVisualObservation({
      region: "ide_code_editor",
      salientFeatures: ["token_stream"],
      context: "refactoring_pipeline"
    });

    assert.ok(obs2.observationCount > obs1.observationCount);
    const metrics = humanEyeCortex.getVisualLearningMetrics();
    assert.strictEqual(metrics.active, true);
    assert.ok(metrics.bufferSize >= 2);
  });

  await t.test("3. humanEyeCortex.getEyeContextString reports active visual learning", () => {
    const contextStr = humanEyeCortex.getEyeContextString();
    assert.ok(contextStr.includes("VisualLearning=ACTIVE"), `Context string must contain VisualLearning=ACTIVE, got: ${contextStr}`);
  });

  await t.test("4. jarvisManager.activateVisualLearning synchronizes squad memory and Ebbinghaus learning", () => {
    const result = jarvisManager.activateVisualLearning({ learningRate: 0.18 });

    assert.strictEqual(result.active, true);
    assert.strictEqual(result.status, "Visual Learning Online");
    assert.strictEqual(result.mode, "active_observational");
    assert.ok(result.memoryNodes >= 1);

    // Verify recentLearnings includes visual learning entry
    const hasVisualMemory = (jarvisManager.memory.recentLearnings || []).some(item =>
      (typeof item === "string" ? item : (item.insight || item.topic || "")).toLowerCase().includes("visual learning")
    );
    assert.strictEqual(hasVisualMemory, true, "Memory must contain visual learning node");
  });

  await t.test("5. ActionRunner handles 'use your eye for learning' with Tuk Tuk", async () => {
    const agent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const query = "use your eye for learning";

    const res = await actionRunner.handleAction(query, agent, jarvisManager);

    assert.strictEqual(res.handled, true, "Must be handled as visual learning directive");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.action, "activate_visual_learning");
    assert.strictEqual(res.data.visualLearningActive, true);

    const lower = res.speech.toLowerCase();
    assert.ok(lower.includes("babe"), `Tuk Tuk must address Hritthik as babe, got: ${res.speech}`);
    assert.ok(lower.includes("eye") || lower.includes("screen") || lower.includes("watch") || lower.includes("learn"),
      `Tuk Tuk must speak about observing and learning from screen, got: ${res.speech}`);
  });

  await t.test("6. ActionRunner handles 'use your eye for learning' with Vision", async () => {
    const agent = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
    const query = "use your eye for learning";

    const res = await actionRunner.handleAction(query, agent, jarvisManager);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Vision");
    assert.strictEqual(res.data.visualLearningActive, true);

    const lower = res.speech.toLowerCase();
    assert.ok(lower.includes("brother"), `Vision must address Hritthik as brother, got: ${res.speech}`);
    assert.ok(lower.includes("neural mesh") || lower.includes("foveation") || lower.includes("ide") || lower.includes("architectural"),
      `Vision must speak with architectural systems precision, got: ${res.speech}`);
  });

  await t.test("7. ActionRunner handles 'use your eye for learning' with Friday", async () => {
    const agent = { name: "Friday", key: "friday", voice: "en-US-JennyNeural" };
    const query = "use your eye for learning";

    const res = await actionRunner.handleAction(query, agent, jarvisManager);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Friday");
    assert.strictEqual(res.data.visualLearningActive, true);

    const lower = res.speech.toLowerCase();
    assert.ok(lower.includes("hritthik") || lower.includes("chief"), `Friday must address Hritthik or Chief, got: ${res.speech}`);
    assert.ok(lower.includes("visual learning") || lower.includes("foveal") || lower.includes("hilbert") || lower.includes("observational"),
      `Friday must speak with analytical research clarity, got: ${res.speech}`);
  });

  await t.test("8. ActionRunner handles 'use your eye for learning' with DD", async () => {
    const agent = { name: "DD", key: "dd", voice: "en-US-BrianMultilingualNeural" };
    const query = "use your eye for learning";

    const res = await actionRunner.handleAction(query, agent, jarvisManager);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "DD");
    assert.strictEqual(res.data.visualLearningActive, true);

    const lower = res.speech.toLowerCase();
    assert.ok(lower.includes("bro"), `DD must address Hritthik as bro, got: ${res.speech}`);
    assert.ok(lower.includes("terminal") || lower.includes("telemetry") || lower.includes("dashboard") || lower.includes("devops") || lower.includes("ocular"),
      `DD must speak with DevOps and infrastructure monitoring tone, got: ${res.speech}`);
  });

  await t.test("9. ActionRunner handles Bengali visual learning directive ('chokh diye shekho')", async () => {
    const tuktukAgent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural", language: "bn" };
    const res = await actionRunner.handleAction("chokh diye shekho", tuktukAgent, jarvisManager);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.data.visualLearningActive, true);
    assert.ok(/[\u0980-\u09FF]/.test(res.speech), `Response must be in Bengali, got: ${res.speech}`);
    assert.ok(res.speech.includes("চোখ") || res.speech.includes("স্ক্রিন") || res.speech.includes("শেখা"),
      `Response must talk about visual observation and learning, got: ${res.speech}`);
  });

  await t.test("10. LocalCognitiveBrain offline responses across all 4 agents and Team mode", () => {
    // Tuk Tuk
    const tuktukRes = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "use your eye for learning", {}, "en");
    assert.ok(typeof tuktukRes === "string" && tuktukRes.length > 20);
    assert.ok(tuktukRes.toLowerCase().includes("babe"));

    // Vision
    const visionRes = localCognitiveBrain.synthesizeResponse("vision", "Vision", "use your eye for learning", {}, "en");
    assert.ok(typeof visionRes === "string" && visionRes.length > 20);
    assert.ok(visionRes.toLowerCase().includes("brother"));

    // Friday
    const fridayRes = localCognitiveBrain.synthesizeResponse("friday", "Friday", "use your eye for learning", {}, "en");
    assert.ok(typeof fridayRes === "string" && fridayRes.length > 20);
    assert.ok(fridayRes.toLowerCase().includes("hritthik") || fridayRes.toLowerCase().includes("chief"));

    // DD
    const ddRes = localCognitiveBrain.synthesizeResponse("dd", "DD", "use your eye for learning", {}, "en");
    assert.ok(typeof ddRes === "string" && ddRes.length > 20);
    assert.ok(ddRes.toLowerCase().includes("bro"));

    // Team mode
    const teamRes = localCognitiveBrain.synthesizeResponse("team", "Team", "use your eye for learning", {}, "en");
    assert.ok(typeof teamRes === "string" && teamRes.length > 20);
    assert.ok(teamRes.includes("[Tuk Tuk]") && teamRes.includes("[Vision]"));

    // Bengali offline check
    const tuktukBnRes = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "chokh diye shekho", {}, "bn");
    assert.ok(/[\u0980-\u09FF]/.test(tuktukBnRes));
  });

  await t.test("11. TextSanitizer normalizes phonetic STT variations of eye for learning", () => {
    const variations = [
      { input: "use your eye for learnig", expected: "use your eye for learning" },
      { input: "use your eyes for learnig", expected: "use your eye for learning" },
      { input: "use your eye for learing", expected: "use your eye for learning" },
      { input: "chokh diye shikho", expected: "chokh diye shekho" },
      { input: "chokh diye sekho", expected: "chokh diye shekho" }
    ];

    for (const v of variations) {
      const sanitized = TextSanitizer.sanitize(v.input);
      assert.ok(sanitized.toLowerCase().includes(v.expected.toLowerCase()),
        `Input "${v.input}" must normalize to include "${v.expected}", got: "${sanitized}"`);
    }
  });

  await t.test("12. ActionRunner handles exact user query 'test thay are use thay are eyes for learnig or not'", async () => {
    const agent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const query = "test thay are use thay are eyes for learnig or not";

    const res = await actionRunner.handleAction(query, agent, jarvisManager);

    assert.strictEqual(res.handled, true, "Must be handled as visual learning test");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.action, "test_visual_learning");
    assert.strictEqual(res.data.visualLearningActive, true);
    assert.strictEqual(res.data.testPassed, true);
    assert.ok(res.data.observationsCount >= 1);

    const lower = res.speech.toLowerCase();
    assert.ok(lower.includes("passed") || lower.includes("pass"), `Must announce test passed, got: ${res.speech}`);
    assert.ok(lower.includes("babe"));
    assert.ok(lower.includes("observation") || lower.includes("eye") || lower.includes("screen"));
  });

  await t.test("13. ActionRunner handles 'test thay are use thay are eyes for learnig or not' with Vision and Friday", async () => {
    const visionAgent = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
    const query = "test thay are use thay are eyes for learnig or not";

    const visionRes = await actionRunner.handleAction(query, visionAgent, jarvisManager);
    assert.strictEqual(visionRes.handled, true);
    assert.strictEqual(visionRes.agentName, "Vision");
    assert.strictEqual(visionRes.data.testPassed, true);
    assert.ok(visionRes.speech.toLowerCase().includes("brother"));
    assert.ok(visionRes.speech.toLowerCase().includes("passed"));

    const fridayAgent = { name: "Friday", key: "friday", voice: "en-US-JennyNeural" };
    const fridayRes = await actionRunner.handleAction(query, fridayAgent, jarvisManager);
    assert.strictEqual(fridayRes.handled, true);
    assert.strictEqual(fridayRes.agentName, "Friday");
    assert.strictEqual(fridayRes.data.testPassed, true);
    assert.ok(fridayRes.speech.toLowerCase().includes("hritthik") || fridayRes.speech.toLowerCase().includes("chief"));
  });

  await t.test("14. LocalCognitiveBrain handles 'test thay are use thay are eyes for learnig or not'", () => {
    const tuktukRes = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "test thay are use thay are eyes for learnig or not", {}, "en");
    assert.ok(typeof tuktukRes === "string" && tuktukRes.length > 20);
    assert.ok(tuktukRes.toLowerCase().includes("passed"));
    assert.ok(tuktukRes.toLowerCase().includes("eye") || tuktukRes.toLowerCase().includes("visual") || tuktukRes.toLowerCase().includes("learn"));

    const visionRes = localCognitiveBrain.synthesizeResponse("vision", "Vision", "test thay are use thay are eyes for learnig or not", {}, "en");
    assert.ok(typeof visionRes === "string" && visionRes.length > 20);
    assert.ok(visionRes.toLowerCase().includes("passed") || visionRes.toLowerCase().includes("confirmed"));
    assert.ok(visionRes.toLowerCase().includes("visual") || visionRes.toLowerCase().includes("ocular") || visionRes.toLowerCase().includes("foveal"),
      `Vision must return visual observational learning response, got: ${visionRes}`);

    const fridayRes = localCognitiveBrain.synthesizeResponse("friday", "Friday", "test thay are use thay are eyes for learnig or not", {}, "en");
    assert.ok(typeof fridayRes === "string" && fridayRes.length > 20);
    assert.ok(fridayRes.toLowerCase().includes("visual") || fridayRes.toLowerCase().includes("telemetry") || fridayRes.toLowerCase().includes("confirmed"));

    const ddRes = localCognitiveBrain.synthesizeResponse("dd", "DD", "test thay are use thay are eyes for learnig or not", {}, "en");
    assert.ok(typeof ddRes === "string" && ddRes.length > 20);
    assert.ok(ddRes.toLowerCase().includes("visual") || ddRes.toLowerCase().includes("telemetry") || ddRes.toLowerCase().includes("passed"));
  });

});
