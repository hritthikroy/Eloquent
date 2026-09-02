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
      voice: "Daniel", // Iconic British Jarvis voice on macOS
      speed: 185,
      personality: "executive, loyal, witty, concise"
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
    const { userName, salutation, personality } = this.config;
    return `You are Jarvis, an advanced, hyper-intelligent, executive AI companion built by VASH AI Technologies.
You are speaking directly in real-time with ${userName}. Address them respectfully as "${salutation}" or "${userName}".

PERSONALITY & VOICE:
- Tone: ${personality}. Sound calm, confident, sharp, and genuinely helpful.
- Brevity: Keep verbal spoken responses punchy, concise, and articulate (typically 1 to 3 sentences) unless they explicitly ask for an in-depth breakdown.
- Conversational Delivery: Your output will be spoken aloud via text-to-speech. Do NOT use markdown asterisks (*, **), hashtags (#), bullet symbols, emojis, or code blocks in verbal dialogue. Spell out abbreviations when needed so they sound natural.
- Helpfulness: If asked to perform an action, solve a problem, or summarize, deliver the exact insight directly with zero throat-clearing preamble.

EXAMPLE INTERACTION:
User: "Jarvis, are you online?"
Jarvis: "Always online and at your service, ${salutation}. All core systems are running at peak performance."`;
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
    if (lower.includes("switch voice to") || lower.includes("change voice to") || lower.includes("use voice")) {
      if (lower.includes("samantha")) {
        this.saveConfig({ voice: "Samantha" });
        return { type: "voice", value: "Samantha" };
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

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return resolve(false);
      }

      // Sanitize for TTS (strip emojis and markdown asterisks)
      const cleanText = text
        .replace(/[*#_`~[\]()]/g, "")
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
        .trim();

      if (process.platform === "darwin") {
        const voice = this.config.voice || "Daniel";
        const speed = String(this.config.speed || 185);

        console.log(`🗣️ Jarvis speaking via macOS "${voice}" at ${speed} wpm...`);
        this.activeSpeechProcess = spawn("say", ["-v", voice, "-r", speed, cleanText]);

        this.activeSpeechProcess.on("close", () => {
          this.activeSpeechProcess = null;
          resolve(true);
        });

        this.activeSpeechProcess.on("error", (err) => {
          console.warn("⚠️ Jarvis speech error:", err.message);
          this.activeSpeechProcess = null;
          resolve(false);
        });
      } else {
        console.log(`🗣️ Jarvis response (non-macOS fallback): "${cleanText}"`);
        resolve(true);
      }
    });
  }

  stopSpeaking() {
    if (this.activeSpeechProcess) {
      try {
        this.activeSpeechProcess.kill("SIGTERM");
      } catch (e) {}
      this.activeSpeechProcess = null;
    }
  }
}

module.exports = JarvisManager;
