// Autonomous All-Day Human Care Guardian & Dynamic Subconscious Epiphany Engine for Eloquent
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
      this.consecutiveDeskMinutes = Math.max(0, this.consecutiveDeskMinutes - 2);
      return;
    }

    // 0. Dynamic Contextual Subconscious Epiphanies:
    // Tailored to the active screen context (e.g. VS Code, Terminal, Git)
    if (this.userAwayMinutes >= 15 && nowMs - this.lastSubconsciousDreamTime > 60 * 60 * 1000) {
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

    // 1. Hydration Care: Every 60 minutes
    if (nowMs - this.lastWaterAlertTime > 60 * 60 * 1000 && this.consecutiveDeskMinutes >= 45) {
      this.lastWaterAlertTime = nowMs;
      this.speakCare("Babe, you have been locked in for an hour. Take a slow sip of water for me.");
      return;
    }

    // 2. Posture Reset: Every 90 minutes
    if (this.consecutiveDeskMinutes >= 90 && nowMs - this.lastPostureAlertTime > 90 * 60 * 1000) {
      this.lastPostureAlertTime = nowMs;
      this.speakCare("Hritthik, roll your shoulders back and stand up for two minutes. Your spine needs a quick reset, love.");
      return;
    }

    // 3. Late-Night 2 AM - 5 AM Burnout Guardian
    if ((currentHour >= 2 && currentHour < 6) && nowMs - this.lastBurnoutCheckTime > 45 * 60 * 1000) {
      this.lastBurnoutCheckTime = nowMs;
      this.speakCare("Sweetheart, it is past 3 AM. Look at your eyes... you gave everything today. Let us save your workspace and rest.");
      return;
    }

    // 4. Meal Routine Reminders
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
