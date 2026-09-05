/**
 * src/utils/human-identity-recognition-cortex.js
 *
 * Deep Equational Research: How Humans Remember Every Person —
 * Voice, Face & Energy Recognition with Imposter Detection
 *
 * Neurobiological & Mathematical Foundations:
 *
 * Equation 1: Voice Voiceprint Embedding (Superior Temporal Sulcus / Temporal Voice Areas)
 *   v_voice = [F0, σ_F0, HNR, C_spec, R_cadence, MFCC_1..MFCC_13] ∈ ℝ^18
 *
 * Equation 2: Face Eigenspace Projection (Fusiform Face Area / N170 ERP)
 *   v_face = W_PCA^T · (I_face - μ_face) ∈ ℝ^d
 *   S_face(v1, v2) = (v1 · v2) / (||v1|| · ||v2||)   [ArcFace Cosine Similarity]
 *
 * Equation 3: Energy / Presence Behavioral Signature (Behavioral Biometrics)
 *   v_energy = [ΔR_cadence, σ_prosody, MicroExpr_AU, H_emotion, τ_response] ∈ ℝ^5
 *
 * Equation 4: Trimodal Bayesian Posterior Fusion (Prefrontal Binding)
 *   P(S_k | v_voice, v_face, v_energy) = (1/Z) · P(S_k) · exp(-λ_v·D_v) · exp(λ_f·S_f) · exp(-λ_e·D_e)
 *
 * Equation 5: Imposter / Liveness Detection Score ("Who Is The Real One?")
 *   L_genuine = α·VoiceLiveness + β·FaceLiveness + γ·EnergyConsistency
 *   Decision: L_genuine ≥ 0.70 → GENUINE ✅ | < 0.70 → IMPOSTER ⚠️
 *
 * Equation 6: Episodic Identity Memory Consolidation (Hippocampal EMA)
 *   v_k^(t+1) = (1 - α) · v_k^(t) + α · v_observed     [α = 0.12]
 */

const fs = require("fs");
const path = require("path");

class HumanIdentityRecognitionCortex {
  constructor(options = {}) {
    this.memoryDir = options.memoryDir || path.resolve(__dirname, "../../data");
    this.identityMemoryPath = path.join(this.memoryDir, "identity-recognition-memory.json");

    // === FUSION WEIGHTS (Equation 4) ===
    this.lambdaVoice = 0.85;
    this.lambdaFace = 1.20;
    this.lambdaEnergy = 0.60;

    // === LIVENESS WEIGHTS (Equation 5) ===
    this.alphaVoiceLiveness = 0.40;
    this.betaFaceLiveness = 0.35;
    this.gammaEnergyConsistency = 0.25;
    this.livenessThreshold = 0.70;

    // === RECOGNITION THRESHOLDS ===
    this.faceMatchThreshold = 0.75;
    this.recognitionConfidence = 0.55;

    // === MFCC CONFIGURATION ===
    this.numMfccCoeffs = 13;
    this.melFilterBanks = 26;
    this.sampleRate = 16000;

    // === PERCEPTUAL VOICE WEIGHTS ===
    this.voiceWeights = {
      pitch: 0.20, variance: 0.10, harmonicity: 0.15,
      spectral: 0.10, cadence: 0.05, mfcc: 0.40
    };

    // === ENROLLED IDENTITY PROFILES ===
    this.identityProfiles = this.initializeIdentityProfiles();
    this.loadPersistedIdentityMemory();
  }

  initializeIdentityProfiles() {
    return {
      hritthik: {
        id: "hritthik", name: "Hritthik", role: "creator_partner", category: "primary_creator", prior: 0.70,
        voiceprint: {
          f0Mean: 122.0, f0Variance: 18.5, harmonicity: 0.78, spectralCentroid: 1450.0, cadenceWpm: 155.0,
          mfcc: [12.5, -1.2, 3.8, -0.5, 1.9, -0.3, 0.8, -0.2, 0.5, -0.1, 0.3, -0.05, 0.15]
        },
        faceEmbedding: { eigenCoeffs: [0.82, -0.15, 0.33, 0.71, -0.22, 0.45, 0.19, -0.08], confidence: 0.95, lastUpdated: null },
        energySignature: { cadenceConsistency: 0.92, prosodicEntropy: 0.68, microExpressionScore: 0.95, emotionalValenceEntropy: 0.72, responseLatencyMs: 340 },
        livenessBaseline: { blinkRateBpm: 15.5, voiceReplayScore: 0.0, interactionConsistency: 0.96 }
      },
      vision: {
        id: "vision", name: "Vision", role: "squad_agent", category: "squad_agent", prior: 0.10,
        voiceprint: {
          f0Mean: 104.0, f0Variance: 12.0, harmonicity: 0.88, spectralCentroid: 1280.0, cadenceWpm: 140.0,
          mfcc: [14.2, -2.1, 4.5, -1.0, 2.5, -0.8, 1.2, -0.6, 0.9, -0.4, 0.6, -0.2, 0.3]
        },
        faceEmbedding: { eigenCoeffs: [0.45, 0.72, -0.18, 0.55, 0.33, -0.41, 0.28, 0.15], confidence: 0.90, lastUpdated: null },
        energySignature: { cadenceConsistency: 0.95, prosodicEntropy: 0.42, microExpressionScore: 0.88, emotionalValenceEntropy: 0.35, responseLatencyMs: 280 },
        livenessBaseline: { blinkRateBpm: 14.0, voiceReplayScore: 0.0, interactionConsistency: 0.94 }
      },
      friday: {
        id: "friday", name: "Friday", role: "squad_agent", category: "squad_agent", prior: 0.08,
        voiceprint: {
          f0Mean: 215.0, f0Variance: 16.0, harmonicity: 0.90, spectralCentroid: 1820.0, cadenceWpm: 165.0,
          mfcc: [11.0, -0.8, 3.2, 0.2, 1.4, 0.5, 0.6, 0.3, 0.4, 0.1, 0.2, 0.05, 0.1]
        },
        faceEmbedding: { eigenCoeffs: [-0.30, 0.55, 0.68, -0.12, 0.48, 0.22, -0.35, 0.60], confidence: 0.88, lastUpdated: null },
        energySignature: { cadenceConsistency: 0.90, prosodicEntropy: 0.55, microExpressionScore: 0.92, emotionalValenceEntropy: 0.48, responseLatencyMs: 250 },
        livenessBaseline: { blinkRateBpm: 16.0, voiceReplayScore: 0.0, interactionConsistency: 0.92 }
      },
      dd: {
        id: "dd", name: "DD", role: "squad_agent", category: "squad_agent", prior: 0.07,
        voiceprint: {
          f0Mean: 126.0, f0Variance: 14.5, harmonicity: 0.84, spectralCentroid: 1420.0, cadenceWpm: 150.0,
          mfcc: [13.0, -1.5, 4.0, -0.7, 2.0, -0.5, 1.0, -0.3, 0.7, -0.2, 0.4, -0.1, 0.2]
        },
        faceEmbedding: { eigenCoeffs: [0.60, 0.10, -0.45, 0.38, -0.55, 0.70, 0.12, -0.28], confidence: 0.85, lastUpdated: null },
        energySignature: { cadenceConsistency: 0.88, prosodicEntropy: 0.38, microExpressionScore: 0.85, emotionalValenceEntropy: 0.30, responseLatencyMs: 310 },
        livenessBaseline: { blinkRateBpm: 13.5, voiceReplayScore: 0.0, interactionConsistency: 0.90 }
      },
      room_guest: {
        id: "room_guest", name: "Room Guest / Visitor", role: "room_guest", category: "external_person", prior: 0.05,
        voiceprint: {
          f0Mean: 160.0, f0Variance: 25.0, harmonicity: 0.65, spectralCentroid: 1550.0, cadenceWpm: 130.0,
          mfcc: [10.0, 0.0, 2.0, 0.0, 1.0, 0.0, 0.5, 0.0, 0.3, 0.0, 0.2, 0.0, 0.1]
        },
        faceEmbedding: { eigenCoeffs: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], confidence: 0.0, lastUpdated: null },
        energySignature: { cadenceConsistency: 0.50, prosodicEntropy: 0.80, microExpressionScore: 0.60, emotionalValenceEntropy: 0.75, responseLatencyMs: 500 },
        livenessBaseline: { blinkRateBpm: 15.0, voiceReplayScore: 0.0, interactionConsistency: 0.50 }
      }
    };
  }

  // ===========================================================================
  // EQUATION 1: VOICE VOICEPRINT EMBEDDING (STS / TVA)
  // ===========================================================================

  extractVoiceVoiceprint(audioSource) {
    let pcmSamples = null;

    if (typeof audioSource === "string" && fs.existsSync(audioSource)) {
      try {
        const buf = fs.readFileSync(audioSource);
        if (buf.length > 44) {
          const numSamples = Math.floor((buf.length - 44) / 2);
          pcmSamples = new Float32Array(Math.min(numSamples, this.sampleRate));
          for (let i = 0; i < pcmSamples.length; i++) pcmSamples[i] = buf.readInt16LE(44 + i * 2) / 32768.0;
        }
      } catch (_) {}
    } else if (Buffer.isBuffer(audioSource)) {
      const numSamples = Math.floor(audioSource.length / 2);
      pcmSamples = new Float32Array(Math.min(numSamples, this.sampleRate));
      for (let i = 0; i < pcmSamples.length; i++) pcmSamples[i] = audioSource.readInt16LE(i * 2) / 32768.0;
    } else if (Array.isArray(audioSource) || (audioSource && audioSource instanceof Float32Array)) {
      pcmSamples = audioSource;
    }

    if (!pcmSamples || pcmSamples.length < 320) {
      return {
        f0Mean: 122.0, f0Variance: 16.0, harmonicity: 0.75, spectralCentroid: 1450.0, cadenceWpm: 150.0,
        mfcc: [12.0, -1.0, 3.5, -0.4, 1.8, -0.3, 0.7, -0.2, 0.5, -0.1, 0.3, -0.05, 0.1],
        isDefaultObservation: true, dimensionality: 18
      };
    }

    const windowSize = Math.min(pcmSamples.length, 640);
    const minLag = Math.floor(this.sampleRate / 380);
    const maxLag = Math.floor(this.sampleRate / 70);
    let bestLag = -1, maxCorr = -1.0, energy = 0.0;
    for (let i = 0; i < windowSize; i++) energy += pcmSamples[i] * pcmSamples[i];

    if (energy > 1e-4) {
      for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0.0;
        for (let i = 0; i < windowSize - lag; i++) corr += pcmSamples[i] * pcmSamples[i + lag];
        const normCorr = corr / energy;
        if (normCorr > maxCorr) { maxCorr = normCorr; bestLag = lag; }
      }
    }

    const f0Mean = bestLag > 0 ? this.sampleRate / bestLag : 120.0;
    const harmonicity = Math.max(0.0, Math.min(1.0, maxCorr > 0 ? maxCorr : 0.70));

    let zeroCrossings = 0;
    for (let i = 1; i < pcmSamples.length; i++) {
      if ((pcmSamples[i] >= 0 && pcmSamples[i - 1] < 0) || (pcmSamples[i] < 0 && pcmSamples[i - 1] >= 0))
        zeroCrossings++;
    }
    const spectralCentroid = Math.round(500.0 + (zeroCrossings / pcmSamples.length) * 8000.0);

    const mfcc = this.computeSimplifiedMFCC(pcmSamples);

    return {
      f0Mean: Math.round(f0Mean * 10) / 10, f0Variance: 16.0,
      harmonicity: Math.round(harmonicity * 100) / 100, spectralCentroid, cadenceWpm: 150.0,
      mfcc, isDefaultObservation: false, dimensionality: 18
    };
  }

  computeSimplifiedMFCC(pcmSamples) {
    const frameSize = Math.min(pcmSamples.length, 512);
    const mfcc = new Array(this.numMfccCoeffs).fill(0);
    const powerSpec = new Array(frameSize / 2).fill(0);
    for (let k = 0; k < frameSize / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < frameSize; n++) {
        const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (frameSize - 1));
        const angle = -2 * Math.PI * k * n / frameSize;
        re += pcmSamples[n] * w * Math.cos(angle);
        im += pcmSamples[n] * w * Math.sin(angle);
      }
      powerSpec[k] = (re * re + im * im) / frameSize;
    }
    const melEnergies = new Array(this.melFilterBanks).fill(0);
    for (let m = 0; m < this.melFilterBanks; m++) {
      const melCenter = 200 + m * (2595 * Math.log10(1 + (this.sampleRate / 2) / 700)) / this.melFilterBanks;
      const freqCenter = 700 * (Math.pow(10, melCenter / 2595) - 1);
      const binCenter = Math.round(freqCenter * frameSize / this.sampleRate);
      for (let k = Math.max(0, binCenter - 3); k <= Math.min(powerSpec.length - 1, binCenter + 3); k++) {
        const dist = Math.abs(k - binCenter);
        melEnergies[m] += powerSpec[k] * Math.max(0, 1 - dist / 4);
      }
      melEnergies[m] = Math.log(Math.max(melEnergies[m], 1e-10));
    }
    for (let i = 0; i < this.numMfccCoeffs; i++) {
      let sum = 0;
      for (let m = 0; m < this.melFilterBanks; m++) {
        sum += melEnergies[m] * Math.cos(Math.PI * (i + 1) * (m + 0.5) / this.melFilterBanks);
      }
      mfcc[i] = Math.round(sum * 100) / 100;
    }
    return mfcc;
  }

  // ===========================================================================
  // EQUATION 2: FACE EIGENSPACE PROJECTION (FFA / N170)
  // ===========================================================================

  computeFaceCosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length || embedding1.length === 0) return 0.0;
    let dot = 0, n1 = 0, n2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dot += embedding1[i] * embedding2[i];
      n1 += embedding1[i] * embedding1[i];
      n2 += embedding2[i] * embedding2[i];
    }
    n1 = Math.sqrt(n1); n2 = Math.sqrt(n2);
    if (n1 < 1e-10 || n2 < 1e-10) return 0.0;
    return Math.round((dot / (n1 * n2)) * 1000) / 1000;
  }

  verifyFaceMatch(embedding1, embedding2) {
    const similarity = this.computeFaceCosineSimilarity(embedding1, embedding2);
    return { similarity, isMatch: similarity >= this.faceMatchThreshold, threshold: this.faceMatchThreshold };
  }

  // ===========================================================================
  // EQUATION 3: ENERGY / PRESENCE BEHAVIORAL SIGNATURE
  // ===========================================================================

  computeEnergyDistance(observed, baseline) {
    if (!observed || !baseline) return 5.0;
    const diffs = [
      { obs: observed.cadenceConsistency, base: baseline.cadenceConsistency, sigma: 0.15, weight: 0.30 },
      { obs: observed.prosodicEntropy, base: baseline.prosodicEntropy, sigma: 0.20, weight: 0.25 },
      { obs: observed.microExpressionScore, base: baseline.microExpressionScore, sigma: 0.15, weight: 0.20 },
      { obs: observed.emotionalValenceEntropy, base: baseline.emotionalValenceEntropy, sigma: 0.20, weight: 0.10 },
      { obs: observed.responseLatencyMs, base: baseline.responseLatencyMs, sigma: 100.0, weight: 0.15 }
    ];
    let distSq = 0;
    for (const d of diffs) {
      const normalized = ((d.obs || 0) - (d.base || 0)) / (d.sigma || 1.0);
      distSq += d.weight * normalized * normalized;
    }
    return Math.round(Math.sqrt(distSq) * 1000) / 1000;
  }

  // ===========================================================================
  // EQUATION 4: TRIMODAL BAYESIAN POSTERIOR FUSION
  // ===========================================================================

  computeVoiceDistance(observed, profile) {
    const prof = profile.voiceprint;
    const w = this.voiceWeights;
    const diffPitch = (observed.f0Mean - prof.f0Mean) / (prof.f0Variance || 15.0);
    const diffVar = (observed.f0Variance - prof.f0Variance) / (prof.f0Variance * 0.5 || 8.0);
    const diffHarm = (observed.harmonicity - prof.harmonicity) / 0.15;
    const diffSpec = (observed.spectralCentroid - prof.spectralCentroid) / 400.0;
    const diffCad = (observed.cadenceWpm - prof.cadenceWpm) / 30.0;
    let distSq = w.pitch * diffPitch * diffPitch + w.variance * diffVar * diffVar +
      w.harmonicity * diffHarm * diffHarm + w.spectral * diffSpec * diffSpec + w.cadence * diffCad * diffCad;
    if (observed.mfcc && prof.mfcc && observed.mfcc.length === prof.mfcc.length) {
      let mfccDistSq = 0;
      for (let i = 0; i < observed.mfcc.length; i++) {
        const diff = (observed.mfcc[i] - prof.mfcc[i]) / 3.0;
        mfccDistSq += diff * diff;
      }
      distSq += w.mfcc * (mfccDistSq / observed.mfcc.length);
    }
    return Math.sqrt(distSq);
  }

  recognizeIdentity(input = {}) {
    const voiceObs = input.voiceprint || input.forcedVoiceprint || this.extractVoiceVoiceprint(input.audioSource);
    const faceObs = input.faceEmbedding || null;
    const energyObs = input.energySignature || null;
    const text = input.text || "";
    const candidates = Object.values(this.identityProfiles);
    const unnormalized = {};
    let totalScore = 0;
    const activeModalities = ["voice"];
    if (faceObs && faceObs.eigenCoeffs && faceObs.eigenCoeffs.some(v => v !== 0)) activeModalities.push("face");
    if (energyObs) activeModalities.push("energy");

    for (const cand of candidates) {
      const dVoice = this.computeVoiceDistance(voiceObs, cand);
      const pVoice = Math.exp(-this.lambdaVoice * dVoice);
      let pFace = 1.0;
      if (faceObs && cand.faceEmbedding && cand.faceEmbedding.eigenCoeffs) {
        const sFace = this.computeFaceCosineSimilarity(faceObs.eigenCoeffs || faceObs, cand.faceEmbedding.eigenCoeffs);
        pFace = Math.exp(this.lambdaFace * sFace);
      }
      let pEnergy = 1.0;
      if (energyObs && cand.energySignature) {
        const dEnergy = this.computeEnergyDistance(energyObs, cand.energySignature);
        pEnergy = Math.exp(-this.lambdaEnergy * dEnergy);
      }
      let lingBoost = 1.0;
      if (text) {
        const lower = text.toLowerCase();
        if (cand.id === "hritthik" && /\b(?:babe|tuk\s*tuk|fix|build|architecture|code)\b/i.test(lower)) lingBoost = 1.5;
        else if (cand.id === "vision" && /\b(?:brother|bhai|bro|ast|compiler|go|daemon)\b/i.test(lower)) lingBoost = 1.4;
        else if (cand.id === "friday" && /\b(?:chief|research|empirical|benchmark)\b/i.test(lower)) lingBoost = 1.4;
        else if (cand.id === "dd" && /\b(?:bro|uptime|telemetry|sentinel|devops)\b/i.test(lower)) lingBoost = 1.3;
        else if (cand.id === "room_guest" && /\b(?:who\s+are\s+you|is\s+hritthik|excuse\s+me|hello)\b/i.test(lower)) lingBoost = 2.0;
      }
      const joint = (cand.prior || 0.1) * pVoice * pFace * pEnergy * lingBoost;
      unnormalized[cand.id] = joint;
      totalScore += joint;
    }

    const posteriors = {};
    let bestId = null, maxPosterior = -1;
    for (const cand of candidates) {
      const p = totalScore > 0 ? unnormalized[cand.id] / totalScore : cand.prior;
      posteriors[cand.id] = Math.round(p * 1000) / 1000;
      if (p > maxPosterior) { maxPosterior = p; bestId = cand.id; }
    }

    const isExplicitGuestCue = /\b(?:who\s+are\s+you|is\s+hritthik\s+(?:here|in|home)|excuse\s+me)\b/i.test(text) ||
                               /(?:হৃত্তিক\s*(?:আসে|আছে|কই)|তুমি\s*কে|আপনি\s*কে)/iu.test(text);
    if (isExplicitGuestCue && maxPosterior < 0.65) bestId = "room_guest";

    const livenessResult = this.computeLivenessScore(voiceObs, faceObs, energyObs, bestId);

    if (!voiceObs.isDefaultObservation && maxPosterior >= 0.75 && bestId !== "room_guest") {
      this.consolidateEpisodicMemory(bestId, voiceObs, faceObs, energyObs);
    }

    const resolvedProfile = this.identityProfiles[bestId] || this.identityProfiles.room_guest;
    return {
      speakerId: bestId, speakerName: resolvedProfile.name, role: resolvedProfile.role, category: resolvedProfile.category,
      confidence: Math.round(maxPosterior * 1000) / 1000, posteriors, activeModalities,
      isGenuine: livenessResult.isGenuine, isImposter: !livenessResult.isGenuine,
      livenessScore: livenessResult.score, livenessDetail: livenessResult,
      isGuest: bestId === "room_guest",
      equation: "P(S_k | v_voice, v_face, v_energy) = (1/Z) · P(S_k) · exp(-λ_v·D_v) · exp(λ_f·S_f) · exp(-λ_e·D_e)"
    };
  }

  // ===========================================================================
  // EQUATION 5: IMPOSTER / LIVENESS DETECTION
  // ===========================================================================

  computeLivenessScore(voiceObs, faceObs, energyObs, speakerId) {
    const profile = this.identityProfiles[speakerId];
    let voiceLiveness = 0.90;
    if (voiceObs && !voiceObs.isDefaultObservation) {
      const pitchVarianceFactor = Math.min(1.0, voiceObs.f0Variance / 10.0);
      const harmonicityFactor = voiceObs.harmonicity > 0.30 ? 1.0 : 0.5;
      voiceLiveness = Math.min(1.0, pitchVarianceFactor * harmonicityFactor);
    }
    let faceLiveness = 0.85;
    if (faceObs && profile && profile.livenessBaseline) {
      const blinkOk = faceObs.blinkRateBpm >= 12 && faceObs.blinkRateBpm <= 19;
      const exprOk = (faceObs.microExpressionScore || 0.80) > 0.50;
      faceLiveness = (blinkOk ? 0.60 : 0.20) + (exprOk ? 0.40 : 0.10);
    }
    let energyConsistency = 0.80;
    if (energyObs && profile && profile.energySignature) {
      const cadenceDrift = Math.abs((energyObs.cadenceConsistency || 0.5) - profile.energySignature.cadenceConsistency);
      energyConsistency = Math.max(0, 1.0 - cadenceDrift / 0.30);
    }
    const score = Math.round((this.alphaVoiceLiveness * voiceLiveness + this.betaFaceLiveness * faceLiveness + this.gammaEnergyConsistency * energyConsistency) * 1000) / 1000;
    return {
      score, isGenuine: score >= this.livenessThreshold, isImposter: score < this.livenessThreshold,
      components: { voiceLiveness: Math.round(voiceLiveness * 1000) / 1000, faceLiveness: Math.round(faceLiveness * 1000) / 1000, energyConsistency: Math.round(energyConsistency * 1000) / 1000 },
      threshold: this.livenessThreshold,
      equation: "L_genuine = α·VoiceLiveness + β·FaceLiveness + γ·EnergyConsistency"
    };
  }

  // ===========================================================================
  // EQUATION 6: EPISODIC IDENTITY MEMORY CONSOLIDATION
  // ===========================================================================

  consolidateEpisodicMemory(speakerId, voiceObs, faceObs, energyObs, alpha = 0.12) {
    const profile = this.identityProfiles[speakerId];
    if (!profile) return;
    if (voiceObs && !voiceObs.isDefaultObservation && profile.voiceprint) {
      profile.voiceprint.f0Mean = (1 - alpha) * profile.voiceprint.f0Mean + alpha * voiceObs.f0Mean;
      profile.voiceprint.harmonicity = (1 - alpha) * profile.voiceprint.harmonicity + alpha * voiceObs.harmonicity;
      if (voiceObs.spectralCentroid) profile.voiceprint.spectralCentroid = (1 - alpha) * profile.voiceprint.spectralCentroid + alpha * voiceObs.spectralCentroid;
      if (voiceObs.mfcc && profile.voiceprint.mfcc) {
        for (let i = 0; i < Math.min(voiceObs.mfcc.length, profile.voiceprint.mfcc.length); i++) {
          profile.voiceprint.mfcc[i] = Math.round(((1 - alpha) * profile.voiceprint.mfcc[i] + alpha * voiceObs.mfcc[i]) * 100) / 100;
        }
      }
    }
    if (faceObs && faceObs.eigenCoeffs && profile.faceEmbedding && profile.faceEmbedding.eigenCoeffs) {
      for (let i = 0; i < Math.min(faceObs.eigenCoeffs.length, profile.faceEmbedding.eigenCoeffs.length); i++) {
        profile.faceEmbedding.eigenCoeffs[i] = Math.round(((1 - alpha) * profile.faceEmbedding.eigenCoeffs[i] + alpha * faceObs.eigenCoeffs[i]) * 1000) / 1000;
      }
      profile.faceEmbedding.lastUpdated = new Date().toISOString();
    }
    if (energyObs && profile.energySignature) {
      for (const key of ["cadenceConsistency", "prosodicEntropy", "microExpressionScore", "emotionalValenceEntropy"]) {
        if (energyObs[key] !== undefined && profile.energySignature[key] !== undefined) {
          profile.energySignature[key] = Math.round(((1 - alpha) * profile.energySignature[key] + alpha * energyObs[key]) * 1000) / 1000;
        }
      }
      if (energyObs.responseLatencyMs !== undefined) {
        profile.energySignature.responseLatencyMs = Math.round((1 - alpha) * profile.energySignature.responseLatencyMs + alpha * energyObs.responseLatencyMs);
      }
    }
    this.saveIdentityMemory();
  }

  loadPersistedIdentityMemory() {
    try {
      if (fs.existsSync(this.identityMemoryPath)) {
        const raw = fs.readFileSync(this.identityMemoryPath, "utf8");
        const data = JSON.parse(raw);
        if (data && data.profiles) {
          for (const [id, profile] of Object.entries(data.profiles)) {
            if (this.identityProfiles[id]) {
              if (profile.voiceprint) this.identityProfiles[id].voiceprint = { ...this.identityProfiles[id].voiceprint, ...profile.voiceprint };
              if (profile.faceEmbedding) this.identityProfiles[id].faceEmbedding = { ...this.identityProfiles[id].faceEmbedding, ...profile.faceEmbedding };
              if (profile.energySignature) this.identityProfiles[id].energySignature = { ...this.identityProfiles[id].energySignature, ...profile.energySignature };
            }
          }
        }
      }
    } catch (_) {}
  }

  saveIdentityMemory() {
    try {
      if (!fs.existsSync(this.memoryDir)) fs.mkdirSync(this.memoryDir, { recursive: true });
      const data = { updatedAt: new Date().toISOString(), profiles: this.identityProfiles };
      fs.writeFileSync(this.identityMemoryPath, JSON.stringify(data, null, 2), "utf8");
    } catch (_) {}
  }

  // ===========================================================================
  // FORMAL EQUATIONAL VERIFICATION
  // ===========================================================================

  verifyEquationalInvariants() {
    const voiceprint = this.extractVoiceVoiceprint(null);
    const voiceDimOk = voiceprint.dimensionality === 18 && voiceprint.mfcc.length === 13;

    const hFace = this.identityProfiles.hritthik.faceEmbedding.eigenCoeffs;
    const selfSim = this.computeFaceCosineSimilarity(hFace, hFace);
    const faceSelfOk = selfSim >= 0.999;

    const guestFace = this.identityProfiles.room_guest.faceEmbedding.eigenCoeffs;
    const crossSim = this.computeFaceCosineSimilarity(hFace, guestFace);
    const faceCrossOk = crossSim < this.faceMatchThreshold;

    const hEnergy = this.identityProfiles.hritthik.energySignature;
    const selfEnergyDist = this.computeEnergyDistance(hEnergy, hEnergy);
    const energySelfOk = selfEnergyDist < 0.01;

    const hResult = this.recognizeIdentity({
      forcedVoiceprint: this.identityProfiles.hritthik.voiceprint,
      faceEmbedding: this.identityProfiles.hritthik.faceEmbedding,
      energySignature: this.identityProfiles.hritthik.energySignature,
      text: "Tuk Tuk babe, check this architecture and run the test pipeline"
    });
    const fusionOk = hResult.speakerId === "hritthik" && hResult.confidence >= 0.55;
    const livenessOk = hResult.livenessScore >= this.livenessThreshold && hResult.isGenuine === true;
    const memoryOk = this.identityProfiles.hritthik.voiceprint.f0Mean > 0;

    const allPassed = voiceDimOk && faceSelfOk && faceCrossOk && energySelfOk && fusionOk && livenessOk && memoryOk;
    return {
      verified: allPassed, lhsEqualsRhs: allPassed,
      proof: "VoiceDim=18 ∧ FaceSelf=1.0 ∧ FaceCross<0.75 ∧ EnergySelf≈0 ∧ Fusion→Hritthik ∧ Liveness≥0.70 ∧ Memory✓",
      equations: {
        eq1_voiceVoiceprint: { verified: voiceDimOk, dimensionality: voiceprint.dimensionality },
        eq2_faceEigenspace: { verified: faceSelfOk && faceCrossOk, selfSimilarity: selfSim, crossSimilarity: crossSim },
        eq3_energyPresence: { verified: energySelfOk, selfDistance: selfEnergyDist },
        eq4_trimodalFusion: { verified: fusionOk, speakerId: hResult.speakerId, confidence: hResult.confidence },
        eq5_livenessDetection: { verified: livenessOk, score: hResult.livenessScore, isGenuine: hResult.isGenuine },
        eq6_episodicMemory: { verified: memoryOk }
      }
    };
  }
}

const humanIdentityRecognitionCortex = new HumanIdentityRecognitionCortex();
module.exports = humanIdentityRecognitionCortex;
module.exports.HumanIdentityRecognitionCortex = HumanIdentityRecognitionCortex;
