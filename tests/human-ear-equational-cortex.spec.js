/**
 * Test Suite: Human Ear Equational Cortex Verification Suite
 * 
 * Verifies all 10 closed-form neurobiological auditory equations:
 * 1. Cochlear Greenwood Frequency-Place Tonotopic Map
 * 2. Equivalent Rectangular Bandwidth (ERB) Filterbanks (Glasberg & Moore)
 * 3. Psychoacoustic Absolute Threshold of Hearing (ISO 226)
 * 4. Binaural Sound Localization (ITD & ILD Duplex Theory)
 * 5. Spatial Release from Masking (SRM) & Cocktail Party Gain
 * 6. Temporal Auditory Forward Masking Decay (Zwicker & Fastl)
 * 7. Acoustic Stapedius Reflex Attenuation for Loud Transients
 * 8. Auditory Nerve Phase-Locking & Real-Time Pitch Extraction
 * 9. Spectral Entropy & Adaptive Turn-Taking Endpointing
 * 10. Self-Acoustic Echo Blinding & Double-Talk Detection
 */

const test = require("node:test");
const assert = require("node:assert");

const humanEarCortex = require("../src/utils/human-ear-cortex");

test("Human Ear Equational Cortex Verification Suite", async (t) => {

  await t.test("1. Cochlear Greenwood Frequency-Place Tonotopy", () => {
    // Apex (x = 0mm) -> Lowest audible resonance (~20 Hz)
    const apexFreq = humanEarCortex.computeCochlearFrequency(0.0);
    assert.strictEqual(apexFreq, 0.0, "Apex represents zero frequency reference");

    // Base (x = 35mm) -> Highest audible frequencies (~20 kHz)
    const baseFreq = humanEarCortex.computeCochlearFrequency(35.0);
    assert.ok(baseFreq >= 15000.0, `Base frequency must exceed 15 kHz (got ${baseFreq} Hz)`);

    // Invert place mapping for 1000 Hz human reference tone
    const place1Khz = humanEarCortex.computeCochlearPlace(1000.0);
    assert.ok(place1Khz >= 13.0 && place1Khz <= 16.0, `1 kHz tone maps to mid-basilar place ~14.1mm (got ${place1Khz}mm)`);
  });

  await t.test("2. Equivalent Rectangular Bandwidth (ERB) Filterbanks", () => {
    // 1000 Hz auditory filter bandwidth
    const erb1Khz = humanEarCortex.computeERB(1000.0);
    assert.ok(erb1Khz >= 120.0 && erb1Khz <= 140.0, `ERB at 1 kHz must be ~132.6 Hz (got ${erb1Khz} Hz)`);

    // ERB increases monotonically with frequency
    const erb100Hz = humanEarCortex.computeERB(100.0);
    const erb4Khz = humanEarCortex.computeERB(4000.0);
    assert.ok(erb4Khz > erb1Khz && erb1Khz > erb100Hz, "Auditory bandwidth must increase monotonically");
  });

  await t.test("3. Psychoacoustic Absolute Threshold of Hearing (ATH)", () => {
    // Peak sensitivity in human ear canal resonance (3 - 4 kHz) -> lowest threshold
    const ath100Hz = humanEarCortex.computeAbsoluteThresholdOfHearing(100.0);
    const ath3500Hz = humanEarCortex.computeAbsoluteThresholdOfHearing(3500.0);
    const ath15Khz = humanEarCortex.computeAbsoluteThresholdOfHearing(15000.0);

    assert.ok(ath3500Hz < ath100Hz, "Ear must be far more sensitive at 3.5 kHz than 100 Hz");
    assert.ok(ath3500Hz < ath15Khz, "Ear must be far more sensitive at 3.5 kHz than 15 kHz");
    assert.ok(ath3500Hz <= 0.0, `Peak sensitivity threshold at 3.5 kHz should reach <= 0 dB SPL (got ${ath3500Hz} dB)`);
  });

  await t.test("4. Binaural Sound Localization (ITD & ILD)", () => {
    // Frontal sound (0 radians) -> zero ITD and zero ILD
    const itdCenter = humanEarCortex.computeInterauralTimeDifference(0.0);
    const ildCenter = humanEarCortex.computeInterauralLevelDifference(0.0, 4000.0);
    assert.strictEqual(itdCenter, 0.0);
    assert.strictEqual(ildCenter, 0.0);

    // 90 degrees right azimuth (PI/2 rad) -> max human ITD ~660 microseconds
    const itd90 = humanEarCortex.computeInterauralTimeDifference(Math.PI / 2);
    assert.ok(itd90 >= 600.0 && itd90 <= 700.0, `Max human ITD must be ~656us (got ${itd90}us)`);

    // High frequency ILD at 90 deg -> significant acoustic head shadow attenuation (>10 dB)
    const ild90HighFreq = humanEarCortex.computeInterauralLevelDifference(Math.PI / 2, 4000.0);
    assert.ok(ild90HighFreq >= 9.0, `High frequency ILD at 90 deg must exceed 9 dB (got ${ild90HighFreq} dB)`);
  });

  await t.test("5. Spatial Release from Masking (SRM) & Cocktail Party Effect", () => {
    // Zero separation -> 0 dB SRM
    const srmZero = humanEarCortex.computeSpatialReleaseFromMasking(0.0);
    assert.strictEqual(srmZero, 0.0);

    // 45 degrees separation between noise and speaker -> ~6 to 10 dB gain
    const srm45 = humanEarCortex.computeSpatialReleaseFromMasking(Math.PI / 4);
    assert.ok(srm45 >= 6.0 && srm45 <= 12.0, `SRM gain at 45 deg must be 6-12 dB (got ${srm45} dB)`);
  });

  await t.test("6. Temporal Auditory Forward Masking Decay", () => {
    const mask0ms = humanEarCortex.computeForwardMaskingThreshold(80.0, 5.0);
    const mask50ms = humanEarCortex.computeForwardMaskingThreshold(80.0, 50.0);
    const mask250ms = humanEarCortex.computeForwardMaskingThreshold(80.0, 250.0);

    assert.ok(mask0ms > mask50ms, "Forward masking must decay over time");
    assert.strictEqual(mask250ms, 0.0, "Forward masking must completely cease after 200ms");
  });

  await t.test("7. Acoustic Stapedius Reflex Attenuation for Loud Transients", () => {
    // Normal conversational speech (65 dB SPL) -> No stapedius reflex
    const normal = humanEarCortex.computeStapediusReflex(65.0);
    assert.strictEqual(normal.isReflexActive, false);
    assert.strictEqual(normal.attenuationDb, 0.0);

    // Loud transient / table slam / cough (105 dB SPL) -> Stapedius triggers up to 8-15 dB attenuation
    const loud = humanEarCortex.computeStapediusReflex(105.0);
    assert.strictEqual(loud.isReflexActive, true);
    assert.ok(loud.attenuationDb >= 6.0 && loud.attenuationDb <= 15.0, `Stapedius must attenuate 6-15 dB (got ${loud.attenuationDb} dB)`);
  });

  await t.test("8. Auditory Nerve Phase-Locking & Pitch Extraction", () => {
    // Generate synthetic 150 Hz harmonic voice tone (male fundamental F0) at 16kHz sample rate
    const sampleRate = 16000;
    const durationSec = 0.05; // 50ms
    const numSamples = Math.floor(sampleRate * durationSec);
    const pcm = new Float32Array(numSamples);
    const f0 = 150.0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // F0 + 2nd harmonic + 3rd harmonic
      pcm[i] = 0.6 * Math.sin(2 * Math.PI * f0 * t) + 0.3 * Math.sin(2 * Math.PI * 2 * f0 * t) + 0.1 * Math.sin(2 * Math.PI * 3 * f0 * t);
    }

    const pitchRes = humanEarCortex.computePitchAndSynchrony(pcm);
    assert.strictEqual(pitchRes.isVoiced, true);
    assert.ok(Math.abs(pitchRes.pitchHz - 150.0) <= 5.0, `Extracted pitch must be ~150 Hz (got ${pitchRes.pitchHz} Hz)`);
    assert.ok(pitchRes.harmonicity >= 0.70, `Harmonicity must be high for pure harmonic tone (got ${pitchRes.harmonicity})`);
  });

  await t.test("9. Spectral Entropy & Adaptive Turn-Taking Endpointing", () => {
    // Tone vs white noise spectral entropy
    const toneMags = new Float32Array(64).fill(0.01);
    toneMags[8] = 5.0; // Peak energy at bin 8
    const noiseMags = new Float32Array(64).fill(1.0); // Flat spectrum

    const toneEntropy = humanEarCortex.computeSpectralEntropy(toneMags);
    const noiseEntropy = humanEarCortex.computeSpectralEntropy(noiseMags);
    assert.ok(toneEntropy < noiseEntropy, "Tonal speech must have lower spectral entropy than flat noise");

    // Dynamic Turn-Taking Latencies (Rapid Equational Benchmark Mode)
    humanEarCortex.setEndpointMode('rapid');
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(3500), 260, "Sustained monologue -> 260ms");
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(1500), 340, "Standard sentence -> 340ms");
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(500), 450, "Short command -> 450ms");
    assert.strictEqual(humanEarCortex.computeDynamicEndpointSilence(1500, true), 220, "Optical lip closure -> 220ms");
    humanEarCortex.setEndpointMode('conversational');
  });

  await t.test("10. Self-Acoustic Echo Blinding & Double-Talk Detection", () => {
    humanEarCortex.recordAssistantSpeech("I've checked the git status and codebase is clean", 1500);

    // AI speaker acoustic bleed echo within window -> Blocked
    const isEcho = humanEarCortex.isSelfAcousticEcho("codebase is clean");
    assert.strictEqual(isEcho, true, "Echo tail of AI speech must be blinded");

    // Independent user command -> Allowed
    const isUser = humanEarCortex.isSelfAcousticEcho("now run the tests please");
    assert.strictEqual(isUser, false, "Real user command must never be blocked");
  });
});
