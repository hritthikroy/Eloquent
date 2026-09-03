// Gemini Client - High-Level Reasoning, Multimodal Vision & Task Execution Engine
const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_GEMINI_API_KEY = "";

const CANDIDATE_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.6-flash"
];

class GeminiClient {
  constructor(apiKey = null, userDataPath = null) {
    this.userDataPath = userDataPath || path.resolve(__dirname, "../../userData");
    this.apiKey = apiKey || this._loadApiKey();
    this.models = CANDIDATE_MODELS;
  }

  _loadApiKey() {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      return process.env.GEMINI_API_KEY.trim();
    }
    try {
      const adminConfigFile = path.join(this.userDataPath, "admin-config.json");
      if (fs.existsSync(adminConfigFile)) {
        const data = JSON.parse(fs.readFileSync(adminConfigFile, "utf8"));
        if (data.geminiApiKey && data.geminiApiKey.trim()) {
          return data.geminiApiKey.trim();
        }
      }
    } catch (e) {
      // Ignore read error
    }
    return DEFAULT_GEMINI_API_KEY;
  }

  setApiKey(key) {
    if (!key || typeof key !== "string") return;
    this.apiKey = key.trim();
    try {
      const adminConfigFile = path.join(this.userDataPath, "admin-config.json");
      let data = {};
      if (fs.existsSync(adminConfigFile)) {
        data = JSON.parse(fs.readFileSync(adminConfigFile, "utf8"));
      }
      data.geminiApiKey = this.apiKey;
      fs.writeFileSync(adminConfigFile, JSON.stringify(data, null, 2), "utf8");
      console.log("✅ [Gemini Client] API key persisted to admin-config.json");
    } catch (err) {
      console.warn("⚠️ [Gemini Client] Could not persist API key:", err.message);
    }
  }

  getApiKey() {
    return this.apiKey || DEFAULT_GEMINI_API_KEY;
  }

  isConfigured() {
    return Boolean(this.getApiKey() && this.getApiKey().length > 10);
  }

  /**
   * Convert OpenAI-style messages array to Gemini REST format
   */
  _formatGeminiPayload(messages, options = {}) {
    let systemInstructionText = "";
    const contents = [];

    for (const msg of messages) {
      if (!msg || !msg.content) continue;
      const contentText = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

      if (msg.role === "system") {
        systemInstructionText += (systemInstructionText ? "\n\n" : "") + contentText;
      } else {
        const geminiRole = msg.role === "assistant" ? "model" : "user";
        contents.push({
          role: geminiRole,
          parts: [{ text: contentText }]
        });
      }
    }

    // Ensure at least one user turn exists
    if (contents.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: "Hello" }]
      });
    }

    // If an image is provided, attach it to the latest user message
    if (options.imagePath && fs.existsSync(options.imagePath)) {
      try {
        const imageBuffer = fs.readFileSync(options.imagePath);
        const base64Data = imageBuffer.toString("base64");
        const ext = path.extname(options.imagePath).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

        const lastUser = contents.slice().reverse().find(c => c.role === "user");
        if (lastUser) {
          lastUser.parts.unshift({
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          });
        }
      } catch (imgErr) {
        console.warn("⚠️ [Gemini Client] Error attaching image:", imgErr.message);
      }
    }

    const payload = {
      contents: contents,
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : 0.4,
        maxOutputTokens: options.max_tokens || options.maxOutputTokens || 600,
        topP: options.topP || 0.95
      }
    };

    if (systemInstructionText.trim().length > 0) {
      payload.systemInstruction = {
        parts: [{ text: systemInstructionText.trim() }]
      };
    }

    return payload;
  }

  /**
   * Send single REST generateContent request to a specific Gemini model
   */
  _requestGenerateContent(modelName, payload, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const postData = JSON.stringify(payload);
      const apiKey = this.getApiKey();

      const req = https.request({
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: timeoutMs
      }, (res) => {
        let responseBody = "";
        res.on("data", chunk => responseBody += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(responseBody);
            if (res.statusCode === 200 && json.candidates && json.candidates[0]?.content) {
              const textParts = json.candidates[0].content.parts || [];
              const rawText = textParts.map(p => p.text).filter(Boolean).join("\n").trim();
              const usage = json.usageMetadata || null;
              resolve({
                status: 200,
                content: rawText,
                model: modelName,
                usage: usage
              });
            } else {
              const errorMsg = json.error?.message || `HTTP ${res.statusCode}: ${responseBody.slice(0, 150)}`;
              resolve({
                status: res.statusCode,
                error: errorMsg,
                model: modelName
              });
            }
          } catch (parseErr) {
            resolve({
              status: res.statusCode,
              error: `JSON parse error: ${parseErr.message}`,
              model: modelName
            });
          }
        });
      });

      req.on("error", (err) => {
        resolve({
          status: 0,
          error: err.message,
          model: modelName
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({
          status: 408,
          error: `Request timed out after ${timeoutMs}ms`,
          model: modelName
        });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Main chat completion with automatic fallback through candidate Gemini models
   */
  async callChatCompletion(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error("Gemini API key is not configured");
    }

    const payload = this._formatGeminiPayload(messages, options);
    const candidateModels = options.model ? [options.model, ...this.models] : this.models;
    const uniqueModels = [...new Set(candidateModels)];

    let lastError = null;

    for (const modelName of uniqueModels) {
      try {
        console.log(`✨ [Gemini Engine] Querying model: ${modelName}...`);
        const result = await this._requestGenerateContent(modelName, payload, options.timeout || 12000);

        if (result.status === 200 && result.content && result.content.length > 0) {
          console.log(`✅ [Gemini Engine] ${modelName} completed response (${result.content.length} chars)`);
          return {
            content: result.content,
            model: modelName,
            usage: result.usage
          };
        }

        console.warn(`⚠️ [Gemini Engine] Model ${modelName} returned status ${result.status}: ${result.error}. Trying next model...`);
        lastError = new Error(result.error || `Gemini status ${result.status}`);
      } catch (err) {
        console.warn(`⚠️ [Gemini Engine] Exception on model ${modelName}:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error("All candidate Gemini models failed");
  }

  /**
   * High-level architectural reasoning and multi-step coding task executor
   */
  async executeHighLevelTask(taskDescription, context = {}, options = {}) {
    const startTime = Date.now();
    console.log(`🚀 [Gemini High-Level Task] Executing: "${taskDescription.slice(0, 80)}..."`);

    const systemPrompt = `You are the Google Gemini High-Level Autonomous Intelligence Engine for Eloquent.
You provide deep architectural analysis, high-speed coding solutions, and multi-agent task execution for Hritthik (Creator of Eloquent).
Current Workspace Context:
- Node.js & Electron Desktop Host
- Go Audio Backend with Zero-Copy DSP & Geigel Double-Talk Cancellation
- 4-Agent Co-Founder Suite: Tuk Tuk (Partner), Andrew (Lead Engineer), Jenny (Research), Brian (DevOps)

When executing tasks:
1. Provide precise, production-grade solutions.
2. Be direct, authoritative, and eliminate conversational filler.
3. For spoken answers, keep it crisp and conversational (under 40 words). For code generation, produce clean code with no superfluous wrappers.`;

    const userContent = `Task: ${taskDescription}
${context.screenContext ? `\nActive Screen Context: ${JSON.stringify(context.screenContext)}` : ""}
${context.additionalContext ? `\nAdditional Context: ${context.additionalContext}` : ""}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ];

    const res = await this.callChatCompletion(messages, {
      temperature: options.temperature !== undefined ? options.temperature : 0.2,
      max_tokens: options.max_tokens || 800,
      imagePath: context.imagePath || null
    });

    const elapsed = Date.now() - startTime;
    console.log(`⚡ [Gemini High-Level Task] Finished in ${elapsed}ms using ${res.model}`);

    return {
      success: true,
      result: res.content,
      model: res.model,
      elapsedMs: elapsed
    };
  }

  /**
   * Multimodal live screen inspection: analyzes screenshots to answer questions about code, errors, or UI
   */
  async analyzeScreen(imagePath, queryText = "What is on the user's screen right now?", options = {}) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Screenshot not found at ${imagePath}`);
    }

    const messages = [
      {
        role: "system",
        content: "You are the real-time visual perception cortex of Eloquent. You analyze screenshots of Hritthik's active macOS monitor. Be extremely accurate about code errors, open windows, terminal logs, and IDE context. Answer in 2 crisp, high-IQ spoken sentences."
      },
      {
        role: "user",
        content: queryText
      }
    ];

    return await this.callChatCompletion(messages, {
      imagePath: imagePath,
      temperature: 0.2,
      max_tokens: options.max_tokens || 200
    });
  }
}

// Export singleton instance initialized with default key
const defaultGeminiClient = new GeminiClient();

module.exports = {
  GeminiClient,
  geminiClient: defaultGeminiClient,
  DEFAULT_GEMINI_API_KEY
};
