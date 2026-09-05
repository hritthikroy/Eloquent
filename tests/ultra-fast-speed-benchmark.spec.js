const test = require("node:test");
const assert = require("node:assert/strict");
const { ultraFastAccelerator } = require("../src/utils/ultra-fast-accelerator");
const { WorkingDomainManager } = require("../src/utils/working-domain");
const humanEyeCortex = require("../src/utils/human-eye-cortex");
const humanEarCortex = require("../src/utils/human-ear-cortex");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const { subagentOrchestrator } = require("../src/utils/subagent-orchestrator");
const { websiteBuilder } = require("../src/utils/website-builder");
const { mcpClientBridge } = require("../src/utils/mcp-client");

test("Ultra-Fast Latency & Speed Benchmark Suite", async (t) => {
  const domainManager = new WorkingDomainManager();

  await t.test("1. Working Domain Resolution Speed (< 1.0ms)", () => {
    // Warm up cache
    domainManager.resolveUnifiedDomainContext("warmup");

    const { latencyMs } = ultraFastAccelerator.measureLatency(() => {
      return domainManager.resolveUnifiedDomainContext("ultra fast query");
    });

    assert.ok(latencyMs < 1.0, `Domain resolution latency ${latencyMs.toFixed(4)}ms must be < 1.0ms`);
  });

  await t.test("2. Visual Foveation & Saccade Speed (< 0.2ms)", () => {
    const { latencyMs } = ultraFastAccelerator.measureLatency(() => {
      return humanEyeCortex.computeSaccadeDynamics(0.1, 0.1, 0.8, 0.8);
    });

    assert.ok(latencyMs < 0.2, `Visual saccade latency ${latencyMs.toFixed(4)}ms must be < 0.2ms`);
  });

  await t.test("3. Auditory ERB Filter & Tonotopy Speed (< 0.2ms)", () => {
    const { latencyMs } = ultraFastAccelerator.measureLatency(() => {
      return humanEarCortex.computeERB(1000.0);
    });

    assert.ok(latencyMs < 0.2, `Auditory ERB latency ${latencyMs.toFixed(4)}ms must be < 0.2ms`);
  });

  await t.test("4. Local Cognitive Brain Deterministic Routing Speed (< 1.0ms)", () => {
    // Warm up V8 JIT
    for (let i = 0; i < 3; i++) {
      LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Tuk Tuk amader code check kor", {});
    }

    const { latencyMs } = ultraFastAccelerator.measureLatency(() => {
      return LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Tuk Tuk amader code check kor", {});
    });

    assert.ok(latencyMs < 1.0, `Local brain routing latency ${latencyMs.toFixed(4)}ms must be < 1.0ms`);
  });

  await t.test("5. Dynamic Subagent Spawn Speed (< 0.2ms)", () => {
    // Warm up V8 JIT
    subagentOrchestrator.spawnSubagent({ role: "Warmup", prompt: "warm" });

    const { latencyMs } = ultraFastAccelerator.measureLatency(() => {
      return subagentOrchestrator.spawnSubagent({
        role: "Speed Worker",
        typeName: "task-worker",
        prompt: "Fast check"
      });
    });

    assert.ok(latencyMs < 0.2, `Subagent spawn latency ${latencyMs.toFixed(4)}ms must be < 0.2ms`);
  });

  await t.test("6. Autonomous Website Builder Synthesis Speed (< 5.0ms)", async () => {
    const { latencyMs } = await ultraFastAccelerator.measureLatencyAsync(async () => {
      return await websiteBuilder.buildWebsiteFromVoice("build a website for Quantum Speed Engine", { openBrowser: false });
    });

    assert.ok(latencyMs < 5.0, `Website synthesis latency ${latencyMs.toFixed(4)}ms must be < 5.0ms`);
  });

  await t.test("7. MCP Tool Discovery & Registration Speed (< 0.5ms)", async () => {
    const { latencyMs } = await ultraFastAccelerator.measureLatencyAsync(async () => {
      return await mcpClientBridge.listTools();
    });

    assert.ok(latencyMs < 0.5, `MCP tool discovery latency ${latencyMs.toFixed(4)}ms must be < 0.5ms`);
  });
});
