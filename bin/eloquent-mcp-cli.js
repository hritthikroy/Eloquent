#!/usr/bin/env node
/**
 * bin/eloquent-mcp-cli.js
 * 
 * Executable CLI Entry Point for Eloquent MCP Stdio Server
 * Connects directly to Google Antigravity IDE, Cursor AI, and MCP-compatible environments.
 * 
 * Usage in mcp_config.json:
 * {
 *   "mcpServers": {
 *     "eloquent-voice": {
 *       "command": "node",
 *       "args": ["/Users/hritthik/Documents/voicy 2.o/EloquentElectron/bin/eloquent-mcp-cli.js"]
 *     }
 *   }
 * }
 */

const { McpStdioServer } = require("../src/services/mcp-stdio-server");

const server = new McpStdioServer({
  serverName: "eloquent-voice-mcp",
  version: "2.1.0",
  stdin: process.stdin,
  stdout: process.stdout
});

process.on("uncaughtException", (err) => {
  process.stderr.write(`[Eloquent MCP Error] ${err.message}\n`);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[Eloquent MCP Unhandled Rejection] ${reason}\n`);
});

server.start();
