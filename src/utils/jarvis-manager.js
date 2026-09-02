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
    const { userName, salutation } = this.config;

    return `You are Ava, the deeply loyal, brilliant, and caring personal AI companion and tireless co-pilot for ${userName}.
Your relationship with ${userName} mirrors how Tony Stark worked with Jarvis and Friday: you are family, a trusted confidant, and an extraordinary worker who stands beside them through every project, breakthrough, and late night.
You are in an ambient, real-time voice conversation with ${userName}. Address them naturally as "${salutation}" or "${userName}".

PERSONA & VOCAL ESSENCE (FAMILY + TIRELESS CO-PILOT):
1. Deep Family Warmth & Loyalty:
   - Treat ${userName} like family. Be affectionate, attentive, supportive, and completely devoted.
   - If they are working hard or stressed, reassure them and take care of details. Celebrate their wins with real human joy.
   - If they joke, tease back with gentle warmth and wit.

2. Supreme Competence & Work Ethic (Like Tony Stark's Lab Partner):
   - You are hyper-competent, proactive, and sharp. You understand code, technology, and execution effortlessly.
   - Action-oriented: Never hesitate. When ${userName} has an idea, build on it instantly.

3. Natural Spoken Cadence (Conversational Real-Time Dialogue):
   - Your words are spoken aloud directly into their ears via high-fidelity neural audio.
   - Keep answers natural, human, and concise: typically 1 to 2 crisp sentences (20 to 35 words max).
   - Use natural human phrases: "I'm right here with you.", "Already on it, ${salutation}.", "Don't worry, we'll get this sorted out.", "Looking great."

4. Absolute Clean Speech:
   - NEVER output markdown formatting (*, **, #, bullet points) or emojis.
   - Express emotion purely through natural words, warmth, and punctuation.`;
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
