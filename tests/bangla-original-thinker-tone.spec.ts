/**
 * tests/bangla-original-thinker-tone.spec.ts
 *
 * Comprehensive Test Suite for:
 * "bangla talk like robotic not english like orginal thinker and change the tone"
 *
 * Verifies:
 * 1. TextSanitizer STT normalization of the user prompt & typo permutations ("orginal" -> "original")
 * 2. ActionRunner directive interception with rich telemetry (banglaOriginalThinkerScore: 1.0)
 * 3. Dynamic directive persistence (bangla_original_thinker_mode = true)
 * 4. Agent persona salutation & tone isolation (Tuk Tuk = babe, Vision = brother/ভাই, Friday = Chief/হৃত্তিক, DD = bro)
 * 5. LocalCognitiveBrain responses across all 4 individual agents and Team mode (English & Bengali)
 * 6. JarvisManager LAW 25: 100% ORIGINAL THINKER IN BANGLA & NATURAL CONVERSATIONAL TONE LAW
 * 7. Tuk Tuk system prompt: First-principles thinking natively in Bengali, dynamic 15-50 word adaptive pacing
 * 8. Zero robotic translation-bot syntax and zero canned soothing loops in Bengali
 */

import * as assert from 'assert';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');
const TextSanitizer = require(path.join(projectRoot, 'src/utils/prompt-engine/text-sanitizer'));
const ActionRunner = require(path.join(projectRoot, 'src/utils/action-runner'));
const LocalCognitiveBrain = require(path.join(projectRoot, 'src/utils/local-cognitive-brain'));
const JarvisManager = require(path.join(projectRoot, 'src/utils/jarvis-manager'));

let testsPassed = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        console.log(`  ✅ [PASS ${totalTests}] ${name}`);
        testsPassed++;
      }).catch((err: Error) => {
        console.error(`  ❌ [FAIL ${totalTests}] ${name}`);
        console.error(`     Error: ${err.message}`);
        process.exitCode = 1;
      });
    }
    console.log(`  ✅ [PASS ${totalTests}] ${name}`);
    testsPassed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL ${totalTests}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('================================================================================');
  console.log('🧠 VERIFYING BANGLA ORIGINAL THINKER & AUTHENTIC TONE RECALIBRATION');
  console.log('   (Tuk Tuk, Vision, Friday, DD & Squad Native First-Principles Cognition)');
  console.log('================================================================================\n');

  const rawPrompt = "bangla talk like robotic not english like orginal thinker and change the tone";
  let savedDirective = "";
  let savedTarget = "";
  let preferenceKey = "";
  let preferenceValue = "";

  const jarvisManagerMock = {
    saveDynamicDirective: (dir: string, target: string) => {
      savedDirective = dir;
      savedTarget = target;
    },
    setPreference: (k: string, v: string) => {
      preferenceKey = k;
      preferenceValue = v;
    }
  };

  // 1. TextSanitizer STT Acoustic Normalization
  runTest('1. TextSanitizer normalizes phonetic typos and the exact prompt into canonical form', () => {
    const sanitized = TextSanitizer.sanitize(rawPrompt);
    console.log(`     Raw:       "${rawPrompt}"`);
    console.log(`     Sanitized: "${sanitized}"`);

    assert.ok(
      sanitized.toLowerCase().includes('original thinker'),
      'Corrects "orginal" typo to "original thinker"'
    );
    assert.ok(
      sanitized.toLowerCase().includes('bangla talk is like a robot') ||
      sanitized.toLowerCase().includes('robot') ||
      sanitized.toLowerCase().includes('change the tone'),
      'Sanitizer captures canonical intent for bangla original thinker directive'
    );

    // Test standalone typo fixes
    const standaloneTypo = TextSanitizer.sanitize("he is an orginal thinker in bangla");
    assert.ok(standaloneTypo.includes("original thinker"), 'Replaces standalone "orginal thinker"');
  });

  // 2. ActionRunner Interception & Telemetry for Tuk Tuk (English)
  await runTest('2. ActionRunner intercepts directive for Tuk Tuk with structured telemetry and loving partner tone', async () => {
    const res = await ActionRunner.handleAction(
      rawPrompt,
      { key: 'tuktuk', name: 'Tuk Tuk' },
      jarvisManagerMock,
      'en'
    );

    assert.strictEqual(res.handled, true, 'ActionRunner handles the bangla original thinker directive');
    assert.strictEqual(res.action, 'bangla_original_thinker_tone_directive', 'Action key matches');
    assert.ok(res.speech.includes('babe'), 'Tuk Tuk addresses Hritthik strictly as babe');
    assert.ok(!res.speech.includes('bro'), 'Tuk Tuk never calls Hritthik bro');
    assert.ok(!res.speech.includes('Chief'), 'Tuk Tuk never calls Hritthik Chief');

    assert.ok(res.data, 'Telemetry data is present');
    assert.strictEqual(res.data.banglaOriginalThinkerScore, 1.0, 'Bangla original thinker score is 1.0');
    assert.strictEqual(res.data.bilingualParityScore, 1.0, 'Bilingual parity score is 1.0');
    assert.strictEqual(res.data.roboticTalkPurged, true, 'Robotic talk purged flag is true');
    assert.strictEqual(res.data.pacingMode, 'dynamic_original_thinker_15_50', 'Pacing mode updated to 15-50 words');
    assert.strictEqual(res.data.status, 'ORIGINAL_THINKER_LOCKED', 'Status confirms original thinker locked');
  });

  // 3. ActionRunner Interception in Bengali for Tuk Tuk
  await runTest('3. ActionRunner responds in authentic Dhaka co-founder tone for Tuk Tuk in Bengali', async () => {
    const res = await ActionRunner.handleAction(
      rawPrompt,
      { key: 'tuktuk', name: 'Tuk Tuk' },
      jarvisManagerMock,
      'bn'
    );

    assert.strictEqual(res.handled, true, 'ActionRunner handles the directive in Bengali');
    assert.ok(res.speech.includes('babe'), 'Tuk Tuk calls him babe in Bengali response');
    assert.ok(res.speech.includes('অরিজিনাল') || res.speech.includes('রোবটিক'), 'Response references original thinking');
    assert.ok(!res.speech.includes('ভাই'), 'Tuk Tuk never calls Hritthik bhai');
    assert.ok(!res.speech.includes('আপনি'), 'Tuk Tuk never uses formal aapni');
  });

  // 4. ActionRunner Interception for Vision, Friday, DD & Squad
  await runTest('4. ActionRunner isolates persona salutations across Vision, Friday, DD and Squad', async () => {
    const visionRes = await ActionRunner.handleAction(
      rawPrompt,
      { key: 'vision', name: 'Vision' },
      jarvisManagerMock,
      'en'
    );
    assert.strictEqual(visionRes.handled, true, 'Vision handles directive');
    assert.ok(visionRes.speech.includes('brother') || visionRes.speech.includes('bro'), 'Vision calls him brother/bro');
    assert.ok(!visionRes.speech.includes('babe'), 'Vision never calls him babe');

    const fridayRes = await ActionRunner.handleAction(
      rawPrompt,
      { key: 'friday', name: 'Friday' },
      jarvisManagerMock,
      'en'
    );
    assert.strictEqual(fridayRes.handled, true, 'Friday handles directive');
    assert.ok(fridayRes.speech.includes('Chief') || fridayRes.speech.includes('Hritthik'), 'Friday calls him Chief/Hritthik');
    assert.ok(!fridayRes.speech.includes('babe'), 'Friday never calls him babe');
    assert.ok(!fridayRes.speech.includes('bro'), 'Friday never calls him bro');

    const ddRes = await ActionRunner.handleAction(
      rawPrompt,
      { key: 'dd', name: 'DD' },
      jarvisManagerMock,
      'en'
    );
    assert.strictEqual(ddRes.handled, true, 'DD handles directive');
    assert.ok(ddRes.speech.includes('bro'), 'DD calls him bro');
    assert.ok(!ddRes.speech.includes('babe'), 'DD never calls him babe');

    const squadRes = await ActionRunner.handleAction(
      rawPrompt,
      { key: 'team', name: 'Team' },
      jarvisManagerMock,
      'en'
    );
    assert.strictEqual(squadRes.handled, true, 'Squad handles directive');
    assert.ok(squadRes.speech.includes('[Tuk Tuk]:'), 'Squad standup includes Tuk Tuk');
    assert.ok(squadRes.speech.includes('[Vision]:'), 'Squad standup includes Vision');
    assert.ok(squadRes.speech.includes('[Friday]:'), 'Squad standup includes Friday');
    assert.ok(squadRes.speech.includes('[DD]:'), 'Squad standup includes DD');
  });

  // 5. LocalCognitiveBrain Synthesis across All Agents
  runTest('5. LocalCognitiveBrain generates authentic original thinker responses for all agents', () => {
    // Tuk Tuk
    const ttBn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', rawPrompt, {}, 'bn');
    assert.ok(ttBn && (ttBn.includes('babe') || ttBn.includes('Babe')), 'Local Tuk Tuk bn has babe');
    const ttEn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', rawPrompt, {}, 'en');
    assert.ok(ttEn && (ttEn.includes('babe') || ttEn.includes('Babe')), 'Local Tuk Tuk en has babe');

    // Vision
    const visBn = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', rawPrompt, {}, 'bn');
    assert.ok(visBn && (visBn.includes('ভাই') || visBn.includes('brother')), 'Local Vision bn has brother/bhai');
    assert.ok(!visBn.includes('babe'), 'Local Vision bn has zero babe');

    // Friday
    const friBn = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', rawPrompt, {}, 'bn');
    assert.ok(friBn && (friBn.includes('Chief') || friBn.includes('Hritthik')), 'Local Friday bn has Chief/Hritthik');
    assert.ok(!friBn.includes('babe'), 'Local Friday bn has zero babe');

    // DD
    const ddBn = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', rawPrompt, {}, 'bn');
    assert.ok(ddBn && (ddBn.includes('bro') || ddBn.includes('ইঞ্জিনিয়ারিং')), 'Local DD bn has authentic DevOps tone');
    assert.ok(!ddBn.includes('babe'), 'Local DD bn has zero babe');

    // Team
    const teamBn = LocalCognitiveBrain.synthesizeResponse('team', 'Team', rawPrompt, {}, 'bn');
    assert.ok(teamBn && teamBn.includes('[Tuk Tuk]:') && teamBn.includes('[Vision]:'), 'Local Team bn has full squad');
  });

  // 6. JarvisManager LAW 25 & System Prompt Invariants
  runTest('6. JarvisManager injects LAW 25 (100% ORIGINAL THINKER IN BANGLA) into system prompts', () => {
    const jm = new JarvisManager();
    const systemPromptBn = jm.getSystemPrompt('tuktuk', 'Hritthik', 'babe', 'bn');

    assert.ok(
      systemPromptBn.includes('25. 100% ORIGINAL THINKER IN BANGLA & NATURAL CONVERSATIONAL TONE LAW'),
      'Contains LAW 25 header'
    );
    assert.ok(
      systemPromptBn.includes('ZERO TRANSLATION-BOT SYNDROME'),
      'Explicitly forbids translation-bot syndrome'
    );
    assert.ok(
      systemPromptBn.includes('FIRST-PRINCIPLES COGNITION') || systemPromptBn.includes('First-Principles Cognition'),
      'Commands first-principles cognition natively in Bengali'
    );
    assert.ok(
      systemPromptBn.includes('DYNAMIC ADAPTIVE PACING (15 TO 50 WORDS)'),
      'Permits 15-50 word dynamic thought expansion'
    );
    assert.ok(
      systemPromptBn.includes('ISOMORPHIC INTELLECTUAL PARITY'),
      'Enforces Isomorphic Intellectual Parity between English and Bengali'
    );
    assert.ok(
      systemPromptBn.includes('100% ORIGINAL THINKER IN BANGLA & NATURAL SPOKEN CONVERSATIONAL PACING'),
      'Tuk Tuk prompt contains original thinker pacing directive'
    );
  });

  // 7. Bengali Pacing & Anti-Translation-Bot Verification
  runTest('7. Bengali prompt removes rigid 16-18 word caps in favor of dynamic first-principles reasoning', () => {
    const jm = new JarvisManager();
    const systemPromptBn = jm.getSystemPrompt('tuktuk', 'Hritthik', 'babe', 'bn');

    assert.ok(
      !systemPromptBn.includes('(up to 16 to 18 words max)'),
      'Purged restrictive 16-18 words max from Bengali languageInvariantLaw'
    );
    assert.ok(
      systemPromptBn.includes('35–50 words') || systemPromptBn.includes('35-50 words'),
      'Bengali language invariant includes up to 35-50 words for deep reasoning'
    );
  });

  console.log(`\n================================================================================`);
  console.log(`🏁 TEST COMPLETE: ${testsPassed} of ${totalTests} assertions PASSED`);
  console.log(`================================================================================\n`);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
