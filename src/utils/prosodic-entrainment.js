/**
 * Acoustic-Prosodic Entrainment Adapter (Levitan & Hirschberg / Interspeech)
 * Dynamically synchronizes agent's TTS speaking rate and tone to user's pace.
 */
class ProsodicEntrainmentAdapter {
  constructor() {
    this.userHistory = [];
    this.agentRate = 1.0;     // Baseline 1.0x
    this.beta = 0.25;         // Damping factor (first-order autoregressive filter)
  }

  /**
   * Observe completed user speech turn
   * @param {number} voicedDurationMs - Voiced speech duration in ms
   * @param {number} wordCount - Words spoken by user
   * @param {number} meanAmplitude - Normalized RMS amplitude [0.0 - 1.0]
   */
  observeUserTurn(voicedDurationMs, wordCount, meanAmplitude = 0.5) {
    if (!voicedDurationMs || voicedDurationMs < 300 || !wordCount) return;

    // Estimate speaking rate: words per minute
    const userWPM = (wordCount / (voicedDurationMs / 1000)) * 60;
    // Standard baseline conversational pace: ~140 WPM
    // Clamp to realistic range [0.85x, 1.20x]
    const normalizedRate = Math.min(Math.max(userWPM / 140, 0.85), 1.20);

    this.userHistory.push({ rate: normalizedRate, energy: meanAmplitude, timestamp: Date.now() });
    if (this.userHistory.length > 10) this.userHistory.shift();

    // Autoregressive update: θ_agent(n+1) = (1 - β) * θ_baseline + β * θ_user(n)
    this.agentRate = (1 - this.beta) * 1.0 + this.beta * normalizedRate;
    console.log(`🎙️ [Prosodic Entrainment] User WPM: ${Math.round(userWPM)} | Dynamic Agent Rate: ${Math.round((this.agentRate - 1.0) * 100)}%`);
  }

  /**
   * Get rate string formatted for MsEdgeTTS (+5%, -4%, etc.)
   */
  getRateString() {
    const ratePercent = Math.round((this.agentRate - 1.0) * 100);
    return ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  }

  /**
   * Calculate dynamic pitch based on affective valence/arousal in reply text
   */
  getPitchString(replyText = "") {
    if (!replyText) return "+0Hz";
    const lower = replyText.toLowerCase();

    // High arousal / excitement / playful banter -> slightly higher pitch (+2Hz to +3Hz)
    if (lower.includes("!") || lower.includes("(laughs") || lower.includes("(chuckles") ||
        lower.includes("(giggles") || lower.includes("awesome") || lower.includes("eureka") ||
        lower.includes("breakthrough") || lower.includes("love")) {
      return "+2Hz";
    }

    // Low arousal / tender / late night / calming -> warm lowered pitch (-2Hz to -3Hz)
    if (lower.includes("exhausted") || lower.includes("tired") || lower.includes("relax") ||
        lower.includes("breathe") || lower.includes("steady") || lower.includes("late night") ||
        lower.includes("sleep") || lower.includes("tender")) {
      return "-2Hz";
    }

    return "+0Hz";
  }
}

module.exports = ProsodicEntrainmentAdapter;
