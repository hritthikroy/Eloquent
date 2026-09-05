const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
const actionRunner = require('../src/utils/action-runner');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');

describe('Squad Bangla Voice Calibration & Multi-Agent Persona Invariants', () => {
  test('1. TextSanitizer: phonetic normalization for multi-agent Bangla voice query', () => {
    const rawInput = 'fix vison bangal dd bangal and fryday bangal fix all the issues';
    const sanitized = TextSanitizer.sanitize(rawInput);

    // Verify normalization
    assert.ok(
      sanitized.includes('Vision Bangla') || sanitized.includes('vision bangla'),
      `Expected sanitized text to contain "Vision Bangla", got: "${sanitized}"`
    );
    assert.ok(
      sanitized.includes('DD Bangla') || sanitized.includes('dd bangla'),
      `Expected sanitized text to contain "DD Bangla", got: "${sanitized}"`
    );
    assert.ok(
      sanitized.includes('Friday Bangla') || sanitized.includes('friday bangla'),
      `Expected sanitized text to contain "Friday Bangla", got: "${sanitized}"`
    );

    // Test individual phrase sanitization
    assert.strictEqual(TextSanitizer.sanitize('vison bangal'), 'Vision Bangla');
    assert.strictEqual(TextSanitizer.sanitize('dd bangal'), 'DD Bangla');
    assert.strictEqual(TextSanitizer.sanitize('fryday bangal'), 'Friday Bangla');
  });

  test('2. ActionRunner: handles squad Bangla voice fix directive and assigns locked voices', async () => {
    const rawQuery = 'fix vison bangal dd bangal and fryday bangal fix all the issues';
    
    // English run
    const resEn = await actionRunner.handleAction(rawQuery, {
      key: 'team',
      name: 'Squad',
      voice: 'bn-BD-PradeepNeural'
    }, null, 'en');

    assert.strictEqual(resEn.handled, true);
    assert.strictEqual(resEn.data.action, 'squad_bangla_voice_calibration');
    assert.deepStrictEqual(resEn.data.target, ['vision', 'friday', 'dd']);
    assert.strictEqual(resEn.data.voices.vision, 'bn-BD-PradeepNeural');
    assert.strictEqual(resEn.data.voices.friday, 'en-US-EmmaMultilingualNeural');
    assert.strictEqual(resEn.data.voices.dd, 'en-US-BrianMultilingualNeural');
    assert.strictEqual(resEn.data.status, 'CALIBRATED_NATURAL_HUMAN');

    // Speech persona checks
    assert.ok(resEn.speech.includes('bn-BD-PradeepNeural'));
    assert.ok(resEn.speech.includes('brother'));
    assert.ok(resEn.speech.includes('Chief'));
    assert.ok(resEn.speech.includes('bro'));

    // Strictly forbidden invariant: Vision, Friday, DD must NEVER call user "babe"
    assert.strictEqual(
      resEn.speech.toLowerCase().includes('babe'),
      false,
      'Vision, Friday, and DD must strictly NEVER use "babe"'
    );

    // Bengali run
    const resBn = await actionRunner.handleAction(rawQuery, {
      key: 'team',
      name: 'Squad',
      voice: 'bn-BD-PradeepNeural'
    }, null, 'bn');

    assert.strictEqual(resBn.handled, true);
    assert.strictEqual(resBn.data.action, 'squad_bangla_voice_calibration');
    assert.strictEqual(resBn.data.voices.vision, 'bn-BD-PradeepNeural');
    assert.strictEqual(resBn.data.voices.friday, 'en-US-EmmaMultilingualNeural');
    assert.strictEqual(resBn.data.voices.dd, 'en-US-BrianMultilingualNeural');

    assert.ok(resBn.speech.includes('ভাই'));
    assert.ok(resBn.speech.includes('Chief'));
    assert.ok(resBn.speech.includes('bro'));
    assert.strictEqual(
      resBn.speech.toLowerCase().includes('babe'),
      false,
      'Vision, Friday, and DD in Bengali must strictly NEVER use "babe"'
    );
  });

  test('3. LocalCognitiveBrain: Tuk Tuk response for squad Bangla directive', () => {
    const rawQuery = 'fix vison bangal dd bangal and fryday bangal fix all the issues';

    // English
    const tuktukEn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', rawQuery, {}, 'en');
    assert.ok(tuktukEn.toLowerCase().includes('babe'), 'Tuk Tuk must address user as "babe"');
    assert.ok(tuktukEn.includes('Vision'));
    assert.ok(tuktukEn.includes('DD'));
    assert.ok(tuktukEn.includes('Friday'));

    // Bengali
    const tuktukBn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', rawQuery, {}, 'bn');
    assert.ok(tuktukBn.toLowerCase().includes('babe'), 'Tuk Tuk in Bengali must address user as "babe"');
    assert.ok(tuktukBn.includes('ভিশন'));
    assert.ok(tuktukBn.includes('ডিডি'));
    assert.ok(tuktukBn.includes('ফ্রাইডে'));
  });

  test('4. LocalCognitiveBrain: Vision response for squad Bangla directive', () => {
    const rawQuery = 'fix vison bangal dd bangal and fryday bangal fix all the issues';

    // English
    const visionEn = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', rawQuery, {}, 'en');
    assert.ok(visionEn.includes('brother'), 'Vision must address user with brotherly tone');
    assert.ok(visionEn.includes('bn-BD-PradeepNeural'));
    assert.ok(visionEn.includes('220Hz'));
    assert.strictEqual(visionEn.toLowerCase().includes('babe'), false, 'Vision must NEVER use "babe"');

    // Bengali
    const visionBn = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', rawQuery, {}, 'bn');
    assert.ok(visionBn.includes('ভাই') || visionBn.includes('brother'), 'Vision Bengali must address user with brotherly tone');
    assert.ok(visionBn.includes('PradeepNeural'));
    assert.strictEqual(visionBn.toLowerCase().includes('babe'), false, 'Vision Bengali must NEVER use "babe"');
  });

  test('5. LocalCognitiveBrain: Friday response for squad Bangla directive', () => {
    const rawQuery = 'fix vison bangal dd bangal and fryday bangal fix all the issues';

    // English
    const fridayEn = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', rawQuery, {}, 'en');
    assert.ok(fridayEn.includes('Chief') || fridayEn.includes('Hritthik'), 'Friday must address user as Chief or Hritthik');
    assert.ok(fridayEn.includes('EmmaMultilingual'));
    assert.strictEqual(fridayEn.toLowerCase().includes('babe'), false, 'Friday must NEVER use "babe"');

    // Bengali
    const fridayBn = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', rawQuery, {}, 'bn');
    assert.ok(fridayBn.includes('Chief') || fridayBn.includes('Hritthik'), 'Friday Bengali must address user as Chief or Hritthik');
    assert.strictEqual(fridayBn.toLowerCase().includes('babe'), false, 'Friday Bengali must NEVER use "babe"');
  });

  test('6. LocalCognitiveBrain: DD response for squad Bangla directive', () => {
    const rawQuery = 'fix vison bangal dd bangal and fryday bangal fix all the issues';

    // English
    const ddEn = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', rawQuery, {}, 'en');
    assert.ok(ddEn.includes('bro'), 'DD must address user as "bro"');
    assert.ok(ddEn.includes('BrianMultilingual'));
    assert.ok(ddEn.includes('sub-15ms') || ddEn.includes('latency'));
    assert.strictEqual(ddEn.toLowerCase().includes('babe'), false, 'DD must NEVER use "babe"');

    // Bengali
    const ddBn = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', rawQuery, {}, 'bn');
    assert.ok(ddBn.includes('bro'), 'DD Bengali must address user as "bro"');
    assert.strictEqual(ddBn.toLowerCase().includes('babe'), false, 'DD Bengali must NEVER use "babe"');
  });

  test('7. LocalCognitiveBrain: Team response for squad Bangla directive', () => {
    const rawQuery = 'fix vison bangal dd bangal and fryday bangal fix all the issues';

    // English
    const teamEn = LocalCognitiveBrain.synthesizeResponse('team', 'Squad', rawQuery, {}, 'en');
    assert.ok(teamEn.includes('[Tuk Tuk]:'));
    assert.ok(teamEn.includes('[Vision]:'));
    assert.ok(teamEn.includes('[Friday]:'));
    assert.ok(teamEn.includes('[DD]:'));

    // Persona checks in team English
    assert.ok(teamEn.includes('Babe, all Bengali speech issues'));
    assert.ok(teamEn.includes('brother'));
    assert.ok(teamEn.includes('Chief'));
    assert.ok(teamEn.includes('bro'));

    // Count occurrences of "babe" (must only occur in Tuk Tuk's line)
    const babeMatchesEn = teamEn.match(/babe/gi) || [];
    assert.strictEqual(babeMatchesEn.length, 1, 'Only Tuk Tuk may use "babe" in Team mode');

    // Bengali
    const teamBn = LocalCognitiveBrain.synthesizeResponse('team', 'Squad', rawQuery, {}, 'bn');
    assert.ok(teamBn.includes('[Tuk Tuk]:'));
    assert.ok(teamBn.includes('[Vision]:'));
    assert.ok(teamBn.includes('[Friday]:'));
    assert.ok(teamBn.includes('[DD]:'));

    assert.ok(teamBn.includes('Babe, ভিশন'));
    assert.ok(teamBn.includes('ভাই'));
    assert.ok(teamBn.includes('Chief'));
    assert.ok(teamBn.includes('bro'));

    const babeMatchesBn = teamBn.match(/babe/gi) || [];
    assert.strictEqual(babeMatchesBn.length, 1, 'Only Tuk Tuk may use "babe" in Team mode (Bengali)');
  });
});
