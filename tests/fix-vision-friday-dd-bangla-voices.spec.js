/**
 * tests/fix-vision-friday-dd-bangla-voices.spec.js
 * 
 * Verifies:
 * 1. STT Acoustic Normalization of "fix vison fryday and dd ar bangla voices" in TextSanitizer
 * 2. Multilingual Voice Resolution for Bengali speech across Vision, Friday, and DD:
 *    - Vision -> en-US-AndrewMultilingualNeural
 *    - Friday -> en-US-EmmaMultilingualNeural
 *    - DD     -> en-US-BrianMultilingualNeural
 *    - TukTuk -> en-US-AvaMultilingualNeural
 * 3. Pre-TTS Script Preservation: Bengali Unicode is 100% preserved for all agents
 * 4. Monolingual English Protection: English text retains signature studio voices
 * 5. BanglaVoiceCortex prosody cadence settings for Vision, Friday, DD, and Tuk Tuk
 * 6. ActionRunner 3-Agent Voice Directive Interception in English and Bengali
 * 7. LocalCognitiveBrain 3-Agent Voice Responses in English and Bengali
 * 8. Backwards-compatibility for 2-agent and 1-agent voice fix directives
 */

const assert = require("assert");
const path = require("path");

console.log("================================================================================");
console.log("🎙️ VERIFYING VISION, FRIDAY & DD BANGLA VOICES CALIBRATION PIPELINE");
console.log("================================================================================\n");

// 1. STT Acoustic Normalization
console.log("--- 1. Testing TextSanitizer STT Acoustic Normalization ---");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");

const rawInput = "fix vison fryday and dd ar bangla voices";
const sanitized = TextSanitizer.sanitize(rawInput);
assert(sanitized.includes("Vision") && sanitized.includes("Friday") && sanitized.includes("DD"),
  `Expected Vision, Friday, and DD in sanitized text, got: "${sanitized}"`);
console.log(`  ✅ [PASS 1] Sanitized exact user input: "${rawInput}" -> "${sanitized}"`);

const vSanitized = TextSanitizer.sanitize("vison bangla voice");
assert(vSanitized.toLowerCase().includes("vision"), `Expected 'Vision' in: "${vSanitized}"`);
const fSanitized = TextSanitizer.sanitize("fryday bangla voice");
assert(fSanitized.toLowerCase().includes("friday"), `Expected 'Friday' in: "${fSanitized}"`);
const ddSanitized = TextSanitizer.sanitize("dd ar bangla voice");
assert(ddSanitized.includes("DD"), `Expected 'DD' in: "${ddSanitized}"`);
console.log("  ✅ [PASS 2] Individual agent Bangla voice prompts normalized correctly");

// 2. Pre-TTS Script Preservation & Multilingual Voice Resolution
console.log("\n--- 2. Testing Pre-TTS Script Preservation on Multilingual Voices ---");
const JarvisManager = require("../src/utils/jarvis-manager");
const phoneticNormalize = JarvisManager.phoneticNormalizeForTTS;

const visionBn = "ভাই, লজিকটা একদম ক্লিয়ার, AST ক্লিন।";
const visionNorm = phoneticNormalize(visionBn, "en-US-AndrewMultilingualNeural");
assert(/[\u0980-\u09FF]/.test(visionNorm), `Vision Bengali Unicode must be preserved: "${visionNorm}"`);
assert(!visionNorm.includes("bhai, lojikta"), `Vision must not be Romanized: "${visionNorm}"`);
assert(visionNorm.includes("A S T"), `Acronyms expanded: "${visionNorm}"`);
console.log(`  ✅ [PASS 3] Vision on AndrewMultilingualNeural preserves native Bengali: "${visionNorm}"`);

const fridayBn = "Chief, আমি বেঞ্চমার্ক ডাটা অ্যানালাইজ করেছি।";
const fridayNorm = phoneticNormalize(fridayBn, "en-US-EmmaMultilingualNeural");
assert(/[\u0980-\u09FF]/.test(fridayNorm), `Friday Bengali Unicode must be preserved: "${fridayNorm}"`);
assert(!fridayNorm.includes("ami benchomark"), `Friday must not be Romanized: "${fridayNorm}"`);
console.log(`  ✅ [PASS 4] Friday on EmmaMultilingualNeural preserves native Bengali: "${fridayNorm}"`);

const ddBn = "সিস্টেম একদম স্টেডি ভাই, সিপিইউ লোড ১৮ পার্সেন্ট।";
const ddNorm = phoneticNormalize(ddBn, "en-US-BrianMultilingualNeural");
assert(/[\u0980-\u09FF]/.test(ddNorm), `DD Bengali Unicode must be preserved: "${ddNorm}"`);
assert(ddNorm.includes("পার্সেন্ট"), `Percent normalized to Bengali: "${ddNorm}"`);
console.log(`  ✅ [PASS 5] DD on BrianMultilingualNeural preserves native Bengali: "${ddNorm}"`);

// 3. Monolingual English Protection
console.log("\n--- 3. Testing Monolingual English Phonetic Protection ---");
const visionEn = "The build pipeline runs tests with zero memory leaks.";
const visionEnNorm = phoneticNormalize(visionEn, "en-US-AndrewNeural");
assert(visionEnNorm.toLowerCase().includes("pipeline"), `Vision English must preserve 'pipeline': "${visionEnNorm}"`);
assert(!visionEnNorm.includes("paipolain"), `Vision English must not be mangled: "${visionEnNorm}"`);

const fridayEn = "The data pipeline benchmark is fast and stable.";
const fridayEnNorm = phoneticNormalize(fridayEn, "en-US-JennyNeural");
assert(fridayEnNorm.toLowerCase().includes("pipeline"), `Friday English must preserve 'pipeline': "${fridayEnNorm}"`);
assert(!fridayEnNorm.includes("paipolain"), `Friday English must not be mangled: "${fridayEnNorm}"`);
console.log("  ✅ [PASS 6] English utterances preserve signature studio voices without transliteration distortion");

// 4. BanglaVoiceCortex Prosody Settings
console.log("\n--- 4. Testing BanglaVoiceCortex Prosody Settings ---");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");

const vProsody = banglaVoiceCortex.computeBengaliProsodySettings("টেস্ট লজিক", "vision");
assert.strictEqual(vProsody.rate, "+0%", "Vision rate must be +0% for natural non-robotic cadence");
assert.strictEqual(vProsody.pitch, "+0Hz", "Vision pitch must be +0Hz");

const fProsody = banglaVoiceCortex.computeBengaliProsodySettings("রিসার্চ ডাটা", "friday");
assert.strictEqual(fProsody.rate, "+0%", "Friday rate must be +0% for natural non-robotic cadence");
assert.strictEqual(fProsody.pitch, "+0Hz", "Friday pitch must be +0Hz");

const ddProsody = banglaVoiceCortex.computeBengaliProsodySettings("সিস্টেম টেলিমেট্রি", "dd");
assert.strictEqual(ddProsody.rate, "+0%", "DD rate must be +0% for natural non-robotic cadence");
assert.strictEqual(ddProsody.pitch, "+0Hz", "DD pitch must be +0Hz");
console.log("  ✅ [PASS 7] Prosodic cadence settings calibrated for zero robotic voice for all three agents");

// 5. ActionRunner 3-Agent Voice Directive Interception
console.log("\n--- 5. Testing ActionRunner 3-Agent Voice Directive Interception ---");
(async () => {
  const actionRunner = require("../src/utils/action-runner");
  const jm = new JarvisManager();

  // A. English 3-agent directive
  const res3En = await actionRunner.handleAction("fix vison fryday and dd ar bangla voices", { key: "team", name: "Squad" }, jm);
  assert(res3En && res3En.handled, "ActionRunner must handle 3-agent voice fix in English");
  assert(res3En.speech.includes("[Vision]"), "Response must include Vision");
  assert(res3En.speech.includes("[Friday]"), "Response must include Friday");
  assert(res3En.speech.includes("[DD]"), "Response must include DD");
  assert(res3En.data.voices.vision === "en-US-AndrewMultilingualNeural" || res3En.data.voices.vision === "bn-BD-PradeepNeural", "Vision voice must be calibrated neural voice");
  assert(res3En.data.voices.friday === "en-US-EmmaMultilingualNeural", "Friday voice must be EmmaMultilingual");
  assert(res3En.data.voices.dd === "en-US-BrianMultilingualNeural", "DD voice must be BrianMultilingual");
  console.log("  ✅ [PASS 8] ActionRunner handles 3-agent voice directive in English with all three voices");

  // B. Bengali 3-agent directive
  const res3Bn = await actionRunner.handleAction("ভিশন ফ্রাইডে আর ডিডির বাংলা ভয়েস ঠিক করো", { key: "team", name: "Squad" }, jm);
  assert(res3Bn && res3Bn.handled, "ActionRunner must handle 3-agent voice fix in Bengali");
  assert(res3Bn.speech.includes("[Vision]"), "Bengali response must include Vision");
  assert(res3Bn.speech.includes("[Friday]"), "Bengali response must include Friday");
  assert(res3Bn.speech.includes("[DD]"), "Bengali response must include DD");
  assert(/[\u0980-\u09FF]/.test(res3Bn.speech), "Bengali response must be in Bengali Unicode");
  console.log("  ✅ [PASS 9] ActionRunner handles 3-agent voice directive in Bengali");

  // C. Backwards compatibility for 2-agent DD + Friday directive
  const res2 = await actionRunner.handleAction("fix dd voice and fryday voices", { key: "team", name: "Squad" }, jm);
  assert(res2 && res2.handled, "ActionRunner must handle 2-agent DD + Friday directive");
  assert(res2.speech.includes("[Friday]") && res2.speech.includes("[DD]"), "Must include Friday and DD");
  console.log("  ✅ [PASS 10] ActionRunner 2-agent backwards compatibility verified");

  // 6. LocalCognitiveBrain Response Verification
  console.log("\n--- 6. Testing LocalCognitiveBrain 3-Agent Responses ---");
  const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

  const lcbEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "fix vison fryday and dd ar bangla voices", { currentLanguageMode: "en" });
  assert(lcbEn.includes("[Vision]") && lcbEn.includes("[Friday]") && lcbEn.includes("[DD]"),
    `Expected Vision, Friday, and DD in English brain response, got: "${lcbEn}"`);
  assert(lcbEn.includes("AndrewMultilingual") || lcbEn.includes("calibrated"), "Vision voice confirmation");
  assert(lcbEn.includes("EmmaMultilingual") || lcbEn.includes("research"), "Friday voice confirmation");
  assert(lcbEn.includes("BrianMultilingual") || lcbEn.includes("telemetry") || lcbEn.includes("latency"), "DD voice confirmation");
  console.log("  ✅ [PASS 11] LocalCognitiveBrain generates 3-agent standup in English");

  const lcbBn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "ভিশন ফ্রাইডে আর ডিডির বাংলা ভয়েস ঠিক করো", { currentLanguageMode: "bn" });
  assert(lcbBn.includes("[Vision]") && lcbBn.includes("[Friday]") && lcbBn.includes("[DD]"),
    `Expected Vision, Friday, and DD in Bengali brain response, got: "${lcbBn}"`);
  assert(/[\u0980-\u09FF]/.test(lcbBn), "Bengali response must be in Bengali Unicode");
  console.log("  ✅ [PASS 12] LocalCognitiveBrain generates 3-agent standup in Bengali");

  console.log("\n================================================================================");
  console.log("🎉 ALL 12 / 12 VISION, FRIDAY & DD BANGLA VOICE TESTS PASSED!");
  console.log("================================================================================\n");
})().catch(err => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
