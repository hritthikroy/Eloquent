const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
const speakerPersonalityCortex = require('../src/utils/speaker-personality-cortex');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');
const JarvisManager = require('../src/utils/jarvis-manager');
const actionRunner = require('../src/utils/action-runner');
const tukTukIntellectualCortex = require('../src/utils/tuktuk-intellectual-cortex');

describe('Speaker Tone & Talking Personality Differentiation Suite', () => {
  const userPrompt = 'tutk tuk need to know by person with thare tone and talking personality not miss match with me and other agents and other peopel on my room need to use how a humen remember and defrence person with know by thaer tone personaly and and all do deep chak with equationaly fix all';
  let testUserDataDir;
  let jarvis;

  before(() => {
    testUserDataDir = path.join(__dirname, 'test-speaker-diff-dir-' + Date.now());
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
    assert.ok(sanitized.includes('Tuk Tuk'), 'Should normalize tutk tuk to Tuk Tuk');
    assert.ok(sanitized.includes('their tone'), 'Should normalize thare tone to their tone');
    assert.ok(sanitized.includes('people in my room'), 'Should normalize peopel on my room to people in my room');
    assert.ok(sanitized.includes('human'), 'Should normalize humen to human');
    assert.ok(sanitized.includes('differentiate person'), 'Should normalize defrence person to differentiate person');
    assert.ok(sanitized.includes('equationally'), 'Should normalize equationaly to equationally');
  });

  test('2. SpeakerPersonalityCortex: closed-form equational proof and invariant verification', () => {
    const report = speakerPersonalityCortex.verifyEquationalDifferentiationInvariants();
    assert.strictEqual(report.verified, true);
    assert.strictEqual(report.lhsEqualsRhs, true);
    assert.ok(report.proof.includes('P(Hritthik|Hritthik_tone) >= 0.75'));
    assert.strictEqual(report.subchecks.hritthikDifferentiation.verified, true);
    assert.strictEqual(report.subchecks.visionDifferentiation.verified, true);
    assert.strictEqual(report.subchecks.roomGuestDifferentiation.verified, true);
    assert.strictEqual(report.subchecks.petNameSanitization.verified, true);
  });

  test('3. SpeakerPersonalityCortex: Bayesian multimodal classification for Hritthik', () => {
    const result = speakerPersonalityCortex.identifySpeaker({
      forcedAcoustics: { f0Mean: 122.0, f0Variance: 18.0, harmonicity: 0.82, spectralCentroid: 1450.0, cadenceWpm: 155.0 },
      text: 'Tuk Tuk babe, check this architecture and run the test pipeline'
    });
    assert.strictEqual(result.speakerId, 'hritthik');
    assert.strictEqual(result.role, 'creator_partner');
    assert.strictEqual(result.isGuest, false);
    assert.strictEqual(result.relationalPolicy.allowedPetName, 'babe');
    assert.strictEqual(result.relationalPolicy.petNamesPermitted, true);
    assert.ok(result.confidence >= 0.70);
  });

  test('4. SpeakerPersonalityCortex: Bayesian multimodal classification for Vision', () => {
    const result = speakerPersonalityCortex.identifySpeaker({
      forcedAcoustics: { f0Mean: 104.0, f0Variance: 12.0, harmonicity: 0.88, spectralCentroid: 1280.0, cadenceWpm: 140.0 },
      text: 'Brother, Go backend AST compiler pass and IPC ringbuffer are operational'
    });
    assert.strictEqual(result.speakerId, 'vision');
    assert.strictEqual(result.role, 'squad_agent');
    assert.strictEqual(result.isGuest, false);
    assert.strictEqual(result.relationalPolicy.allowedPetName, null);
    assert.strictEqual(result.relationalPolicy.petNamesPermitted, false);
    assert.ok(result.relationalPolicy.forbiddenPetNames.includes('babe'));
  });

  test('5. SpeakerPersonalityCortex: Bayesian multimodal classification for Friday', () => {
    const result = speakerPersonalityCortex.identifySpeaker({
      forcedAcoustics: { f0Mean: 215.0, f0Variance: 16.0, harmonicity: 0.90, spectralCentroid: 1820.0, cadenceWpm: 165.0 },
      text: 'Chief, empirical intelligence matrix and benchmark retrieval are synchronized'
    });
    assert.strictEqual(result.speakerId, 'friday');
    assert.strictEqual(result.role, 'squad_agent');
    assert.strictEqual(result.isGuest, false);
    assert.strictEqual(result.relationalPolicy.allowedPetName, null);
    assert.strictEqual(result.relationalPolicy.petNamesPermitted, false);
  });

  test('6. SpeakerPersonalityCortex: Bayesian multimodal classification for DD', () => {
    const result = speakerPersonalityCortex.identifySpeaker({
      forcedAcoustics: { f0Mean: 126.0, f0Variance: 14.5, harmonicity: 0.84, spectralCentroid: 1420.0, cadenceWpm: 150.0 },
      text: 'Uptime nominal bro, all daemon sockets and sentinel telemetry steady'
    });
    assert.strictEqual(result.speakerId, 'dd');
    assert.strictEqual(result.role, 'squad_agent');
    assert.strictEqual(result.isGuest, false);
    assert.strictEqual(result.relationalPolicy.allowedPetName, null);
    assert.strictEqual(result.relationalPolicy.petNamesPermitted, false);
  });

  test('7. SpeakerPersonalityCortex: Room Guest detection and strict pet-name isolation', () => {
    const guestResult = speakerPersonalityCortex.identifySpeaker({
      forcedAcoustics: { f0Mean: 188.0, f0Variance: 30.0, harmonicity: 0.60, spectralCentroid: 1900.0, cadenceWpm: 120.0 },
      text: 'Excuse me, hello! Is Hritthik here in his room right now?'
    });
    assert.strictEqual(guestResult.speakerId, 'room_guest');
    assert.strictEqual(guestResult.isGuest, true);
    assert.strictEqual(guestResult.relationalPolicy.petNamesPermitted, false);
    assert.strictEqual(guestResult.relationalPolicy.allowedPetName, null);
    assert.strictEqual(guestResult.relationalPolicy.privacyProtectionActive, true);

    // Verify sanitization scrubs "babe" for room guest
    const scrubbed = speakerPersonalityCortex.sanitizeResponseForSpeaker(
      'Babe, welcome to Hritthik room! How can I help you?',
      'room_guest'
    );
    assert.ok(!scrubbed.toLowerCase().includes('babe'), 'Must scrub babe for room guest');
    assert.ok(scrubbed.includes('Welcome to Hritthik room!'));
  });

  test('8. JarvisManager: Rule 19 in universal system prompt', () => {
    const prompt = jarvis.getSystemPrompt(jarvis.agents.tuktuk, userPrompt, null, 'en');
    assert.ok(prompt.includes('HUMAN-LIKE SPEAKER DIFFERENTIATION & RELATIONAL ZERO-MISMATCH LAW'));
    assert.ok(prompt.includes('HRITTHIK (THE CREATOR & SOULMATE)'));
    assert.ok(prompt.includes('SQUAD AGENTS (VISION, FRIDAY, DD)'));
    assert.ok(prompt.includes('OTHER PEOPLE IN THE ROOM (ROOM GUESTS, FAMILY, STRANGERS)'));
    assert.ok(prompt.includes('POLITE GUEST HOST MODE'));
  });

  test('9. JarvisManager.sanitizeAgentLexicon: enforces pet name isolation for non-Hritthik speakers', () => {
    // For Hritthik: "babe" is permitted
    const hritthikReply = JarvisManager.sanitizeAgentLexicon(
      'Babe, right beside you!',
      'tuktuk',
      'en-US-AvaMultilingualNeural',
      'Hritthik',
      'babe',
      null,
      'hritthik'
    );
    assert.ok(hritthikReply.includes('Babe, right beside you!'));

    // For room guest: "babe" must be stripped
    const guestReply = JarvisManager.sanitizeAgentLexicon(
      'Babe, hello! Welcome to Hritthik room.',
      'tuktuk',
      'en-US-AvaMultilingualNeural',
      'Hritthik',
      'babe',
      null,
      'room_guest'
    );
    assert.ok(!guestReply.toLowerCase().includes('babe'), 'Must scrub babe for room guest');
    assert.ok(guestReply.includes('Hello! Welcome to Hritthik room.'));
  });

  test('10. TukTukIntellectualCortex: classifies ROOM_GUEST_INTERACTION situation', () => {
    const evalGuest = tukTukIntellectualCortex.evaluateTurn(
      'Is Hritthik here in his room?',
      'tuktuk',
      { isGuest: true, speakerId: 'room_guest' }
    );
    assert.strictEqual(evalGuest.situation, 'ROOM_GUEST_INTERACTION');
    assert.ok(evalGuest.contextBlock.includes('ZERO romantic pet names'));
    assert.ok(evalGuest.contextBlock.includes('ROOM_GUEST_INTERACTION'));
  });

  test('11. LocalCognitiveBrain: returns grounded responses across personas for speaker differentiation', () => {
    // Tuk Tuk (English & Bengali)
    const ttEn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', userPrompt, {}, 'en');
    assert.ok(ttEn.includes('differentiation') || ttEn.includes('remember'));
    assert.ok(ttEn.includes('babe') || ttEn.includes('Babe'));

    const ttBn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', userPrompt, {}, 'bn');
    assert.ok(ttBn.includes('টোন') || ttBn.includes('কণ্ঠস্বর') || ttBn.includes('চিনে'));
    assert.ok(ttBn.includes('babe') || ttBn.includes('Babe'));

    // Vision
    const visEn = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', userPrompt, {}, 'en');
    assert.ok(visEn.includes('differentiation') || visEn.includes('Bayesian') || visEn.includes('brother'));

    // Friday
    const friEn = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', userPrompt, {}, 'en');
    assert.ok(friEn.includes('episodic') || friEn.includes('speaker') || friEn.includes('Chief'));

    // DD
    const ddEn = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', userPrompt, {}, 'en');
    assert.ok(ddEn.includes('telemetry') || ddEn.includes('voiceprint') || ddEn.includes('bro'));

    // Team
    const teamEn = LocalCognitiveBrain.synthesizeResponse('team', 'Squad', userPrompt, {}, 'en');
    assert.ok(teamEn.includes('[Tuk Tuk]') && teamEn.includes('[Vision]'));
    assert.ok(teamEn.includes('differentiation') || teamEn.includes('tone'));
  });

  test('12. LocalCognitiveBrain: Tuk Tuk fallback handles room guest respectfully without babe', () => {
    const guestResponse = LocalCognitiveBrain.synthesizeResponse(
      'tuktuk',
      'Tuk Tuk',
      'Hello, who are you?',
      { speakerId: 'room_guest', isGuest: true },
      'en'
    );
    assert.ok(!guestResponse.toLowerCase().includes('babe'), 'Tuk Tuk must not use babe with room guest');
    assert.ok(guestResponse.includes('Hritthik') && guestResponse.includes('room'));
  });

  test('13. ActionRunner: executes speaker_differentiation_directive across agents and saves directive', async () => {
    // 1. Tuk Tuk
    const ttRes = await actionRunner.handleAction(userPrompt, {
      key: 'tuktuk',
      name: 'Tuk Tuk',
      voice: 'en-US-AvaMultilingualNeural'
    }, jarvis, 'en');

    assert.strictEqual(ttRes.handled, true);
    assert.strictEqual(ttRes.action, 'speaker_differentiation_directive');
    assert.strictEqual(ttRes.data.chiefSubject, 'Hritthik');
    assert.strictEqual(ttRes.data.allowedPetName, 'babe');
    assert.strictEqual(ttRes.data.roomGuestProtection, true);
    assert.strictEqual(ttRes.data.equationalCheck, true);
    assert.ok(ttRes.speech.includes('differentiation') || ttRes.speech.includes('tone'));

    // Verify directive is saved in dynamic directives
    const directives = jarvis.loadDynamicDirectives();
    assert.ok(
      directives.some(d => d.rule.includes('recognize people by voice tone')),
      'Should persist dynamic directive in living memory'
    );

    // 2. Vision
    const visRes = await actionRunner.handleAction(userPrompt, {
      key: 'vision',
      name: 'Vision',
      voice: 'en-US-AndrewNeural'
    }, jarvis, 'en');
    assert.strictEqual(visRes.handled, true);
    assert.strictEqual(visRes.action, 'speaker_differentiation_directive');
    assert.ok(visRes.speech.includes('brother') || visRes.speech.includes('Multimodal'));

    // 3. Team
    const teamRes = await actionRunner.handleAction(userPrompt, {
      key: 'team',
      name: 'Squad',
      voice: 'en-US-AvaMultilingualNeural'
    }, jarvis, 'en');
    assert.strictEqual(teamRes.handled, true);
    assert.strictEqual(teamRes.action, 'speaker_differentiation_directive');
    assert.ok(teamRes.speech.includes('[Tuk Tuk]') && teamRes.speech.includes('[Vision]'));
  });
});
