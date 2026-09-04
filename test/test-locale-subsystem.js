/**
 * End-to-End Integration Test for Multi-Language Detection & Auto-Switching
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');

const { LanguageDetector, SUPPORTED_LOCALES, DEFAULT_LOCALE } = require('../src/i18n/detector');
const { ElectronLanguageBridge } = require('../src/main/electron-bridge');

async function testDetector() {
  console.log('🧪 1. Testing LanguageDetector Engine...');
  const testUserData = path.join(__dirname, 'test_userdata');
  if (!fs.existsSync(testUserData)) fs.mkdirSync(testUserData, { recursive: true });

  const detector = new LanguageDetector({ storageDir: testUserData });

  const cases = [
    { text: 'বাবু, তুমি কেমন আছো?', expected: 'bn-IN', desc: 'Bengali (বাংলা)' },
    { text: 'Andrew bhai, code ta check koro to, latency kemon ache?', expected: 'bn-Roman', desc: 'Banglish (Roman Bengali)' },
    { text: 'नमस्ते, आप कैसे हैं?', expected: 'hi-IN', desc: 'Hindi (हिन्दी)' },
    { text: 'kya scene hai bhai, sab theek chal raha hai na?', expected: 'hi-Roman', desc: 'Hinglish (Roman Hindi)' },
    { text: 'The latency is under 12ms and audio pipeline is synchronized.', expected: 'en-US', desc: 'English' },
    { text: '', expected: 'en-US', desc: 'Empty input fallback' },
    { text: '12345678 ???', expected: 'en-US', desc: 'Punctuation fallback' }
  ];

  for (const c of cases) {
    const res = detector.detect(c.text);
    console.log(`   [${c.desc}] -> Detected: ${res.locale} (${(res.confidence * 100).toFixed(0)}% conf, ${res.durationUs}µs)`);
    assert.strictEqual(res.locale, c.expected, `Mismatch for "${c.text}": expected ${c.expected}, got ${res.locale}`);
  }

  // Test LRU Cache Performance
  console.log('\n🧪 2. Testing 256-slot LRU Cache Speed...');
  const repeatText = 'Andrew bhai, latency kemon ache?';
  const firstRes = detector.detect(repeatText);
  assert.strictEqual(firstRes.cached, false);

  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 1000; i++) {
    const cachedRes = detector.detect(repeatText);
    assert.strictEqual(cachedRes.cached, true);
  }
  const t1 = process.hrtime.bigint();
  const avgCachedUs = Number((t1 - t0) / 1000n) / 1000;
  console.log(`   ✅ 1,000 cached detections executed in ${Number((t1 - t0) / 1000n)}µs (Average: ${avgCachedUs.toFixed(3)}µs per lookup)`);

  const telemetry = detector.getTelemetry();
  console.log(`   Telemetry: ${JSON.stringify(telemetry)}`);
  assert(telemetry.cacheHits >= 1000);

  // Test Preferences & Persistence
  console.log('\n🧪 3. Testing Persistent Preference Storage...');
  detector.savePreferences({ activeLocale: 'bn-IN', autoDetect: false });
  const reloadedDetector = new LanguageDetector({ storageDir: testUserData });
  const prefs = reloadedDetector.loadPreferences();
  assert.strictEqual(prefs.activeLocale, 'bn-IN');
  assert.strictEqual(prefs.autoDetect, false);
  console.log(`   ✅ Preferences safely persisted and reloaded across restarts:`, prefs);

  // Cleanup testUserData
  fs.rmSync(testUserData, { recursive: true, force: true });
}

async function testBridge() {
  console.log('\n🧪 4. Testing ElectronLanguageBridge & Go Audio Sync Dispatch...');
  const testUserData = path.join(__dirname, 'test_userdata_bridge');
  if (!fs.existsSync(testUserData)) fs.mkdirSync(testUserData, { recursive: true });

  let syncedLocaleToGo = null;
  const mockGoBackend = {
    setLocale: (loc) => {
      syncedLocaleToGo = loc;
    }
  };

  const bridge = new ElectronLanguageBridge({
    storageDir: testUserData,
    audioBackend: mockGoBackend
  });

  // Test manual switch
  const res = await bridge.setLocale('hi-IN', { source: 'manual' });
  assert.strictEqual(res.locale, 'hi-IN');
  assert.strictEqual(res.changed, true);

  // Wait for setImmediate to trigger Go backend sync
  await new Promise(r => setImmediate(r));
  assert.strictEqual(syncedLocaleToGo, 'hi-IN');
  console.log(`   ✅ Bridge successfully dispatched dynamic locale "hi-IN" to Go Audio Backend`);

  // Test auto-detection speech utterance hook
  bridge.autoDetectEnabled = true;
  const detected = bridge.processSpokenUtterance('বাবু, বাফারটা কেমন চলছে?');
  assert(detected !== null);
  assert.strictEqual(detected.locale, 'bn-IN');

  await new Promise(r => setImmediate(r));
  assert.strictEqual(syncedLocaleToGo, 'bn-IN');
  console.log(`   ✅ Whisper speech utterance triggered zero-latency auto-switch to "bn-IN"`);

  fs.rmSync(testUserData, { recursive: true, force: true });
}

async function run() {
  console.log('==================================================');
  console.log('🌍 Eloquent Multi-Language Subsystem Integration Test');
  console.log('==================================================\n');

  await testDetector();
  await testBridge();

  console.log('\n==================================================');
  console.log('🎉 ALL MULTI-LANGUAGE SUBSYSTEM INTEGRATION TESTS PASSED!');
  console.log('==================================================');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
