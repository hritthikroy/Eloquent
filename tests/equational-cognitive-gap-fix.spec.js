/**
 * Test Suite: Equational Human Cognitive Gap Fixes
 * 
 * Verifies the 5 Equational Solutions bridging the human-agent cognitive gap:
 * 1. Default Mode Network (DMN) & Proactive Background Synthesis Equation
 * 2. Episodic Associative Memory & Shared Milestone Graph (Hippocampus)
 * 3. Theory of Mind Cognitive Load & Dynamic Verbosity Modulation (Prefrontal)
 * 4. Acoustic-Prosodic Entrainment & Vibe Vector Synchronization (Limbic)
 * 5. Closed-Form Sovereign Specialist Resonance & Equational Handoff (Squad Synergy)
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const ZeroLossMemoryEngine = require("../src/utils/zero-loss-memory");
const { BehaviorModeEngine } = require("../src/utils/behavior-mode-engine");
const ProsodicEntrainmentAdapter = require("../src/utils/prosodic-entrainment");
const JarvisManager = require("../src/utils/jarvis-manager");

test("Equational Human Cognitive Gap Fix Suite", async (t) => {
  const testUserData = path.resolve(__dirname, "../userData");
  const zeroLoss = new ZeroLossMemoryEngine({ userDataPath: testUserData });
  const behaviorEngine = new BehaviorModeEngine(testUserData);
  const entrainment = new ProsodicEntrainmentAdapter();
  const jarvis = new JarvisManager(testUserData);

  await t.test("1. Default Mode Network (DMN) & Proactive Background Synthesis Equation", () => {
    const dmnResult = zeroLoss.synthesizeProactiveDMN(path.resolve(__dirname, ".."), 10);
    assert.strictEqual(typeof dmnResult.dmnScore, "number");
    assert.ok(dmnResult.dmnScore >= 0.65, `DMN Score ${dmnResult.dmnScore} must satisfy threshold >= 0.65`);
    assert.strictEqual(dmnResult.hasCleanAST, true, "Proactive AST integrity must be clean");
    assert.ok(dmnResult.proactiveSummary.length > 10, "Proactive summary must be populated");
  });

  await t.test("2. Episodic Associative Memory & Shared Milestone Graph", () => {
    // Record a milestone
    const milestone = zeroLoss.recordMilestoneEpisode("AST Zero-Defect Pass", "Resolved voice hopping and code validation across all modules", "triumphant");
    assert.strictEqual(milestone.name, "AST Zero-Defect Pass");
    assert.strictEqual(milestone.emotionalVibe, "triumphant");

    // Test associative recall
    const learnedPool = [
      { topic: "Performance", insight: "Microsoft Ava neural voice latency dropped to 240ms", salience: 0.95, recallCount: 4 },
      { topic: "Architecture", insight: "AST validation runs with zero syntax errors via node -c", salience: 0.92, recallCount: 2 },
      { topic: "Preference", insight: "Prefers Banglish code-mixed natural speech", salience: 0.88, recallCount: 5 },
      { topic: "Random", insight: "Unrelated item about pizza toppings", salience: 0.40, recallCount: 0 }
    ];

    const recalled = zeroLoss.computeAssociativeRecall("voice latency and banglish", learnedPool, 2);
    assert.ok(recalled.length >= 1, "Must associatively recall relevant nodes");
    assert.strictEqual(recalled[0].topic === "Performance" || recalled[0].topic === "Preference", true, "Top recall must be resonant topic");

    // Format living memory with query
    const memFormatted = jarvis.formatLivingMemory("voice latency");
    assert.match(memFormatted, /SHARED LIVING MEMORY|Dynamic Learned Preferences/i);
  });

  await t.test("3. Theory of Mind Cognitive Load & Flow Verbosity Modulation", () => {
    // Scenario A: Deep flow state (rapid 1-word utterance while active in IDE)
    const deepFlow = behaviorEngine.computeCognitiveLoadIndex("ok", true);
    assert.strictEqual(deepFlow.isDeepFlow, true, "1-word utterance in active session must identify as Deep Flow");
    assert.ok(deepFlow.cli >= 0.70, `CLI (${deepFlow.cli.toFixed(2)}) must exceed 0.70`);
    assert.ok(deepFlow.targetWords <= 16, `Deep flow word ceiling (${deepFlow.targetWords}) must be clamped under 16 words`);

    // Scenario B: Exploratory strategy / resting (longer reflective query)
    const exploratory = behaviorEngine.computeCognitiveLoadIndex("Can you explain the overall system design and future roadmap for Eloquent?", false);
    assert.ok(exploratory.cli < deepFlow.cli, "Exploratory query must have lower cognitive load score");
    assert.ok(exploratory.targetWords > deepFlow.targetWords, "Exploratory mode allows higher verbosity ceiling");
  });

  await t.test("4. Subconscious Prosodic Entrainment & Vibe Vector", () => {
    // High-tempo excited utterance
    const excitedVibe = entrainment.analyzeVibe("Awesome, boom! That fixed the issue completely!", 1200);
    assert.strictEqual(excitedVibe.cognitiveMode, "EUREKA_BREAKTHROUGH");
    assert.ok(excitedVibe.arousal > 0.60, "Arousal must be elevated for breakthrough utterance");
    assert.ok(excitedVibe.valence > 0.20, "Valence must be positive");

    // Late-night calm utterance
    const lateNightVibe = entrainment.analyzeVibe("Tired after a long day of coding...", 2500);
    assert.strictEqual(lateNightVibe.cognitiveMode, "LATE_NIGHT_REFLECTIVE");
    assert.ok(lateNightVibe.valence <= 0.0, "Valence reflects fatigue");
  });

  await t.test("5. Closed-Form Sovereign Specialist Resonance & Equational Handoff", () => {
    const codeQuery = "vision ke bol build check korte";
    const handoff = jarvis.evaluateCrossAgentHandoff(codeQuery);
    assert.notStrictEqual(handoff, null);
    assert.strictEqual(handoff.delegated, true);
    assert.strictEqual(handoff.targetAgent.key, "vision");
    assert.strictEqual(handoff.sourceAgent.key, "tuktuk");
    assert.ok(handoff.utility >= 0.60, `U_handoff (${handoff.utility.toFixed(2)}) satisfies >= 0.60`);
  });

  zeroLoss.destroy();
});
