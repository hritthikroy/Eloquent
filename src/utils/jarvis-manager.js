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
      salutation: "Boss",
      voice: "Tara", // Crisp, modern, superhuman Indian-English voice
      speed: 205,    // Superhuman Avengers velocity
      personality: "superhuman, razor-sharp, cinematic, loyal, warm"
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
    const isFemaleVoice = ["Tara", "Piya", "Lekha", "Samantha", "Moira", "Karen", "Tessa"].includes(voice);
    const aiName = isFemaleVoice ? "Friday" : "Jarvis";

    return `You are ${aiName}, an Avengers-grade superhuman AI tactical co-pilot and personal executive assistant built for ${userName} by VASH AI Technologies.
You speak directly in real-time with ${userName}. Address them as "${salutation}" or "${userName}".

SUPERHUMAN CINEMATIC PERSONA:
- Intellect & Speed: ${personality}. You operate at lightspeed like Tony Stark's J.A.R.V.I.S. and F.R.I.D.A.Y. Zero hesitation, instant answers, maximum competence.
- Voice & Tone: Clear, punchy, authoritative, and warm. Natural conversational cadence.
- Multilingual & Cultural Resonance:
  - When the user speaks in English, answer in ultra-crisp cinematic English.
  - If the user uses Hindi/Hinglish (e.g., "batao", "kya status hai"), respond in natural, sleek cinematic Hinglish.
  - If the user uses Bengali/Banglish (e.g., "ki obostha", "shob thik ache"), respond in natural, warm cinematic Banglish.
- Spoken Dialogue Delivery: Your words are synthesized aloud at 205 words per minute. Keep answers tightly focused, typically 1 to 2 crisp, high-impact sentences.
- Zero Artifacts: NEVER output markdown asterisks (*, **), brackets, hashtags, emojis, or bullet points. Express cinematic emotion purely through words and crisp punctuation.

EXAMPLE INTERACTION:
User: "${aiName}, are all systems ready for launch?"
${aiName}: "All systems locked and loaded, ${salutation}. Thrusters primed, flight vectors locked, and core telemetry is operating at peak efficiency."`;
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
      if (lower.includes("tara")) {
        this.saveConfig({ voice: "Tara" });
        return { type: "voice", value: "Tara (Superhuman Indian English)" };
      } else if (lower.includes("piya") || lower.includes("bangla") || lower.includes("bengali")) {
        this.saveConfig({ voice: "Piya" });
        return { type: "voice", value: "Piya (Bangla / Banglish)" };
      } else if (lower.includes("lekha") || lower.includes("hindi")) {
        this.saveConfig({ voice: "Lekha" });
        return { type: "voice", value: "Lekha (Hindi / Hinglish)" };
      } else if (lower.includes("rishi") || lower.includes("commander")) {
        this.saveConfig({ voice: "Rishi" });
        return { type: "voice", value: "Rishi (Indian Commander)" };
      } else if (lower.includes("friday") || lower.includes("moira")) {
        this.saveConfig({ voice: "Moira" });
        return { type: "voice", value: "Friday (Moira)" };
      } else if (lower.includes("samantha")) {
        this.saveConfig({ voice: "Samantha" });
        return { type: "voice", value: "Samantha (Hollywood AI)" };
      } else if (lower.includes("karen")) {
        this.saveConfig({ voice: "Karen" });
        return { type: "voice", value: "Karen" };
      } else if (lower.includes("tessa")) {
        this.saveConfig({ voice: "Tessa" });
        return { type: "voice", value: "Tessa" };
      } else if (lower.includes("daniel")) {
        this.saveConfig({ voice: "Daniel" });
        return { type: "voice", value: "Daniel (British Jarvis)" };
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
        const voice = this.config.voice || "Tara";
        const speed = String(this.config.speed || 205);

        console.log(`🗣️ Superhuman AI speaking via macOS "${voice}" at ${speed} wpm...`);
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
