const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
const humanIdentityRecognitionCortex = require('../src/utils/human-identity-recognition-cortex');
const speakerPersonalityCortex = require('../src/utils/speaker-personality-cortex');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');
const JarvisManager = require('../src/utils/jarvis-manager');
const actionRunner = require('../src/utils/action-runner');

describe('Human Identity Multimodal Recognition (Voice, Face, Energy & Imposter Gate) Suite', () => {
  const userPrompt = 'do deep research equationaly how humwn cen remeber every person voice fase and thay are enragy to know who is the real one need to fix all';
  let testUserDataDir;
  let jarvis;

  before(() => {
    testUserDataDir = path.join(__dirname, 'test-identity-recognition-dir-' + Date.now());
    if (!fs.existsSync(testUserDataDir)) {
      fs.mkdirSync(testUserDataDir, { recursive: true });
    }
    jarvis = new JarvisManager(testUserDataDir);
    jarvis.config.userName = 'Hritthik';
  });

  after(() => {
    if (fs.existsSync(testUserDataDir)) {
      try {
        fs.rmSync(testUserDataDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  test('1. TextSanitizer: normalizes phonetic mishearings in user directive', () => {
    const sanitized = TextSanitizer.sanitize(userPrompt);
    assert.ok(sanitized.includes('equationally'), 'Should normalize equationaly to equationally');
    assert.ok(sanitized.includes('human'), 'Should normalize humwn to human');
    assert.ok(sanitized.includes('can remember'), 'Should normalize cen remeber to can remember');
    assert.ok(sanitized.includes('voice face'), 'Should normalize voice fase to voice face');
    assert.ok(sanitized.includes('energy'), 'Should normalize enragy to energy');
    assert.ok(sanitized.includes('who is the real one'), 'Should preserve who is the real one');
  });

  test('2. HumanIdentityRecognitionCortex: closed-form equational proof and invariant verification', () => {
    const report = humanIdentityRecognitionCortex.verifyEquationalInvariants();
    assert.strictEqual(report.verified, true);
    assert.strictEqual(report.lhsEqualsRhs, true);
    assert.ok(report.proof.includes('VoiceDim=18'));
    assert.ok(report.proof.includes('FaceSelf=1.0'));
    assert.ok(report.proof.includes('Liveness≥0.70'));
    assert.strictEqual(report.equations.eq1_voiceVoiceprint.verified, true);
    assert.strictEqual(report.equations.eq2_faceEigenspace.verified, true);
    assert.strictEqual(report.equations.eq3_energyPresence.verified, true);
    assert.strictEqual(report.equations.eq4_trimodalFusion.verified, true);
    assert.strictEqual(report.equations.eq5_livenessDetection.verified, true);
    assert.strictEqual(report.equations.eq6_episodicMemory.verified, true);
  });

  test('3. HumanIdentityRecognitionCortex: 18D voice voiceprint embedding (STS / TVA)', () => {
    const voiceprint = humanIdentityRecognitionCortex.extractVoiceVoiceprint(null);
    assert.strictEqual(voiceprint.dimensionality, 18);
    assert.ok(Array.isArray(voiceprint.mfcc));
    assert.strictEqual(voiceprint.mfcc.length, 13);
    assert.ok(voiceprint.f0Mean > 0);
    assert.ok(voiceprint.harmonicity > 0);
    assert.ok(voiceprint.spectralCentroid > 0);
  });

  test('4. HumanIdentityRecognitionCortex: Face eigenspace projection & ArcFace cosine similarity (FFA)', () => {
    const hritthikFace = humanIdentityRecognitionCortex.identityProfiles.hritthik.faceEmbedding.eigenCoeffs;
    const visionFace = humanIdentityRecognitionCortex.identityProfiles.vision.faceEmbedding.eigenCoeffs;

    // Self-similarity
    const selfSim = humanIdentityRecognitionCortex.computeFaceCosineSimilarity(hritthikFace, hritthikFace);
    assert.ok(selfSim >= 0.999, 'Self face similarity must be ~1.0');

    // Cross-person similarity
    const crossSim = humanIdentityRecognitionCortex.computeFaceCosineSimilarity(hritthikFace, visionFace);
    assert.ok(crossSim < 0.75, 'Cross-person face similarity must be below 0.75 threshold');

    const matchReport = humanIdentityRecognitionCortex.verifyFaceMatch(hritthikFace, hritthikFace);
    assert.strictEqual(matchReport.isMatch, true);
  });

  test('5. HumanIdentityRecognitionCortex: Behavioral energy signature distance (Biometrics)', () => {
    const hritthikEnergy = humanIdentityRecognitionCortex.identityProfiles.hritthik.energySignature;
    const guestEnergy = humanIdentityRecognitionCortex.identityProfiles.room_guest.energySignature;

    const selfDist = humanIdentityRecognitionCortex.computeEnergyDistance(hritthikEnergy, hritthikEnergy);
    assert.ok(selfDist < 0.05, 'Self energy distance must be approximately 0');

    const crossDist = humanIdentityRecognitionCortex.computeEnergyDistance(hritthikEnergy, guestEnergy);
    assert.ok(crossDist > 1.0, 'Different person energy distance must be significant');
  });

  test('6. HumanIdentityRecognitionCortex: Trimodal Bayesian posterior fusion identifies Hritthik', () => {
    const result = humanIdentityRecognitionCortex.recognizeIdentity({
      forcedVoiceprint: humanIdentityRecognitionCortex.identityProfiles.hritthik.voiceprint,
      faceEmbedding: humanIdentityRecognitionCortex.identityProfiles.hritthik.faceEmbedding,
      energySignature: humanIdentityRecognitionCortex.identityProfiles.hritthik.energySignature,
      text: 'Tuk Tuk babe, check this architecture and run the test pipeline'
    });

    assert.strictEqual(result.speakerId, 'hritthik');
    assert.strictEqual(result.speakerName, 'Hritthik');
    assert.strictEqual(result.role, 'creator_partner');
    assert.strictEqual(result.isGuest, false);
    assert.strictEqual(result.isGenuine, true);
    assert.strictEqual(result.isImposter, false);
    assert.ok(result.confidence >= 0.60);
    assert.ok(result.activeModalities.includes('voice'));
    assert.ok(result.activeModalities.includes('face'));
    assert.ok(result.activeModalities.includes('energy'));
  });

  test('7. HumanIdentityRecognitionCortex: Trimodal Bayesian fusion identifies Room Guest', () => {
    const result = humanIdentityRecognitionCortex.recognizeIdentity({
      forcedVoiceprint: humanIdentityRecognitionCortex.identityProfiles.room_guest.voiceprint,
      faceEmbedding: humanIdentityRecognitionCortex.identityProfiles.room_guest.faceEmbedding,
      energySignature: humanIdentityRecognitionCortex.identityProfiles.room_guest.energySignature,
      text: 'Excuse me, hello, is Hritthik here in his room right now?'
    });

    assert.strictEqual(result.speakerId, 'room_guest');
    assert.strictEqual(result.isGuest, true);
  });

  test('8. HumanIdentityRecognitionCortex: Imposter liveness detection flags spoofed/fake samples', () => {
    // Simulate imposter: voice with 0 variance (replay artifact), face with no blinks, erratic cadence
    const fakeVoice = { f0Mean: 122.0, f0Variance: 0.1, harmonicity: 0.20, spectralCentroid: 1450.0, cadenceWpm: 155.0, isDefaultObservation: false };
    const fakeFace = { blinkRateBpm: 0.0, microExpressionScore: 0.10, eigenCoeffs: [0.82, -0.15, 0.33, 0.71, -0.22, 0.45, 0.19, -0.08] };
    const fakeEnergy = { cadenceConsistency: 0.10, prosodicEntropy: 0.05, microExpressionScore: 0.10, responseLatencyMs: 2000 };

    const liveness = humanIdentityRecognitionCortex.computeLivenessScore(fakeVoice, fakeFace, fakeEnergy, 'hritthik');
    assert.ok(liveness.score < 0.70, 'Fake/spoofed sample must score below 0.70 liveness threshold');
    assert.strictEqual(liveness.isGenuine, false);
    assert.strictEqual(liveness.isImposter, true);
  });

  test('9. HumanIdentityRecognitionCortex: Episodic identity memory consolidation via hippocampal EMA', () => {
    const initialF0 = humanIdentityRecognitionCortex.identityProfiles.hritthik.voiceprint.f0Mean;
    const observedVoice = { f0Mean: 130.0, f0Variance: 18.0, harmonicity: 0.82, spectralCentroid: 1460.0, isDefaultObservation: false };

    humanIdentityRecognitionCortex.consolidateEpisodicMemory('hritthik', observedVoice, null, null, 0.12);
    const updatedF0 = humanIdentityRecognitionCortex.identityProfiles.hritthik.voiceprint.f0Mean;

    // EMA: updated = (1 - 0.12) * initial + 0.12 * 130.0
    const expectedF0 = (1 - 0.12) * initialF0 + 0.12 * 130.0;
    assert.ok(Math.abs(updatedF0 - expectedF0) < 0.1, 'EMA memory consolidation must update smoothly');
  });

  test('10. JarvisManager: Rule 21 in universal system prompt', () => {
    const prompt = jarvis.getSystemPrompt(jarvis.agents.tuktuk, userPrompt, null, 'en');
    assert.ok(prompt.includes('HUMAN-LIKE TRIMODAL IDENTITY RECOGNITION & IMPOSTER VERIFICATION LAW'));
    assert.ok(prompt.includes('VOICE VOICEPRINT'));
    assert.ok(prompt.includes('FACE EIGENSPACE EMBEDDING'));
    assert.ok(prompt.includes('ENERGY & BEHAVIORAL SIGNATURE'));
    assert.ok(prompt.includes('MULTIMODAL BAYESIAN POSTERIOR FUSION'));
    assert.ok(prompt.includes('IMPOSTER & LIVENESS DETECTION'));
  });

  test('11. LocalCognitiveBrain: returns grounded responses across all personas for identity recognition', () => {
    // 1. Tuk Tuk (English & Bengali)
    const ttEn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', userPrompt, {}, 'en');
    assert.ok(/voice|face|energy|trimodal|pillars/i.test(ttEn));
    assert.ok(/babe/i.test(ttEn));

    const ttBn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', userPrompt, {}, 'bn');
    assert.ok(/সুপিরিয়র|ফেস|এনার্জি|আসল|মাল্টিমোডাল/i.test(ttBn));
    assert.ok(/babe/i.test(ttBn));

    // 2. Vision (English & Bengali) — STRICTLY NO "babe"
    const visEn = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', userPrompt, {}, 'en');
    assert.ok(/trimodal|bayesian|brother|voice/i.test(visEn));
    assert.strictEqual(visEn.toLowerCase().includes('babe'), false, 'Vision must NEVER say babe in English');

    const visBn = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', userPrompt, {}, 'bn');
    assert.ok(/ত্রিমোডাল|ভাই|ইম্পোস্টার|মানুষের/i.test(visBn));
    assert.strictEqual(visBn.toLowerCase().includes('babe'), false, 'Vision must NEVER say babe in Bengali');

    // 3. Friday (English & Bengali) — STRICTLY NO "babe", NO "bro/bhai"
    const friEn = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', userPrompt, {}, 'en');
    assert.ok(/chief|trimodal|empirical/i.test(friEn));
    assert.strictEqual(friEn.toLowerCase().includes('babe'), false, 'Friday must NEVER say babe');
    assert.strictEqual(friEn.toLowerCase().includes('brother'), false, 'Friday must NEVER say brother');

    // 4. DD (English & Bengali) — STRICTLY NO "babe"
    const ddEn = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', userPrompt, {}, 'en');
    assert.ok(/bro|telemetry|trimodal/i.test(ddEn));
    assert.strictEqual(ddEn.toLowerCase().includes('babe'), false, 'DD must NEVER say babe');

    // 5. Team / Squad
    const teamEn = LocalCognitiveBrain.synthesizeResponse('team', 'Squad', userPrompt, {}, 'en');
    assert.ok(teamEn.includes('[Tuk Tuk]') && teamEn.includes('[Vision]'));
    assert.ok(/trimodal|voice/i.test(teamEn));
  });

  test('12. ActionRunner: executes human_identity_recognition_directive with full trimodal telemetry', async () => {
    // 1. Tuk Tuk
    const ttRes = await actionRunner.handleAction(userPrompt, {
      key: 'tuktuk',
      name: 'Tuk Tuk',
      voice: 'en-US-AvaMultilingualNeural'
    }, jarvis, 'en');

    assert.strictEqual(ttRes.handled, true);
    assert.strictEqual(ttRes.action, 'human_identity_recognition_directive');
    assert.strictEqual(ttRes.data.chiefSubject, 'Hritthik');
    assert.deepStrictEqual(ttRes.data.modalities, ['voice', 'face', 'energy']);
    assert.strictEqual(ttRes.data.equations, 6);
    assert.strictEqual(ttRes.data.livenessThreshold, 0.70);
    assert.strictEqual(ttRes.data.equationalCheck, true);
    assert.ok(ttRes.speech.includes('pillars') || ttRes.speech.includes('Voice') || ttRes.speech.includes('Face'));

    // Verify directive is saved in dynamic directives
    const directives = jarvis.loadDynamicDirectives();
    assert.ok(
      directives.some(d => d.rule.includes('Trimodal human identity recognition active')),
      'Should persist dynamic directive in living memory'
    );

    // 2. Vision
    const visRes = await actionRunner.handleAction(userPrompt, {
      key: 'vision',
      name: 'Vision',
      voice: 'en-US-AndrewNeural'
    }, jarvis, 'en');
    assert.strictEqual(visRes.handled, true);
    assert.strictEqual(visRes.action, 'human_identity_recognition_directive');
    assert.ok(visRes.speech.includes('brother') || visRes.speech.includes('Trimodal'));
    assert.strictEqual(visRes.speech.toLowerCase().includes('babe'), false, 'Vision must NEVER say babe');

    // 3. Team
    const teamRes = await actionRunner.handleAction(userPrompt, {
      key: 'team',
      name: 'Squad',
      voice: 'en-US-AvaMultilingualNeural'
    }, jarvis, 'en');
    assert.strictEqual(teamRes.handled, true);
    assert.strictEqual(teamRes.action, 'human_identity_recognition_directive');
    assert.ok(teamRes.speech.includes('[Tuk Tuk]') && teamRes.speech.includes('[Vision]'));
  });
});
