const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { WorkingDomainManager } = require("../src/utils/working-domain");

test("Working Domain Architecture Verification Suite", async (t) => {
  const manager = new WorkingDomainManager();

  await t.test("1. Workspace Domain Verification", () => {
    const ws = manager.getWorkspaceDomain();
    assert.equal(ws.domainType, "WORKSPACE_FILESYSTEM");
    assert.ok(ws.projectRoot.includes("EloquentElectron"));
    assert.equal(ws.projectName, "eloquent");
    assert.equal(ws.hasPackageJson, true);
    assert.equal(ws.status, "ACTIVE");
  });

  await t.test("2. Personal User & Developer Domain Verification", () => {
    const userDomain = manager.getPersonalUserDomain();
    assert.equal(userDomain.domainType, "PERSONAL_USER_DOMAIN");
    assert.equal(userDomain.userName, "Hritthik");
    assert.equal(userDomain.preferredLanguage, "Banglish / English Tech Hybrid");
    assert.equal(userDomain.activeSquadPersona, "Tuk Tuk");
    assert.equal(userDomain.autoASTValidation, true);
  });

  await t.test("3. Execution & Tool Domain Verification", () => {
    const execDomain = manager.getExecutionDomain();
    assert.equal(execDomain.domainType, "EXECUTION_TOOL_DOMAIN");
    assert.ok(execDomain.runtime.startsWith("Node.js"));
    assert.equal(execDomain.astGuardEnabled, true);
    assert.equal(execDomain.sandboxMode, "STANDARD_SANDBOX");
    assert.ok(execDomain.supportedCommands.includes("npm test"));
  });

  await t.test("4. Perceptual Sensory Domain Verification", () => {
    const percDomain = manager.getPerceptualDomain();
    assert.equal(percDomain.domainType, "PERCEPTUAL_SENSORY_DOMAIN");
    assert.ok(percDomain.visualCortex.includes("Schwartz Log-Polar"));
    assert.ok(percDomain.auditoryCortex.includes("Glasberg-Moore ERB"));
    assert.equal(percDomain.sampleRateHz, 16000);
    assert.equal(percDomain.turnTakingTargetMs, 260);
  });

  await t.test("5. Memory & Epistemic Domain Verification", () => {
    const memDomain = manager.getMemoryDomain();
    assert.equal(memDomain.domainType, "MEMORY_EPISTEMIC_DOMAIN");
    assert.equal(memDomain.storageEngine, "ZeroLossHierarchicalWAL");
    assert.ok(memDomain.walPath.endsWith("turn-wal.jsonl"));
    assert.ok(memDomain.historyPath.endsWith("history.json"));
  });

  await t.test("6. Unified Multi-Domain Context Synthesis (Claude / Antigravity / Cursor Equivalence)", () => {
    const unified = manager.resolveUnifiedDomainContext("optimize audio latency");
    assert.ok(unified.timestamp);
    assert.equal(unified.query, "optimize audio latency");
    assert.ok(unified.workspace);
    assert.ok(unified.user);
    assert.ok(unified.execution);
    assert.ok(unified.perceptual);
    assert.ok(unified.memory);
    assert.equal(unified.industryStandardEquivalence.claudeArtifactsCompatible, true);
    assert.equal(unified.industryStandardEquivalence.antigravitySubagentCompatible, true);
    assert.equal(unified.industryStandardEquivalence.cursorContextWindowCompatible, true);
  });

  await t.test("7. Personal Configuration Persistence & Reload", () => {
    const success = manager.savePersonalConfig({ vibe: "Hyper-Focused 10x Developer Mode" });
    assert.equal(success, true);
    const updated = manager.getPersonalUserDomain();
    assert.equal(updated.vibe, "Hyper-Focused 10x Developer Mode");
    
    // Restore default
    manager.savePersonalConfig({ vibe: "Supportive, 10x Engineer, Zero Nagging" });
  });
});
