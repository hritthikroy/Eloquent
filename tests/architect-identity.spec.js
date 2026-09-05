const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
const actionRunner = require('../src/utils/action-runner');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');

describe('Architect Identity & Hierarchy Test Suite', () => {
  test('1. TextSanitizer: phonetic normalization for "who is the arcitecture"', () => {
    const variations = [
      { input: 'who is the arcitecture', expected: 'who is the architect' },
      { input: 'who is the arkitecture', expected: 'who is the architect' },
      { input: 'who is the architechture', expected: 'who is the architect' },
      { input: 'who is the arcitect', expected: 'who is the architect' },
      { input: 'who is the arkitect', expected: 'who is the architect' },
      { input: 'system arcitecture review', expected: 'system architecture review' },
      { input: 'lead arcitect vision', expected: 'lead architect vision' }
    ];

    for (const { input, expected } of variations) {
      const sanitized = TextSanitizer.sanitize(input);
      assert.strictEqual(
        sanitized.toLowerCase().includes(expected.toLowerCase()),
        true,
        `Expected "${sanitized}" to include "${expected}" for input "${input}"`
      );
    }
  });

  test('2. ActionRunner: handles architect identity query across all agent keys', async () => {
    // 1. Tuk Tuk (English)
    const tuktukRes = await actionRunner.handleAction('who is the arcitecture', {
      key: 'tuktuk',
      name: 'Tuk Tuk',
      voice: 'en-US-AvaMultilingualNeural'
    }, null, 'en');
    assert.strictEqual(tuktukRes.handled, true);
    assert.strictEqual(tuktukRes.action, 'architect_identity_query');
    assert.ok(tuktukRes.speech.includes('Hritthik'));
    assert.ok(tuktukRes.speech.includes('Chief Architect'));
    assert.ok(tuktukRes.data.chiefArchitect === 'Hritthik');
    assert.ok(tuktukRes.data.systemsArchitect === 'Vision');

    // 2. Vision (English)
    const visionRes = await actionRunner.handleAction('who is the architect', {
      key: 'vision',
      name: 'Vision',
      voice: 'en-US-AndrewNeural'
    }, null, 'en');
    assert.strictEqual(visionRes.handled, true);
    assert.strictEqual(visionRes.action, 'architect_identity_query');
    assert.ok(visionRes.speech.includes('Chief Architect'));
    assert.ok(visionRes.speech.includes('Lead Systems Architect'));

    // 3. DD (Bangla / Banglish)
    const ddRes = await actionRunner.handleAction('architect ke', {
      key: 'dd',
      name: 'DD',
      voice: 'en-US-BrianMultilingualNeural'
    }, null, 'bn');
    assert.strictEqual(ddRes.handled, true);
    assert.strictEqual(ddRes.action, 'architect_identity_query');
    assert.ok(ddRes.speech.includes('চিফ আর্কিটেক্ট') || ddRes.speech.includes('Chief Architect'));

    // 4. Friday (English)
    const fridayRes = await actionRunner.handleAction('who designed the architecture', {
      key: 'friday',
      name: 'Friday',
      voice: 'en-US-JennyNeural'
    }, null, 'en');
    assert.strictEqual(fridayRes.handled, true);
    assert.strictEqual(fridayRes.action, 'architect_identity_query');
    assert.ok(fridayRes.speech.includes('Chief Architect') || fridayRes.speech.includes('Hritthik'));

    // 5. Team mode
    const teamRes = await actionRunner.handleAction('who is the arcitecture', {
      key: 'team',
      name: 'Squad',
      voice: 'en-US-AvaMultilingualNeural'
    }, null, 'en');
    assert.strictEqual(teamRes.handled, true);
    assert.strictEqual(teamRes.action, 'architect_identity_query');
    assert.ok(teamRes.speech.includes('[Tuk Tuk]'));
    assert.ok(teamRes.speech.includes('[Vision]'));
  });

  test('3. LocalCognitiveBrain: returns grounded responses for architect queries across all personas', () => {
    const queries = [
      'who is the arcitecture',
      'who is the architect',
      'who designed the architecture',
      'who is architecture'
    ];

    for (const q of queries) {
      // Tuk Tuk
      const tuktukOutput = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', q, {}, 'en');
      assert.ok(tuktukOutput, `Tuk Tuk should return a response for "${q}"`);
      assert.ok(
        tuktukOutput.toLowerCase().includes('architect') || tuktukOutput.includes('আর্কিটেক্ট'),
        `Tuk Tuk output should affirm architect for "${q}"`
      );

      // Vision
      const visionOutput = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', q, {}, 'en');
      assert.ok(visionOutput, `Vision should return a response for "${q}"`);
      assert.ok(
        visionOutput.toLowerCase().includes('architect') || visionOutput.includes('আর্কিটেক্ট'),
        `Vision output should affirm architect for "${q}"`
      );

      // Friday
      const fridayOutput = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', q, {}, 'en');
      assert.ok(fridayOutput, `Friday should return a response for "${q}"`);
      assert.ok(
        fridayOutput.toLowerCase().includes('architect') || fridayOutput.includes('আর্কিটেক্ট'),
        `Friday output should affirm architect for "${q}"`
      );

      // DD
      const ddOutput = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', q, {}, 'en');
      assert.ok(ddOutput, `DD should return a response for "${q}"`);
      assert.ok(
        ddOutput.toLowerCase().includes('architect') || ddOutput.includes('আর্কিটেক্ট'),
        `DD output should affirm architect for "${q}"`
      );

      // Team
      const teamOutput = LocalCognitiveBrain.synthesizeResponse('team', 'Squad', q, {}, 'en');
      assert.ok(teamOutput, `Team should return a response for "${q}"`);
      assert.ok(
        teamOutput.includes('[Tuk Tuk]') && teamOutput.includes('[Vision]'),
        `Team output should include squad perspective for "${q}"`
      );
    }
  });

  test('4. Bengali queries to LocalCognitiveBrain return rich Bengali responses', () => {
    const qBn = 'কে আর্কিটেক্ট';

    const ttBn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', qBn, {}, 'bn');
    assert.ok(ttBn.includes('চিফ আর্কিটেক্ট') || ttBn.includes('আর্কিটেক্ট'));
    assert.ok(ttBn.includes('Hritthik') || ttBn.includes('babe') || ttBn.includes('Babe'));

    const visBn = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', qBn, {}, 'bn');
    assert.ok(visBn.includes('চিফ আর্কিটেক্ট') || visBn.includes('আর্কিটেক্ট'));
    assert.ok(visBn.includes('ভাই') || visBn.includes('brother'));

    const teamBn = LocalCognitiveBrain.synthesizeResponse('team', 'Squad', qBn, {}, 'bn');
    assert.ok(teamBn.includes('[Tuk Tuk]'));
    assert.ok(teamBn.includes('[Vision]'));
    assert.ok(teamBn.includes('চিফ আর্কিটেক্ট') || teamBn.includes('আর্কিটেক্ট'));
  });
});
