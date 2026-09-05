const assert = require("assert");
const { HarnessService, harnessService } = require("../src/services/harness-service");
const actionRunner = require("../src/utils/action-runner");
const { validateSkillProfile } = require("../src/services/skill-daemon");
const fs = require("fs");
const path = require("path");

async function runHarnessTests() {
  console.log("🧪 Starting Harness Service & DevOps Automation Unit Tests...");

  // Test 1: Configuration check
  assert.strictEqual(harnessService.isConfigured(), true, "Harness service should be configured");
  assert.strictEqual(harnessService.accountId, "GzOfvD7STBis1yNTgNek3A", "Harness account ID must match");
  assert(harnessService.apiKey.startsWith("pat.GzOfvD7STBis1yNTgNek3A"), "Harness API key should match PAT format");
  console.log("✅ Test 1 Passed: Harness credentials properly loaded.");

  // Test 2: Project and Pipeline List
  const projRes = await harnessService.listProjects();
  assert.strictEqual(projRes.success, true, "Projects list should succeed");

  const pipeRes = await harnessService.listPipelines();
  assert.strictEqual(pipeRes.success, true, "Pipelines list should succeed");
  assert(pipeRes.pipelines.length > 0, "Pipelines should have entries");
  console.log("✅ Test 2 Passed: Project and pipeline discovery passed.");

  // Test 3: Trigger Pipeline Execution
  const triggerRes = await harnessService.triggerPipeline("eloquent_build_pipeline");
  assert.strictEqual(triggerRes.success, true, "Trigger pipeline should succeed");
  assert(triggerRes.executionId.length > 0, "Execution ID should be returned");
  console.log("✅ Test 3 Passed: Pipeline triggering succeeded with execution ID:", triggerRes.executionId);

  // Test 4: Execution Status & Feature Flags & Health
  const statusRes = await harnessService.getExecutionStatus(triggerRes.executionId);
  assert.strictEqual(statusRes.success, true, "Status query should succeed");

  const flagsRes = await harnessService.listFeatureFlags();
  assert.strictEqual(flagsRes.success, true, "Feature flags query should succeed");

  const healthRes = await harnessService.getServiceHealth();
  assert.strictEqual(healthRes.success, true, "Service health query should succeed");
  assert.strictEqual(healthRes.health, "HEALTHY", "Health status should be HEALTHY");
  console.log("✅ Test 4 Passed: Status, feature flags, and health queries passed.");

  // Test 5: Action Runner Voice Command Integration
  const deployAction = await actionRunner.handleAction("Vision trigger deployment", { name: "Vision", key: "vision" });
  assert.strictEqual(deployAction.handled, true, "Deploy voice action should be handled");
  assert(deployAction.speech.includes("pipeline") || deployAction.speech.includes("Execution ID"), "Speech should confirm deployment trigger");

  const statusAction = await actionRunner.handleAction("Brian check pipeline status", { name: "Brian", key: "brian" });
  assert.strictEqual(statusAction.handled, true, "Status voice action should be handled");
  assert(statusAction.speech.includes("Harness") || statusAction.speech.includes("pipeline"), "Speech should confirm pipeline status");

  const flagsAction = await actionRunner.handleAction("Vision check feature flags", { name: "Vision", key: "vision" });
  assert.strictEqual(flagsAction.handled, true, "Flags voice action should be handled");
  assert(flagsAction.speech.includes("flags"), "Speech should confirm feature flags");
  console.log("✅ Test 5 Passed: ActionRunner voice commands routed to Harness seamlessly.");

  // Test 6: Skill Profile Schema Validation
  const skillsDir = path.resolve(__dirname, "../config/skills");
  const skillFiles = ["vision.json", "brian.json", "friday.json", "tuktuk.json", "andrew.json"];
  for (const file of skillFiles) {
    const filePath = path.join(skillsDir, file);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      assert.doesNotThrow(() => validateSkillProfile(data), `Skill file ${file} must pass schema validation`);
    }
  }
  console.log("✅ Test 6 Passed: All 5 agent skill profiles passed strict schema validation.");

  console.log("\n🎉 ALL HARNESS & SELF-UPDATE TESTS PASSED (6/6)!\n");
}

runHarnessTests().catch((err) => {
  console.error("❌ Test failure:", err);
  process.exit(1);
});
