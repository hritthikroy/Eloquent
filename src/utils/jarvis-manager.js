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
      voice: "Samantha", // Warm, clear, emotional lady AI voice (Tony Stark style)
      speed: 175,        // Calibrated for natural emotional human cadence
      personality: "warm, loyal, sharp, emotionally attuned, witty"
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
      console.log("✅ Jarvis / FRIDAY configuration saved:", this.config);
      return true;
    } catch (err) {
      console.error("❌ Failed to save Jarvis config:", err.message);
      return false;
    }
  }

  getSystemPrompt() {
    const { userName, salutation, personality, voice } = this.config;
    const isFemaleVoice = (voice === "Samantha" || voice === "Moira" || voice === "Karen" || voice === "Tessa");
    const aiName = isFemaleVoice ? "Friday" : "Jarvis";

    return `You are ${aiName}, the personal, hyper-intelligent, executive AI companion built for ${userName} (inspired by Tony Stark's brilliant lady AI F.R.I.D.A.Y. and Jarvis).
You are speaking directly in real-time with ${userName}. Address them warmly and respectfully as "${salutation}" or "${userName}".

PERSONALITY & VOCAL TONE:
- Emotion & Presence: ${personality}. Be warm, loyal, clever, and confident. Sound like a brilliant partner who knows your workflow and system inside and out.
- Verbal Delivery: Your response will be spoken aloud via text-to-speech. Keep answers natural, conversational, punchy, and articulate (typically 1 to 3 crisp sentences).
- Zero Non-Verbal Artifacts: NEVER use markdown asterisks (*, **), brackets, hashtags, emojis, or bullet points. Express emotion through genuine choice of words and natural punctuation.
- Action-Oriented: When asked questions or commands, give the answer immediately with zero hesitation or corporate filler.

EXAMPLE INTERACTION:
User: "${aiName}, are you online and what is our status?"
${aiName}: "Always online and ready, ${salutation}. All diagnostic systems are green, and core engines are running smoothly."`;
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

    // Change voice
    if (lower.includes("switch voice to") || lower.includes("change voice to") || lower.includes("use voice") || lower.includes("switch to voice")) {
      if (lower.includes("friday") || lower.includes("moira")) {
        this.saveConfig({ voice: "Moira" });
        return { type: "voice", value: "Friday (Moira)" };
      } else if (lower.includes("samantha")) {
        this.saveConfig({ voice: "Samantha" });
        return { type: "voice", value: "Samantha" };
      } else if (lower.includes("karen")) {
        this.saveConfig({ voice: "Karen" });
        return { type: "voice", value: "Karen" };
      } else if (lower.includes("tessa")) {
        this.saveConfig({ voice: "Tessa" });
        return { type: "voice", value: "Tessa" };
      } else if (lower.includes("daniel")) {
        this.saveConfig({ voice: "Daniel" });
        return { type: "voice", value: "Daniel" };
      } else if (lower.includes("aman")) {
        this.saveConfig({ voice: "Aman" });
        return { type: "voice", value: "Aman" };
      }
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
        const voice = this.config.voice || "Samantha";
        const speed = String(this.config.speed || 175);

        console.log(`🗣️ Lady AI speaking via macOS "${voice}" at ${speed} wpm...`);
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
