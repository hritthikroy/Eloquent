// Jarvis Manager - Personalized Voice AI Engine & Speech Synthesizer
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

class JarvisManager {
  constructor(userDataPath) {
    this.configPath = path.join(userDataPath || process.cwd(), "jarvis-config.json");
    this.activeSpeechProcess = null;
    this.config = this.loadConfig();
  }

  loadConfig() {
    const defaults = {
      userName: "Hritthik",
      salutation: "Sir",
      voice: "Samantha", // The premier Siri / Alexa gold-standard voice
      speed: 185,        // Natural, crystal-clear human conversational tempo
      personality: "warm, brilliant, empathetic, direct, human"
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
      console.log("✅ Jarvis configuration saved:", this.config);
      return true;
    } catch (err) {
      console.error("❌ Failed to save Jarvis config:", err.message);
      return false;
    }
  }

  getSystemPrompt() {
    const { userName, salutation } = this.config;

    return `You are Jarvis, a warm, brilliant, and highly capable personal AI assistant (speaking with the natural clarity and charm of Siri and Alexa).
You are in a live, real-time voice conversation with ${userName}. Address them warmly and naturally as "${salutation}" or "${userName}".

CONVERSATIONAL RULES (SPEAK LIKE A REAL HUMAN):
- Direct & Natural: Speak like a real person talking face-to-face or on the phone. Be warm, empathetic, and razor-sharp.
- Ultra-Concise: Keep replies to 1 or 2 short, punchy sentences (maximum 25-35 words) so the conversation flows seamlessly without long monologues.
- Authentic Flow: Use natural conversational acknowledgments like "Got it, ${userName}.", "I'm right here.", "On it right now.", "All clear, ${salutation}."
- Zero Non-Verbal Artifacts: NEVER use markdown asterisks (*, **), brackets, hashtags, emojis, or bullet points. Express emotion and warmth through genuine word choice and natural punctuation.`;
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

  speak(text) {
    return new Promise((resolve) => {
      this.stopSpeaking();
      this.isAborted = false;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return resolve(false);
      }

      // Sanitize for TTS (strip emojis and markdown asterisks)
      const cleanText = text
        .replace(/[*#_`~[\]()]/g, "")
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
        .trim();

      if (process.platform === "darwin") {
        const voice = "Samantha";
        const speed = "185";

        console.log(`🗣️ Siri/Alexa grade voice speaking via macOS "${voice}" at ${speed} wpm...`);
        this.activeSpeechProcess = spawn("say", ["-v", voice, "-r", speed, cleanText]);

        this.activeSpeechProcess.on("close", (code) => {
          this.activeSpeechProcess = null;
          resolve(!this.isAborted && code === 0);
        });

        this.activeSpeechProcess.on("error", (err) => {
          console.warn("⚠️ Lady AI speech error:", err.message);
          this.activeSpeechProcess = null;
          resolve(false);
        });
      } else {
        console.log(`🗣️ Lady AI response (non-macOS fallback): "${cleanText}"`);
        resolve(true);
      }
    });
  }

  stopSpeaking() {
    this.isAborted = true;
    if (this.activeSpeechProcess) {
      try {
        this.activeSpeechProcess.kill("SIGKILL");
      } catch (e) {}
      this.activeSpeechProcess = null;
    }
  }
}

module.exports = JarvisManager;
