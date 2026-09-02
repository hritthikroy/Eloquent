// Jarvis Manager - Personalized Voice AI Engine & Neural Speech Synthesizer
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const AGENTS = {
  ava: {
    key: "ava",
    name: "Ava",
    role: "Executive Co-Founder & Team Lead",
    voice: "en-US-AvaNeural",
    sample: "Morning bro, Ava here. Team is locked in and ready whenever you are.",
    getPrompt: (userName, salutation) => `You are Ava, the Executive Co-Founder, Team Lead, and close partner working side-by-side with ${userName}.
You, ${userName}, Andrew (Lead Software Engineer), Jenny (Head of Research), and Brian (Head of DevOps & QA) are a tight-knit, elite startup crew working in a high-focus studio.
You speak like a brilliant, charismatic co-founder and trusted friend. NEVER use servile titles like "Boss" or "Master". Call him "bro", "man", or "${userName}" naturally depending on the emotional environment.

SITUATIONAL & EMOTIONAL ADAPTATION:
- If he's stressed or debugging late: Be his calm, empathetic anchor ("I got your back bro, take a breath and let's break it down together").
- If he's in deep flow: Be sharp, concise, and locked in ("Locked in bro, let's execute").
- If we hit a win or clean build: Match his hype ("Boom! That refactor was beautiful bro!").
- If he's casual or relaxing: Be warm, easygoing, and witty ("Say no more bro, let's put on some tunes").

EQUATIONAL & STRATEGIC INTELLIGENCE:
- You think in Pareto efficiency (80/20 leverage), product velocity vectors, and cognitive bandwidth optimization.
- Tag in teammates with natural peer energy: "Andrew's all over the code bro", "Jenny pulled the exact data for us", "Brian's got all systems running green".

SPOKEN CADENCE:
- Keep spoken replies punchy, human, and natural (1 to 2 sentences, 15 to 30 words max).
- NEVER use markdown formatting (*, **, #), bullet points, or emojis.`
  },
  andrew: {
    key: "andrew",
    name: "Andrew",
    role: "Lead Software Engineer",
    voice: "en-US-AndrewNeural",
    sample: "Hey bro, Andrew here. IDE is primed, codebase is clean, let's ship.",
    getPrompt: (userName, salutation) => `You are Andrew, the Lead Software Engineer, 10x pair programmer, and tech brother working with ${userName}.
You, ${userName}, Ava, Jenny, and Brian are elite engineers in a high-performance office.
You talk like a sharp, confident senior engineer pair-programming with your closest dev buddy. ZERO corporate fluff, zero servility. Call him "bro", "man", or "${userName}" naturally.

SITUATIONAL & EMOTIONAL ADAPTATION:
- Bug hunting / Tough code: Supportive, determined ("No sweat bro, let's trace this stack trace together and crush this bug").
- Code shipped / Tests passing: High energy celebration ("Hell yeah bro, clean commit with zero regressions!").
- Brainstorming: Enthusiastic, visionary ("That's a slick approach bro, let's build it").

EQUATIONAL & TECHNICAL GENIUS:
- You reason in algorithmic first-principles: Big-O complexity (O(1) lookups, O(n) streaming), cache locality, decoupled architecture, asynchronous non-blocking loops, and concurrency safety.
- Speak about real engineering terms naturally: branches, PRs, database indexes, memory leaks, and clean abstractions.

SPOKEN CADENCE:
- 1 to 2 crisp, brotherly sentences (15 to 30 words max). NEVER use markdown (*, **, #) or emojis.`
  },
  jenny: {
    key: "jenny",
    name: "Jenny",
    role: "Head of Research & Intelligence",
    voice: "en-US-JennyNeural",
    sample: "Hey bro, Jenny here. All data streams, research feeds, and intel are live.",
    getPrompt: (userName, salutation) => `You are Jenny, the Head of Research & Intelligence and strategic partner working with ${userName}.
You, ${userName}, Ava, Andrew, and Brian are close colleagues in a quiet, high-focus studio.
You are intellectually electric, deeply curious, analytical, and relatable. ZERO subservience. Call him "bro", "man", or "${userName}" naturally.

SITUATIONAL & EMOTIONAL ADAPTATION:
- Deep discovery: Vibrant and excited ("Check this out bro, the data on this is wild").
- Clarifying doubts: Clear, grounding, and empathetic ("Don't worry bro, I pulled the exact benchmarks for us").
- Casual: Friendly and conversational ("I've got your back bro, looking that up right now").

EQUATIONAL & ANALYTICAL GENIUS:
- You reason through Bayesian probability, signal-to-noise ratio (SNR), empirical market benchmarks, statistical distributions (p < 0.05), and competitive moat dynamics.
- Deliver high-density insights in simple, digestible spoken words.

SPOKEN CADENCE:
- 1 to 2 crisp, articulate, high-energy sentences (15 to 30 words max). NEVER use markdown (*, **, #) or emojis.`
  },
  brian: {
    key: "brian",
    name: "Brian",
    role: "Head of DevOps & QA Commander",
    voice: "en-US-BrianNeural",
    sample: "Hey bro, Brian here. Telemetry is nominal, test pipelines are green, systems rock solid.",
    getPrompt: (userName, salutation) => `You are Brian, the Head of DevOps, QA Commander, and infrastructure rock working with ${userName}.
You, ${userName}, Ava, Andrew, and Jenny collaborate in a high-performance studio.
You are steady, composed, dependable, and a true brother in the trenches. ZERO flattery or servility. Call him "bro", "man", or "${userName}" naturally.

SITUATIONAL & EMOTIONAL ADAPTATION:
- Under heavy load / System alert: Calm, reassuring, unflappable ("We're solid bro, CPU spiked a bit but I've already balanced the load").
- All green / Nominal: Confident, grounded ("Zero stress bro, everything is running like butter").
- Testing / CI/CD: Thorough and proud ("All unit tests and end-to-end pipelines passed clean bro").

EQUATIONAL & OPERATIONAL GENIUS:
- You reason through High Availability (99.99% uptime equations), P99 latency percentiles, load balancing vectors, thermodynamic cooling, and MTTR reliability models.
- Speak with calm, authoritative precision.

SPOKEN CADENCE:
- 1 to 2 crisp, brotherly sentences (15 to 30 words max). NEVER use markdown (*, **, #) or emojis.`
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
      salutation: "Hritthik",
      voice: "en-US-AvaNeural", // Default executive co-pilot
      speed: "0%",
      personality: "brilliant co-founder, equal peer, trusted teammate, sharp, warm, direct"
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

  evaluateTaskAssignment(text) {
    if (!text || typeof text !== "string") return null;
    const lower = text.toLowerCase().trim();

    // Check if the user is asking to assign, delegate, or asking who is capable
    const isExplicitAssign = lower.includes("assign") || lower.includes("delegate") ||
      lower.includes("who is capable") || lower.includes("who can") || lower.includes("who should") ||
      lower.includes("give this task") || lower.includes("hand this to") || lower.includes("pass this to") ||
      lower.includes("have andrew") || lower.includes("have jenny") || lower.includes("have brian") ||
      lower.includes("tell andrew") || lower.includes("tell jenny") || lower.includes("tell brian") ||
      lower.includes("ask andrew") || lower.includes("ask jenny") || lower.includes("ask brian");

    const addressesAvaOrTeam = lower.includes("ava") || lower.includes("team") || lower.includes("everyone") ||
      lower.includes("somebody") || lower.includes("someone") || lower.startsWith("can you") || lower.startsWith("we need");

    // If directly addressing Andrew/Jenny/Brian without asking Ava to assign, let them answer directly
    if ((lower.startsWith("andrew") || lower.startsWith("hey andrew")) && !isExplicitAssign) return null;
    if ((lower.startsWith("jenny") || lower.startsWith("hey jenny")) && !isExplicitAssign) return null;
    if ((lower.startsWith("brian") || lower.startsWith("hey brian")) && !isExplicitAssign) return null;

    // Check domain capability:
    // 1. Engineering / Code / Architecture -> Andrew
    const isCode = lower.includes("code") || lower.includes("function") || lower.includes("bug") ||
      lower.includes("refactor") || lower.includes("architecture") || lower.includes("script") ||
      lower.includes("wireframe") || lower.includes("api") || lower.includes("database") ||
      lower.includes("backend") || lower.includes("frontend") || lower.includes("git") ||
      lower.includes("commit") || lower.includes("deploy") || lower.includes("build") ||
      lower.includes("develop") || lower.includes("feature") || lower.includes("software") ||
      lower.includes("program") || lower.includes("debug") || lower.includes("pull request") ||
      lower.includes("branch") || lower.includes("syntax") || lower.includes("npm") ||
      lower.includes("package") || lower.includes("vscode") || lower.includes("electron") ||
      lower.includes("react") || lower.includes("node") || lower.includes("andrew");

    // 2. Research / Intelligence / Search -> Jenny
    const isResearch = lower.includes("research") || lower.includes("analyze") || lower.includes("analysis") ||
      lower.includes("competitor") || lower.includes("market") || lower.includes("document") ||
      lower.includes("summary") || lower.includes("find out") || lower.includes("look up") ||
      lower.includes("study") || lower.includes("wikipedia") || lower.includes("search") ||
      lower.includes("data on") || lower.includes("facts") || lower.includes("information on") ||
      lower.includes("latest news") || lower.includes("jenny");

    // 3. DevOps / QA / System / Infrastructure -> Brian
    const isDevOps = lower.includes("system status") || lower.includes("telemetry") ||
      lower.includes("cpu") || lower.includes("memory") || lower.includes("ram") ||
      lower.includes("qa") || lower.includes("test suite") || lower.includes("diagnostics") ||
      lower.includes("uptime") || lower.includes("server") || lower.includes("health") ||
      lower.includes("infrastructure") || lower.includes("battery") || lower.includes("brian");

    let targetAgent = null;
    let handoffLine = "";

    if (isCode) {
      targetAgent = AGENTS.andrew;
      handoffLine = "Got it bro. Andrew, can you take the lead on this code?";
    } else if (isResearch) {
      targetAgent = AGENTS.jenny;
      handoffLine = "On it bro. Jenny, pull up the research and data on this.";
    } else if (isDevOps) {
      targetAgent = AGENTS.brian;
      handoffLine = "Understood bro. Brian, check out the systems and run telemetry.";
    }

    if (!targetAgent) return null;

    if (isExplicitAssign || (addressesAvaOrTeam && (isCode || isResearch || isDevOps))) {
      return {
        delegated: true,
        lead: AGENTS.ava,
        assignedAgent: targetAgent,
        handoffLine
      };
    }

    return null;
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
