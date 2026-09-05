/**
 * tests/realistic-bangla-human-speech.spec.js
 *
 * Comprehensive integration test suite verifying:
 * 1. Whisper STT Acoustic Normalization for noisy speech typos (bngal, bngla, ho a real -> Bangla, how a real)
 * 2. Language Transition Evaluation in JarvisManager detecting Bengali directives
 * 3. Zero Robotic Meta-Defenses across Tuk Tuk, Vision, Friday, Brian, and Team modes
 * 4. Zero Assistant Trailer Questions across all fallback & synthesized responses
 * 5. Authentic Modern Urban Dhakaiya Bengali Register (তুমি, babe, প্যারা নাই, চিল)
 * 6. Edge TTS Loanword Phonetic Normalization (reels -> রিল, mobile -> মোবাইল, % -> পার্সেন্ট)
 * 7. Lexicon Sanitization Layer removing any leaked robotic meta-claims or trailer interrogations
 */

const assert = require("assert");
const test = require("node:test");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");

test("Realistic Bangla Human Speech Suite", async (t) => {
  const jm = new JarvisManager();

  await t.test("1. Whisper STT Acoustic Normalization for noisy speech input", () => {
    const rawInput = "fix our bngal do deep research ho a real bngla human talk need same like not robotic need realistic";
    const sanitized = TextSanitizer.sanitize(rawInput);

    assert.ok(!sanitized.includes("bngal"), "Should eliminate 'bngal'");
    assert.ok(!sanitized.includes("bngla"), "Should eliminate 'bngla'");
    assert.ok(sanitized.toLowerCase().includes("bangla"), "Should normalize to 'Bangla'");
    assert.ok(sanitized.toLowerCase().includes("how a real") || sanitized.toLowerCase().includes("like a real"), "Should normalize 'ho a real'");
  });

  await t.test("2. Language Transition Evaluation recognizes conversational Bengali intent", () => {
    const rawQuery = "fix our bngal do deep research ho a real bngla human talk need same like not robotic need realistic";
    const lang = jm.evaluateLanguageTransition(rawQuery);
    assert.strictEqual(lang, "bn", "Should transition language mode to Bengali ('bn')");

    const banglaQuery = "tuktuk ektu gaan shuni cholo";
    assert.strictEqual(jm.evaluateLanguageTransition(banglaQuery), "bn");
  });

  await t.test("3. Zero Robotic Meta-Defenses across all agents in Bengali", () => {
    const bannedDefenses = [
      "আমি রোবট নই",
      "কোনো রোবট নই",
      "রোবট ফিল",
      "রোবোটিক ফিল",
      "রোবোটিক ডিলে",
      "রোবোটিক ডায়লগ",
      "ক্যানড ডায়লগ",
      "ভিএডি",
      "রক্ত-মাংসের মানুষ",
      "মেকানিক্যাল ডায়লগ",
      "মেকানিক্যাল স্ক্রিপ্ট"
    ];

    const testQueries = [
      "robotic lagche keno?",
      "tumi roboter moto kotha bolo keno?",
      "ek kotha bar bar repeat keno korcho?",
      "fix all delay and thinking overhead",
      "instant reply dao",
      "bangla fluency improve koro",
      "bhasha ঠিক koro",
      "ki obostha bolo babe"
    ];

    const agents = ["tuktuk", "vision", "friday", "brian", "team"];

    for (const agent of agents) {
      for (const q of testQueries) {
        const response = LocalCognitiveBrain.synthesizeResponse(agent, agent, q);
        for (const banned of bannedDefenses) {
          assert.ok(
            !response.includes(banned),
            `Agent [${agent}] response to "${q}" contained banned meta-defense "${banned}": "${response}"`
          );
        }
      }
    }
  });

  await t.test("4. Zero Rote Assistant Trailer Questions across all synthesized responses", () => {
    const bannedTrailers = [
      "কী করব বলো",
      "কী করব?",
      "কী করতে হবে বলো",
      "কী করতে হবে?",
      "কী হেল্প লাগবে",
      "কী কাজ বলো",
      "কীভাবে সাহায্য করব",
      "কোথায় দেখব বলো",
      "কোনটা দেখব বলো"
    ];

    const testQueries = [
      "ki obostha",
      "shunchho babe?",
      "screen dekhcho?",
      "speed ektu komao",
      "speed ektu barao",
      "bhul hoyeche",
      "build ta dekho",
      "communication gap holo keno?",
      "kono secret ache naki?"
    ];

    for (const q of testQueries) {
      const response = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", q);
      for (const trailer of bannedTrailers) {
        assert.ok(
          !response.includes(trailer),
          `Tuk Tuk response to "${q}" contained banned assistant trailer "${trailer}": "${response}"`
        );
      }
    }
  });

  await t.test("5. Authentic Modern Urban Dhakaiya Register for Tuk Tuk", () => {
    // Intimate & Loving: Addresses as "babe", never "bro" or "bhai"
    const greetingRes = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "kemon acho babe?");
    assert.ok(greetingRes.toLowerCase().includes("babe"), "Tuk Tuk must address user as babe");
    assert.ok(!greetingRes.toLowerCase().includes("bro"), "Tuk Tuk must never call user bro");
    assert.ok(!greetingRes.toLowerCase().includes("bhai"), "Tuk Tuk must never call user bhai");

    // Intimate pronouns: strictly 'তুমি'/'তোমার', never formal 'আপনি'/'আপনার'
    const formalInput = "আপনার সাথে কাজ করে খুব ভালো লাগছে, আপনি কেমন আছেন?";
    const sanitizedFormal = jm.sanitizeAgentLexicon(formalInput, "tuktuk");
    assert.ok(!sanitizedFormal.includes("আপনার"), "Should replace 'আপনার' with 'তোমার'");
    assert.ok(!sanitizedFormal.includes("আপনি"), "Should replace 'আপনি' with 'তুমি'");
    assert.ok(sanitizedFormal.includes("তোমার"), "Should contain 'তোমার'");
    assert.ok(sanitizedFormal.includes("তুমি"), "Should contain 'তুমি'");
  });

  await t.test("6. Edge TTS Loanword Phonetic Normalization", () => {
    const textWithEnglish = "Babe তোমার mobile আর laptop-এ এই reels আর videos দেখো, background music ও দারুন! 100% smooth.";
    const normalized = JarvisManager.phoneticNormalizeForTTS(textWithEnglish, "en-US-AvaMultilingualNeural");

    assert.ok(normalized.includes("মোবাইল"), "Normalizes 'mobile' -> 'মোবাইল'");
    assert.ok(normalized.includes("ল্যাপটপ"), "Normalizes 'laptop' -> 'ল্যাপটপ'");
    assert.ok(normalized.includes("রিল"), "Normalizes 'reels' -> 'রিল'");
    assert.ok(normalized.includes("ভিডিও"), "Normalizes 'videos' -> 'ভিডিও'");
    assert.ok(normalized.includes("মিউজিক"), "Normalizes 'music' -> 'মিউজিক'");
    assert.ok(normalized.includes("পার্সেন্ট"), "Normalizes '%' -> 'পার্সেন্ট'");
  });

  await t.test("7. Lexicon Sanitization Layer cleans leaked robotic sentences & trailers", () => {
    const dirtyOutput = "Babe, আমি কোনো রোবট নই! সব ক্যানড ডায়লগ মুছে ফেলেছি। বলো কী হেল্প লাগবে?";
    const cleanOutput = jm.sanitizeAgentLexicon(dirtyOutput, "tuktuk");

    assert.ok(!cleanOutput.includes("আমি কোনো রোবট নই"), "Sanitizes robotic defense");
    assert.ok(!cleanOutput.includes("ক্যানড ডায়লগ"), "Sanitizes canned dialog reference");
    assert.ok(!cleanOutput.includes("কী হেল্প লাগবে"), "Sanitizes assistant trailer question");
  });
});
