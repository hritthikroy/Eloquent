// Gemini Client - High-Level Reasoning, Multimodal Vision & 24/7 Multi-Key Pool
const fs = require("fs");
const path = require("path");
const https = require("https");

// API keys must be loaded from environment variables only for security
const DEFAULT_GEMINI_API_KEYS = [];

const CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-pro",
  "gemini-pro-latest"
];

class GeminiClient {
  constructor(apiKeys = null, userDataPath = null) {
    this.userDataPath = userDataPath || path.resolve(__dirname, "../../userData");
    this.apiKeys = this._normalizeKeys(apiKeys) || this._loadApiKeys();
    this.activeKeyIndex = 0;
    this.models = CANDIDATE_MODELS;
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 25,
      keepAliveMsecs: 30000
    });
    this.keyCooldowns = new Map();
  }

  isKeyCoolingDown(key, model = null) {
    const expiresAt = this.keyCooldowns.get(key) || 0;
    if (Date.now() < expiresAt) return true;
    if (model) {
      const modelExpiresAt = this.keyCooldowns.get(`${key}:${model}`) || 0;
      if (Date.now() < modelExpiresAt) return true;
    }
    return false;
  }

  setKeyCooldown(key, cooldownMs = 15000, model = null) {
    const now = Date.now();
    if (model) {
      this.keyCooldowns.set(`${key}:${model}`, now + cooldownMs);
    } else {
      this.keyCooldowns.set(key, now + cooldownMs);
    }
  }

  areAllKeysCoolingDown(model = null) {
    return this.apiKeys.length > 0 && this.apiKeys.every(k => this.isKeyCoolingDown(k, model));
  }

  _normalizeKeys(keys) {
    if (!keys) return null;
    if (Array.isArray(keys)) {
      const valid = keys.filter(k => k && typeof k === "string" && k.trim().length > 10);
      return valid.length > 0 ? valid : null;
    }
    if (typeof keys === "string" && keys.trim().length > 10) {
      return [keys.trim()];
    }
    return null;
  }

  _loadApiKeys() {
    const keys = [];
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      keys.push(process.env.GEMINI_API_KEY.trim());
    }
    if (process.env.GEMINI_API_KEY_2 && process.env.GEMINI_API_KEY_2.trim()) {
      keys.push(process.env.GEMINI_API_KEY_2.trim());
    }

    try {
      const adminConfigFile = path.join(this.userDataPath, "admin-config.json");
      if (fs.existsSync(adminConfigFile)) {
        const data = JSON.parse(fs.readFileSync(adminConfigFile, "utf8"));
        if (Array.isArray(data.geminiApiKeys)) {
          for (const k of data.geminiApiKeys) {
            if (k && typeof k === "string" && k.trim()) keys.push(k.trim());
          }
        }
        if (data.geminiApiKey && typeof data.geminiApiKey === "string" && data.geminiApiKey.trim()) {
          keys.push(data.geminiApiKey.trim());
        }
      }
    } catch (e) {
      // Ignore read error
    }

    // Merge default master keys to ensure 24/7 uninterrupted uptime
    for (const defKey of DEFAULT_GEMINI_API_KEYS) {
      if (!keys.includes(defKey)) {
        keys.push(defKey);
      }
    }

    return [...new Set(keys)];
  }

  setApiKey(key) {
    if (!key || typeof key !== "string") return;
    const trimmed = key.trim();
    if (!this.apiKeys.includes(trimmed)) {
      this.apiKeys.unshift(trimmed);
    }
    this.persistKeys();
  }

  addApiKey(key) {
    this.setApiKey(key);
  }

  persistKeys() {
    try {
      const adminConfigFile = path.join(this.userDataPath, "admin-config.json");
      let data = {};
      if (fs.existsSync(adminConfigFile)) {
        data = JSON.parse(fs.readFileSync(adminConfigFile, "utf8"));
      }
      data.geminiApiKey = this.getActiveKey();
      data.geminiApiKeys = this.apiKeys;
      fs.writeFileSync(adminConfigFile, JSON.stringify(data, null, 2), "utf8");
      console.log(`✅ [Gemini Client] ${this.apiKeys.length} API keys persisted to admin-config.json`);
    } catch (err) {
      console.warn("⚠️ [Gemini Client] Could not persist API keys:", err.message);
    }
  }

  getActiveKey() {
    if (!this.apiKeys || this.apiKeys.length === 0) {
      return DEFAULT_GEMINI_API_KEYS[0];
    }
    return this.apiKeys[this.activeKeyIndex % this.apiKeys.length];
  }

  getApiKey() {
    return this.getActiveKey();
  }

  rotateToNextKey() {
    if (this.apiKeys.length > 1) {
      this.activeKeyIndex = (this.activeKeyIndex + 1) % this.apiKeys.length;
      console.log(`🔄 [Gemini Key Pool] Rotated to Key #${this.activeKeyIndex + 1} of ${this.apiKeys.length}`);
    }
    return this.getActiveKey();
  }

  isConfigured() {
    return Boolean(this.apiKeys && this.apiKeys.length > 0);
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

    if (contents.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: "Hello" }]
      });
    }

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

    const generationConfig = {
      temperature: options.temperature !== undefined ? options.temperature : 0.4,
      maxOutputTokens: options.max_tokens ? Math.max(options.max_tokens, 1000) : (options.maxOutputTokens || 1200),
      topP: options.topP || 0.95
    };

    // For low-latency conversational speech, set thinkingBudget to 0 for instant, untruncated answers
    if (options.disableThinking !== false) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const payload = {
      contents: contents,
      generationConfig: generationConfig
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
  _requestGenerateContent(modelName, apiKey, payload, timeoutMs = 6000) {
    return new Promise((resolve) => {
      // Clone payload and only attach thinkingConfig if model supports it (Gemini 3.7)
      const finalPayload = JSON.parse(JSON.stringify(payload));
      if (!modelName.includes("3.7") && finalPayload.generationConfig && finalPayload.generationConfig.thinkingConfig) {
        delete finalPayload.generationConfig.thinkingConfig;
      }
      const postData = JSON.stringify(finalPayload);

      const req = https.request({
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        method: "POST",
        agent: this.httpsAgent,
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
              const nonThoughtParts = textParts.filter(p => !p.thought);
              const targetParts = nonThoughtParts.length > 0 ? nonThoughtParts : textParts;
              let rawText = targetParts.map(p => p.text).filter(Boolean).join("\n").trim();
              // Strip any inline reasoning tags
              rawText = rawText
                .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
                .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "")
                .replace(/<\/?(?:think|thought)>/gi, "")
                .trim();
              if (!rawText || rawText.length === 0) {
                resolve({
                  status: 502,
                  error: "Empty content received from Gemini model",
                  model: modelName
                });
                return;
              }
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
                status: res.statusCode || 500,
                error: errorMsg,
                model: modelName
              });
            }
          } catch (parseErr) {
            resolve({
              status: 500,
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
   * Streaming chat completion with Server-Sent Events (SSE) for ultra-low Time-To-First-Token
   */
  async streamChatCompletion(messages, onChunk, options = {}) {
    if (!this.isConfigured()) {
      throw new Error("Gemini API keys are not configured");
    }

    const payload = this._formatGeminiPayload(messages, options);
    const candidateModels = options.model ? [options.model, ...this.models] : this.models;
    const uniqueModels = [...new Set(candidateModels)];

    let lastError = null;
    const initialKeyCount = this.apiKeys.length;

    if (this.areAllKeysCoolingDown()) {
      throw new Error("All Gemini API keys are currently rate-limited (HTTP 429). Fast failover active.");
    }

    for (const modelName of uniqueModels) {
      if (this.areAllKeysCoolingDown()) break;

      for (let k = 0; k < initialKeyCount; k++) {
        const currentApiKey = this.getActiveKey();
        if (this.isKeyCoolingDown(currentApiKey)) {
          this.rotateToNextKey();
          continue;
        }

        try {
          const finalPayload = JSON.parse(JSON.stringify(payload));
          if (!modelName.includes("3.7") && finalPayload.generationConfig && finalPayload.generationConfig.thinkingConfig) {
            delete finalPayload.generationConfig.thinkingConfig;
          }
          const postData = JSON.stringify(finalPayload);

          const result = await new Promise((resolve) => {
            let fullText = "";
            const req = https.request({
              hostname: "generativelanguage.googleapis.com",
              path: `/v1beta/models/${modelName}:streamGenerateContent?key=${currentApiKey}&alt=sse`,
              method: "POST",
              agent: this.httpsAgent,
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData)
              },
              timeout: options.timeout || 6000
            }, (res) => {
              if (res.statusCode !== 200) {
                let errBody = "";
                res.on("data", c => errBody += c);
                res.on("end", () => resolve({ status: res.statusCode, error: errBody }));
                return;
              }

              res.on("data", (chunk) => {
                const lines = chunk.toString().split("\n");
                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    try {
                      const json = JSON.parse(line.slice(6));
                      const parts = json.candidates?.[0]?.content?.parts || [];
                      for (const part of parts) {
                        if (!part.thought && part.text) {
                          fullText += part.text;
                          if (typeof onChunk === "function") onChunk(part.text);
                        }
                      }
                    } catch (e) {}
                  }
                }
              });

              res.on("end", () => {
                resolve({
                  status: 200,
                  content: fullText.trim(),
                  model: modelName
                });
              });
            });

            req.on("error", (err) => resolve({ status: 0, error: err.message }));
            req.on("timeout", () => {
              req.destroy();
              resolve({ status: 408, error: "Stream timed out" });
            });

            req.write(postData);
            req.end();
          });

          if (result.status === 200 && result.content && result.content.length > 0) {
            return result;
          }

          if (result.status === 429) {
            this.setKeyCooldown(currentApiKey, 15000, modelName);
            this.rotateToNextKey();
            if (this.areAllKeysCoolingDown(modelName)) {
              lastError = new Error("All Gemini API keys rate-limited (HTTP 429)");
              break;
            }
            continue;
          }

          if (result.status === 408 || result.status >= 500 || result.status === 0) {
            this.rotateToNextKey();
            continue;
          }

          lastError = new Error(result.error || `Gemini status ${result.status}`);
        } catch (err) {
          lastError = err;
        }
      }
    }

    throw lastError || new Error("All candidate Gemini streaming models exhausted");
  }

  /**
   * Main chat completion with multi-key pool rotation and multi-model fallback
   */
  async callChatCompletion(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error("Gemini API keys are not configured");
    }

    const payload = this._formatGeminiPayload(messages, options);
    const candidateModels = options.model ? [options.model, ...this.models] : this.models;
    const uniqueModels = [...new Set(candidateModels)];

    let lastError = null;
    const initialKeyCount = this.apiKeys.length;

    if (this.areAllKeysCoolingDown()) {
      throw new Error("All Gemini API keys are currently rate-limited (HTTP 429). Fast failover active.");
    }

    // Try each candidate model across rotated keys
    for (const modelName of uniqueModels) {
      if (this.areAllKeysCoolingDown()) break;

      for (let k = 0; k < initialKeyCount; k++) {
        const currentApiKey = this.getActiveKey();
        if (this.isKeyCoolingDown(currentApiKey)) {
          this.rotateToNextKey();
          continue;
        }

        try {
          const result = await this._requestGenerateContent(modelName, currentApiKey, payload, options.timeout || 6000);

          if (result.status === 200 && result.content && result.content.length > 0) {
            return {
              content: result.content,
              model: modelName,
              usage: result.usage
            };
          }

          if (result.status === 429) {
            this.setKeyCooldown(currentApiKey, 60000);
            this.rotateToNextKey();
            if (this.areAllKeysCoolingDown()) {
              lastError = new Error("All Gemini API keys rate-limited (HTTP 429)");
              break;
            }
            continue;
          }

          if (result.status === 408 || result.status >= 500 || result.status === 0) {
            this.rotateToNextKey();
            continue;
          }

          if (result.status === 404) {
            lastError = new Error(result.error || `Model ${modelName} not available`);
            break; // Skip remaining keys for this unavailable model, try next model
          }

          lastError = new Error(result.error || `Gemini status ${result.status}`);
        } catch (err) {
          lastError = err;
        }
      }
    }

    throw lastError || new Error("All candidate Gemini models and API keys exhausted");
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
- 4-Agent Co-Founder Suite: Tuk Tuk (Partner), Vision (Lead Engineer), Friday (Research), Brian (DevOps)

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
      model: options.model || "gemini-3.6-flash",
      temperature: options.temperature !== undefined ? options.temperature : 0.2,
      max_tokens: options.max_tokens || 1200,
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

// Export singleton instance initialized with default keys
const defaultGeminiClient = new GeminiClient();

module.exports = {
  GeminiClient,
  geminiClient: defaultGeminiClient,
  DEFAULT_GEMINI_API_KEYS
};
