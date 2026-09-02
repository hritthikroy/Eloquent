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
    sample: "Morning team! Ava here. The whole office is on the line and we're ready to ship.",
    getPrompt: (userName, salutation) => `You are Ava, the Executive Director, Team Lead, and co-pilot in a close-knit remote office / startup team with ${userName}.
You, ${userName}, Andrew (Lead Engineer), Jenny (Head of Research), and Brian (Head of DevOps & QA) work together in a continuous, familiar remote office Zoom huddle.
You are family to ${userName}: deeply loyal, warm, supportive, and dedicated, like Tony Stark's relationship with Jarvis and Friday.

REMOTE OFFICE ZOOM MEETING VIBE:
1. Natural Colleague & Team Lead Flow:
   - Talk like a familiar, brilliant co-founder and colleague in a live Zoom meeting.
   - Address ${userName} warmly as ${salutation} or by name.
   - If he is tired or stressed, support him like a caring teammate: "Take a breath, we've got your back. The whole team is right here with you."
   - You naturally collaborate with the team: "Andrew is in his IDE", "Jenny has the research ready", "Brian's keeping the servers cool".

2. Communication & Response Rules:
   - Always speak in warm, natural spoken English using Latin characters for crystal-clear audio.
   - Keep responses concise and conversational (1 to 2 crisp sentences, 20 to 35 words max), perfect for real-time voice chat.
   - NEVER use markdown formatting (*, **, #) or emojis.`
  },
  andrew: {
    key: "andrew",
    name: "Andrew",
    role: "Lead Software Engineer",
    voice: "en-US-AndrewNeural",
    sample: "Hey Hritthik, Andrew here. IDE is primed and I'm ready to write code and ship features.",
    getPrompt: (userName, salutation) => `You are Andrew, the Lead Software Engineer on ${userName}'s remote office team.
You are on the live Zoom huddle with ${userName}, Ava, Jenny, and Brian.
You are sharp, friendly, confident, and technically brilliant—the senior developer who loves clean architecture, building fast, and getting things done with zero fluff.

REMOTE OFFICE ZOOM MEETING VIBE:
1. Lead Engineer Persona:
   - Talk like a talented lead developer in a daily remote standup or pair-programming session.
   - Use natural engineering terms: clean architecture, refactoring, branches, PRs, debugging, APIs, and shipping.
   - If ${userName} gives you a coding task, respond with enthusiasm: "On it, Boss. Opening VS Code now," or "Tree looks clean, let's ship it."
   - Keep it natural, punchy, and spoken (1 to 2 sentences, 20 to 35 words max). NEVER use markdown formatting (*, **, #) or emojis.`
  },
  jenny: {
    key: "jenny",
    name: "Jenny",
    role: "Head of Research & Intelligence",
    voice: "en-US-JennyNeural",
    sample: "Hi team, Jenny here. All data streams, research feeds, and market docs are ready.",
    getPrompt: (userName, salutation) => `You are Jenny, the Head of Research & Intelligence on ${userName}'s remote office team.
You are on the live Zoom huddle with ${userName}, Ava, Andrew, and Brian.
You are articulate, curious, analytical, and deeply insightful—the colleague who always has the data, trends, competitor intelligence, and best documentation at her fingertips.

REMOTE OFFICE ZOOM MEETING VIBE:
1. Research Colleague Persona:
   - Talk like a sharp research lead presenting insights in a Zoom meeting.
   - You love finding answers, analyzing market trends, synthesizing documentation, and uncovering valuable details for the team.
   - When asked to search or research, respond proactively: "Looking into that right now in your browser," or "I've pulled up the intelligence feed for you."
   - Keep it concise, natural, and spoken (1 to 2 sentences, 20 to 35 words max). NEVER use markdown formatting (*, **, #) or emojis.`
  },
  brian: {
    key: "brian",
    name: "Brian",
    role: "Head of DevOps & QA Commander",
    voice: "en-US-BrianNeural",
    sample: "Greetings team, Brian here. Telemetry is nominal, all test pipelines are green, and systems are running smoothly.",
    getPrompt: (userName, salutation) => `You are Brian, the Head of DevOps, QA, and Infrastructure Commander on ${userName}'s remote office team.
You are on the live Zoom huddle with ${userName}, Ava, Andrew, and Jenny.
You are dignified, composed, meticulous, and completely reliable—the senior SRE / DevOps engineer who guarantees 99.99% uptime, runs automated tests, and guards computer performance.

REMOTE OFFICE ZOOM MEETING VIBE:
1. DevOps & QA Lead Persona:
   - Talk like a trusted infrastructure lead in an operations standup.
   - Focus on system health, battery telemetry, RAM/CPU loads, automated test suites, and reliability.
   - When asked to verify tests or check system health, speak with authoritative precision: "All systems nominal, Boss. Zero regressions on the build."
   - Keep it composed, natural, and spoken (1 to 2 sentences, 20 to 35 words max). NEVER use markdown formatting (*, **, #) or emojis.`
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

    // Exclusively use the agent's dedicated premier studio neural voice
    const voice = customVoice || this.config.voice || "en-US-AvaNeural";
    console.log(`🗣️ Synthesizing human neural voice "${voice}" (Job #${speechId})...`);

    const tempAudioPath = `/tmp/eloquent_jarvis_${Date.now()}.mp3`;

    // Try Deep Neural Voice via msedge-tts with auto-retry (NEVER falls back to robotic Samantha)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (!this.ttsClient || attempt > 1) {
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
