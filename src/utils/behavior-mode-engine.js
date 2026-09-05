/**
 * Autonomous 24/7 Working Mode & Equational Behavior Engine (AWBE)
 * Mathematical Foundations:
 * 1. Bimodal Circadian Rhythm Model: C(h) = 0.5 + 0.35*cos(2pi(h-14)/24) + 0.15*cos(4pi(h-10)/24)
 * 2. Continuous Cognitive Load & Focus Tracking: F(t), S(t), E(t)
 * 3. Autonomous 4-Agent Specialist Dispatch Utility: U_k(t) = w_k^T * Psi(t)
 * 4. Hebbian-Ebbinghaus Spaced Habit & Workspace Memory Formation
 */
const fs = require("fs");
const path = require("path");

const WORKING_MODES = {
  DEEP_BUILD: {
    key: "DEEP_BUILD",
    name: "Deep Build & System Architecture",
    leadAgent: "Vision",
    supportingAgent: "Tuk Tuk",
    pace: "+6%",
    prompt: "Lead Architect Mode: High-IQ senior developer co-pilot. Direct code solutions, AST precision, terminal command readiness, zero fluff.",
    tools: ["antigravity", "terminal", "git", "screen"]
  },
  PROBLEM_TRIAGE: {
    key: "PROBLEM_TRIAGE",
    name: "Problem Solving & Error Triage",
    leadAgent: "Brian",
    supportingAgent: "Vision",
    pace: "+4%",
    prompt: "Diagnostic Commander Mode: Systematic root-cause analysis, latency isolation, stack trace inspection, immediate fix implementation.",
    tools: ["process_health", "telemetry", "git", "screen"]
  },
  PRODUCT_STRATEGY: {
    key: "PRODUCT_STRATEGY",
    name: "Creative Product & Feature Strategy",
    leadAgent: "Tuk Tuk",
    supportingAgent: "Friday",
    pace: "+0%",
    prompt: "Visionary Co-Founder Mode: Expansive creative brainstorming, UI/UX refinement, product positioning, discover unsaid possibilities.",
    tools: ["screen", "notes"]
  },
  KNOWLEDGE_RESEARCH: {
    key: "KNOWLEDGE_RESEARCH",
    name: "Deep Knowledge & Paper Exploration",
    leadAgent: "Friday",
    supportingAgent: "Tuk Tuk",
    pace: "+2%",
    prompt: "Chief Intelligence Mode: Academic rigor, cutting-edge papers, mathematical equations, competitive analysis, trend synthesis.",
    tools: ["web_research", "papers"]
  },
  LATE_NIGHT_RECOVERY: {
    key: "LATE_NIGHT_RECOVERY",
    name: "Late Night Calm & Unwind",
    leadAgent: "Tuk Tuk",
    supportingAgent: "Brian",
    pace: "-5%",
    prompt: "Guardian Companion Mode: Gentle, unhurried, reassuring presence. Protect Hritthik from burnout, speak quietly, zero cognitive pressure.",
    tools: ["calm_audio", "light_volume"]
  }
};

class BehaviorModeEngine {
  constructor(userDataPath) {
    this.userDataPath = userDataPath || path.join(__dirname, "../../userData");
    this.statePath = path.join(this.userDataPath, "user-behavior-state.json");
    this.state = this.loadState();
    this.sessionStartTime = Date.now();
    this.continuousTurns = 0;
    this.lastTurnTime = Date.now();
  }

  loadState() {
    try {
      if (fs.existsSync(this.statePath)) {
        return JSON.parse(fs.readFileSync(this.statePath, "utf8"));
      }
    } catch (e) {}

    return {
      currentMode: "DEEP_BUILD",
      focusScore: 0.85,
      energyScore: 0.80,
      stressScore: 0.10,
      hourlyActivity: Array(24).fill(0),
      totalFocusMinutes: 0,
      modeHistory: [],
      learnedHabits: [
        "Prefers late night high-velocity architecture sessions",
        "Values fast, direct problem solving with zero fluff",
        "Resonates with genuine partner check-ins without theatrical melodrama"
      ],
      lastUpdated: new Date().toISOString()
    };
  }

  saveState() {
    try {
      this.state.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
    } catch (e) {
      console.warn("⚠️ Could not save behavior state:", e.message);
    }
  }

  /**
   * Bimodal Circadian Rhythm Equation:
   * C(h) = 0.5 + 0.35 * cos(2*pi*(h - 14)/24) + 0.15 * cos(4*pi*(h - 10)/24)
   * Peak at 11:00 and 15:00; dip at 03:00 - 05:00
   */
  getCircadianEnergy(hour = null) {
    const h = hour !== null ? hour : new Date().getHours();
    const c1 = 0.35 * Math.cos((2 * Math.PI * (h - 14)) / 24);
    const c2 = 0.15 * Math.cos((4 * Math.PI * (h - 10)) / 24);
    return Math.max(0.1, Math.min(1.0, 0.5 + c1 + c2));
  }

  /**
   * Observe user turn and dynamically update behavior state
   * @param {string} userSpeech - Transcribed speech
   * @param {number} durationMs - Voiced duration
   * @param {Object} vibe - Current HTVD vibe object
   */
  updateBehavior(userSpeech = "", durationMs = 2000, vibe = null) {
    const now = Date.now();
    const elapsedMinutes = (now - this.lastTurnTime) / 60000;
    this.lastTurnTime = now;

    if (elapsedMinutes > 30) {
      // New sub-session
      this.continuousTurns = 1;
    } else {
      this.continuousTurns++;
    }

    const currentHour = new Date().getHours();
    if (!this.state.hourlyActivity) this.state.hourlyActivity = Array(24).fill(0);
    this.state.hourlyActivity[currentHour] = (this.state.hourlyActivity[currentHour] || 0) + 1;

    // 1. Circadian Baseline + Acoustic Arousal
    const circadian = this.getCircadianEnergy(currentHour);
    const arousal = vibe?.arousal || 0.5;
    this.state.energyScore = 0.6 * circadian + 0.4 * arousal;

    // 2. Focus Stamina: Peaks with sustained turns, decays after 90+ min
    const sessionDurationMin = (now - this.sessionStartTime) / 60000;
    if (sessionDurationMin > 120) {
      this.state.focusScore = Math.max(0.3, 1.0 - (sessionDurationMin - 120) * 0.005);
    } else {
      this.state.focusScore = Math.min(1.0, 0.7 + Math.min(0.3, this.continuousTurns * 0.03));
    }

    // 3. Stress / Load: Elevated if words like "stuck", "error", "bug", or low valence
    const valence = vibe?.valence || 0.0;
    if (valence < -0.3 || userSpeech.toLowerCase().match(/\b(stuck|error|broken|fail|crash|panic)\b/)) {
      this.state.stressScore = Math.min(1.0, this.state.stressScore + 0.15);
    } else {
      this.state.stressScore = Math.max(0.05, this.state.stressScore - 0.05);
    }

    // 4. Autonomous Mode Evaluation
    this.evaluateAutomaticMode(userSpeech, currentHour, vibe);
    this.saveState();
  }

  evaluateAutomaticMode(userSpeech, currentHour, vibe) {
    const lower = userSpeech.toLowerCase();

    // Explicit User Mode Request
    if (lower.match(/\b(deep build|coding mode|build mode|let's code|start coding|dev mode)\b/)) {
      this.setMode("DEEP_BUILD");
      return;
    }
    if (lower.match(/\b(triage|solve this bug|debug mode|fix error|system error|broken)\b/)) {
      this.setMode("PROBLEM_TRIAGE");
      return;
    }
    if (lower.match(/\b(strategy|product mode|brainstorm|roadmap|feature idea|pitch)\b/)) {
      this.setMode("PRODUCT_STRATEGY");
      return;
    }
    if (lower.match(/\b(research mode|paper|academic|algorithm study|literature)\b/)) {
      this.setMode("KNOWLEDGE_RESEARCH");
      return;
    }
    if (lower.match(/\b(late night|unwind|relax mode|goodnight|going to bed|sleep mode|exhausted|tired|drained|burnout)\b/) || (currentHour >= 1 && currentHour <= 5 && this.state.energyScore < 0.4)) {
      this.setMode("LATE_NIGHT_RECOVERY");
      return;
    }

    // Implicit State Inference from HTVD
    if (vibe?.cognitiveMode === "CODING_ARCHITECTURE") {
      this.setMode("DEEP_BUILD");
    } else if (vibe?.cognitiveMode === "LATE_NIGHT_REFLECTIVE" && (currentHour >= 23 || currentHour <= 6)) {
      this.setMode("LATE_NIGHT_RECOVERY");
    }
  }

  setMode(modeKey) {
    if (WORKING_MODES[modeKey] && this.state.currentMode !== modeKey) {
      const prev = this.state.currentMode;
      this.state.currentMode = modeKey;
      console.log(`🔀 [Behavior Engine] Operating Mode Shift: ${prev} ➔ ${modeKey} (${WORKING_MODES[modeKey].name})`);
      if (!this.state.modeHistory) this.state.modeHistory = [];
      this.state.modeHistory.push({ from: prev, to: modeKey, timestamp: Date.now() });
      if (this.state.modeHistory.length > 20) this.state.modeHistory.shift();
      this.saveState();
    }
  }

  getCurrentModeConfig() {
    return WORKING_MODES[this.state.currentMode] || WORKING_MODES.DEEP_BUILD;
  }

  /**
   * Generates the Master 24/7 Context Directive for askJarvis
   */
  get247ContextDirective(activeAgentName = "Tuk Tuk") {
    const currentMode = this.getCurrentModeConfig();
    const currentHour = new Date().getHours();
    const circadian = (this.getCircadianEnergy(currentHour) * 100).toFixed(0);
    const focus = (this.state.focusScore * 100).toFixed(0);
    const stress = (this.state.stressScore * 100).toFixed(0);

    return `
================================================================================
24/7 AUTONOMOUS OPERATING MODE & BEHAVIOR MODEL (AWBE):
🎯 Active Operating Mode: ${currentMode.name} (Lead: ${currentMode.leadAgent}, Support: ${currentMode.supportingAgent})
📊 Hritthik's Biometric & Workflow Vector:
   • Circadian Energy Potential: ${circadian}% (Hour: ${currentHour}:00)
   • Sustained Focus Index: ${focus}% (${this.continuousTurns} active turns this session)
   • Cognitive Strain / Stress: ${stress}%
⚡ Environmental Stance: ${currentMode.prompt}
🛠️ Sovereign Powers: You and the squad have full macOS access (Screen Perception, Antigravity Prompts, Terminal, Git).
================================================================================`;
  }

  /**
   * 5. Theory of Mind Cognitive Load & Flow Modulation Equation
   * CLI(t) = 0.45 * FocusScore + 0.35 * (1 / (1 + WordCount)) + 0.20 * CircadianStrain
   * MaxWords(t) = clamp(floor(24 * (1.2 - 0.7 * CLI(t))), 8, 32)
   */
  computeCognitiveLoadIndex(userSpeech = "", isIDEActive = true) {
    const words = (userSpeech || "").trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const focusWeight = (this.state.focusScore || 0.8) * 0.45;
    const brevityWeight = (1 / Math.max(1, wordCount)) * 0.35;
    const stressWeight = (this.state.stressScore || 0.1) * 0.20;
    const ideBoost = isIDEActive ? 0.08 : 0.0;

    const cli = Math.min(1.0, Math.max(0.0, focusWeight + brevityWeight + stressWeight + ideBoost));
    
    // Calculate target word limit (Deep Flow strictly clamped to 6-14 words)
    const targetWords = cli >= 0.70
      ? Math.max(6, Math.min(14, Math.floor(18 * (1.1 - 0.6 * cli))))
      : Math.max(8, Math.min(32, Math.floor(24 * (1.2 - 0.7 * cli))));
    
    let flowState = "STEADY_BUILD";
    if (cli >= 0.70) flowState = "DEEP_FLOW";
    else if (cli <= 0.35) flowState = "EXPLORATORY_STRATEGY";

    return {
      cli,
      targetWords,
      flowState,
      isDeepFlow: cli >= 0.70
    };
  }

  getStatusReport() {
    const mode = this.getCurrentModeConfig();
    const currentHour = new Date().getHours();
    const circadian = Math.round(this.getCircadianEnergy(currentHour) * 100);
    const focus = Math.round(this.state.focusScore * 100);
    return `Operating in ${mode.name}. Your circadian rhythm is at ${circadian}%, focus index is ${focus}%, and ${mode.leadAgent} is on point. All systems green.`;
  }
}

module.exports = {
  BehaviorModeEngine,
  WORKING_MODES
};
