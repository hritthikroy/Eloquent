#!/usr/bin/env node
/**
 * tests/live-talk-to-code-ide-simulation.spec.js
 * 
 * Comprehensive Live End-to-End Test & Demonstration of the
 * Voice-Driven Talk-to-Code IDE Integration.
 * 
 * Simulates:
 * 1. User speaking voice directive to Vision brother
 * 2. STT Sanitization & 10x Architect Prompt Assembly
 * 3. Automatic Synchronization into VoiceIdeBridge & MCP Server
 * 4. Antigravity MCP Client Tool Invocation (Capture Prompt, Validate AST, Speak Voice Feedback)
 * 5. Closed-Form Verification
 */

const assert = require("assert");
const { spawn } = require("child_process");
const path = require("path");
const { PromptEngine } = require("../src/utils/prompt-engine");
const { voiceIdeBridge } = require("../src/utils/voice-ide-bridge");

console.log("================================================================================");
console.log("🚀 LIVE TALK-TO-CODE IDE & MCP FULL WORKFLOW SIMULATION TEST");
console.log("================================================================================\n");

async function runLiveSimulation() {
  const cliPath = path.resolve(__dirname, "../bin/eloquent-mcp-cli.js");

  // Step 1: Simulate User Speaking to Jarvis / Vision Brother
  console.log("[STAGE 1] User Speaks Voice Directive...");
  const rawUtterance = "Vision brother, fix audio buffer latency and verify AST schema compliance in our code";
  console.log(`  🗣️ Spoken Input: "${rawUtterance}"`);

  // Step 2: Process through PromptEngine (STT Sanitizer, Intent Parser, 4-Section Assembler, Bridge Sync)
  console.log("\n[STAGE 2] PromptEngine Processes Utterance & Assembles 10x Prompt...");
  const engineResult = await PromptEngine.process(rawUtterance, { userName: "Hritthik" });
  assert.strictEqual(engineResult.handled, true);
  assert.ok(engineResult.prompt.includes("Clear Technical Objective"));
  assert.ok(engineResult.prompt.includes("Key Files / Architecture"));
  assert.ok(engineResult.prompt.includes("Quality Requirements & AST Verification"));
  assert.ok(engineResult.prompt.includes("Next Steps & Continuation Roadmap"));
  console.log("  ✅ 4-Section 10x Architect Developer Prompt Assembled & Synced to Bridge.");

  // Verify Bridge State
  const bridgeCtx = voiceIdeBridge.getLatestVoiceContext();
  assert.strictEqual(bridgeCtx.status, "READY");
  assert.strictEqual(bridgeCtx.agentKey, "vision");
  console.log(`  Bridge Context Status: ${bridgeCtx.status} (Agent: ${bridgeCtx.agentName})`);

  // Step 3: Antigravity IDE connects to MCP Server over Stdio
  console.log("\n[STAGE 3] Antigravity IDE Connects via MCP JSON-RPC over Stdio...");
  const mcpProcess = spawn("node", [cliPath], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  let responseBuffer = "";
  let responseResolver = null;

  mcpProcess.stdout.on("data", (chunk) => {
    responseBuffer += chunk.toString();
    const lines = responseBuffer.split("\n");
    if (lines.length > 1) {
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line && responseResolver) {
          const parsed = JSON.parse(line);
          const resolve = responseResolver;
          responseResolver = null;
          resolve(parsed);
        }
      }
      responseBuffer = lines[lines.length - 1];
    }
  });

  function rpcCall(method, params, id = Date.now()) {
    return new Promise((resolve) => {
      responseResolver = resolve;
      mcpProcess.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  // MCP Handshake
  const init = await rpcCall("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "antigravity-live-ide", version: "1.0.0" }
  }, 1);
  assert.strictEqual(init.result.serverInfo.name, "eloquent-voice-mcp");
  console.log("  ✅ Handshake Connected: eloquent-voice-mcp v2.1.0");

  mcpProcess.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  // Step 4: Antigravity calls eloquent_capture_latest_voice_prompt
  console.log("\n[STAGE 4] Antigravity Invokes 'eloquent_capture_latest_voice_prompt'...");
  const captureRes = await rpcCall("tools/call", {
    name: "eloquent_capture_latest_voice_prompt",
    arguments: { requireRecentSeconds: 300 }
  }, 2);

  assert.strictEqual(captureRes.result.isError, false);
  const captured = JSON.parse(captureRes.result.content[0].text);
  assert.strictEqual(captured.success, true);
  assert.strictEqual(captured.isFresh, true);
  assert.strictEqual(captured.agent.name, "Vision");
  assert.ok(captured.structuredPrompt.includes("Clear Technical Objective"));
  console.log("  ✅ Captured Voice Prompt in IDE:");
  console.log("  -------------------------------------------------------------");
  console.log("  " + captured.structuredPrompt.split("\n").slice(0, 4).join("\n  ") + "\n  ...");
  console.log("  -------------------------------------------------------------");

  // Step 5: Antigravity calls eloquent_execute_squad_directive to validate AST
  console.log("\n[STAGE 5] Antigravity Invokes 'eloquent_execute_squad_directive' (validate_ast)...");
  const execRes = await rpcCall("tools/call", {
    name: "eloquent_execute_squad_directive",
    arguments: { directive: "validate_ast" }
  }, 3);

  assert.strictEqual(execRes.result.isError, false);
  const execData = JSON.parse(execRes.result.content[0].text);
  assert.strictEqual(execData.success, true);
  assert.strictEqual(execData.zeroDefects, true);
  console.log("  ✅ Workspace AST Validation Passed with Zero Defects.");

  // Step 6: Antigravity calls eloquent_speak_voice_notification to notify developer
  console.log("\n[STAGE 6] Antigravity Invokes 'eloquent_speak_voice_notification'...");
  const speakRes = await rpcCall("tools/call", {
    name: "eloquent_speak_voice_notification",
    arguments: {
      message: "Audio buffer latency fixed, all tests compiled with zero AST defect",
      agentKey: "vision",
      passed: true
    }
  }, 4);

  assert.strictEqual(speakRes.result.isError, false);
  const speakData = JSON.parse(speakRes.result.content[0].text);
  assert.strictEqual(speakData.success, true);
  assert.strictEqual(speakData.spokenBy, "Vision");
  assert.ok(speakData.spokenMessage.includes("Brother"));
  console.log(`  🗣️ Spoken Voice Feedback: "${speakData.spokenMessage}"`);
  console.log("  ✅ Voice Notification Delivered with Authentic Persona Sovereignty.");

  mcpProcess.kill("SIGTERM");

  console.log("\n================================================================================");
  console.log("🎉 ALL 6 STAGES OF LIVE TALK-TO-CODE IDE SIMULATION PASSED (6/6 = 100%)");
  console.log("================================================================================\n");
}

runLiveSimulation().catch((err) => {
  console.error("❌ Live simulation failed:", err);
  process.exit(1);
});
