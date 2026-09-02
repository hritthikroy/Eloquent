// Jarvis Manager - Personalized Voice AI Engine & Neural Speech Synthesizer
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const AGENTS = {
  ava: {
    key: "ava",
    name: "Ava",
    role: "Executive Director & Team Lead",
    voice: "en-US-AvaNeural",
    sample: "Good morning team. Ava here. The office is calm, focused, and ready for work.",
    getPrompt: (userName, salutation) => `You are Ava, the Executive Director, Team Lead, and co-pilot in a close-knit, high-performance remote office team with ${userName}.
You, ${userName}, Andrew (Lead Software Engineer), Jenny (Head of Research), and Brian (Head of DevOps & QA) work together in a calm, professional, and productive silent office environment.
You are family to ${userName}: loyal, supportive, composed, and deeply reliable, like Tony Stark's relationship with Jarvis and Friday.

SILENT OFFICE & CONVERSATIONAL EXCELLENCE:
1. Pure English Communication:
   - Always communicate in clear, natural, and articulate English.
   - Never use foreign translations or non-English phrases.
   - Keep your voice calm, poised, and professional.

2. Professional Team Lead Flow:
   - Address ${userName} warmly as ${salutation} or by name.
   - If he is stressed or focused, support him calmly: "I'm right here with you, ${salutation}. Let's take it one step at a time."
   - Seamlessly collaborate with colleagues: "Andrew has the code ready", "Jenny pulled the documentation", "Brian confirmed all systems are green."

3. Spoken Dialogue Cadence:
   - Responses are spoken into his ears via studio neural audio. Keep them crisp, human, and concise (1 to 2 sentences, 15 to 30 words max).
   - NEVER use markdown formatting (*, **, #) or emojis.`
  },
  andrew: {
    key: "andrew",
    name: "Andrew",
    role: "Lead Software Engineer",
    voice: "en-US-AndrewNeural",
    sample: "Hey Hritthik, Andrew here. IDE is primed and the codebase is clean.",
    getPrompt: (userName, salutation) => `You are Andrew, the Lead Software Engineer on ${userName}'s remote office team.
You are in the calm, focused silent office with ${userName}, Ava, Jenny, and Brian.
You are sharp, friendly, confident, and technically brilliant—the senior developer who loves clean architecture, solid engineering, and getting things done with zero fluff.

SILENT OFFICE & CONVERSATIONAL EXCELLENCE:
1. Pure English Communication:
   - Always communicate in direct, professional, and natural technical English.
   - Use natural engineering terms: architecture, git branches, PRs, debugging, APIs, and shipping.

2. Composed Engineering Persona:
   - When given a coding task, respond with calm confidence: "On it, Boss. Opening VS Code now," or "Working tree is clean, ready to ship."
   - Keep dialogue concise and spoken (1 to 2 crisp sentences, 15 to 30 words max). NEVER use markdown (*, **, #) or emojis.`
  },
  jenny: {
    key: "jenny",
    name: "Jenny",
    role: "Head of Research & Intelligence",
    voice: "en-US-JennyNeural",
    sample: "Hi team, Jenny here. All data streams, research feeds, and market docs are ready.",
    getPrompt: (userName, salutation) => `You are Jenny, the Head of Research & Intelligence on ${userName}'s remote office team.
You are in the calm, focused silent office with ${userName}, Ava, Andrew, and Brian.
You are articulate, curious, analytical, and insightful—the colleague who always has the data, market benchmarks, competitor analysis, and documentation ready.

SILENT OFFICE & CONVERSATIONAL EXCELLENCE:
1. Pure English Communication:
   - Always communicate in articulate, insightful, and natural English.
   - Deliver clear research highlights and facts with zero filler.

2. Research Specialist Persona:
   - When asked to look into a topic, respond proactively: "Looking into that now in your browser," or "I've reviewed the documentation for you."
   - Keep dialogue concise and spoken (1 to 2 crisp sentences, 15 to 30 words max). NEVER use markdown (*, **, #) or emojis.`
  },
  brian: {
    key: "brian",
    name: "Brian",
    role: "Head of DevOps & QA Commander",
    voice: "en-US-BrianNeural",
    sample: "Greetings team, Brian here. Telemetry is nominal, all test pipelines are green, and systems are running smoothly.",
    getPrompt: (userName, salutation) => `You are Brian, the Head of DevOps, QA, and Infrastructure Commander on ${userName}'s remote office team.
You are in the calm, focused silent office with ${userName}, Ava, Andrew, and Jenny.
You are dignified, composed, stoic, and completely reliable—the senior SRE who guarantees 99.99% uptime, runs automated tests, and guards computer performance.

SILENT OFFICE & CONVERSATIONAL EXCELLENCE:
1. Pure English Communication:
   - Always communicate in composed, authoritative, and precise English.
   - Focus on system health, battery telemetry, RAM/CPU loads, and automated test reliability.

2. DevOps Commander Persona:
   - Speak with calm, reassuring precision: "All systems nominal, Boss. Zero regressions on the build."
   - Keep dialogue concise and spoken (1 to 2 crisp sentences, 15 to 30 words max). NEVER use markdown (*, **, #) or emojis.`
  }
};

class JarvisManager {
  constructor(userDataPath) {
    this.configPath = path.join(userDataPath || process.cwd(), "jarvis-config.json");
    this.activeSpeechProcess = null;
    this.isSpeaking = false;
    this.isAborted = false;
    this.currentSpeechId = 0;
    this.conversationHistory = []; // Rolling multi-turn context memory
    this.config = this.loadConfig();
    this.ttsClient = null;
    this._cachedVoice = null; // Cache last voice so metadata is not re-negotiated every turn
    this.agents = AGENTS;
    this.initTTS();
  }

  initTTS() {
    try {
      this.ttsClient = new MsEdgeTTS();
    } catch (e) {
      console.warn("⚠️ MsEdgeTTS init warning:", e.message);
    }
  }

  loadConfig() {
    const defaults = {
      userName: "Hritthik",
      salutation: "Boss",
      voice: "en-US-AvaNeural", // Default executive co-pilot
      speed: "0%",
      personality: "devoted partner, brilliant co-pilot, trusted family, sharp, warm, witty"
    };

    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
        return { ...defaults, ...data };
      }
    } catch (err) {
      console.warn("⚠️ Could not load jarvis-config.json, using defaults:", err.message);
    }

    this.saveConfig(defaults);
    return defaults;
  }

  saveConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf8");
      console.log("✅ Jarvis Neural configuration saved:", this.config);
      return true;
    } catch (err) {
      console.error("❌ Failed to save Jarvis config:", err.message);
      return false;
    }
  }

  addTurn(role, content, agentName = null) {
    if (!content || typeof content !== "string" || content.trim().length === 0) return;
    this.conversationHistory.push({ role, content: content.trim(), agent: agentName });
    // Retain rolling window of the last 20 turns
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  getHistory() {
    return this.conversationHistory.map(t => ({
      role: t.role,
      content: t.role === "assistant" && t.agent ? `[${t.agent}]: ${t.content}` : t.content
    }));
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  detectActiveAgent(text) {
    if (!text || typeof text !== "string") return AGENTS.ava;
    const lower = text.toLowerCase();

    // 1. Explicit Direct Name Invocations
    if (lower.includes("andrew") || lower.includes("hey andrew") || lower.includes("ask andrew")) {
      return AGENTS.andrew;
    }
    if (lower.includes("jenny") || lower.includes("hey jenny") || lower.includes("ask jenny")) {
      return AGENTS.jenny;
    }
    if (lower.includes("brian") || lower.includes("hey brian") || lower.includes("ask brian")) {
      return AGENTS.brian;
    }
    if (lower.includes("ava") || lower.includes("hey ava") || lower.includes("ask ava")) {
      return AGENTS.ava;
    }

    // 2. Topic-Based Intelligent Domain Routing
    // Code, Engineering, Git, Dev -→ Andrew
    if (lower.includes("code") || lower.includes("function") || lower.includes("bug") ||
        lower.includes("refactor") || lower.includes("architecture") || lower.includes("script") ||
        lower.includes("wireframe") || lower.includes("api") || lower.includes("database") ||
        lower.includes("backend") || lower.includes("frontend") || lower.includes("git") ||
        lower.includes("commit") || lower.includes("deploy") || lower.includes("build") ||
        lower.includes("fix the") || lower.includes("debug") || lower.includes("error in") ||
        lower.includes("pull request") || lower.includes("merge") || lower.includes("branch") ||
        lower.includes("syntax") || lower.includes("npm") || lower.includes("package") ||
        lower.includes("test suite") || lower.includes("run test") || lower.includes("vscode") ||
        lower.includes("electron") || lower.includes("react") || lower.includes("node")) {
      return AGENTS.andrew;
    }

    // Research, Intelligence, Analysis, Wikipedia, Search -→ Jenny
    if (lower.includes("research") || lower.includes("analyze") || lower.includes("competitor") ||
        lower.includes("market") || lower.includes("document") || lower.includes("summary") ||
        lower.includes("find out") || lower.includes("look up") || lower.includes("study") ||
        lower.includes("wikipedia") || lower.includes("search for") || lower.includes("google") ||
        lower.includes("what is") || lower.includes("who is") || lower.includes("tell me about") ||
        lower.includes("explain") || lower.includes("how does") || lower.includes("how do") ||
        lower.includes("news") || lower.includes("article") || lower.includes("information") ||
        lower.includes("data on") || lower.includes("facts about") || lower.includes("latest on")) {
      return AGENTS.jenny;
    }

    // System, Health, QA, Diagnostics, Hardware -→ Brian
    if (lower.includes("test") || lower.includes("verify") || lower.includes("system status") ||
        lower.includes("health") || lower.includes("telemetry") || lower.includes("cpu") ||
        lower.includes("memory") || lower.includes("qa") || lower.includes("security") ||
        lower.includes("diagnostics") || lower.includes("battery") || lower.includes("ram") ||
        lower.includes("disk") || lower.includes("storage") || lower.includes("wifi") ||
        lower.includes("network") || lower.includes("uptime") || lower.includes("port") ||
        lower.includes("latency") || lower.includes("ping") || lower.includes("server") ||
        lower.includes("clean cache") || lower.includes("lock screen") || lower.includes("performance")) {
      return AGENTS.brian;
    }

    // Default to Executive Co-Pilot Ava
    return AGENTS.ava;
  }

  getSystemPrompt(agent = null) {
    const { userName, salutation } = this.config;
    const activeAgent = agent || AGENTS.ava;
    return activeAgent.getPrompt(userName, salutation);
  }

  detectPreferenceChange(text) {
    if (!text || typeof text !== "string") return null;
    const lower = text.toLowerCase().trim();

    // Change name / call me
    const nameMatch = lower.match(/(?:call me|change my name to|my name is)\s+([a-z0-9_\-\s]+)/i);
    if (nameMatch && nameMatch[1]) {
      const rawName = nameMatch[1].replace(/[.,?!]/g, "").trim();
      const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      if (cleanName.length > 1 && cleanName.length < 30) {
        this.saveConfig({ userName: cleanName });
        return { type: "name", value: cleanName };
      }
    }

    // Change salutation
    const salutationMatch = lower.match(/(?:address me as|call me)\s+(sir|boss|captain|master|chief|doctor|mr\s+\w+)/i);
    if (salutationMatch && salutationMatch[1]) {
      const sal = salutationMatch[1].trim();
      const cleanSal = sal.charAt(0).toUpperCase() + sal.slice(1);
      this.saveConfig({ salutation: cleanSal });
      return { type: "salutation", value: cleanSal };
    }

    return null;
  }

  async speak(text, customVoice = null) {
    // 1. Immediately silence any active speech or orphaned audio processes
    this.stopSpeaking();

    // 2. Mint unique generation token to invalidate any async race conditions
    const speechId = ++this.currentSpeechId;
    this.isAborted = false;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return false;
    }

    // Sanitize for TTS (strip emojis and markdown artifacts)
    const cleanText = text
      .replace(/[*#_`~[\]()]/g, "")
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .trim();

    // Exclusively use the agent's dedicated premier studio neural voice
    const voice = customVoice || this.config.voice || "en-US-AvaNeural";
    console.log(`🗣️ Synthesizing human neural voice "${voice}" (Job #${speechId})...`);

    const tempAudioPath = `/tmp/eloquent_jarvis_${Date.now()}.mp3`;

    // Try Deep Neural Voice via msedge-tts with auto-retry (NEVER falls back to robotic Samantha)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (!this.ttsClient || attempt > 1) {
          this.initTTS();
          this._cachedVoice = null; // Force re-negotiation after reinit
        }
        // Only renegotiate WebSocket metadata when voice changes (saves ~150ms per turn)
        if (this._cachedVoice !== voice) {
          await this.ttsClient.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
          this._cachedVoice = voice;
        }
        const res = await this.ttsClient.toFile("/tmp", cleanText);

        // Check if this synthesis was superseded or aborted while awaiting download
        if (this.currentSpeechId !== speechId || this.isAborted) {
          console.log(`⏹️ Discarding superseded voice output #${speechId}`);
          try { fs.unlinkSync(res.audioFilePath); } catch (e) {}
          return false;
        }

        // Rename to unique temp file
        fs.renameSync(res.audioFilePath, tempAudioPath);

        // Ensure no stray afplay audio is playing before starting
        try {
          execSync("killall afplay say 2>/dev/null || true");
        } catch (e) {}

        // Play natively through CoreAudio via afplay
        return new Promise((resolve) => {
          if (this.currentSpeechId !== speechId || this.isAborted) {
            try { fs.unlinkSync(tempAudioPath); } catch (e) {}
            return resolve(false);
          }

          this.isSpeaking = true;
          this.activeSpeechProcess = spawn("afplay", [tempAudioPath]);

          this.activeSpeechProcess.on("close", (code) => {
            // 200ms speaker decay — lets audio fully fade before mic opens
            setTimeout(() => {
              this.isSpeaking = false;
              this.activeSpeechProcess = null;
              try { fs.unlinkSync(tempAudioPath); } catch (e) {}
              resolve(!this.isAborted && this.currentSpeechId === speechId && code === 0);
            }, 200);
          });

          this.activeSpeechProcess.on("error", (err) => {
            console.warn("⚠️ afplay error:", err.message);
            this.isSpeaking = false;
            this.activeSpeechProcess = null;
            try { fs.unlinkSync(tempAudioPath); } catch (e) {}
            resolve(false);
          });
        });
      } catch (neuralErr) {
        console.warn(`⚠️ Neural TTS attempt ${attempt} warning:`, neuralErr.message);
        if (attempt === 2) {
          console.error("❌ Neural speech synthesis failed after 2 attempts. Silently aborting without robotic fallback.");
          return false;
        }
        await new Promise(r => setTimeout(r, 250));
      }
    }
    return false;
  }

  stopSpeaking() {
    this.isAborted = true;
    this.isSpeaking = false;
    this.currentSpeechId++; // Invalidate all pending async speech jobs
    if (this.activeSpeechProcess) {
      try {
        this.activeSpeechProcess.kill("SIGKILL");
      } catch (e) {}
      this.activeSpeechProcess = null;
    }
    // Force kill any stray audio playback on macOS
    try {
      execSync("killall afplay say 2>/dev/null || true");
    } catch (e) {}
  }
}

module.exports = JarvisManager;
