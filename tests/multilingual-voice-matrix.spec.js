const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const JarvisManager = require('../src/utils/jarvis-manager');
const banglaVoiceCortex = require('../src/utils/bangla-voice-cortex');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');
const { MATRIX, SAMPLES_DIR } = require('../scripts/test-voices');

describe('Multilingual Voice & Persona Integrity Test Suite (English, Bengali, Hindi)', () => {
  test('1. Every Language & Agent Matrix Entry has Verified Audio File', () => {
    assert.ok(fs.existsSync(SAMPLES_DIR), 'Samples directory must exist');

    for (const entry of MATRIX) {
      const mp3Path = path.join(SAMPLES_DIR, `${entry.agentKey}_${entry.lang}.mp3`);
      assert.ok(fs.existsSync(mp3Path), `Audio file must exist for [${entry.agentKey}:${entry.lang}]: ${mp3Path}`);
      const stat = fs.statSync(mp3Path);
      assert.ok(stat.size > 20000, `Audio file must be non-empty and >20KB, got: ${stat.size} bytes`);
    }
  });

  test('2. Squad Multi-Agent Standup Audio Files Exist for English, Bengali, and Hindi', () => {
    const squadLangs = ['en', 'bn', 'hi'];
    for (const lang of squadLangs) {
      const squadPath = path.join(SAMPLES_DIR, `squad_${lang}.mp3`);
      assert.ok(fs.existsSync(squadPath), `Squad standup file must exist for ${lang}: ${squadPath}`);
      const stat = fs.statSync(squadPath);
      assert.ok(stat.size > 50000, `Squad audio must be substantial (>50KB), got: ${stat.size} bytes`);
    }
  });

  test('3. Voice Model Resolution Fidelity across Languages', () => {
    // Tuk Tuk -> AvaMultilingual across all languages
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('tuktuk', 'Hello babe'), 'en-US-AvaMultilingualNeural');
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('tuktuk', 'কেমন আছো babe'), 'en-US-AvaMultilingualNeural');
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('tuktuk', 'कैसी हो babe'), 'en-US-AvaMultilingualNeural');

    // Vision -> PradeepNeural in Bengali, AndrewMultilingual in English/Hindi
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('vision', 'ভাই কেমন আছো'), 'bn-BD-PradeepNeural');
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('vision', 'Hello brother'), 'en-US-AndrewMultilingualNeural');
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('vision', 'नमस्ते भाई'), 'en-US-AndrewMultilingualNeural');

    // Friday -> EmmaMultilingual across all languages (JennyNeural eliminated)
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('friday', 'Hello Chief'), 'en-US-EmmaMultilingualNeural');
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('friday', 'রিসার্চ রিপোর্ট রেডি'), 'en-US-EmmaMultilingualNeural');
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('jenny', 'Hello Chief'), 'en-US-EmmaMultilingualNeural');

    // DD -> BrianMultilingual across all languages
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('dd', 'Systems steady bro'), 'en-US-BrianMultilingualNeural');
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('dd', 'মেমরি স্টেডি bro'), 'en-US-BrianMultilingualNeural');
    assert.strictEqual(JarvisManager.resolveVoiceForLanguage('brian', 'सर्वर बिल्कुल स्मूथ है bro'), 'en-US-BrianMultilingualNeural');
  });

  test('4. Relational Invariant: "babe" is strictly exclusive to Tuk Tuk in English, Bengali, and Hindi', () => {
    for (const entry of MATRIX) {
      const hasBabe = /\bbabe\b/i.test(entry.text);
      if (entry.agentKey === 'tuktuk') {
        assert.strictEqual(hasBabe, true, `Tuk Tuk must use "babe" in [${entry.lang}], got: "${entry.text}"`);
      } else {
        assert.strictEqual(hasBabe, false, `${entry.agentName} must NEVER use "babe" in [${entry.lang}], got: "${entry.text}"`);
      }
    }
  });

  test('5. Persona Salutation Fidelity across Agents in All Languages', () => {
    for (const entry of MATRIX) {
      if (entry.agentKey === 'vision') {
        const hasBrother = /(?:brother|bhai|ভাই|भाई)/iu.test(entry.text);
        assert.ok(hasBrother, `Vision must include brotherly address in [${entry.lang}]: "${entry.text}"`);
      }
      if (entry.agentKey === 'friday') {
        const hasChief = /(?:Chief|Hritthik|হৃত্তিক)/iu.test(entry.text);
        assert.ok(hasChief, `Friday must include Chief/Hritthik in [${entry.lang}]: "${entry.text}"`);
      }
      if (entry.agentKey === 'dd') {
        const hasBro = /(?:bro|ব্রো)/iu.test(entry.text);
        assert.ok(hasBro, `DD must address as "bro" in [${entry.lang}]: "${entry.text}"`);
      }
    }
  });

  test('6. Zero Negative Rate Invariant across All Languages and Prosody Settings', () => {
    for (const entry of MATRIX) {
      const prosody = banglaVoiceCortex.computeBengaliProsodySettings(entry.text, entry.agentKey);
      assert.strictEqual(
        prosody.rate.startsWith('-'),
        false,
        `Rate must never start with "-" (zero robotic dragging), got: ${prosody.rate} for [${entry.agentKey}:${entry.lang}]`
      );
      assert.strictEqual(prosody.rate, '+0%', 'All agents must run at crisp +0% tempo');
    }
  });

  test('7. LocalCognitiveBrain synthesizes rich responses in English, Bengali, and Hindi', () => {
    // English query
    const resEn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', 'how are you doing babe', {}, 'en');
    assert.ok(resEn.toLowerCase().includes('babe'), 'Tuk Tuk in English must address as babe');

    // Bengali query
    const resBn = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', 'কেমন আছো babe', {}, 'bn');
    assert.ok(resBn.toLowerCase().includes('babe'), 'Tuk Tuk in Bengali must address as babe');

    // Hindi query
    const resHi = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', 'tum kaisi ho babe', {}, 'hi');
    assert.ok(resHi.toLowerCase().includes('babe'), 'Tuk Tuk in Hindi must address as babe');
  });
});
