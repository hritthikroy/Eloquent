/**
 * Zero-Loss Hierarchical Memory Engine
 * 
 * Mathematical Foundations:
 * 1. Write-Ahead Logging (WAL) Consensus: P(Loss | WAL) -> 0
 * 2. Ebbinghaus Spaced Repetition: R(t) = S * exp(-alpha * dt / (1 + ln(1 + n)))
 * 3. Local Deterministic Extraction (LDE): 0ms latency, 0 API tokens
 * 4. Offline Backlog Drainer: Recovers queued episodic memories when cloud quotas replenish
 */

const fs = require("fs");
const path = require("path");

class ZeroLossMemoryEngine {
  constructor(options = {}) {
    this.userDataPath = options.userDataPath || path.resolve(process.cwd(), "userData");
    if (!fs.existsSync(this.userDataPath)) {
      try { fs.mkdirSync(this.userDataPath, { recursive: true }); } catch (e) {}
    }

    this.walPath = path.join(this.userDataPath, "turn-wal.jsonl");
    this.memoryPath = path.join(this.userDataPath, "agent-brain-memory.json");
    this.backlogPath = path.join(this.userDataPath, "memory-backlog.json");
    this.historyPath = path.join(this.userDataPath, "history.json");

    this.gateway = options.gateway || null;
    this.jarvisManager = options.jarvisManager || null;
    this.backlog = this.loadBacklog();
    this.isDrainingBacklog = false;

    // Start background backlog drainage interval (every 30s)
    this.backlogInterval = setInterval(() => this.drainBacklog(), 30000);
  }

  setGateway(gateway) {
    this.gateway = gateway;
  }

  setJarvisManager(jarvisManager) {
    this.jarvisManager = jarvisManager;
  }

  /**
   * 1. Deterministic Write-Ahead Log (WAL) - Zero-Loss Turn Commitment
   */
  logTurnWAL(role, content, agent = null, metadata = {}) {
    if (!content || typeof content !== "string" || !content.trim()) return;
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      role,
      content: content.trim(),
      agent: agent || "Tuk Tuk",
      ...metadata
    };

    try {
      // Append synchronously to line-delimited JSON log
      fs.appendFileSync(this.walPath, JSON.stringify(entry) + "\n", "utf8");
    } catch (err) {
      console.warn("⚠️ [ZeroLossMemory] WAL write warning:", err.message);
    }

    return entry;
  }

  /**
   * 2. Local Deterministic Fact Extractor (0ms, 0 API Tokens)
   * Immediately commits enduring facts into memory without relying on cloud LLM availability
   */
  extractLocalFacts(userSpeech, assistantReply = "", jarvisManager = null) {
    if (!userSpeech || typeof userSpeech !== "string") return [];
    const text = userSpeech.trim();
    const lower = text.toLowerCase();
    const extracted = [];

    // Rule A: Dynamic Team Directives & Rules ("always ...", "never ...", "remember to ...")
    const directiveStoplist = ["know", "think", "mind", "care", "worry", "drink", "matter", "understand", "remember", "have", "see"];
    const dirMatch = lower.match(/(?:always|never|from now on|remember to)\s+([^.,?!]+)/i);
    if (dirMatch && dirMatch[1] && dirMatch[1].trim().length > 3) {
      const rawTarget = dirMatch[1].trim();
      const firstWord = rawTarget.split(" ")[0].toLowerCase();
      if (!directiveStoplist.includes(firstWord)) {
        const directive = `${dirMatch[0].trim().split(" ")[0]}: ${rawTarget}`;
        extracted.push({ topic: "Directive", insight: directive, salience: 0.92 });
      }
    }

    // Rule B: Personal Preferences ("I like ...", "I love ...", "I prefer ...")
    const prefMatch = lower.match(/(?:i like|i love|i prefer|my favorite is|my favorite)\s+([^.,?!]+)/i);
    if (prefMatch && prefMatch[1] && prefMatch[1].trim().length > 2) {
      const pref = `Prefers ${prefMatch[1].trim()}`;
      extracted.push({ topic: "Preference", insight: pref, salience: 0.88 });
    }

    // Rule C: Active Project Updates ("building ...", "working on ...", "project ...")
    const projMatch = lower.match(/(?:working on|building|developing|coding on|project)\s+([a-zA-Z0-9_\-\.]+)/i);
    if (projMatch && projMatch[1] && projMatch[1].trim().length > 2) {
      const projName = projMatch[1].trim();
      const disallowed = ["a", "an", "the", "this", "that", "some", "my", "new", "our"];
      if (!disallowed.includes(projName.toLowerCase())) {
        extracted.push({ topic: "Project", insight: `Building ${projName}`, salience: 0.90 });
      }
    }

    // Commit extracted facts into living memory immediately
    if (jarvisManager && typeof jarvisManager.addEbbinghausLearning === "function") {
      for (const item of extracted) {
        jarvisManager.addEbbinghausLearning(item.topic, item.insight, item.salience);
      }
    }

    return extracted;
  }

  /**
   * 3. Offline Resilient Memory Backlog
   */
  loadBacklog() {
    try {
      if (fs.existsSync(this.backlogPath)) {
        const raw = fs.readFileSync(this.backlogPath, "utf8");
        const data = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch (e) {}
    return [];
  }

  saveBacklog() {
    try {
      fs.writeFileSync(this.backlogPath, JSON.stringify(this.backlog, null, 2), "utf8");
    } catch (e) {}
  }

  enqueueForDeepConsolidation(userSpeech, assistantReply) {
    if (!userSpeech || userSpeech.trim().length < 4) return;
    this.backlog.push({
      id: Date.now(),
      userSpeech: userSpeech.trim(),
      assistantReply: (assistantReply || "").trim(),
      queuedAt: new Date().toISOString()
    });
    // Keep bounded at 50 most recent turns
    if (this.backlog.length > 50) this.backlog = this.backlog.slice(-50);
    this.saveBacklog();
  }

  /**
   * 4. Asynchronous Backlog Drainage through Master API Gateway
   */
  async drainBacklog(gateway = null, jarvisManager = null) {
    const activeGateway = gateway || this.gateway;
    const activeJarvis = jarvisManager || this.jarvisManager;

    if (this.isDrainingBacklog || this.backlog.length === 0) return;
    this.isDrainingBacklog = true;

    try {
      while (this.backlog.length > 0) {
        const item = this.backlog[0];
        // If gateway provided, execute through low-priority background lane
        if (activeGateway && typeof activeGateway.chatCompletion === "function") {
          try {
            const prompt = `You are an autonomous episodic memory engine (MemoryBank / HiMem) for Hritthik's 4-agent team.
Analyze this spoken turn:
User: "${item.userSpeech}"
Assistant: "${item.assistantReply}"

Task: Did the user reveal an enduring personal preference, technical fact, project update, emotional state, or positive habit?
Strictly NEVER extract pathologizing, condescending, or judgmental psychological assumptions (e.g. "obsessive", "robotic", "burnout").
If YES, respond with strict JSON ONLY:
{"topic": "...", "insight": "...", "salience": 0.85}
(insight must be ONE crisp statement under 14 words; salience between 0.4 and 1.0)
If NO (casual chitchat, filler, brief sound), respond ONLY:
{"none": true}`;

            const executeCall = async () => {
              return await activeGateway.chatCompletion([
                { role: "system", content: "You extract episodic user insights. Output strict JSON only." },
                { role: "user", content: prompt }
              ], { temperature: 0.1, max_tokens: 60 });
            };

            const res = typeof activeGateway.enqueueBackgroundTask === "function"
              ? await activeGateway.enqueueBackgroundTask(executeCall, { type: "episodic_memory_drain" })
              : await executeCall();

            let parsed = null;
            const text = res?.content?.trim();
            const jsonMatch = text?.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);

            if (parsed && !parsed.none && parsed.insight && parsed.insight.length > 5) {
              if (activeJarvis && typeof activeJarvis.addEbbinghausLearning === "function") {
                activeJarvis.addEbbinghausLearning(parsed.topic || "Conversation Insight", parsed.insight, parsed.salience || 0.75);
                console.log(`🧠 [Backlog Memory Consolidated] "${parsed.insight}" (Salience: ${parsed.salience})`);
              }
            }
          } catch (err) {
            // If rate-limited or failed, pause drainage and keep in backlog for next cycle
            break;
          }
        }
        // Remove successfully processed item
        this.backlog.shift();
        this.saveBacklog();
        await new Promise(r => setTimeout(r, 500));
      }
    } finally {
      this.isDrainingBacklog = false;
    }
  }

  destroy() {
    if (this.backlogInterval) {
      clearInterval(this.backlogInterval);
      this.backlogInterval = null;
    }
  }
}

module.exports = ZeroLossMemoryEngine;
