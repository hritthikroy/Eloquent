/**
 * tests/hrita-user-alias-recognition.spec.js
 * 
 * Verification Test Suite: Hrita User Identity & Phonetic Recognition
 * Ensures 100% seamless recognition of "Hrita" as a phonetic alias for user Hritthik
 * across STT sanitization, agent salutations, memory recall, and JarvisManager directives.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 1. TextSanitizer & Phonetics
const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
const equationalPhoneticEngine = require('../src/utils/prompt-engine/equational-phonetic-engine');

// 2. JarvisManager
const JarvisManager = require('../src/utils/jarvis-manager');

// 3. SpeakerPersonalityCortex
const speakerPersonalityCortex = require('../src/utils/speaker-personality-cortex');

// 4. LocalCognitiveBrain
const localBrain = require('../src/utils/local-cognitive-brain');

// 5. ActionRunner
const actionRunner = require('../src/utils/action-runner');

console.log('================================================================');
console.log('🧪 TEST SUITE: HRITA USER IDENTITY & PHONETIC RECOGNITION');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: STT Sanitization & Phonetic Mishearing Normalization
// -----------------------------------------------------------------------------
console.log('--- 1. Testing TextSanitizer & Phonetic Normalization ---');
{
  const testCases = [
    { input: 'who is Hrita', expected: 'Who is Hritthik' },
    { input: "who's hrita", expected: 'Who is Hritthik' },
    { input: 'Hrita ke', expected: 'Hritthik ke' },
    { input: 'হৃতা কে', expected: 'হৃত্তিক কে' },
    { input: 'tell hrita to inspect the pipeline', expected: 'Tell Hritthik to inspect the pipeline' },
    { input: 'ask hrita about the build', expected: 'Ask Hritthik about the build' },
    { input: 'hrita needs this fix right now', expected: 'Hritthik needs this fix right now' },
    { input: 'hrita says check the AST', expected: 'Hritthik says check the AST' }
  ];

  for (const tc of testCases) {
    const sanitized = TextSanitizer.sanitize(tc.input);
    assert.strictEqual(sanitized, tc.expected, `Expected "${tc.input}" -> "${tc.expected}", got "${sanitized}"`);
    console.log(`  ✅ [PASS] "${tc.input}" -> "${sanitized}"`);
  }

  // Domain Lexicon check
  assert(equationalPhoneticEngine.DOMAIN_LEXICON.has('hritthik'), 'DOMAIN_LEXICON contains hritthik');
  assert(equationalPhoneticEngine.DOMAIN_LEXICON.has('hrita'), 'DOMAIN_LEXICON contains hrita');
  console.log('  ✅ [PASS] EquationalPhoneticEngine domain lexicon includes hritthik and hrita');
}

// -----------------------------------------------------------------------------
// TEST 2: JarvisManager User Identity & Alias Coherence
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing JarvisManager User Identity & Aliases ---');
{
  const jm = new JarvisManager();
  
  // Verify defaults
  assert.strictEqual(jm.config.userName, 'Hritthik');
  assert(Array.isArray(jm.config.userNameAliases), 'userNameAliases is an array');
  assert(jm.config.userNameAliases.includes('Hrita'), 'userNameAliases contains Hrita');
  assert(jm.config.userNameAliases.includes('Hrito'), 'userNameAliases contains Hrito');

  // Verify isUserName helper method
  assert.strictEqual(jm.isUserName('Hritthik'), true, 'Recognizes Hritthik');
  assert.strictEqual(jm.isUserName('hritthik'), true, 'Recognizes lowercase hritthik');
  assert.strictEqual(jm.isUserName('Hrita'), true, 'Recognizes Hrita');
  assert.strictEqual(jm.isUserName('hrita'), true, 'Recognizes lowercase hrita');
  assert.strictEqual(jm.isUserName('Hrito'), true, 'Recognizes Hrito');
  assert.strictEqual(jm.isUserName('হৃতা'), true, 'Recognizes Bengali হৃতা');
  assert.strictEqual(jm.isUserName('UnknownUser'), false, 'Rejects unknown user');
  assert.strictEqual(jm.isUserName(''), false, 'Handles empty string');
  assert.strictEqual(jm.isUserName(null), false, 'Handles null');

  // Verify static helper JarvisManager.isKnownUser
  assert.strictEqual(JarvisManager.isKnownUser('Hrita'), true);
  assert.strictEqual(JarvisManager.isKnownUser('hrita'), true);
  assert.strictEqual(JarvisManager.isKnownUser('Hritthik'), true);
  assert.strictEqual(JarvisManager.isKnownUser('হৃতা'), true);
  assert.strictEqual(JarvisManager.isKnownUser('stranger'), false);

  console.log('  ✅ [PASS] JarvisManager isUserName and isKnownUser alias resolution verified');
}

// -----------------------------------------------------------------------------
// TEST 3: Lexicon Sanitization & Pet-Name Sovereignty for Hrita
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing Lexicon Sanitization & Pet-Name Sovereignty ---');
{
  const sampleTukTukSpeech = 'Babe, the pipeline is green and ready for deployment!';

  // Speaker is "hrita" -> "babe" MUST be preserved (treated as primary user)
  const sanitizedForHrita = JarvisManager.sanitizeAgentLexicon(
    sampleTukTukSpeech,
    'tuktuk',
    'en-US-AvaMultilingualNeural',
    'Hrita',
    'babe',
    null,
    'hrita'
  );
  assert(sanitizedForHrita.toLowerCase().includes('babe'), 'Tuk Tuk preserves "babe" when speaker is "hrita"');
  console.log(`  ✅ [PASS] Tuk Tuk preserves "babe" for speakerId="hrita": "${sanitizedForHrita}"`);

  // Speaker is "hritthik" -> "babe" preserved
  const sanitizedForHritthik = JarvisManager.sanitizeAgentLexicon(
    sampleTukTukSpeech,
    'tuktuk',
    'en-US-AvaMultilingualNeural',
    'Hritthik',
    'babe',
    null,
    'hritthik'
  );
  assert(sanitizedForHritthik.toLowerCase().includes('babe'), 'Tuk Tuk preserves "babe" when speaker is "hritthik"');
  console.log(`  ✅ [PASS] Tuk Tuk preserves "babe" for speakerId="hritthik": "${sanitizedForHritthik}"`);

  // Speaker is "room_guest" -> "babe" MUST be stripped
  const sanitizedForGuest = JarvisManager.sanitizeAgentLexicon(
    sampleTukTukSpeech,
    'tuktuk',
    'en-US-AvaMultilingualNeural',
    'Hritthik',
    'babe',
    null,
    'room_guest'
  );
  assert(!sanitizedForGuest.toLowerCase().includes('babe'), 'Tuk Tuk strips "babe" for room_guest');
  console.log(`  ✅ [PASS] Tuk Tuk strips "babe" for speakerId="room_guest": "${sanitizedForGuest}"`);

  // Friday sanitization replacing pet names with userDisplayName
  const fridaySpeech = 'Babe, research benchmarks show sub-250ms VAD latency.';
  const sanitizedFriday = JarvisManager.sanitizeAgentLexicon(
    fridaySpeech,
    'friday',
    'en-US-EmmaMultilingualNeural',
    'Hrita',
    'babe',
    null,
    'hrita'
  );
  assert(!sanitizedFriday.toLowerCase().includes('babe'), 'Friday strips babe');
  assert(sanitizedFriday.includes('Hrita'), 'Friday addresses Hrita');
  console.log(`  ✅ [PASS] Friday replaces pet names with user alias "Hrita": "${sanitizedFriday}"`);
}

// -----------------------------------------------------------------------------
// TEST 4: SpeakerPersonalityCortex Profile & Guest Cue Handling
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing SpeakerPersonalityCortex ---');
{
  const cortex = speakerPersonalityCortex;
  const hProfile = cortex.profiles.hritthik;
  assert(hProfile, 'Hritthik profile exists in cortex');
  assert(Array.isArray(hProfile.aliases), 'Hritthik profile has aliases');
  assert(hProfile.aliases.includes('Hrita'), 'Hritthik profile aliases include Hrita');
  assert(hProfile.personality.keywords.includes('hrita'), 'Keywords include hrita');

  // Explicit guest query mentioning Hrita: "is Hrita here"
  const guestResult = cortex.identifySpeaker({ text: 'Hello, is Hrita here today?' });
  assert.strictEqual(guestResult.speakerId, 'room_guest', 'Guest asking for Hrita is identified as room_guest');
  assert.strictEqual(guestResult.isGuest, true);
  console.log('  ✅ [PASS] SpeakerPersonalityCortex identifies external person asking for Hrita as room_guest');
}

// -----------------------------------------------------------------------------
// TEST 5: LocalCognitiveBrain "Who is Hrita" Multi-Agent Recall
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing LocalCognitiveBrain Identity Recall ---');
{
  const agents = [
    { key: 'tuktuk', name: 'Tuk Tuk' },
    { key: 'vision', name: 'Vision' },
    { key: 'friday', name: 'Friday' },
    { key: 'dd', name: 'DD' }
  ];
  const queries = ['who is Hrita', "who's Hrita", 'Hrita ke', 'হৃতা কে'];

  for (const q of queries) {
    for (const agent of agents) {
      const response = localBrain.synthesizeResponse(agent.key, agent.name, q, {}, 'en');
      assert(response, `Brain should return response for "${q}" via ${agent.name}`);
      const lower = response.toLowerCase();
      assert(
        lower.includes('architect') || lower.includes('creator') || lower.includes('আর্কিটেক্ট') || lower.includes('প্রতিষ্ঠাতা') || lower.includes('founder'),
        `Response for "${q}" via ${agent.name} must acknowledge architect/creator status (got: "${response}")`
      );
      assert(
        lower.includes('hritthik') || lower.includes('হৃত্তিক') || lower.includes('hrita') || lower.includes('হৃতা'),
        `Response for "${q}" via ${agent.name} must mention Hritthik or Hrita (got: "${response}")`
      );
    }
  }
  console.log('  ✅ [PASS] LocalCognitiveBrain answers "who is Hrita" / "Hrita ke" across all 4 squad agents with Creator/Architect confirmation');
}

// -----------------------------------------------------------------------------
// TEST 6: ActionRunner Architect Identity Dispatch
// -----------------------------------------------------------------------------
console.log('\n--- 6. Testing ActionRunner architect_identity_query ---');
(async () => {
  const jm = new JarvisManager();
  const mockAgent = { key: 'vision', name: 'Vision', voice: 'en-US-AndrewNeural' };

  const result = await actionRunner.handleAction('who is Hrita', mockAgent, jm);
  assert(result, 'ActionRunner handles "who is Hrita"');
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.action, 'architect_identity_query');
  assert.strictEqual(result.agentName, 'Vision');
  assert.strictEqual(result.data.chiefArchitect, 'Hritthik');
  assert.strictEqual(result.data.chiefArchitectAlias, 'Hrita');
  assert(result.speech.includes('Hritthik') || result.speech.includes('Hrita'), 'Speech mentions Hritthik/Hrita');
  console.log(`  ✅ [PASS] ActionRunner executed architect_identity_query: "${result.speech}"`);

  // Bengali variant
  const resultBn = await actionRunner.handleAction('Hrita ke', mockAgent, jm);
  assert(resultBn, 'ActionRunner handles Bengali "Hrita ke"');
  assert.strictEqual(resultBn.handled, true);
  assert(resultBn.speech.includes('হৃত্তিক') || resultBn.speech.includes('Hrita'), 'Bengali speech mentions Hritthik/Hrita');
  console.log(`  ✅ [PASS] ActionRunner executed Bengali architect_identity_query: "${resultBn.speech}"`);

  // -----------------------------------------------------------------------------
  // TEST 7: Preference Change "Call me Hrita"
  // -----------------------------------------------------------------------------
  console.log('\n--- 7. Testing User Preference Directive "Call me Hrita" ---');
  {
    const jm = new JarvisManager();
    
    // Directive: "call me Hrita"
    const pref = jm.detectPreferenceChange('call me Hrita');
    assert(pref, 'Preference change detected');
    assert.strictEqual(pref.type, 'name');
    assert.strictEqual(pref.value, 'Hrita');
    assert.strictEqual(pref.isAlias, true, 'Hrita recognized as alias');
    assert.strictEqual(jm.config.userName, 'Hrita');
    assert(jm.isUserName('Hrita'), 'jm recognizes Hrita as current userName');
    assert(jm.isUserName('Hritthik'), 'jm still recognizes Hritthik from userNameAliases');
    console.log('  ✅ [PASS] "call me Hrita" seamlessly updates active userName while preserving Hritthik identity');

    // Reset back to canonical "Hritthik"
    const resetPref = jm.detectPreferenceChange('call me Hritthik');
    assert.strictEqual(resetPref.value, 'Hritthik');
    assert.strictEqual(jm.config.userName, 'Hritthik');
    console.log('  ✅ [PASS] Reset back to "Hritthik" succeeded');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 7 HRITA USER IDENTITY & ALIAS RECOGNITION TESTS PASSED! (100%)');
  console.log('================================================================\n');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
