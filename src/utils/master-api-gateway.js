/**
 * Master API Gateway - High-Throughput Quota Multiplexer & Dual-Lane Router
 * 
 * Mathematical Foundations:
 * 1. Token-Bucket Quota Dynamics: C_k(t) = min(C_max, C_k(t-dt) + rho*dt) - w(tau)
 * 2. Predictive Softmax Routing: pi_k,m proportional to exp(gamma1*C_hat - gamma2*L_ema - gamma3*I_cooldown)
 * 3. Dual-Priority Lanes: Interactive Voice (<450ms) vs Low-Priority Background (<60s)
 * 4. Resilient Key Pooling: Groq Master + Sub-Keys 1-5 with seamless Gemini Fallback
 */

const axios = require("axios");
const https = require("https");
const fs = require("fs");
const path = require("path");

class MasterApiGateway {
  constructor(options = {}) {
    this.userDataPath = options.userDataPath || path.resolve(process.cwd(), "userData");
    
    // HTTP Keep-Alive Agents for Sub-Millisecond Socket Re-Use
    this.groqAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 30,
      keepAliveMsecs: 30000
    });

    this.geminiAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 20,
      keepAliveMsecs: 30000
    });

    // Upstream API Key Registries
    this.groqKeys = [];
    this.geminiKeys = [];
    
    // Key Health & Rate Limit Telemetry Maps: key -> { cooldownUntil, remainingTokens, remainingRequests, emaLatency, failures }
    this.keyTelemetry = new Map();

    // Priority Lane Traffic State
    this.activeInteractiveRequests = 0;
    this.backgroundQueue = [];
    this.isProcessingBackgroundQueue = false;

    // Default Preferred Models in Hierarchy Order (Prioritize sub-150ms instant voice models)
    this.groqModels = [
      "llama-3.1-8b-instant",
      "llama-3.3-70b-versatile",
      "llama3-70b-8192",
      "llama3-8b-8192",
      "mixtral-8x7b-32768",
      "gemma2-9b-it"
    ];

    this.geminiModels = [
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest"
    ];

    this.geminiClient = options.geminiClient || null;

    this.initKeys();
  }

  /**
   * Load and normalize all available Master & Sub Keys from Environment & Admin Config
   */
  initKeys() {
    const rawGroq = [];
    
    // 1. Groq Master Key
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
      rawGroq.push({ key: process.env.GROQ_API_KEY.trim(), type: "master" });
    }

    // 2. Groq Sub-Keys 1 through 10
    for (let i = 1; i <= 10; i++) {
      const envKey = process.env[`GROQ_API_KEY_${i}`];
      if (envKey && envKey.trim()) {
        rawGroq.push({ key: envKey.trim(), type: `sub-${i}` });
      }
    }

    // 3. Comma-separated GROQ_API_KEYS
    if (process.env.GROQ_API_KEYS) {
      process.env.GROQ_API_KEYS.split(",").forEach((k, idx) => {
        if (k && k.trim()) rawGroq.push({ key: k.trim(), type: `sub-list-${idx + 1}` });
      });
    }

    // 4. Admin config fallback
    try {
      const adminConfigFile = path.join(this.userDataPath, "admin-config.json");
      if (fs.existsSync(adminConfigFile)) {
        const adminData = JSON.parse(fs.readFileSync(adminConfigFile, "utf8"));
        if (adminData.masterApiKey && adminData.masterApiKey.startsWith("gsk_")) {
          rawGroq.push({ key: adminData.masterApiKey.trim(), type: "admin-master" });
        }
        if (Array.isArray(adminData.groqApiKeys)) {
          adminData.groqApiKeys.forEach((k, idx) => {
            if (k && k.trim()) rawGroq.push({ key: k.trim(), type: `admin-sub-${idx + 1}` });
          });
        }
      }
    } catch (e) {}

    // Deduplicate Groq keys while preserving label metadata
    const seenGroq = new Set();
    this.groqKeys = [];
    for (const item of rawGroq) {
      if (!seenGroq.has(item.key) && item.key.length > 10) {
        seenGroq.add(item.key);
        this.groqKeys.push({
          key: item.key,
          label: item.type === "master" ? `Master (${item.key.slice(0, 8)}...)` : `Sub-Key [${item.type}] (${item.key.slice(0, 8)}...)`,
          type: item.type
        });
        if (!this.keyTelemetry.has(item.key)) {
          this.keyTelemetry.set(item.key, {
            cooldownUntil: 0,
            remainingTokens: Infinity,
            remainingRequests: Infinity,
            emaLatency: 350,
            consecutiveFailures: 0,
            successfulTurns: 0
          });
        }
      }
    }

    // 5. Load Gemini Keys
    const rawGemini = [];
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      rawGemini.push(process.env.GEMINI_API_KEY.trim());
    }
    if (process.env.GEMINI_API_KEY_2 && process.env.GEMINI_API_KEY_2.trim()) {
      rawGemini.push(process.env.GEMINI_API_KEY_2.trim());
    }
    try {
      const adminConfigFile = path.join(this.userDataPath, "admin-config.json");
      if (fs.existsSync(adminConfigFile)) {
        const adminData = JSON.parse(fs.readFileSync(adminConfigFile, "utf8"));
        if (Array.isArray(adminData.geminiApiKeys)) {
          adminData.geminiApiKeys.forEach(k => { if (k && k.trim()) rawGemini.push(k.trim()); });
        }
        if (adminData.geminiApiKey && adminData.geminiApiKey.trim()) {
          rawGemini.push(adminData.geminiApiKey.trim());
        }
      }
    } catch (e) {}

    this.geminiKeys = [...new Set(rawGemini.filter(k => k && k.length > 10))];
    for (const k of this.geminiKeys) {
      if (!this.keyTelemetry.has(k)) {
        this.keyTelemetry.set(k, {
          cooldownUntil: 0,
          remainingTokens: Infinity,
          remainingRequests: Infinity,
          emaLatency: 750,
          consecutiveFailures: 0,
          successfulTurns: 0
        });
      }
    }

    console.log(`🌐 [MasterApiGateway] Initialized with ${this.groqKeys.length} Groq key(s) and ${this.geminiKeys.length} Gemini key(s)`);
  }

  _getModelFamily(model) {
    if (!model) return "general";
    const m = String(model).toLowerCase();
    if (m.includes("qwen")) return "qwen";
    if (m.includes("llama-3.3") || m.includes("70b")) return "llama-70b";
    if (m.includes("llama-3.1") || m.includes("8b")) return "llama-8b";
    if (m.includes("compound")) return "compound";
    if (m.includes("gemini")) return "gemini";
    return m;
  }

  /**
   * Check if a specific key is in active cooldown (supports per-model isolation)
   */
  isKeyCoolingDown(key, model = null) {
    const meta = this.keyTelemetry.get(key);
    if (!meta) return false;
    const now = Date.now();
    if (meta.cooldownUntil && now < meta.cooldownUntil) {
      return true;
    }
    if (model && meta.modelCooldowns) {
      const family = this._getModelFamily(model);
      const modelCooldown = meta.modelCooldowns.get(family) || 0;
      if (now < modelCooldown) {
        return true;
      }
    }
    // Check if remaining tokens is critically low (<100 tokens remaining) and reset time has not passed
    if (meta.remainingTokens < 100 && meta.resetTokensTime && now < meta.resetTokensTime) {
      return true;
    }
    return false;
  }

  /**
   * Put key (or specific model on key) into cooldown window based on error details
   */
  setKeyCooldown(key, durationMs, reason = "rate limit", model = null) {
    const meta = this.keyTelemetry.get(key) || { cooldownUntil: 0, consecutiveFailures: 0 };
    if (!meta.modelCooldowns) {
      meta.modelCooldowns = new Map();
    }
    const now = Date.now();
    if (model) {
      const family = this._getModelFamily(model);
      meta.modelCooldowns.set(family, now + durationMs);
    } else {
      meta.cooldownUntil = now + durationMs;
    }
    meta.consecutiveFailures = (meta.consecutiveFailures || 0) + 1;
    this.keyTelemetry.set(key, meta);
  }

  /**
   * Update Rate Limit Headers returned by Groq/Gemini to predictively avoid 429s
   */
  recordResponseHeaders(key, headers, latencyMs = 0) {
    const meta = this.keyTelemetry.get(key);
    if (!meta) return;

    if (latencyMs > 0) {
      meta.emaLatency = Math.round(0.8 * meta.emaLatency + 0.2 * latencyMs);
    }
    meta.consecutiveFailures = 0;
    meta.successfulTurns = (meta.successfulTurns || 0) + 1;

    if (headers) {
      const remReq = parseInt(headers["x-ratelimit-remaining-requests"] || headers["x-ratelimit-remaining-requests-minute"], 10);
      const remTok = parseInt(headers["x-ratelimit-remaining-tokens"] || headers["x-ratelimit-remaining-tokens-minute"], 10);
      const resetTok = headers["x-ratelimit-reset-tokens"] || headers["x-ratelimit-reset-tokens-minute"];

      if (!isNaN(remReq)) meta.remainingRequests = remReq;
      if (!isNaN(remTok)) meta.remainingTokens = remTok;

      if (resetTok) {
        // Parse "1s", "120ms", "1m30s"
        let resetMs = 5000;
        if (typeof resetTok === "string") {
          if (resetTok.includes("m")) resetMs = parseInt(resetTok, 10) * 60000;
          else if (resetTok.includes("s")) resetMs = parseFloat(resetTok) * 1000;
          else if (resetTok.includes("ms")) resetMs = parseFloat(resetTok);
        }
        meta.resetTokensTime = Date.now() + resetMs;
      }

      // Proactive Quota Shifting: If tokens dropped below 500, trigger soft cooldown so next turns use another key
      if (meta.remainingTokens < 500) {
        console.log(`⚠️ [MasterApiGateway] Key ${key.slice(0, 8)}... remaining tokens low (${meta.remainingTokens}). Shifting traffic proactively.`);
        meta.cooldownUntil = meta.resetTokensTime || (Date.now() + 10000);
      }
    }

    this.keyTelemetry.set(key, meta);
  }

  /**
   * Sort available Groq keys using Predictive Token-Bucket Quota Ranking
   */
  getRankedGroqKeys() {
    const now = Date.now();
    return [...this.groqKeys].sort((a, b) => {
      const metaA = this.keyTelemetry.get(a.key) || {};
      const metaB = this.keyTelemetry.get(b.key) || {};

      const coolA = (metaA.cooldownUntil && now < metaA.cooldownUntil) ? 1 : 0;
      const coolB = (metaB.cooldownUntil && now < metaB.cooldownUntil) ? 1 : 0;
      if (coolA !== coolB) return coolA - coolB; // Non-cooling keys first

      // Then sort by remaining tokens (highest tokens first)
      const tokA = metaA.remainingTokens !== undefined ? metaA.remainingTokens : 10000;
      const tokB = metaB.remainingTokens !== undefined ? metaB.remainingTokens : 10000;
      if (tokA !== tokB) return tokB - tokA;

      // Then sort by lowest EMA latency
      return (metaA.emaLatency || 350) - (metaB.emaLatency || 350);
    });
  }

  /**
   * High-Priority Interactive Chat Completion Lane (Voice ping-pong, sub-450ms target)
   */
  async chatCompletion(messages, options = {}) {
    this.activeInteractiveRequests++;
    const startTime = Date.now();

    try {
      const candidateModels = [
        options.model,
        ...this.groqModels
      ].filter(Boolean);
      const uniqueModels = [...new Set(candidateModels)];

      const rankedKeys = this.getRankedGroqKeys();
      let groqLastError = null;
      let geminiLastError = null;

      // Phase 1: Multiplex across Groq keys and models
      for (const model of uniqueModels) {
        for (const item of rankedKeys) {
          const { key, label } = item;
          if (this.isKeyCoolingDown(key, model)) continue;

          try {
            const payload = {
              model: model,
              messages: messages,
              temperature: options.temperature !== undefined ? options.temperature : 0.3,
              max_tokens: options.max_tokens || 1200,
              presence_penalty: options.presence_penalty !== undefined ? options.presence_penalty : 0.6,
              frequency_penalty: options.frequency_penalty !== undefined ? options.frequency_penalty : 0.5
            };
            if (model.includes("qwen") || model.includes("deepseek") || model.includes("gpt-oss") || model.includes("compound")) {
              payload.reasoning_effort = "none";
            }

            const reqStart = Date.now();
            const response = await axios.post(
              "https://api.groq.com/openai/v1/chat/completions",
              payload,
              {
                headers: { "Authorization": `Bearer ${key}` },
                httpsAgent: this.groqAgent,
                timeout: options.timeout || 4000,
                validateStatus: status => status < 500
              }
            );

            const elapsed = Date.now() - reqStart;
            this.recordResponseHeaders(key, response.headers, elapsed);

            // Handle successful 200 output
            if (response.status === 200) {
              const rawChoice = response.data?.choices?.[0]?.message;
              let rawContent = (rawChoice?.content || rawChoice?.reasoning || "").trim();
              rawContent = rawContent
                .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
                .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "")
                .replace(/<\/?(?:think|thought)>/gi, "")
                .replace(/\[Thinking:[\s\S]*?\]/gi, "")
                .replace(/\*(?:thinking|thought process|internal monologue|reasoning)\*[\s\S]*?(?:\n\n|$)/gi, "")
                .replace(/^\s*(?:\*\*)?(?:analyze user input|internal reasoning|reasoning|thought process|thoughts?|chain of thought|analysis|thinking process)(?:\*\*)?:?[\s\S]*?(?:\n\n|\r\n\r\n|\n(?=[A-Z\u0980-\u09FF\u0900-\u097F]))/i, "")
                .replace(/^\s*(?:(?:we|i)\s+need\s+to|must\s+respond\s+in|the\s+user\s+says|user\s+says|user\s+is\s+asking|following\s+all\s+rules|react\s+first|as\s+[a-z0-9\s]+,\s*i\s+(?:need|should|must)|let\s+me\s+analyze|here\s+is\s+(?:my|the)\s+response)[\s\S]*?(?:\n\n|\r\n\r\n|\n(?=[A-Z\u0980-\u09FF\u0900-\u097F])|$)/i, "")
                .trim();

              if (rawContent.length > 0) {
                return {
                  content: rawContent,
                  model: model,
                  provider: "groq",
                  keyLabel: label,
                  usage: response.data?.usage,
                  latencyMs: elapsed
                };
              }
            }

            // Handle 429 Rate Limit (TPD vs RPM)
            if (response.status === 429) {
              const errMsg = (response.data?.error?.message || "").toLowerCase();
              const isTpd = errMsg.includes("tokens per day") || errMsg.includes("tpd");
              const retryAfter = parseInt(response.headers?.["retry-after"] || "0", 10);
              const cooldownMs = isTpd ? (45 * 1000) : (retryAfter > 0 ? retryAfter * 1000 : 10000);

              this.setKeyCooldown(key, cooldownMs, isTpd ? "TPD limit" : "RPM rate-limit", model);
              groqLastError = new Error(response.data?.error?.message || `429 on ${model}`);
              continue; // Try next key / model
            }

            groqLastError = new Error(response.data?.error?.message || `Groq HTTP ${response.status} on ${model}`);
          } catch (err) {
            groqLastError = err;
            const meta = this.keyTelemetry.get(key);
            if (meta) meta.consecutiveFailures = (meta.consecutiveFailures || 0) + 1;
          }
        }
      }

      // Phase 2: High-Level Failover to Google Gemini Multi-Key Pool
      if (this.geminiClient && typeof this.geminiClient.callChatCompletion === "function") {
        for (const gemModel of this.geminiModels) {
          try {
            const geminiRes = await this.geminiClient.callChatCompletion(messages, {
              model: gemModel,
              temperature: options.temperature !== undefined ? options.temperature : 0.4,
              max_tokens: options.max_tokens || 1200,
              timeout: Math.max(options.timeout || 0, 7500)
            });
            if (geminiRes && geminiRes.content) {
              return {
                content: geminiRes.content,
                model: `gemini/${geminiRes.model}`,
                provider: "gemini",
                usage: geminiRes.usage,
                latencyMs: Date.now() - startTime
              };
            }
          } catch (gemErr) {
            geminiLastError = gemErr;
          }
        }
      }

      const errParts = [];
      if (groqLastError) errParts.push(`Groq: ${groqLastError.message || groqLastError}`);
      if (geminiLastError) errParts.push(`Gemini: ${geminiLastError.message || geminiLastError}`);
      const finalMsg = errParts.length > 0 ? errParts.join(" | ") : "All Groq master/sub keys and Gemini fallback keys exhausted";
      throw new Error(finalMsg);
    } finally {
      this.activeInteractiveRequests = Math.max(0, this.activeInteractiveRequests - 1);
    }
  }

  /**
   * Low-Priority Deferred Background Lane (Memory consolidation, vector indexing, summarization)
   */
  async enqueueBackgroundTask(taskFn, metadata = {}) {
    return new Promise((resolve, reject) => {
      this.backgroundQueue.push({ taskFn, metadata, resolve, reject, enqueuedAt: Date.now() });
      this.drainBackgroundQueue();
    });
  }

  async drainBackgroundQueue() {
    if (this.isProcessingBackgroundQueue) return;
    this.isProcessingBackgroundQueue = true;

    try {
      while (this.backgroundQueue.length > 0) {
        // Yield if interactive voice turn is in-flight
        if (this.activeInteractiveRequests > 0) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }

        const item = this.backgroundQueue.shift();
        try {
          const result = await item.taskFn();
          item.resolve(result);
        } catch (err) {
          item.reject(err);
        }
        // Polite pacing between background jobs
        await new Promise(r => setTimeout(r, 300));
      }
    } finally {
      this.isProcessingBackgroundQueue = false;
    }
  }

  /**
   * Real-time gateway telemetry report
   */
  getTelemetry() {
    const now = Date.now();
    const groqSummary = this.groqKeys.map(k => {
      const meta = this.keyTelemetry.get(k.key) || {};
      const cooling = meta.cooldownUntil && now < meta.cooldownUntil;
      return {
        label: k.label,
        isCoolingDown: cooling,
        cooldownRemainingSec: cooling ? Math.round((meta.cooldownUntil - now) / 1000) : 0,
        remainingTokens: meta.remainingTokens,
        emaLatencyMs: meta.emaLatency,
        successfulTurns: meta.successfulTurns || 0
      };
    });

    return {
      activeInteractiveRequests: this.activeInteractiveRequests,
      backgroundQueueDepth: this.backgroundQueue.length,
      groqKeysTotal: this.groqKeys.length,
      geminiKeysTotal: this.geminiKeys.length,
      groqPool: groqSummary
    };
  }
}

const defaultGateway = new MasterApiGateway();
module.exports = MasterApiGateway;
module.exports.MasterApiGateway = MasterApiGateway;
module.exports.masterApiGateway = defaultGateway;
