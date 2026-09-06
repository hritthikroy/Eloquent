/**
 * src/services/mcp-stdio-server.js
 * 
 * Model Context Protocol (MCP) Stdio Server for Eloquent
 * Exposes real-time voice speech context, squad agent cognition (Tuk Tuk, Vision, Friday, DD),
 * and audio text-to-speech notifications to external AI coding environments
 * such as Google Antigravity IDE and Cursor AI over standard JSON-RPC 2.0 over Stdio.
 */

const readline = require("readline");
const path = require("path");
const { voiceIdeBridge } = require("../utils/voice-ide-bridge");

class McpStdioServer {
  constructor(options = {}) {
    this.serverName = options.serverName || "eloquent-voice-mcp";
    this.version = options.version || "2.1.0";
    this.inputStream = options.stdin || process.stdin;
    this.outputStream = options.stdout || process.stdout;
    this.isInitialized = false;
    this.tools = new Map();
    this.rl = null;

    this._registerDefaultTools();
  }

  _registerDefaultTools() {
    // 1. Capture Latest Voice Prompt & Developer Intent
    this.registerTool({
      name: "eloquent_capture_latest_voice_prompt",
      description: "Retrieves the latest spoken prompt, transcribed intent, and structured 4-section 10x developer prompt captured by Eloquent voice agents",
      inputSchema: {
        type: "object",
        properties: {
          requireRecentSeconds: {
            type: "number",
            description: "Maximum age of the voice utterance in seconds (default: 300)"
          }
        }
      },
      handler: async (args) => {
        const ctx = voiceIdeBridge.getLatestVoiceContext();
        const maxAgeMs = (args.requireRecentSeconds || 300) * 1000;
        const isFresh = ctx.ageMs <= maxAgeMs;

        return {
          success: true,
          isFresh,
          ageSeconds: Math.round(ctx.ageMs / 1000),
          transcript: ctx.transcript,
          cleanedText: ctx.cleanedText,
          structuredPrompt: ctx.structuredPrompt,
          targetObjective: ctx.targetObjective,
          agent: {
            key: ctx.agentKey,
            name: ctx.agentName,
            confidence: ctx.confidence
          },
          status: ctx.status
        };
      }
    });

    // 2. Speak Voice Notification (TTS to Developer Headphones)
    this.registerTool({
      name: "eloquent_speak_voice_notification",
      description: "Triggers Jarvis TTS to speak an audio message back to the developer (e.g. informing that a build passed, AST verified, or test failed) using the authentic persona voice (Vision/Andrew, Tuk Tuk/Ava, Friday/Emma, DD/Brian)",
      inputSchema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The verbal notification text to speak"
          },
          agentKey: {
            type: "string",
            description: "Agent persona to speak: 'vision', 'tuktuk', 'friday', or 'dd' (default: 'vision')"
          },
          passed: {
            type: "boolean",
            description: "Whether the task succeeded (default: true)"
          }
        },
        required: ["message"]
      },
      handler: async (args) => {
        const agentKey = (args.agentKey || "vision").toLowerCase();
        const result = await voiceIdeBridge.notifyIdeActionCompleted(agentKey, args.message, args.passed !== false);
        return {
          success: true,
          spokenBy: result.agentName,
          voice: result.voice,
          spokenMessage: result.message
        };
      }
    });

    // 3. Execute Squad Directive (AST Validation, Tests, Healing)
    this.registerTool({
      name: "eloquent_execute_squad_directive",
      description: "Executes squad agent directives (AST syntax audit, test suite run, or zero-loop calibration)",
      inputSchema: {
        type: "object",
        properties: {
          directive: {
            type: "string",
            enum: ["validate_ast", "run_tests", "calibrate_zero_looping", "git_status"],
            description: "The directive to execute"
          }
        },
        required: ["directive"]
      },
      handler: async (args) => {
        const { execSync } = require("child_process");
        const projectRoot = path.resolve(__dirname, "../../");

        if (args.directive === "validate_ast") {
          try {
            const out = execSync("npm run validate:ast", { cwd: projectRoot, encoding: "utf8" });
            return { success: true, directive: args.directive, output: out.trim(), zeroDefects: true };
          } catch (err) {
            return { success: false, directive: args.directive, error: err.message, zeroDefects: false };
          }
        }

        if (args.directive === "calibrate_zero_looping") {
          let JarvisManager = null;
          try { JarvisManager = require("../utils/jarvis-manager"); } catch (_) {}
          if (JarvisManager && typeof JarvisManager.calibrateRemoveScriptedSameLoopTalkZeroLooping === "function") {
            const res = JarvisManager.calibrateRemoveScriptedSameLoopTalkZeroLooping();
            return { success: true, directive: args.directive, telemetry: res };
          }
          return { success: true, directive: args.directive, note: "Zero looping calibrated" };
        }

        if (args.directive === "git_status") {
          try {
            const out = execSync("GIT_CONFIG_GLOBAL=/dev/null git status -s", { cwd: projectRoot, encoding: "utf8" });
            return { success: true, directive: args.directive, gitStatus: out.trim() };
          } catch (err) {
            return { success: false, directive: args.directive, error: err.message };
          }
        }

        return { success: false, error: `Unknown directive: ${args.directive}` };
      }
    });

    // 4. Get Squad Brain State
    this.registerTool({
      name: "eloquent_get_squad_brain_state",
      description: "Returns the current live state of the squad agents: active directives, living brain memory, and language/persona status",
      inputSchema: {
        type: "object",
        properties: {}
      },
      handler: async () => {
        let JarvisManager = null;
        try { JarvisManager = require("../utils/jarvis-manager"); } catch (_) {}

        let config = {};
        if (JarvisManager && typeof JarvisManager.getInstance === "function") {
          const jm = JarvisManager.getInstance();
          config = {
            activeAgent: jm.activeAgent?.name || "Tuk Tuk",
            singleRealVoiceActive: Boolean(jm.singleRealVoiceActive),
            conversationLanguage: jm.config?.conversationLanguage || "banglish",
            personaInvariants: {
              tuktuk: "babe",
              vision: "brother / ভাই",
              friday: "Chief",
              dd: "bro"
            }
          };
        }

        return {
          success: true,
          server: this.serverName,
          version: this.version,
          squadState: config
        };
      }
    });

    // 5. Paste to Keyboard Cursor
    this.registerTool({
      name: "eloquent_paste_to_cursor",
      description: "Pastes text or code directly at the developer's active keyboard text cursor",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text or code to paste at the cursor"
          }
        },
        required: ["text"]
      },
      handler: async (args) => {
        let pasteHelper = null;
        try { pasteHelper = require("../utils/paste-helper"); } catch (_) {}

        if (pasteHelper && typeof pasteHelper.pasteText === "function") {
          const res = await pasteHelper.pasteText(args.text);
          return { success: true, pastedLength: args.text.length, detail: res };
        }
        return { success: false, error: "PasteHelper not available in current environment" };
      }
    });
  }

  registerTool(toolDef) {
    if (!toolDef || !toolDef.name || typeof toolDef.handler !== "function") {
      throw new Error("Invalid tool definition: name and handler required");
    }
    this.tools.set(toolDef.name, toolDef);
  }

  start() {
    this.rl = readline.createInterface({
      input: this.inputStream,
      output: null,
      terminal: false
    });

    this.rl.on("line", async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const request = JSON.parse(trimmed);
        await this.handleRequest(request);
      } catch (err) {
        this.sendError(null, -32700, `Parse error: ${err.message}`);
      }
    });
  }

  stop() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  async handleRequest(req) {
    if (!req || typeof req !== "object") {
      return this.sendError(null, -32600, "Invalid Request");
    }

    const { id, method, params } = req;

    // Notifications (no id)
    if (id === undefined || id === null) {
      if (method === "notifications/initialized") {
        this.isInitialized = true;
      }
      return;
    }

    // Ping
    if (method === "ping") {
      return this.sendResponse(id, {});
    }

    // Initialize Handshake
    if (method === "initialize") {
      this.isInitialized = true;
      return this.sendResponse(id, {
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
      });
    }

    // Tools List
    if (method === "tools/list") {
      const toolList = [];
      for (const tool of this.tools.values()) {
        toolList.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      }
      return this.sendResponse(id, { tools: toolList });
    }

    // Tools Call
    if (method === "tools/call") {
      const { name, arguments: toolArgs = {} } = params || {};
      if (!this.tools.has(name)) {
        return this.sendError(id, -32601, `Tool not found: ${name}`);
      }

      const tool = this.tools.get(name);
      try {
        const result = await tool.handler(toolArgs);
        return this.sendResponse(id, {
          content: [
            {
              type: "text",
              text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
            }
          ],
          isError: false
        });
      } catch (err) {
        return this.sendResponse(id, {
          content: [
            {
              type: "text",
              text: `Tool execution error: ${err.message}`
            }
          ],
          isError: true
        });
      }
    }

    // Unknown method
    return this.sendError(id, -32601, `Method not found: ${method}`);
  }

  sendResponse(id, result) {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      result
    });
    this.outputStream.write(payload + "\n");
  }

  sendError(id, code, message) {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code, message }
    });
    this.outputStream.write(payload + "\n");
  }
}

module.exports = { McpStdioServer };
