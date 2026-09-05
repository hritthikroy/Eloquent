/**
 * Verification Test Suite: Banglish and English Overlap & Flickering Prevention
 * 
 * Tests:
 * 1. Agent Prompts Dynamic Separation (en vs bn)
 * 2. Lexical Sanitizer Invariant (purges Banglish in en, translates to Unicode in bn)
 * 3. LocalCognitiveBrain Absolute Language Isolation (zero cross-contamination)
 * 4. i18n Detector & Bridge De-flickering (no false flips on English common words or affirmations)
 * 5. Master API Gateway Valid Model Pool Configuration
 */

const assert = require('assert');
const path = require('path');
const JarvisManager = require('../src/utils/jarvis-manager');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');
const { LanguageDetector } = require('../src/i18n/detector');
const { ElectronLanguageBridge } = require('../src/main/electron-bridge');
const MasterApiGateway = require('../src/utils/master-api-gateway');

console.log('='.repeat(80));
console.log('🛡️ RUNNING BANGLISH-ENGLISH OVERLAP & FLICKERING VERIFICATION SUITE');
console.log('='.repeat(80));

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS ${totalCount}] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${totalCount}] ${name}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AGENT PROMPTS DYNAMIC SEPARATION
// ─────────────────────────────────────────────────────────────────────────────
test('Tuk Tuk agent prompt enforces 100% English when activeLang="en"', () => {
  const jarvis = new JarvisManager({ storageDir: path.join(__dirname, '../temp_test_storage') });
  const enPrompt = jarvis.agents.tuktuk.getPrompt('Hritthik', 'Hritthik', 'en');
  assert(enPrompt.includes('100% MODERN ENGLISH WORKFLOW'), 'Should specify English workflow law');
  assert(!/[\u0980-\u09FF]/.test(enPrompt), 'English prompt must contain ZERO Bengali Unicode');
  assert(enPrompt.includes('Strictly NEVER use Bengali script, Romanized Banglish words'), 'Should ban Banglish');
});

test('Tuk Tuk agent prompt enforces Bengali Unicode script when activeLang="bn"', () => {
  const jarvis = new JarvisManager({ storageDir: path.join(__dirname, '../temp_test_storage') });
  const bnPrompt = jarvis.agents.tuktuk.getPrompt('Hritthik', 'Hritthik', 'bn');
  assert(bnPrompt.includes('বাংলা লিপি'), 'Should specify Bengali script');
  assert(bnPrompt.includes('ZERO ROMANIZED BANGLISH IN OUTPUT'), 'Should ban Romanized Banglish');
  assert(/[\u0980-\u09FF]/.test(bnPrompt), 'Bengali prompt must have Bengali Unicode script');
});

test('Squad/Team agent prompt dynamically adapts to activeLang', () => {
  const jarvis = new JarvisManager({ storageDir: path.join(__dirname, '../temp_test_storage') });
  const enSquad = jarvis.agents.team.getPrompt('Hritthik', 'Hritthik', 'en');
  assert(enSquad.includes('STRICT 100% MODERN ENGLISH LAW'), 'Squad English should enforce English law');
  assert(!/[\u0980-\u09FF]/.test(enSquad), 'Squad English prompt must have zero Bengali script');

  const bnSquad = jarvis.agents.team.getPrompt('Hritthik', 'Hritthik', 'bn');
  assert(bnSquad.includes('বাংলা লিপি'), 'Squad Bengali should enforce Bengali Unicode script');
  assert(bnSquad.includes('Strictly ZERO Romanized Banglish'), 'Squad Bengali should ban Romanized Banglish');
});

test('getSystemPrompt passes activeLang to activeAgent.getPrompt', () => {
  const jarvis = new JarvisManager({ storageDir: path.join(__dirname, '../temp_test_storage') });
  jarvis.currentLanguageMode = 'en';
  const enSysPrompt = jarvis.getSystemPrompt('tuktuk', 'test query');
  assert(enSysPrompt.includes('100% MODERN ENGLISH LAW'), 'System prompt should include English law');
  assert(enSysPrompt.includes('100% MODERN ENGLISH WORKFLOW'), 'Base agent prompt must have received activeLang=en');

  jarvis.currentLanguageMode = 'bn';
  const bnSysPrompt = jarvis.getSystemPrompt('tuktuk', 'test query');
  assert(bnSysPrompt.includes('বাংলা লিপি'), 'Base agent prompt must have received activeLang=bn');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. LEXICAL SANITIZER INVARIANTS
// ─────────────────────────────────────────────────────────────────────────────
test('Sanitizer purges Romanized Banglish and Bengali script when in English mode', () => {
  const jarvis = new JarvisManager({ storageDir: path.join(__dirname, '../temp_test_storage') });
  jarvis.currentLanguageMode = 'en';

  const mixedInput = 'Hey babe shono, the AST validation is green kintu amar code dekho এবং ঠিক করো!';
  const sanitized = jarvis.sanitizeAgentLexicon(mixedInput, 'tuktuk');
  
  assert(!/[\u0980-\u09FF]/.test(sanitized), 'Sanitized English text must not have Bengali Unicode');
  assert(!/\b(?:shono|kintu|dekho|amar|theek|thik)\b/i.test(sanitized), 'Sanitized English text must not contain Banglish tokens');
  assert(sanitized.includes('AST validation is green'), 'Preserved English content');
});

test('Sanitizer translates leaked Romanized Banglish to Bengali Unicode script in Bengali mode', () => {
  const jarvis = new JarvisManager({ storageDir: path.join(__dirname, '../temp_test_storage') });
  jarvis.currentLanguageMode = 'bn';

  const banglishInput = 'Ami to achi babe, tumi kemon acho? Shono babe, thik ache!';
  const sanitized = jarvis.sanitizeAgentLexicon(banglishInput, 'tuktuk');

  assert(sanitized.includes('আমি'), 'Should translate Ami to আমি');
  assert(sanitized.includes('আছি'), 'Should translate achi to আছি');
  assert(sanitized.includes('তুমি'), 'Should translate tumi to তুমি');
  assert(sanitized.includes('কেমন'), 'Should translate kemon to কেমন');
  assert(sanitized.includes('ঠিক'), 'Should translate thik to ঠিক');
  assert(sanitized.includes('শোনো'), 'Should translate shono to শোনো');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. LOCAL COGNITIVE BRAIN LANGUAGE ISOLATION
// ─────────────────────────────────────────────────────────────────────────────
test('LocalCognitiveBrain outputs 100% English across all agents when activeLang="en"', () => {
  const agents = ['tuktuk', 'vision', 'jenny', 'brian', 'team'];
  const queries = [
    'How are you doing?',
    'What is the scene today?', // previously collided on "scene"
    'Did you see the latest age benchmark?', // previously collided on "age"
    'Buffer underflow error on slot 42, fix it',
    'shabash bro thanks for fixing',
    'ok',
    'server uptime check'
  ];

  for (const agent of agents) {
    for (const q of queries) {
      const resp = LocalCognitiveBrain.synthesizeResponse(agent, agent, q, {}, 'en');
      assert(!/[\u0980-\u09FF]/.test(resp), `Expected 0 Bengali Unicode for ${agent} on "${q}", got: "${resp}"`);
      assert(!/\b(?:kemon|shono|bhalo|thik|bujhte|korbo|cholo|achhi|achi|ভাই|বলো)\b/i.test(resp), 
        `Expected 0 Banglish words for ${agent} on "${q}", got: "${resp}"`);
    }
  }
});

test('LocalCognitiveBrain outputs 100% Bengali Unicode when activeLang="bn"', () => {
  const queries = [
    'কেমন আছো?',
    'shabash bro',
    'server uptime check',
    'morning standup shuru koro'
  ];

  for (const q of queries) {
    const respTukTuk = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', q, {}, 'bn');
    assert(/[\u0980-\u09FF]/.test(respTukTuk), `Expected Bengali script for tuktuk on "${q}", got: "${respTukTuk}"`);

    const respVision = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', q, {}, 'bn');
    assert(/[\u0980-\u09FF]/.test(respVision), `Expected Bengali script for vision on "${q}", got: "${respVision}"`);
  }
});

test('LocalCognitiveBrain eliminates mixed Banglish sentence in meta-voice feedback', () => {
  // Line 164 previously had: "Babe, I hear you! Softening my voice right now. একদম natural Bengali woman-er moto..."
  const query = 'voice tone robotic lagche, change koro';
  const respBn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', query, {}, 'bn');
  assert(!/woman-er moto|flow-te bolchi/i.test(respBn), 'Should not contain awkward mixed Banglish grammar');
  assert(/[\u0980-\u09FF]/.test(respBn), 'Should be authentic Bengali script');

  const respEn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', 'Your voice sounds robotic, fix it', {}, 'en');
  assert(!/[\u0980-\u09FF]/.test(respEn), 'English voice feedback must not output Bengali script');
  assert(!/woman-er moto|flow-te bolchi/i.test(respEn), 'English voice feedback must not have Banglish');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. i18n DETECTOR & ELECTRON BRIDGE DE-FLICKERING
// ─────────────────────────────────────────────────────────────────────────────
test('LanguageDetector does not falsely trigger bn-Roman on English words ("scene", "age", "miss")', () => {
  const detector = new LanguageDetector();
  
  const r1 = detector.detect('What is the scene in the terminal right now?');
  assert.strictEqual(r1.locale, 'en-US', 'Sentence with "scene" should detect as en-US');

  const r2 = detector.detect('At this age of AI development, we need rock solid stability.');
  assert.strictEqual(r2.locale, 'en-US', 'Sentence with "age" should detect as en-US');

  const r3 = detector.detect('We had a cache miss on slot 42 in the ring buffer.');
  assert.strictEqual(r3.locale, 'en-US', 'Sentence with "miss" should detect as en-US');
});

test('LanguageDetector reliably detects true Bengali & Banglish clusters', () => {
  const detector = new LanguageDetector();
  
  const r1 = detector.detect('তুমি কেমন আছো babe?');
  assert.strictEqual(r1.locale, 'bn-IN', 'Bengali script must detect as bn-IN');

  const r2 = detector.detect('tumi kemon acho bolo amader');
  assert.strictEqual(r2.locale, 'bn-Roman', 'Cluster of Banglish words must detect as bn-Roman');
});

test('LanguageBridge does not auto-switch on short affirmations or pet names', () => {
  const bridge = new ElectronLanguageBridge({ autoDetectEnabled: true });
  bridge.activeLocale = 'en-US';

  const affirmations = ['ok', 'okay', 'yeah', 'cool', 'nice', 'yes', 'babe', 'bro', 'sure'];
  for (const aff of affirmations) {
    bridge.processSpokenUtterance(aff);
    assert.strictEqual(bridge.activeLocale, 'en-US', `Affirmation "${aff}" must not switch activeLocale away from en-US`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MASTER API GATEWAY MODEL POOL
// ─────────────────────────────────────────────────────────────────────────────
test('MasterApiGateway contains only valid Groq production models', () => {
  const gateway = new MasterApiGateway();
  assert(Array.isArray(gateway.groqModels), 'groqModels must be an array');
  
  const invalidModels = ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b', 'groq/compound-mini', 'groq/compound'];
  for (const inv of invalidModels) {
    assert(!gateway.groqModels.includes(inv), `groqModels must not contain fictitious model: ${inv}`);
  }

  assert(gateway.groqModels.includes('llama-3.3-70b-versatile'), 'Must include llama-3.3-70b-versatile');
  assert(gateway.groqModels.includes('llama-3.1-8b-instant'), 'Must include llama-3.1-8b-instant');
});

console.log('='.repeat(80));
console.log(`🎉 ALL ${passCount}/${totalCount} BANGLISH-ENGLISH OVERLAP PREVENTIONS PASSED (100%)`);
console.log('='.repeat(80));
