/**
 * Test Suite: Bangla Normalization and Correction Pipeline
 * 
 * Verifies:
 * 1. Unicode NFC canonicalization and zero-width character stripping.
 * 2. Split vowel sign (matra) correction (O-kar, Ou-kar, Ai-kar).
 * 3. Precomposed Nukta character normalization (ড়, ঢ়, য়).
 * 4. Khanda-Ta canonicalization.
 * 5. Duplicate matra/hasant deduplication.
 * 6. Dari (।) spacing normalization.
 * 7. 'validate-bangla-text' IPC channel handling and registration.
 * 8. Tuk Tuk persona output formatting.
 * 9. ContentDisplay component lifecycle & Bengali script detection.
 */

const Module = require('module');
const origRequire = Module.prototype.require;

// Lightweight headless React mock for Node runner
Module.prototype.require = function (id) {
  if (id === 'react') {
    return {
      useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
      useEffect: (cb) => {
        const cleanup = cb();
        if (typeof cleanup === 'function') cleanup();
      },
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
      useRef: (init) => ({ current: init }),
      createElement: (type, props, ...children) => ({ type, props, children })
    };
  }
  return origRequire.apply(this, arguments);
};

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Import compiled dist-ts modules
const { normalizeBanglaText, registerConversationIpcHandlers } = require('../dist-ts/src/main/ipc-handlers');
const { isBengaliText, ContentDisplay } = require('../dist-ts/src/renderer/components/ContentDisplay');

test('Bangla Normalization and Correction Pipeline Spec', async (t) => {
  await t.test('1. Split Matra (Vowel Sign) Correction', () => {
    // 1.1 Split O-kar (e-kar + aa-kar -> o-kar \u09CB)
    const splitO = 'ক\u09C7\u09BE'; // ক + ে + া
    const expectedO = 'কো';
    assert.strictEqual(normalizeBanglaText(splitO), expectedO);

    // 1.2 Inverted Split O-kar (aa-kar + e-kar -> o-kar)
    const invertedO = 'ক\u09BE\u09C7';
    assert.strictEqual(normalizeBanglaText(invertedO), expectedO);

    // 1.3 Split Ou-kar (e-kar + ou-length-mark -> ou-kar \u09CC)
    const splitOu = 'ক\u09C7\u09D7';
    const expectedOu = 'কৌ';
    assert.strictEqual(normalizeBanglaText(splitOu), expectedOu);

    // 1.4 Split Ai-kar (e-kar + ai-kar -> ai-kar \u09C8)
    const splitAi = 'ক\u09C7\u09C8';
    const expectedAi = 'কৈ';
    assert.strictEqual(normalizeBanglaText(splitAi), expectedAi);
  });

  await t.test('2. Zero-Width Character Stripping & Canonicalization', () => {
    // 2.1 Stripping ZWSP, ZWNJ, BOM
    const dirty = 'বাংলা\u200Bদেশ\uFEFF\u200C';
    assert.strictEqual(normalizeBanglaText(dirty), 'বাংলাদেশ');

    // 2.2 Khanda-Ta legacy with ZWJ
    const khandaTaLegacy = '\u09A4\u09CD\u200D'; // ত্ + ZWJ
    assert.strictEqual(normalizeBanglaText(khandaTaLegacy), 'ৎ');

    // 2.3 Word-final Ta + Hasant -> Khanda-Ta
    const wordFinalKhanda = 'হতা\u09A4\u09CD'; // হ + তা + ত্ -> হতাৎ
    assert.strictEqual(normalizeBanglaText(wordFinalKhanda), 'হতাৎ');
  });

  await t.test('3. Nukta Combinations Canonicalization', () => {
    // ড + nukta -> ড়
    const ddaNukta = 'প\u09A1\u09BCা';
    assert.strictEqual(normalizeBanglaText(ddaNukta), 'পড়া');

    // ঢ + nukta -> ঢ়
    const ddhaNukta = 'আষা\u09A2\u09BC';
    assert.strictEqual(normalizeBanglaText(ddhaNukta), 'আষাঢ়');

    // য + nukta -> য়
    const yaNukta = 'সম\u09AF\u09BC';
    assert.strictEqual(normalizeBanglaText(yaNukta), 'সময়');
  });

  await t.test('4. Deduplication of Repeated Modifiers & Dari Normalization', () => {
    // Repeated aa-kars
    const repeatedAa = 'বাাংলাা';
    assert.strictEqual(normalizeBanglaText(repeatedAa), 'বাংলা');

    // Repeated hasants
    const repeatedHasant = 'ক্\u09CDয';
    assert.strictEqual(normalizeBanglaText(repeatedHasant), 'ক্য');

    // Dari spacing
    const badDari = 'আমি ভাত খাব  ।পরে কথা হবে।ধন্যবাদ';
    const fixedDari = normalizeBanglaText(badDari);
    assert.strictEqual(fixedDari, 'আমি ভাত খাব। পরে কথা হবে। ধন্যবাদ');
  });

  await t.test('5. Tuk Tuk Persona Conversational Strings', () => {
    const rawTukTuk = '  \uFEFFআমি টুক টুক!   আপনি ক\u09C7\u09BEন ভাষায় কথা বলত\u09C7\u09BE চান  ?  ';
    const cleanTukTuk = normalizeBanglaText(rawTukTuk);
    assert.strictEqual(cleanTukTuk, 'আমি টুক টুক! আপনি কোন ভাষায় কথা বলতো চান ?');
  });

  await t.test('6. IPC Channel validate-bangla-text Registration & Handling', async () => {
    const handlers = new Map();
    const mockIpcMain = {
      handle: (channel, fn) => {
        handlers.set(channel, fn);
      },
      removeHandler: (channel) => {
        handlers.delete(channel);
      }
    };

    const registration = registerConversationIpcHandlers(mockIpcMain);
    assert.ok(handlers.has('validate-bangla-text'), 'Must register validate-bangla-text channel');

    const handler = handlers.get('validate-bangla-text');

    // Test with string input
    const res1 = await handler(null, 'ক\u09C7\u09BEথায় যাচ্ছ\u09C7\u09BE?');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.text, 'কোথায় যাচ্ছো?');
    assert.strictEqual(res1.modified, true);

    // Test with object payload
    const res2 = await handler(null, { text: 'বাংলা\u200Bদেশ' });
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.text, 'বাংলাদেশ');
    assert.strictEqual(res2.modified, true);

    // Test with unmodified text
    const res3 = await handler(null, 'নমস্কার');
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.text, 'নমস্কার');
    assert.strictEqual(res3.modified, false);

    // Test unregister
    registration.unregister();
    assert.ok(!handlers.has('validate-bangla-text'), 'Must unregister validate-bangla-text channel');
  });

  await t.test('7. ContentDisplay Bengali Script Detection & Component Export', () => {
    assert.strictEqual(isBengaliText('Hello world'), false);
    assert.strictEqual(isBengaliText('12345'), false);
    assert.strictEqual(isBengaliText('শুভ সকাল'), true);
    assert.strictEqual(isBengaliText('English with বাংলা embedded'), true);
    assert.strictEqual(typeof ContentDisplay, 'function', 'ContentDisplay must be a React component');
  });
});
