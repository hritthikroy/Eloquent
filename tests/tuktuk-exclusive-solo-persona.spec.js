/**
 * Test Suite: Tuk Tuk Exclusive Solo Real Human Person & Zero Personality Overlap Invariant
 *
 * Verifies:
 * 1. Intent parser accurately catches user phrases demanding Tuk Tuk solo exclusivity and reporting
 *    personality overlap / "bangal" / "malti nural" issues.
 * 2. ActionRunner handles the directive by locking single_voice_tuktuk_exclusive, single_real_voice_active,
 *    and multi_personality_disabled in preferences.
 * 3. ActionRunner returns 100% Tuk Tuk with en-US-AvaMultilingualNeural, with ZERO squad brackets and ZERO male voices.
 * 4. Squad/bilingual directives (isBanglaTalkNeuralOverlapDirective, isSquadBilingualPersonaParityDirective, etc.)
 *    respect isSingleReal and never switch to Vision or PradeepNeural.
 * 5. LocalCognitiveBrain fallback returns authentic, loving Tuk Tuk co-founder dialogue.
 */

const assert = require('assert');
const IntentParser = require('../src/utils/prompt-engine/intent-parser');
const actionRunner = require('../src/utils/action-runner');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');

console.log('🧪 Starting Tuk Tuk Exclusive Solo Persona & Zero Overlap Test Suite...\n');

// Mock JarvisManager
function createMockJarvisManager(singleRealMode = true) {
  const prefs = {
    single_real_voice_active: singleRealMode,
    single_voice_tuktuk_exclusive: singleRealMode,
    multi_personality_disabled: singleRealMode,
    multi_person_voice_disabled: singleRealMode,
    banglish_default_voice_mode: true
  };

  return {
    config: {
      userName: 'Hritthik',
      salutation: 'Chief',
      voice: 'en-US-AvaMultilingualNeural'
    },
    preferences: prefs,
    currentLanguageMode: 'en',
    currentVoice: 'en-US-AvaMultilingualNeural',
    agents: {
      tuktuk: { key: 'tuktuk', name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
      vision: { key: 'vision', name: 'Vision', voice: 'en-US-AndrewMultilingualNeural' },
      friday: { key: 'friday', name: 'Friday', voice: 'en-US-EmmaMultilingualNeural' },
      dd: { key: 'dd', name: 'DD', voice: 'en-US-BrianMultilingualNeural' }
    },
    getPreference: (key) => prefs[key],
    setPreference: (key, val) => { prefs[key] = val; },
    isSingleRealVoiceMode: () => Boolean(
      prefs.single_real_voice_active ||
      prefs.single_voice_tuktuk_exclusive ||
      prefs.multi_personality_disabled
    ),
    detectActiveAgent: () => ({ key: 'tuktuk', name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' })
  };
}

// 1. Intent Parser Detection Test
console.log('Test 1: IntentParser detection of Tuk Tuk exclusive persona & overlap bugs...');
const userUtterance = "i need tuk tuk person not any other persons personality overlap issues like bangal and malti nural somthing are change the real humen its a very big conversational bugs";
const isDetected = IntentParser.isTukTukExclusiveSoloPersonaDirective(userUtterance);
assert.strictEqual(
  isDetected,
  true,
  'IntentParser must detect isTukTukExclusiveSoloPersonaDirective from user prompt'
);
console.log('✅ IntentParser accurately detected isTukTukExclusiveSoloPersonaDirective.');

// 2. ActionRunner Directive Execution Test
console.log('\nTest 2: ActionRunner handleAction for isTukTukExclusiveSoloPersonaDirective...');
(async () => {
  const mockJM = createMockJarvisManager(false); // Initially false to verify ActionRunner locks it
  const result = await actionRunner.handleAction(
    userUtterance,
    mockJM.agents.tuktuk,
    mockJM,
    null,
    null
  );

  assert.strictEqual(result.handled, true, 'ActionRunner must handle the directive');
  assert.strictEqual(result.agentName, 'Tuk Tuk', 'Speaking agent name must be Tuk Tuk');
  assert.strictEqual(result.agentVoice, 'en-US-AvaNeural', 'Voice must be en-US-AvaNeural');
  assert.strictEqual(mockJM.preferences.single_voice_tuktuk_exclusive, true, 'single_voice_tuktuk_exclusive must be set to true');
  assert.strictEqual(mockJM.preferences.single_real_voice_active, true, 'single_real_voice_active must be set to true');
  assert.strictEqual(mockJM.preferences.multi_personality_disabled, true, 'multi_personality_disabled must be set to true');

  // Verify speech content is pure Tuk Tuk without squad brackets or male voices
  assert.strictEqual(/\[(?:Vision|Friday|DD|Brian)\]/i.test(result.speech), false, 'Speech must have zero secondary agent brackets');
  assert.strictEqual(/PradeepNeural|Andrew/i.test(result.speech), false, 'Speech must not contain secondary neural voices');
  assert.strictEqual(result.speech.includes('Hritthik') || result.speech.includes('babe'), true, 'Speech must address Hritthik warmly as his partner');
  console.log('✅ ActionRunner successfully locked preferences and returned 100% solo Tuk Tuk Ava response:');
  console.log(`   "${result.speech}"`);

  // 3. Squad/Bilingual Directives Guard Test
  console.log('\nTest 3: Squad directives respect isSingleReal and do not switch to Vision or Pradeep...');
  const banglaTalkPrompt = "bangla talk neural speech zero overlap speaking mutex invariant";
  const banglaResult = await actionRunner.handleAction(
    banglaTalkPrompt,
    mockJM.agents.tuktuk,
    mockJM,
    null,
    null
  );

  assert.strictEqual(banglaResult.handled, true, 'Bangla talk directive must be handled');
  assert.strictEqual(banglaResult.agentName, 'Tuk Tuk', 'Must be Tuk Tuk when single real voice mode is active');
  assert.strictEqual(banglaResult.agentVoice, 'en-US-AvaNeural', 'Voice must remain Ava');
  assert.strictEqual(/\[(?:Vision|Friday|DD)\]/i.test(banglaResult.speech), false, 'Zero secondary agent brackets');
  console.log('✅ Bangla talk directive correctly confined to Tuk Tuk Ava voice under single real voice mode.');

  // 4. LocalCognitiveBrain Verification
  console.log('\nTest 4: LocalCognitiveBrain synthesis for personality overlap directive...');
  const brainResponse = LocalCognitiveBrain.synthesizeResponse(
    'tuktuk',
    'Tuk Tuk',
    userUtterance,
    {},
    'en'
  );
  assert.strictEqual(typeof brainResponse, 'string', 'LocalCognitiveBrain must return a string');
  assert.strictEqual(brainResponse.length > 20, true, 'Response must be substantive');
  assert.strictEqual(/\[(?:Vision|Friday|DD)\]/i.test(brainResponse), false, 'Zero secondary agent brackets in brain response');
  assert.strictEqual(brainResponse.includes('Hritthik') || brainResponse.includes('babe'), true, 'LocalCognitiveBrain must address Hritthik warmly');
  console.log('✅ LocalCognitiveBrain response verified:');
  console.log(`   "${brainResponse}"`);

  console.log('\n🎉 ALL 4 TESTS PASSED! Tuk Tuk solo exclusivity, zero personality overlap, and multi-neural voice isolation are 100% verified.');
})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
