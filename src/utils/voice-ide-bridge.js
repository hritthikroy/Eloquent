/**
 * src/utils/voice-ide-bridge.js
 * 
 * Voice IDE Bridge for Eloquent
 * Bridges voice-captured developer intent, 4-section 10x architect prompts,
 * and bidirectional audio feedback between Eloquent Squad Agents and IDEs
 * (Google Antigravity IDE, Cursor, Kiro, VS Code).
 */

const { EventEmitter } = require("events");
const path = require("path");

class VoiceIdeBridge extends EventEmitter {
  constructor() {
    super();
    this.latestVoiceContext = {
      transcript: "",
      cleanedText: "",
      structuredPrompt: "",
      targetObjective: "",
      agentKey: "vision",
      agentName: "Vision",
      confidence: 1.0,
      timestamp: Date.now(),
      status: "IDLE"
    };

    this.ideStatus = {
      connected: false,
      activeIde: "Antigravity",
      lastAction: null,
      lastError: null
    };

    this.recentHistory = [];
    this.maxHistory = 20;
  }

  /**
   * Records an utterance captured by Eloquent's audio pipeline and prompt engine.
   * @param {object} payload
   */
  recordUtterance(payload = {}) {
    const record = {
      transcript: payload.transcript || payload.rawText || "",
      cleanedText: payload.cleanedText || payload.sanitized || "",
      structuredPrompt: payload.structuredPrompt || payload.prompt || "",
      targetObjective: payload.targetObjective || payload.objective || "",
      agentKey: (payload.agentKey || "vision").toLowerCase(),
      agentName: payload.agentName || (payload.agentKey === "tuktuk" ? "Tuk Tuk" : "Vision"),
      confidence: payload.confidence || 0.99,
      timestamp: Date.now(),
      status: "READY"
    };

    this.latestVoiceContext = record;
    this.recentHistory.unshift(record);
    if (this.recentHistory.length > this.maxHistory) {
      this.recentHistory.pop();
    }

    this.emit("voice:captured", record);
    return record;
  }

  /**
   * Retrieves the latest active voice context for IDE consumers.
   * @returns {object}
   */
  getLatestVoiceContext() {
    return {
      ...this.latestVoiceContext,
      ageMs: Date.now() - this.latestVoiceContext.timestamp
    };
  }

  /**
   * Notifies developer via TTS when an IDE action (build, edit, test) finishes.
   * @param {string} agentKey - tuktuk, vision, friday, dd
   * @param {string} summary - Brief summary of what was done
   * @param {boolean} passed - Whether task succeeded
   */
  async notifyIdeActionCompleted(agentKey = "vision", summary = "", passed = true) {
    let JarvisManager = null;
    try {
      JarvisManager = require("./jarvis-manager");
    } catch (_) {}

    const key = (agentKey || "vision").toLowerCase();
    let agentName = "Vision";
    let voice = "en-US-AndrewMultilingualNeural";
    let message = "";

    if (key === "tuktuk") {
      agentName = "Tuk Tuk";
      voice = "en-US-AvaMultilingualNeural";
      message = passed
        ? `Babe, IDE task completed successfully! ${summary}`
        : `Babe, something blocked the build: ${summary}`;
    } else if (key === "friday") {
      agentName = "Friday";
      voice = "en-US-EmmaMultilingualNeural";
      message = passed
        ? `Chief, action verified and executed without error. ${summary}`
        : `Chief, exception encountered during execution: ${summary}`;
    } else if (key === "dd" || key === "brian") {
      agentName = "DD";
      voice = "en-US-BrianMultilingualNeural";
      message = passed
        ? `Bro, task finished clean! ${summary}`
        : `Bro, task hit a snag: ${summary}`;
    } else {
      agentName = "Vision";
      voice = "en-US-AndrewNeural";
      message = passed
        ? `Brother, task executed and AST verified clean. ${summary}`
        : `Brother, task failed verification: ${summary}`;
    }

    this.ideStatus.lastAction = {
      agentKey: key,
      agentName,
      summary,
      passed,
      timestamp: Date.now()
    };

    this.emit("ide:notified", this.ideStatus.lastAction);

    // Speak audio if JarvisManager is active
    if (JarvisManager && typeof JarvisManager.getInstance === "function") {
      try {
        const jm = JarvisManager.getInstance();
        if (typeof jm.speakText === "function") {
          await jm.speakText(message, { voice, agent: key });
        }
      } catch (err) {
        console.warn("⚠️ [VoiceIdeBridge] TTS notification fallback:", err.message);
      }
    }

    return {
      success: true,
      agentName,
      voice,
      message,
      passed
    };
  }

  /**
   * Generates standard mcp_config.json configuration for Antigravity & Cursor
   * @param {string} [customCliPath]
   */
  generateMcpConfig(customCliPath = null) {
    const cliPath = customCliPath || path.resolve(__dirname, "../../bin/eloquent-mcp-cli.js");
    return {
      mcpServers: {
        "eloquent-voice": {
          command: "node",
          args: [cliPath],
          env: {
            NODE_ENV: "production"
          }
        }
      }
    };
  }
}

const voiceIdeBridge = new VoiceIdeBridge();
module.exports = { VoiceIdeBridge, voiceIdeBridge };
