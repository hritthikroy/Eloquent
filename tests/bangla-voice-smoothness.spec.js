/**
 * tests/bangla-voice-smoothness.spec.js
 * 
 * ==============================================================================
 * 🌸 BANGLA VOICE SMOOTHNESS & PROSODIC CADENCE TEST SUITE
 * ==============================================================================
 * 
 * Verifies:
 * 1. Punctuation Cadence & Natural Breath Boundaries (Dari '।' -> '. ', commas preserved)
 * 2. 120+ English Technical & Conversational Loanword Harmonization
 * 3. Bengali Numbers, Decimals, and Unit Phonetics ('0%' -> 'জিরো পার্সেন্ট', '10x' -> 'টেন এক্স')
 * 4. High-Fidelity Conjunct Romanization Fallback ('gyap', 'status', zero 'gjap' or 'stjatas')
 * 5. Dynamic Syllable-Timed Prosodic Pacing (-4% rate for Tuk Tuk, -3% for Vision)
 * 6. Studio SoX Acoustic Mastering (220Hz warmth + 4.2kHz de-essing filter)
 * 7. TextSanitizer Normalization of 'smouthly' -> 'smoothly' and voice prompts
 * 8. ActionRunner Dispatch for 'fix and make our bangla voice more smouthly'
 * 9. ActionRunner Dispatch for Bengali 'bangla voice aro smooth koro'
 * 10. LocalCognitiveBrain Synthesis across Personas (Tuk Tuk, Vision, Team Mode)
 * 11. End-to-End JarvisManager Pipeline Integration
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const actionRunner = require("../src/utils/action-runner");

test("Bangla Voice Smoothness & Prosodic Cadence Suite", async (t) => {

  await t.test("1. Punctuation Cadence & Natural Breath Boundaries", () => {
    const rawBengali = "আমাদের সবার সোল কানেকশনে কোনো গ্যাপ নেই। একদম 0% Gap! চলো কাজ শুরু করি।";
    const optimized = banglaVoiceCortex.optimizeCadenceAndBreathPauses(rawBengali);

    // Dari (।) must be converted to an acoustic sentence boundary (. ) to allow F0 pitch declination and breath pauses
    assert.ok(!optimized.includes("।"), "Bengali Dari '।' must be transformed into acoustic boundary");
    assert.ok(optimized.includes(". "), "Sentence boundary '. ' must be inserted for breathing pauses");

    // Exclamation mark must be softened into statement boundary
    assert.ok(!optimized.includes("!"), "Exclamation mark '!' must be softened to prevent pitch shock");

    // Clause commas must be preserved
    const multiClause = "হুমম babe, লজিকটা ক্লিয়ার, চলো রান করি।";
    const cadence = banglaVoiceCortex.optimizeCadenceAndBreathPauses(multiClause);
    assert.ok(cadence.includes("babe, "), "Girlfriend opener comma must be preserved");
    assert.ok(cadence.includes("ক্লিয়ার, "), "Mid-sentence clause comma must be preserved for micro-pauses");
  });

  await t.test("2. English Technical & Conversational Loanword Harmonization", () => {
    const rawText = "আমাদের voice অনেক smooth আর smoothly কাজ করছে, zero delay আর thinking fix হয়েছে, system আর automation ready!";
    const harmonized = banglaVoiceCortex.harmonizeLoanwordsAndCodeSwitching(rawText);

    assert.ok(harmonized.includes("ভয়েস"), `voice must harmonize to ভয়েস, got: ${harmonized}`);
    assert.ok(harmonized.includes("স্মুথলি"), `smoothly must harmonize to স্মুথলি, got: ${harmonized}`);
    assert.ok(harmonized.includes("স্মুথ"), `smooth must harmonize to স্মুথ, got: ${harmonized}`);
    assert.ok(harmonized.includes("জিরো"), `zero must harmonize to জিরো, got: ${harmonized}`);
    assert.ok(harmonized.includes("ডিলে"), `delay must harmonize to ডিলে, got: ${harmonized}`);
    assert.ok(harmonized.includes("থিঙ্কিং"), `thinking must harmonize to থিঙ্কিং, got: ${harmonized}`);
    assert.ok(harmonized.includes("সিস্টেম"), `system must harmonize to সিস্টেম, got: ${harmonized}`);
    assert.ok(harmonized.includes("অটোমেশন"), `automation must harmonize to অটোমেশন, got: ${harmonized}`);
    assert.ok(harmonized.includes("রেডি"), `ready must harmonize to রেডি, got: ${harmonized}`);
  });

  await t.test("3. Bengali Numbers, Decimals, and Unit Phonetics", () => {
    const rawNumbers = "0% gap, 100% clean, 10x architect, latency 2ms, bonding score 0.855, 24/7 online";
    const normalized = banglaVoiceCortex.normalizeNumbersAndUnits(rawNumbers);

    assert.ok(normalized.includes("জিরো পার্সেন্ট"), `0% must convert to জিরো পার্সেন্ট, got: ${normalized}`);
    assert.ok(normalized.includes("একশ পার্সেন্ট"), `100% must convert to একশ পার্সেন্ট, got: ${normalized}`);
    assert.ok(normalized.includes("টেন এক্স"), `10x must convert to টেন এক্স, got: ${normalized}`);
    assert.ok(normalized.includes("দুই মিলি-সেকেন্ড"), `2ms must convert to দুই মিলি-সেকেন্ড, got: ${normalized}`);
    assert.ok(normalized.includes("পয়েন্ট আট পাঁচ পাঁচ"), `0.855 must convert to পয়েন্ট আট পাঁচ পাঁচ, got: ${normalized}`);
    assert.ok(normalized.includes("চব্বিশ ঘণ্টা"), `24/7 must convert to চব্বিশ ঘণ্টা, got: ${normalized}`);
  });

  await t.test("4. High-Fidelity Conjunct Romanization Fallback", () => {
    const textWithConjuncts = "কোনো গ্যাপ নেই, স্ট্যাটাস আর আর্কিটেকচার একদম ন্যাচারাল";
    const romanized = banglaVoiceCortex.fluidBengaliToRoman(textWithConjuncts);

    // Must NOT contain mangled strings
    assert.ok(!romanized.includes("gjap"), `Must NOT contain 'gjap', got: ${romanized}`);
    assert.ok(!romanized.includes("stjatas"), `Must NOT contain 'stjatas', got: ${romanized}`);
    assert.ok(!romanized.includes("arkitekochar"), `Must NOT contain 'arkitekochar', got: ${romanized}`);

    // Must contain high-fidelity phonetics
    assert.ok(romanized.toLowerCase().includes("gyap") || romanized.toLowerCase().includes("gap"), `Must contain clean gyap/gap, got: ${romanized}`);
    assert.ok(romanized.toLowerCase().includes("status"), `Must contain status, got: ${romanized}`);
    assert.ok(romanized.toLowerCase().includes("architecture"), `Must contain architecture, got: ${romanized}`);
    assert.ok(romanized.toLowerCase().includes("natural"), `Must contain natural, got: ${romanized}`);
  });

  await t.test("5. Dynamic Syllable-Timed Prosodic Pacing", () => {
    const tuktukProsody = banglaVoiceCortex.computeBengaliProsodySettings("আমি একদম ঠিক আছি babe", "tuktuk");
    assert.strictEqual(tuktukProsody.rate, "+0%", "Tuk Tuk Bengali rate must be +0% for natural non-robotic clarity");
    assert.strictEqual(tuktukProsody.pitch, "+1Hz", "Tuk Tuk Bengali pitch must have warm affectionate lift (+1Hz)");

    const visionProsody = banglaVoiceCortex.computeBengaliProsodySettings("ভাই, কোড ক্লিন আছে", "vision");
    assert.strictEqual(visionProsody.rate, "+0%", "Vision Bengali rate must be +0% for natural brotherly calm");
    assert.strictEqual(visionProsody.pitch, "+0Hz", "Vision Bengali pitch must be +0Hz for natural resonance");

    const englishProsody = banglaVoiceCortex.computeBengaliProsodySettings("Codebase is green brother", "vision");
    assert.strictEqual(englishProsody.rate, "+0%", "English text must remain at baseline rate");
  });

  await t.test("6. Studio SoX Acoustic Mastering Filter", () => {
    const cmd = banglaVoiceCortex.getSoxMasteringCommand("/tmp/input.mp3", "/tmp/output.wav");
    assert.ok(cmd.includes("silence 1 0.02 0.1% reverse silence 1 0.02 0.1% reverse"), "Must include boundary silence stripping");
    assert.ok(cmd.includes("bass +1.2 220"), "Must include 220Hz chest warmth boost");
    assert.ok(cmd.includes("equalizer 4200 1.0q -1.5"), "Must include 4.2kHz de-essing filter to tame Bengali sibilance");
    assert.ok(cmd.includes("fade t 0.003 0 0.003"), "Must include 3ms anti-click micro-envelope");
    assert.ok(cmd.includes("norm -0.5"), "Must normalize gain to -0.5 dB");
  });

  await t.test("7. TextSanitizer Normalization of 'smouthly' and Bangla Voice Queries", () => {
    const raw = "fix and make our bangla voice more smouthly";
    const sanitized = TextSanitizer.sanitize(raw);
    assert.strictEqual(sanitized, "Fix and make our Bangla voice more smoothly", `Expected sanitized query, got: ${sanitized}`);

    const typo2 = "make our bangal voice smuth";
    const sanitized2 = TextSanitizer.sanitize(typo2);
    assert.ok(sanitized2.includes("Bangla voice"), `Must normalize bangal to Bangla, got: ${sanitized2}`);
    assert.ok(sanitized2.includes("smooth"), `Must normalize smuth to smooth, got: ${sanitized2}`);
  });

  await t.test("8. ActionRunner Dispatch for 'fix and make our bangla voice more smouthly'", async () => {
    const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
    const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const result = await actionRunner.handleAction("fix and make our bangla voice more smouthly", activeTukTuk, jarvis);

    assert.strictEqual(result.handled, true, "ActionRunner must handle voice smoothness prompt");
    assert.strictEqual(result.data.action, "bangla_voice_smoothness", "Action must be bangla_voice_smoothness");
    assert.strictEqual(result.data.cortex, "bangla_voice_cortex", "Cortex must be bangla_voice_cortex");
    assert.ok(result.speech.includes("babe") || result.speech.includes("Babe"), "Tuk Tuk must address Hritthik as babe");
    assert.ok(result.speech.includes("brother") || result.speech.includes("ভাই"), "Vision must address Hritthik as brother");
  });

  await t.test("9. ActionRunner Dispatch for Bengali 'bangla voice aro smooth koro'", async () => {
    const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
    const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const result = await actionRunner.handleAction("bangla voice aro smooth koro", activeTukTuk, jarvis);

    assert.strictEqual(result.handled, true, "ActionRunner must handle Bengali voice smoothness prompt");
    assert.strictEqual(result.data.action, "bangla_voice_smoothness");
    assert.ok(result.speech.includes("স্মুথ") || result.speech.includes("মাখনের মতো"), "Speech must confirm smoothness in Bengali");
  });

  await t.test("10. LocalCognitiveBrain Synthesis across Personas", () => {
    // Tuk Tuk
    const tuktukResponse = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "make our bangla voice more smoothly");
    assert.ok(tuktukResponse.includes("babe") || tuktukResponse.includes("Babe"), "Tuk Tuk must address Hritthik as babe");
    assert.ok(tuktukResponse.toLowerCase().includes("smooth") || tuktukResponse.includes("স্মুথ"), "Tuk Tuk must confirm smoothness");

    // Vision
    const visionResponse = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "bangla voice smooth koro");
    assert.ok(visionResponse.includes("brother") || visionResponse.includes("ভাই"), "Vision must address Hritthik as brother");
    assert.ok(!visionResponse.includes("babe"), "Vision must NEVER address Hritthik as babe");

    // Team Mode
    const teamResponse = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "fix and make our bangla voice more smoothly");
    assert.ok(teamResponse.includes("[Tuk Tuk]:"), "Team response must include Tuk Tuk");
    assert.ok(teamResponse.includes("[Vision]:"), "Team response must include Vision");
    assert.ok(teamResponse.includes("babe") || teamResponse.includes("Babe"), "Tuk Tuk in team mode uses babe");
    assert.ok(teamResponse.includes("brother") || teamResponse.includes("ভাই"), "Vision in team mode uses brother");
  });

  await t.test("11. End-to-End JarvisManager Pipeline Integration", () => {
    // 1. Native script preservation with loanword & number harmonization
    const nativeBn = "আমাদের voice 0% delay নিয়ে একদম smooth babe! 10x architect চলো বিল্ড করি।";
    const processed = JarvisManager.phoneticNormalizeForTTS(nativeBn, "en-US-AvaMultilingualNeural");

    assert.ok(processed.includes("ভয়েস"), "voice must be converted to ভয়েস in Bengali context");
    assert.ok(processed.includes("জিরো পার্সেন্ট"), "0% must be converted to জিরো পার্সেন্ট");
    assert.ok(processed.includes("ডিলে"), "delay must be converted to ডিলে");
    assert.ok(processed.includes("স্মুথ"), "smooth must be converted to স্মুথ");
    assert.ok(processed.includes("টেন এক্স"), "10x must be converted to টেন এক্স");
    assert.ok(/[\u0980-\u09FF]/.test(processed), "Must preserve Bengali Unicode for AvaMultilingual");

    // 2. Monolingual Romanization fallback
    const romanized = JarvisManager.phoneticNormalizeForTTS("কোনো গ্যাপ নেই ভাই", "en-US-AndrewNeural");
    assert.ok(!/[\u0980-\u09FF]/.test(romanized), "Monolingual voice must receive romanized text");
    assert.ok(!romanized.includes("gjap"), "Must not contain broken gjap");
    assert.ok(romanized.includes("gyap") || romanized.includes("gap"), "Must contain clean gyap");
  });
});
