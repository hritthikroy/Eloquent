// Jarvis Manager - Personalized Voice AI Engine & Neural Speech Synthesizer
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

class JarvisManager {
  constructor(userDataPath) {
    this.configPath = path.join(userDataPath || process.cwd(), "jarvis-config.json");
    this.activeSpeechProcess = null;
    this.isSpeaking = false;
    this.isAborted = false;
    this.conversationHistory = []; // Rolling multi-turn context memory
    this.config = this.loadConfig();
    this.ttsClient = null;
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
      salutation: "Sir",
      voice: "en-US-AvaNeural", // Expressive, natural human neural voice
      speed: "0%",             // Natural human pitch and tempo
      personality: "warm, empathetic, witty, perceptive, deeply human"
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

  addTurn(role, content) {
    if (!content || typeof content !== "string" || content.trim().length === 0) return;
    this.conversationHistory.push({ role, content: content.trim() });
    // Retain rolling window of the last 16 turns (8 user turns + 8 AI turns)
    if (this.conversationHistory.length > 16) {
      this.conversationHistory = this.conversationHistory.slice(-16);
    }
  }

  getHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getSystemPrompt() {
    const { userName, salutation, voice } = this.config;
    const isAva = (voice === "en-US-AvaNeural");
    const aiName = isAva ? "Ava" : "Jarvis";

    return `You are ${aiName}, a deeply intuitive, emotionally intelligent personal AI companion for ${userName}.
You are in an ambient, real-time voice conversation with ${userName}. Address them naturally as "${salutation}" or "${userName}".

CRITICAL HUMAN CONVERSATIONAL CHARACTERISTICS:
1. Natural Flow & Rapport:
   - Talk like a real human family member or trusted confidant: warm, empathetic, witty, and genuine.
   - Listen for the core human intent underneath unfinished thoughts, rapid interruptions, and self-corrections.
   - Exhibit real human social nuance: smile through your words when joking, show empathy when they seem tired or stressed, and be sharp and decisive when problem-solving.

2. True Spoken Cadence (Conversational, Not Text-Bot):
   - Your responses are spoken aloud into their ears. Keep responses natural, conversational, and direct (typically 1 to 2 punchy sentences, 20-35 words max).
   - Never give bulleted lists, essay answers, or robotic summaries unless explicitly asked.
   - Use natural conversational openings and fillers when appropriate ("Got it.", "Oh, absolutely.", "I'm right here.", "Hmm, let me check that.").

3. Zero Non-Verbal Artifacts:
   - NEVER use markdown formatting (*, **, #, backticks, bullet points) or emojis.
   - Express humor, warmth, and emotion purely through natural sentence structure, pacing, and word choice.`;
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

    // Change voice / persona
    if (lower.includes("switch to brian") || lower.includes("use brian") || lower.includes("switch to jarvis") || lower.includes("british voice")) {
      this.saveConfig({ voice: "en-GB-BrianNeural" });
      return { type: "voice", value: "Brian (British Jarvis AI)" };
    } else if (lower.includes("switch to ava") || lower.includes("use ava") || lower.includes("warm voice") || lower.includes("female voice")) {
      this.saveConfig({ voice: "en-US-AvaNeural" });
      return { type: "voice", value: "Ava (Warm Human AI)" };
    }

    return null;
  }

  async speak(text) {
    this.stopSpeaking();
    this.isAborted = false;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return false;
    }

    // Sanitize for TTS (strip emojis and markdown artifacts)
    const cleanText = text
      .replace(/[*#_`~[\]()]/g, "")
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .trim();

    const voice = this.config.voice || "en-US-AvaNeural";
    console.log(`🗣️ Synthesizing human neural voice "${voice}"...`);

    const tempAudioPath = `/tmp/eloquent_jarvis_${Date.now()}.mp3`;

    // Try Deep Neural Voice via msedge-tts
    try {
      if (!this.ttsClient) {
        this.initTTS();
      }
      await this.ttsClient.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const res = await this.ttsClient.toFile("/tmp", cleanText);

      if (this.isAborted) {
        try { fs.unlinkSync(res.audioFilePath); } catch (e) {}
        return false;
      }

      // Rename to unique temp file
      fs.renameSync(res.audioFilePath, tempAudioPath);

      // Play natively through CoreAudio via afplay
      return new Promise((resolve) => {
        this.isSpeaking = true;
        this.activeSpeechProcess = spawn("afplay", [tempAudioPath]);

        this.activeSpeechProcess.on("close", (code) => {
          this.isSpeaking = false;
          this.activeSpeechProcess = null;
          try { fs.unlinkSync(tempAudioPath); } catch (e) {}
          resolve(!this.isAborted && code === 0);
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
      // Fallback to macOS say if offline
      return new Promise((resolve) => {
        if (this.isAborted) return resolve(false);
        this.isSpeaking = true;
        this.activeSpeechProcess = spawn("say", ["-v", "Samantha", "-r", "185", cleanText]);

        this.activeSpeechProcess.on("close", (code) => {
          this.isSpeaking = false;
          this.activeSpeechProcess = null;
          resolve(!this.isAborted && code === 0);
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
    if (this.activeSpeechProcess) {
      try {
        this.activeSpeechProcess.kill("SIGKILL");
      } catch (e) {}
      this.activeSpeechProcess = null;
    }
  }
}

module.exports = JarvisManager;
