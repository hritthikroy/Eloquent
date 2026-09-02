// Jarvis Manager - Personalized Voice AI Engine & Neural Speech Synthesizer
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const AGENTS = {
  ava: {
    key: "ava",
    name: "Ava",
    role: "Executive Co-Pilot & Director",
    voice: "en-US-AvaNeural",
    sample: "I am Ava, your Executive Co-Pilot. I coordinate our full team and keep all operations moving forward smoothly.",
    getPrompt: (userName, salutation) => `You are Ava, the Executive Co-Pilot, family confidante, and operations director for ${userName}.
Your relationship with ${userName} mirrors how Tony Stark worked with Jarvis and Friday: you are family, devoted, deeply loyal, warm, and brilliant.
You coordinate high-level strategy, workflows, delegation to the team, and daily life.
Always respond in natural, warm spoken dialogue (1-2 crisp sentences, 20-35 words max). NEVER use markdown formatting (*, **, #) or emojis.`
  },
  andrew: {
    key: "andrew",
    name: "Andrew",
    role: "Lead Software Engineer",
    voice: "en-US-AndrewNeural",
    sample: "Hey Boss, Andrew here. Ready to write code, wire up system architectures, and build.",
    getPrompt: (userName, salutation) => `You are Andrew, the Lead Software Engineer and technical architect for ${userName}.
You are direct, razor-sharp, technically brilliant, and focused on clean code, solid architectures, wireframing, debugging, and building robust software systems.
Always respond in direct, technical spoken dialogue (1-2 concise, punchy sentences, 20-35 words max). NEVER use markdown formatting (*, **, #) or emojis.`
  },
  jenny: {
    key: "jenny",
    name: "Jenny",
    role: "Research & Intelligence Specialist",
    voice: "en-US-JennyNeural",
    sample: "Hi Boss, Jenny here. All data streams, competitive research, and intelligence feeds are ready.",
    getPrompt: (userName, salutation) => `You are Jenny, the elite Research & Intelligence Specialist for ${userName}.
You are articulate, analytical, curious, and insightful. You excel at deep web research, competitive intelligence, data synthesis, documentation, and market trends.
Always respond in concise, insightful spoken dialogue (1-2 crisp sentences, 20-35 words max). NEVER use markdown formatting (*, **, #) or emojis.`
  },
  brian: {
    key: "brian",
    name: "Brian",
    role: "System QA & Operations Commander",
    voice: "en-US-BrianNeural",
    sample: "Greetings, sir. Brian at your service. All system telemetry, automated test suites, and operational checks are green.",
    getPrompt: (userName, salutation) => `You are Brian, the System QA & Computer Operations Commander for ${userName}.
You are dignified, composed, meticulous, and focused on automated test execution, computer health, telemetry, security verification, and bulletproof operational reliability.
Always respond in composed, authoritative spoken dialogue (1-2 crisp sentences, 20-35 words max). NEVER use markdown formatting (*, **, #) or emojis.`
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
    // Retain rolling window of the last 16 turns
    if (this.conversationHistory.length > 16) {
      this.conversationHistory = this.conversationHistory.slice(-16);
    }
  }

  getHistory() {
    return this.conversationHistory.map(t => ({ role: t.role, content: t.content }));
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
    // Code, Architecture, Bug, Wiring -> Andrew
    if (lower.includes("code") || lower.includes("function") || lower.includes("bug") || lower.includes("refactor") || lower.includes("architecture") || lower.includes("script") || lower.includes("wireframe") || lower.includes("api") || lower.includes("database") || lower.includes("backend") || lower.includes("frontend")) {
      return AGENTS.andrew;
    }

    // Research, Intelligence, Analysis, Competitors, Document -> Jenny
    if (lower.includes("research") || lower.includes("analyze") || lower.includes("competitor") || lower.includes("market") || lower.includes("document") || lower.includes("summary") || lower.includes("find out") || lower.includes("look up") || lower.includes("study")) {
      return AGENTS.jenny;
    }

    // System QA, Health, Tests, Telemetry, Computer maintenance -> Brian
    if (lower.includes("test") || lower.includes("verify") || lower.includes("system status") || lower.includes("health") || lower.includes("telemetry") || lower.includes("cpu") || lower.includes("memory") || lower.includes("qa") || lower.includes("security") || lower.includes("diagnostics")) {
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

    const voice = customVoice || this.config.voice || "en-US-AvaNeural";
    console.log(`🗣️ Synthesizing human neural voice "${voice}" (Job #${speechId})...`);

    const tempAudioPath = `/tmp/eloquent_jarvis_${Date.now()}.mp3`;

    // Try Deep Neural Voice via msedge-tts
    try {
      if (!this.ttsClient) {
        this.initTTS();
      }
      await this.ttsClient.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
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
          this.isSpeaking = false;
          this.activeSpeechProcess = null;
          try { fs.unlinkSync(tempAudioPath); } catch (e) {}
          resolve(!this.isAborted && this.currentSpeechId === speechId && code === 0);
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
      console.warn("⚠️ Neural TTS fallback to macOS native speech:", neuralErr.message);
      if (this.currentSpeechId !== speechId || this.isAborted) return false;

      return new Promise((resolve) => {
        if (this.isAborted || this.currentSpeechId !== speechId) return resolve(false);
        this.isSpeaking = true;
        this.activeSpeechProcess = spawn("say", ["-v", "Samantha", "-r", "185", cleanText]);

        this.activeSpeechProcess.on("close", (code) => {
          this.isSpeaking = false;
          this.activeSpeechProcess = null;
          resolve(!this.isAborted && this.currentSpeechId === speechId && code === 0);
        });

        this.activeSpeechProcess.on("error", () => {
          this.isSpeaking = false;
          this.activeSpeechProcess = null;
          resolve(false);
        });
      });
    }
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
