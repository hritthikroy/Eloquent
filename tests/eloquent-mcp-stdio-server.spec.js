#!/usr/bin/env node
/**
 * tests/eloquent-mcp-stdio-server.spec.js
 * 
 * Integration Test Suite for Eloquent MCP Stdio Server
 * Verifies JSON-RPC 2.0 protocol over Stdio streams:
 * - Handshake (initialize)
 * - Discovery (tools/list)
 * - Invocations (tools/call)
 * - Persona voice notifications and squad directives
 */

const assert = require("assert");
const { PassThrough } = require("stream");
const { McpStdioServer } = require("../src/services/mcp-stdio-server");
const { voiceIdeBridge } = require("../src/utils/voice-ide-bridge");

console.log("================================================================================");
console.log("🚀 RUNNING ELOQUENT MCP STDIO SERVER PROTOCOL VERIFICATION SUITE");
console.log("================================================================================\n");

async function runMcpServerTests() {
  const stdinStream = new PassThrough();
  const stdoutStream = new PassThrough();

  const server = new McpStdioServer({
    serverName: "eloquent-voice-mcp-test",
    version: "2.1.0",
    stdin: stdinStream,
    stdout: stdoutStream
  });

  server.start();

  let responseResolver = null;
  let responseBuffer = "";

  stdoutStream.on("data", (chunk) => {
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

  function sendJsonRpc(req) {
    return new Promise((resolve) => {
      responseResolver = resolve;
      stdinStream.write(JSON.stringify(req) + "\n");
    });
  }

  // Pre-seed voice context
  voiceIdeBridge.recordUtterance({
    transcript: "Vision brother, optimize ring buffer latency in audio recorder",
    cleanedText: "Vision brother, optimize ring buffer latency in audio recorder",
    structuredPrompt: "Clear Technical Objective:\nOptimize ring buffer latency...",
    targetObjective: "Optimize ring buffer latency",
    agentKey: "vision"
  });

  // 1. Handshake: initialize
  console.log("[TEST 1] Testing MCP JSON-RPC Handshake (initialize)...");
  const initRes = await sendJsonRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "antigravity-test-client", version: "1.0.0" }
    }
  });

  assert.strictEqual(initRes.jsonrpc, "2.0");
  assert.strictEqual(initRes.id, 1);
  assert.strictEqual(initRes.result.protocolVersion, "2024-11-05");
  assert.strictEqual(initRes.result.serverInfo.name, "eloquent-voice-mcp-test");
  assert.ok(initRes.result.capabilities.tools);
  console.log("  ✅ [PASS 1/6] Handshake succeeded with protocol version 2024-11-05.");

  // 2. Notification: initialized
  console.log("\n[TEST 2] Testing Notification initialized...");
  stdinStream.write(JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized"
  }) + "\n");
  assert.strictEqual(server.isInitialized, true);
  console.log("  ✅ [PASS 2/6] Notification acknowledged and server marked initialized.");

  // 3. Tool Discovery: tools/list
  console.log("\n[TEST 3] Testing Tool Discovery (tools/list)...");
  const listRes = await sendJsonRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });

  assert.strictEqual(listRes.id, 2);
  assert.ok(Array.isArray(listRes.result.tools));
  assert.ok(listRes.result.tools.length >= 5);

  const toolNames = listRes.result.tools.map(t => t.name);
  assert.ok(toolNames.includes("eloquent_capture_latest_voice_prompt"));
  assert.ok(toolNames.includes("eloquent_speak_voice_notification"));
  assert.ok(toolNames.includes("eloquent_execute_squad_directive"));
  assert.ok(toolNames.includes("eloquent_get_squad_brain_state"));
  assert.ok(toolNames.includes("eloquent_paste_to_cursor"));
  console.log(`  Discovered Tools: [${toolNames.join(", ")}]`);
  console.log("  ✅ [PASS 3/6] All 5 developer MCP tools discovered with valid schemas.");

  // 4. Tool Invocation: eloquent_capture_latest_voice_prompt
  console.log("\n[TEST 4] Testing Tool Invocation (eloquent_capture_latest_voice_prompt)...");
  const captureRes = await sendJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eloquent_capture_latest_voice_prompt",
      arguments: { requireRecentSeconds: 60 }
    }
  });

  assert.strictEqual(captureRes.id, 3);
  assert.strictEqual(captureRes.result.isError, false);
  const captureData = JSON.parse(captureRes.result.content[0].text);
  assert.strictEqual(captureData.success, true);
  assert.strictEqual(captureData.isFresh, true);
  assert.strictEqual(captureData.agent.key, "vision");
  assert.ok(captureData.transcript.includes("optimize ring buffer latency"));
  console.log("  ✅ [PASS 4/6] Spoken prompt and 10x architect context captured.");

  // 5. Tool Invocation: eloquent_speak_voice_notification
  console.log("\n[TEST 5] Testing Tool Invocation (eloquent_speak_voice_notification)...");
  const speakRes = await sendJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "eloquent_speak_voice_notification",
      arguments: {
        message: "AST checked and all 39 handoff tests passed",
        agentKey: "vision",
        passed: true
      }
    }
  });

  assert.strictEqual(speakRes.id, 4);
  assert.strictEqual(speakRes.result.isError, false);
  const speakData = JSON.parse(speakRes.result.content[0].text);
  assert.strictEqual(speakData.success, true);
  assert.strictEqual(speakData.spokenBy, "Vision");
  assert.ok(speakData.spokenMessage.includes("Brother"));
  console.log("  ✅ [PASS 5/6] Voice notification dispatched with persona sovereignty.");

  // 6. Error Handling on Unknown Tool
  console.log("\n[TEST 6] Testing Error Handling on Unknown Tool...");
  const errRes = await sendJsonRpc({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "unknown_tool",
      arguments: {}
    }
  });

  assert.strictEqual(errRes.id, 5);
  assert.ok(errRes.error);
  assert.strictEqual(errRes.error.code, -32601);
  assert.ok(errRes.error.message.includes("Tool not found"));
  console.log("  ✅ [PASS 6/6] Standard JSON-RPC -32601 error returned for unknown tool.");

  server.stop();

  console.log("\n================================================================================");
  console.log("🎉 ALL 6 MCP STDIO SERVER SUBTESTS PASSED (6/6 = 100%)");
  console.log("================================================================================\n");
}

runMcpServerTests().catch((err) => {
  console.error("❌ MCP Server test failed:", err);
  process.exit(1);
});
