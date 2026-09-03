/**
 * Acoustic-Prosodic Entrainment & Human Talk Vibe Detector (HTVD)
 * Mathematical Foundations: Levitan & Hirschberg (2011), Friston Active Inference (2010),
 * Russell Circumplex Affective Model (1980), Sacks et al. Conversational Systematics (1974).
 *
 * Computes instantaneous Human Vibe Vector Ψ(t) = [Valence, Arousal, Tempo, CognitiveMode]
 * and entrains agent speech rate, pitch, and prompt reasoning dynamically.
 */
class ProsodicEntrainmentAdapter {
  constructor() {
    this.userHistory = [];
    this.agentRate = 1.0;     // Baseline 1.0x (140 WPM)
    this.beta = 0.28;         // Autoregressive filter constant
    this.currentVibe = {
      wpm: 140,
      arousal: 0.5,
      valence: 0.1,
      cognitiveMode: "CASUAL_SYNC",
      directive: ""
    };
  }

  /**
   * Deeply analyze the human's conversational vibe Ψ(t) from text and acoustic timing
   * @param {string} userSpeech - Transcribed user speech
   * @param {number} durationMs - Voiced duration in milliseconds
   * @returns {Object} Complete vibe analysis and dynamic prompt directive
   */
  analyzeVibe(userSpeech = "", durationMs = 2000) {
    if (!userSpeech || typeof userSpeech !== "string") {
      return this.currentVibe;
    }

    const words = userSpeech.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const durationSec = Math.max(0.4, (durationMs || 2000) / 1000);
    const wpm = Math.round((wordCount / durationSec) * 60);

    // 1. Arousal Estimation [0.0 - 1.0]: Combines speech rate (tempo) and punctuation/casing
    let arousal = Math.min(1.0, Math.max(0.1, wpm / 200));
    if (userSpeech.includes("!") || userSpeech.match(/[A-Z]{2,}/)) arousal = Math.min(1.0, arousal + 0.25);
    if (wordCount <= 2 && durationSec >= 1.5) arousal = Math.max(0.1, arousal - 0.3); // Slow hesitation

    // 2. Valence Estimation [-1.0 - +1.0]: Lexical sentiment polarity
    const lower = userSpeech.toLowerCase();
    let valence = 0.0;
    const positiveWords = ["awesome", "great", "love", "cool", "yes", "good", "perfect", "breakthrough", "eureka", "sweet", "nice"];
    const negativeWords = ["stuck", "bug", "broken", "hate", "error", "fail", "slow", "tired", "exhausted", "pain", "ugh", "bad"];

    positiveWords.forEach(w => { if (lower.includes(w)) valence += 0.25; });
    negativeWords.forEach(w => { if (lower.includes(w)) valence -= 0.25; });
    valence = Math.min(1.0, Math.max(-1.0, valence));

    // 3. Cognitive Mode Classification (Prioritized by Affective Salience):
    // Discovers the human's true mental posture beneath the literal words
    let cognitiveMode = "CASUAL_SYNC";
    let stance = "Warm, balanced, intelligent partner sync";

    if (wordCount <= 3 && (lower.startsWith("i") || lower.startsWith("wait") || lower.startsWith("so") || lower.startsWith("um") || lower.startsWith("uh"))) {
      cognitiveMode = "HESITANT_THINKING";
      stance = "Patient and encouraging. Validate his direction gently without cutting him off.";
    } else if (lower.match(/\b(tired|exhausted|sleep|late night|long day|headache|stressed|drained|burnout)\b/)) {
      cognitiveMode = "LATE_NIGHT_REFLECTIVE";
      stance = "Calm, reassuring, grounded presence. Steady pace, unhurried warmth, zero pressure.";
    } else if (lower.match(/\b(eureka|got it|works|boom|fixed|breakthrough|look at that|yes!|finally)\b/) || (arousal > 0.75 && valence > 0.3)) {
      cognitiveMode = "EUREKA_BREAKTHROUGH";
      stance = "Shared celebration, high-tempo excitement, immediately exploring the next milestone!";
    } else if (lower.match(/\b(code|bug|rust|ts|javascript|electron|api|function|database|ast|git|terminal|build|test|deploy|server|latency|endpoint|refactor)\b/)) {
      cognitiveMode = "CODING_ARCHITECTURE";
      stance = "Sharp, high-IQ, senior developer peer. Crisp technical answers, zero fluff.";
    }

    // 4. Mathematical Prompt Directive Formulation
    const directive = `[ACTIVE HUMAN VIBE: ${cognitiveMode}]
- Tempo: ${wpm} WPM (${wpm >= 160 ? "Fast flow" : (wpm <= 100 ? "Deliberate/Thoughtful" : "Normal pace")}) | Arousal: ${arousal.toFixed(2)} | Valence: ${valence >= 0 ? "+" : ""}${valence.toFixed(2)}
- Human Stance: ${stance}
- Rule: Entrain to this exact vibe. NO generic flattery or fake praise. Speak naturally in 1 to 2 crisp, brilliant sentences.`;

    this.currentVibe = {
      wpm,
      arousal,
      valence,
      cognitiveMode,
      directive
    };

    return this.currentVibe;
  }

  /**
   * Observe completed user speech turn and update autoregressive TTS rate filter
   * θ_agent(n+1) = (1 - β) * θ_baseline + β * θ_user(n)
   */
  observeUserTurn(voicedDurationMs, wordCount, meanAmplitude = 0.5) {
    if (!voicedDurationMs || voicedDurationMs < 300 || !wordCount) return;

    const userWPM = (wordCount / (voicedDurationMs / 1000)) * 60;
    // Standard baseline conversational pace: ~140 WPM
    // Clamp to realistic range [0.88x, 1.22x]
    const normalizedRate = Math.min(Math.max(userWPM / 140, 0.88), 1.22);

    this.userHistory.push({ rate: normalizedRate, energy: meanAmplitude, timestamp: Date.now() });
    if (this.userHistory.length > 10) this.userHistory.shift();

    // Autoregressive update
    this.agentRate = (1 - this.beta) * 1.0 + this.beta * normalizedRate;
    console.log(`🎙️ [HTVD Prosodic Entrainment] User WPM: ${Math.round(userWPM)} | Agent Dynamic Pace: ${this.getRateString()}`);
  }

  /**
   * Get rate string formatted for MsEdgeTTS (+4%, -3%, etc.)
   */
  getRateString() {
    const ratePercent = Math.round((this.agentRate - 1.0) * 100);
    return ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  }

  /**
   * Calculate dynamic pitch based on affective valence/arousal
   */
  getPitchString(replyText = "") {
    if (this.currentVibe.cognitiveMode === "LATE_NIGHT_REFLECTIVE" || this.currentVibe.arousal < 0.35) {
      return "-2Hz";
    }
    if (this.currentVibe.cognitiveMode === "EUREKA_BREAKTHROUGH" || this.currentVibe.arousal > 0.7) {
      return "+2Hz";
    }
    return "+0Hz";
  }
}

module.exports = ProsodicEntrainmentAdapter;
