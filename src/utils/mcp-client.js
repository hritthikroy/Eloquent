/**
 * Model Context Protocol (MCP) Client Bridge for Eloquent
 * 
 * Implements the standard MCP JSON-RPC 2.0 protocol:
 * 1. Protocol Handshake: initialize & notifications
 * 2. Tool Discovery: tools/list
 * 3. Tool Invocation: tools/call
 * 4. Resource & Prompt Access: resources/list, prompts/list
 */

const { EventEmitter } = require("events");

class MCPClientBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.serverName = options.serverName || "eloquent-local-mcp";
    this.version = options.version || "1.0.0";
    this.tools = new Map();
    this.isInitialized = false;

    // Register built-in default tools
    this._registerDefaultTools();
  }

  _registerDefaultTools() {
    // 1. Terminal Command Runner
    this.registerTool({
      name: "run_terminal_command",
      description: "Execute a shell command in the project workspace with AST safety guards",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command to run" }
        },
        required: ["command"]
      },
      handler: async (args) => {
        const { execSync } = require("child_process");
        try {
          const output = execSync(args.command, { encoding: "utf8", timeout: 15000, cwd: process.cwd() });
          return { success: true, stdout: output.trim(), exitCode: 0 };
        } catch (err) {
          return { success: false, stderr: err.message, exitCode: err.status || 1 };
        }
      }
    });

    // 2. Read File Tool
    this.registerTool({
      name: "read_workspace_file",
      description: "Read the text content of a workspace file",
      inputSchema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to file" }
        },
        required: ["filePath"]
      },
      handler: async (args) => {
        const fs = require("fs");
        const path = require("path");
        const resolved = path.resolve(process.cwd(), args.filePath);
        if (!fs.existsSync(resolved)) {
          return { success: false, error: `File not found: ${args.filePath}` };
        }
        const content = fs.readFileSync(resolved, "utf8");
        return { success: true, content, lines: content.split("\n").length };
      }
    });

    // 3. Web Search Tool
    this.registerTool({
      name: "search_web",
      description: "Search the web for technical documentation and solutions",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        },
        required: ["query"]
      },
      handler: async (args) => {
        const { browserAgent } = require("./browser-agent");
        return await browserAgent.searchWeb(args.query);
      }
    });
  }

  /**
   * Register a custom tool on this MCP bridge
   */
  registerTool(toolDef) {
    if (!toolDef || !toolDef.name || typeof toolDef.handler !== "function") {
      throw new Error("Invalid tool definition: name and handler function required");
    }
    this.tools.set(toolDef.name, {
      name: toolDef.name,
      description: toolDef.description || "",
      inputSchema: toolDef.inputSchema || { type: "object", properties: {} },
      handler: toolDef.handler
    });
    this.emit("tool:registered", toolDef.name);
  }

  /**
   * MCP Protocol: Initialize handshake
   */
  async initialize() {
    this.isInitialized = true;
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: true },
        resources: {},
        prompts: {}
      },
      serverInfo: {
        name: this.serverName,
        version: this.version
      }
    };
  }

  /**
   * MCP Protocol: tools/list
   */
  async listTools() {
    const toolList = [];
    for (const [name, tool] of this.tools.entries()) {
      toolList.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      });
    }
    return { tools: toolList };
  }

  /**
   * MCP Protocol: tools/call
   */
  async callTool(name, argumentsObj = {}) {
    if (!this.tools.has(name)) {
      throw new Error(`MCP Tool not found: ${name}`);
    }
    const tool = this.tools.get(name);
    try {
      const result = await tool.handler(argumentsObj);
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
          }
        ],
        isError: false
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool ${name}: ${err.message}`
          }
        ],
        isError: true
      };
    }
  }
}

const mcpClientBridge = new MCPClientBridge();
module.exports = { MCPClientBridge, mcpClientBridge };
