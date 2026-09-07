#!/usr/bin/env node
/**
 * tests/voice-ide-bridge.spec.js
 * 
 * Unit Test Suite for VoiceIdeBridge
 * Verifies voice context recording, IDE action completion callbacks,
 * persona sovereignty messages, and Antigravity MCP config generation.
 */

const assert = require("assert");
const { VoiceIdeBridge } = require("../src/utils/voice-ide-bridge");

console.log("================================================================================");
console.log("🚀 RUNNING VOICE IDE BRIDGE VERIFICATION SUITE");
console.log("================================================================================\n");

async function runTests() {
  const bridge = new VoiceIdeBridge({ hydrate: false, persist: false });

  // 1. Initial State
  console.log("[TEST 1] Testing Initial State...");
  const initialCtx = bridge.getLatestVoiceContext();
  assert.strictEqual(initialCtx.status, "IDLE");
  assert.strictEqual(initialCtx.agentKey, "vision");
  console.log("  ✅ [PASS 1/4] Initial state is IDLE and default agent is Vision.");

  // 2. Record Utterance
  console.log("\n[TEST 2] Testing Record Utterance...");
  const record = bridge.recordUtterance({
    transcript: "Vision brother, fix audio buffer latency in recorder.js",
    cleanedText: "Vision brother, fix audio buffer latency in recorder.js",
    structuredPrompt: "Clear Technical Objective:\nFix audio buffer latency...",
    targetObjective: "Fix audio buffer latency",
    agentKey: "vision"
  });

  assert.strictEqual(record.status, "READY");
  assert.strictEqual(record.agentKey, "vision");
  assert.ok(record.transcript.includes("recorder.js"));

  const latest = bridge.getLatestVoiceContext();
  assert.strictEqual(latest.status, "READY");
  assert.strictEqual(latest.transcript, record.transcript);
  assert.ok(typeof latest.ageMs === "number");
  assert.strictEqual(bridge.recentHistory.length, 1);
  console.log("  ✅ [PASS 2/4] Utterance recorded into latest context and history.");

  // 3. Notify IDE Action Completed across Personas
  console.log("\n[TEST 3] Testing Notify IDE Action Completed Across Personas...");
  
  // Vision (Brother)
  const visionNotif = await bridge.notifyIdeActionCompleted("vision", "AST syntax checked, 0 errors", true);
  assert.strictEqual(visionNotif.agentName, "Vision");
  assert.ok(visionNotif.message.includes("Brother"));
  assert.strictEqual(visionNotif.passed, true);

  // Tuk Tuk (Babe)
  const tuktukNotif = await bridge.notifyIdeActionCompleted("tuktuk", "Workspace synced", true);
  assert.strictEqual(tuktukNotif.agentName, "Tuk Tuk");
  assert.ok(tuktukNotif.message.includes("Babe"));

  // Friday (Chief)
  const fridayNotif = await bridge.notifyIdeActionCompleted("friday", "Telemetry verified", true);
  assert.strictEqual(fridayNotif.agentName, "Friday");
  assert.ok(fridayNotif.message.includes("Chief"));

  // DD (Bro)
  const ddNotif = await bridge.notifyIdeActionCompleted("dd", "Sockets green", true);
  assert.strictEqual(ddNotif.agentName, "DD");
  assert.ok(ddNotif.message.includes("Bro"));

  console.log("  ✅ [PASS 3/4] Persona sovereignty strictly preserved across all 4 agents.");

  // 4. Generate MCP Config for Antigravity & Cursor
  console.log("\n[TEST 4] Testing MCP Config Generator...");
  const config = bridge.generateMcpConfig("/dummy/path/bin/eloquent-mcp-cli.js");
  assert.ok(config.mcpServers);
  assert.ok(config.mcpServers["eloquent-voice"]);
  assert.strictEqual(config.mcpServers["eloquent-voice"].command, "node");
  assert.strictEqual(config.mcpServers["eloquent-voice"].args[0], "/dummy/path/bin/eloquent-mcp-cli.js");
  console.log("  ✅ [PASS 4/4] Valid Antigravity mcp_config.json structure generated.");

  console.log("\n================================================================================");
  console.log("🎉 ALL 4 VOICE IDE BRIDGE SUBTESTS PASSED (4/4 = 100%)");
  console.log("================================================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
