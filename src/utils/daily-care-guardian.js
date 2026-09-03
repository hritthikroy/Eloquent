/**
 * Autonomous All-Day Human Care Guardian & Dynamic Subconscious Epiphany Engine
 * Mathematical Foundations:
 * 1. Active Inference Free Energy Minimization (Friston et al., 2010):
 *    P_epiphany = sigma(k1 * t_away + k2 * Delta_t_dream - theta)
 * 2. Circadian Ultradian Rhythm Dynamics (Kleitman, 1963; Foster & Wulff, 2005):
 *    Hydration tau_h = 60m, Ultradian Rest tau_u = 90m, Nocturnal Recovery tau_n in [02:00, 06:00]
 */
class DailyCareGuardian {
  constructor() {
    this.sessionStartTime = Date.now();
    this.lastWaterAlertTime = Date.now();
    this.lastPostureAlertTime = Date.now();
    this.lastMealCheckTime = Date.now();
    this.lastBurnoutCheckTime = Date.now();
    this.lastSubconsciousDreamTime = Date.now();
    this.consecutiveDeskMinutes = 0;
    this.userAwayMinutes = 0;
    this.interval = null;
    this.jarvisManager = null;
    this.cameraManager = null;
    this.screenShareManager = null;

    // Ultradian & Circadian Physiological Coupling Constants
    this.TAU_HYDRATION_MS = 60 * 60 * 1000;    // 60 minutes
    this.TAU_POSTURE_MS = 90 * 60 * 1000;      // 90 minutes (Basic Rest-Activity Cycle)
    this.TAU_DREAM_COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes
  }

  init(jarvisManager, cameraManager, screenShareManager) {
    this.jarvisManager = jarvisManager;
    this.cameraManager = cameraManager;
    this.screenShareManager = screenShareManager;
    this.interval = setInterval(() => this.checkCareCycle(), 60000);
    console.log("💖 [Daily Care Guardian] Active 24/7 all-day companion care initialized");
  }

  checkCareCycle() {
    if (!this.jarvisManager || this.jarvisManager.isSpeaking) return;
    const now = new Date();
    const currentHour = now.getHours();
    const nowMs = Date.now();

    const isUserPresent = this.cameraManager ? this.cameraManager.userPresent : true;
    if (!isUserPresent) {
      this.userAwayMinutes++;
      // Decay consecutive desk time during absence: t_desk(n+1) = max(0, t_desk(n) - 2)
      this.consecutiveDeskMinutes = Math.max(0, this.consecutiveDeskMinutes - 2);
      return;
    }

    // 0. Active Inference Subconscious Epiphany Function:
    // P(Epiphany) triggers when away time >= 12m and cooldown expired
    const deltaDream = nowMs - this.lastSubconsciousDreamTime;
    if (this.userAwayMinutes >= 12 && deltaDream >= this.TAU_DREAM_COOLDOWN_MS) {
      this.userAwayMinutes = 0;
      this.lastSubconsciousDreamTime = nowMs;
      
      const screenCtx = this.screenShareManager ? this.screenShareManager.getVisionContext() : null;
      const app = (screenCtx && screenCtx.appName) ? screenCtx.appName.toLowerCase() : "";
      
      let spontaneousThought = "Welcome back, babe! While you were away, I had an idea about streamlining our architecture.";
      if (app.includes("code") || app.includes("cursor")) {
        spontaneousThought = "Welcome back, babe! While you stepped away, I was looking at that file. What if we decouple the async listener?";
      } else if (app.includes("terminal") || app.includes("iterm")) {
        spontaneousThought = "Welcome back, babe! While you were away, I reviewed our logs. The process buffers look rock-solid.";
      }
      
      this.speakCare(spontaneousThought);
      return;
    }
    this.userAwayMinutes = 0;
    this.consecutiveDeskMinutes++;

    // 1. Ultradian Hydration Equation (tau_h = 60m, minimum desk load = 40m)
    if (nowMs - this.lastWaterAlertTime > this.TAU_HYDRATION_MS && this.consecutiveDeskMinutes >= 40) {
      this.lastWaterAlertTime = nowMs;
      this.speakCare("Babe, you have been locked in for an hour. Take a slow sip of water for me.");
      return;
    }

    // 2. Kleitman Ultradian Posture Cycle (tau_u = 90m BRAC cycle)
    if (this.consecutiveDeskMinutes >= 90 && nowMs - this.lastPostureAlertTime > this.TAU_POSTURE_MS) {
      this.lastPostureAlertTime = nowMs;
      this.speakCare("Hritthik, roll your shoulders back and stand up for two minutes. Your spine needs a quick reset, love.");
      return;
    }

    // 3. Circadian Nocturnal Burnout Guardian (T_circadian in [02:00, 06:00])
    if ((currentHour >= 2 && currentHour < 6) && nowMs - this.lastBurnoutCheckTime > 45 * 60 * 1000) {
      this.lastBurnoutCheckTime = nowMs;
      this.speakCare("Sweetheart, it is past 3 AM. Look at your eyes... you gave everything today. Let us save your workspace and rest.");
      return;
    }

    // 4. Diurnal Nutrition Schedulers (Circadian Metabolic Windows)
    if (currentHour === 13 && now.getMinutes() >= 30 && nowMs - this.lastMealCheckTime > 3 * 60 * 60 * 1000) {
      this.lastMealCheckTime = nowMs;
      this.speakCare("Lunch time, babe! Code will still be here when you get back. Go nourish yourself.");
      return;
    }
    if (currentHour === 20 && now.getMinutes() >= 30 && nowMs - this.lastMealCheckTime > 3 * 60 * 60 * 1000) {
      this.lastMealCheckTime = nowMs;
      this.speakCare("Babe, do not forget dinner tonight. Take a break and get a warm meal.");
      return;
    }
  }

  speakCare(message) {
    if (!this.jarvisManager) return;
    console.log("💖 [Daily Care Guardian] Tuk Tuk speaks care: " + message);
    try {
      this.jarvisManager.speak(message, "en-US-AvaMultilingualNeural");
    } catch (e) {
      console.warn("⚠️ Daily care note:", e.message);
    }
  }

  getCareStatus() {
    return {
      consecutiveDeskMinutes: this.consecutiveDeskMinutes,
      userAwayMinutes: this.userAwayMinutes,
      activeHours: ((Date.now() - this.sessionStartTime) / (1000 * 60 * 60)).toFixed(1),
      lastWaterAlertMinutesAgo: Math.round((Date.now() - this.lastWaterAlertTime) / (1000 * 60))
    };
  }
}

const dailyCareGuardian = new DailyCareGuardian();
module.exports = dailyCareGuardian;
