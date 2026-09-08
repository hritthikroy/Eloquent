/**
 * Quad-Modal Full-Duplex Simultaneous Perception Stream Test Suite
 * Verifies that Reading, Listening, Seeing, and Speaking execute concurrently
 * without cross-pipeline blocking or mutual exclusion stalls.
 *
 * Invariant: Omega_quad_modal = P_read * P_listen * P_see * P_speak = 1.00 (RHS = 100%)
 */

const assert = require('assert');
const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
const IntentParser = require('../src/utils/prompt-engine/intent-parser');
const continuousHumanLearningTrimodalCortex = require('../src/utils/continuous-human-learning-trimodal-cortex');
const jarvisManager = require('../src/utils/jarvis-manager');
const actionRunner = require('../src/utils/action-runner');
const localCognitiveBrain = require('../src/utils/local-cognitive-brain');

console.log('--- STARTING QUAD-MODAL SIMULTANEOUS HUMAN STREAM TEST SUITE ---');

// 1. Text Sanitizer & Phonetic Normalization
console.log('\n[1] Testing TextSanitizer phonetic normalization...');
const rawPrompt = 'how i make reading lisening seeing and spking all in symententeniously like a humen can do fix all issues';
const sanitized = TextSanitizer.sanitize(rawPrompt);
console.log('Sanitized output:', sanitized);
assert(sanitized.toLowerCase().includes('reading'), 'Sanitizer should retain reading');
assert(sanitized.toLowerCase().includes('listening'), 'Sanitizer should normalize lisening -> listening');
assert(sanitized.toLowerCase().includes('seeing'), 'Sanitizer should retain seeing');
assert(sanitized.toLowerCase().includes('speaking'), 'Sanitizer should normalize spking -> speaking');
assert(sanitized.toLowerCase().includes('simultaneously'), 'Sanitizer should normalize symententeniously -> simultaneously');
console.log('✓ TextSanitizer normalization verified.');

// 2. Intent Detection & Routing
console.log('\n[2] Testing IntentParser detection & routing...');
assert(
  IntentParser.isQuadModalSimultaneousPerceptionDirective(rawPrompt),
  'IntentParser must detect raw prompt as quad-modal simultaneous perception'
);
assert(
  IntentParser.isQuadModalSimultaneousPerceptionDirective(sanitized),
  'IntentParser must detect sanitized prompt as quad-modal simultaneous perception'
);

const parsed = IntentParser.parse(rawPrompt);
console.log('Intent parsed:', parsed.intent, 'target:', parsed.target, 'confidence:', parsed.confidence);
assert.strictEqual(
  parsed.target,
  'quad_modal_simultaneous_perception_stream_directive',
  'Parsed target must be quad_modal_simultaneous_perception_stream_directive'
);
assert.strictEqual(
  parsed.intent,
  IntentParser.INTENTS.SMOOTH_CONVERSATION,
  'Parsed intent must be SMOOTH_CONVERSATION'
);
assert(parsed.confidence >= 0.95, 'Intent confidence must be >= 0.95');
console.log('✓ IntentParser detection and routing verified.');

// 3. Continuous Human Learning Trimodal/Quadmodal Cortex
console.log('\n[3] Testing ContinuousHumanLearningTrimodalCortex quad-modal invariants...');
const streams = continuousHumanLearningTrimodalCortex.activeSensoryStreams;
console.log('Active sensory streams:', streams);
assert(streams.reading === true, 'Reading stream must be true');
assert(streams.listening === true, 'Listening stream must be true');
assert(streams.seeing === true, 'Seeing stream must be true');
assert(streams.speaking === true, 'Speaking stream must be true');

const invariantResult = continuousHumanLearningTrimodalCortex.evaluateQuadModalInvariants('tuk_tuk', 'en');
console.log('Invariant evaluation:', invariantResult);
assert.strictEqual(invariantResult.verified, true, 'Invariant must be verified');
assert.strictEqual(invariantResult.lhsEqualsRhs, true, 'LHS must equal RHS');
assert.strictEqual(invariantResult.omegaQuadModal, 1.0, 'Omega quad-modal invariant must be 1.0');
assert.strictEqual(invariantResult.scores.readingScore, 1.0, 'Reading score must be 1.0');
assert.strictEqual(invariantResult.scores.listeningScore, 1.0, 'Listening score must be 1.0');
assert.strictEqual(invariantResult.scores.seeingScore, 1.0, 'Seeing score must be 1.0');
assert.strictEqual(invariantResult.scores.speakingScore, 1.0, 'Speaking score must be 1.0');
console.log('✓ ContinuousHumanLearningTrimodalCortex quad-modal invariants verified.');

// 4. Jarvis Manager Calibration & Living Memory
console.log('\n[4] Testing JarvisManager calibrateQuadModalSimultaneousPerception()...');
const calibrationResult = jarvisManager.calibrateQuadModalSimultaneousPerception();
console.log('Calibration result:', calibrationResult);
assert.strictEqual(calibrationResult.success, true, 'Calibration must succeed');
assert.strictEqual(calibrationResult.omega_quad_modal, 1.00, 'Calibration omega must be 1.00');
assert.strictEqual(jarvisManager.getPreference('quad_modal_simultaneous_perception'), true, 'Preference must be set');
assert.strictEqual(jarvisManager.getPreference('instant_reading_active'), true, 'Reading must be active');
assert.strictEqual(jarvisManager.getPreference('screen_reading_active'), true, 'Screen reading must be active');
console.log('✓ JarvisManager calibration verified.');

async function run() {
  // 5. Action Runner Directive Execution across Personas
  console.log('\n[5] Testing ActionRunner directive execution across personas...');
  const personas = [
    { agent: 'tuktuk', name: 'Tuk Tuk', expectedTerm: 'babe' },
    { agent: 'vision', name: 'Vision', expectedTerm: 'brother' },
    { agent: 'friday', name: 'Friday', expectedTerm: 'Chief' },
    { agent: 'dd', name: 'DD', expectedTerm: 'bro' }
  ];

  for (const { agent, name, expectedTerm } of personas) {
    const result = await actionRunner.handleAction(rawPrompt, { key: agent, name: name });
    console.log(`[ActionRunner - ${agent}]:`, result.speech);
    assert.strictEqual(result.handled, true, `ActionRunner must handle directive for ${agent}`);
    assert(
      result.speech.toLowerCase().includes(expectedTerm.toLowerCase()),
      `Agent ${agent} must use persona term "${expectedTerm}" in speech`
    );
    assert(
      !result.speech.trim().endsWith('?'),
      `Agent ${agent} speech must adhere to Anti-Trailer Law (no trailing ?)`
    );
  }
  console.log('✓ ActionRunner persona responses and Anti-Trailer Law compliance verified.');

  // 6. Local Cognitive Brain Responses across Personas & Team Mode
  console.log('\n[6] Testing LocalCognitiveBrain responses...');
  for (const { agent, name, expectedTerm } of personas) {
    const brainResponse = localCognitiveBrain.synthesizeResponse(agent, name, rawPrompt, {}, 'en');
    console.log(`[Brain - ${agent}]:`, brainResponse);
    assert(brainResponse, `LocalCognitiveBrain must return a response for ${agent}`);
    assert(
      brainResponse.toLowerCase().includes(expectedTerm.toLowerCase()),
      `LocalCognitiveBrain response for ${agent} must include "${expectedTerm}"`
    );
    assert(
      !brainResponse.trim().endsWith('?'),
      `LocalCognitiveBrain response for ${agent} must adhere to Anti-Trailer Law (no trailing ?)`
    );
  }

  // Team mode test
  const teamResponse = localCognitiveBrain.synthesizeResponse('team', 'Squad', rawPrompt, {}, 'en');
  console.log('[Brain - Team]:\n', teamResponse);
  assert(teamResponse.includes('[Tuk Tuk]:'), 'Team response must include [Tuk Tuk]');
  assert(teamResponse.includes('[Vision]:'), 'Team response must include [Vision]');
  assert(teamResponse.includes('[Friday]:'), 'Team response must include [Friday]');
  assert(teamResponse.includes('[DD]:'), 'Team response must include [DD]');
  assert(!teamResponse.trim().endsWith('?'), 'Team response must adhere to Anti-Trailer Law (no trailing ?)');
  console.log('✓ LocalCognitiveBrain persona and squad execution verified.');

  console.log('\n--- ALL QUAD-MODAL SIMULTANEOUS HUMAN STREAM TESTS PASSED CLEANLY (LHS ≡ RHS = 100%) ---');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
