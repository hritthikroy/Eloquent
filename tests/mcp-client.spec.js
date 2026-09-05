const test = require("node:test");
const assert = require("node:assert/strict");
const { MCPClientBridge, mcpClientBridge } = require("../src/utils/mcp-client");

test("Model Context Protocol (MCP) Client Bridge Suite", async (t) => {
  const mcp = new MCPClientBridge();

  await t.test("1. MCP Protocol Handshake (initialize)", async () => {
    const initRes = await mcp.initialize();
    assert.equal(initRes.protocolVersion, "2024-11-05");
    assert.equal(initRes.serverInfo.name, "eloquent-local-mcp");
    assert.ok(initRes.capabilities.tools);
    assert.equal(mcp.isInitialized, true);
  });

  await t.test("2. Tool Discovery (tools/list)", async () => {
    const listRes = await mcp.listTools();
    assert.ok(Array.isArray(listRes.tools));
    assert.ok(listRes.tools.length >= 3);

    const toolNames = listRes.tools.map(t => t.name);
    assert.ok(toolNames.includes("run_terminal_command"));
    assert.ok(toolNames.includes("read_workspace_file"));
    assert.ok(toolNames.includes("search_web"));
  });

  await t.test("3. Tool Invocation: run_terminal_command", async () => {
    const callRes = await mcp.callTool("run_terminal_command", { command: "node -v" });
    assert.equal(callRes.isError, false);
    assert.ok(callRes.content[0].text.includes("stdout"));
    assert.ok(callRes.content[0].text.includes("v20") || callRes.content[0].text.includes("v"));
  });

  await t.test("4. Tool Invocation: read_workspace_file", async () => {
    const callRes = await mcp.callTool("read_workspace_file", { filePath: "package.json" });
    assert.equal(callRes.isError, false);
    assert.ok(callRes.content[0].text.includes("eloquent"));
  });

  await t.test("5. Custom MCP Tool Dynamic Registration", async () => {
    mcp.registerTool({
      name: "calculate_cpu_load",
      description: "Calculate current CPU load percentage",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        return { cpuLoad: "12%", status: "OPTIMAL" };
      }
    });

    const listRes = await mcp.listTools();
    const customTool = listRes.tools.find(t => t.name === "calculate_cpu_load");
    assert.ok(customTool);

    const callRes = await mcp.callTool("calculate_cpu_load", {});
    assert.equal(callRes.isError, false);
    assert.ok(callRes.content[0].text.includes("OPTIMAL"));
  });

  await t.test("6. Error Handling on Unknown MCP Tool", async () => {
    await assert.rejects(
      async () => { await mcp.callTool("non_existent_tool", {}); },
      /MCP Tool not found/
    );
  });
});
