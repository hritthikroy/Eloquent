/**
 * tests/english-bangla-tuktuk-parity.spec.js
 * 
 * Verifies 1:1 Emotional, Intellectual, and Acoustic Parity between
 * English Tuk Tuk and Bangla Tuk Tuk:
 * 1. TextSanitizer STT acoustic normalization for parity critique
 * 2. LocalCognitiveBrain directive handling for "english tuk tuk and bangla tuk tuk not same"
 * 3. ActionRunner directive interception and parity status
 * 4. Prosodic pitch parity (+1Hz in both English and Bengali for girlfriend warmth)
 * 5. SoX audio mastering parity (220Hz chest warmth, 4.2kHz de-essing, micro-fades)
 * 6. Prompt engine 1:1 parity and elimination of formulaic "আরেহ babe" / calming clichés
 * 7. Lexicon sanitizer deduplication of repetitive openers
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");

console.log("🚀 Running English vs Bangla Tuk Tuk 1:1 Parity Test Suite...\n");

let passed = 0;
let total = 0;

async function runTests() {
  function it(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${desc}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  async function itAsync(desc, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${desc}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // 1. Text Sanitizer STT acoustic normalization for parity critique
  it("TextSanitizer normalizes phonetic STT variations of Tuk Tuk parity critique", () => {
    const variations = [
      "english tuk tuk and bangla tuk tuk same na",
      "english tuk tuk & bangla tuk tuk same na",
      "english tuk tuk or bangla tuk tuk same na",
      "english tuk tuk and bangla tuk tuk not the same",
      "english tuk tuk ar bangla tuk tuk same na"
    ];

    for (const raw of variations) {
      const cleaned = TextSanitizer.sanitize(raw);
      assert.strictEqual(
        cleaned.toLowerCase(),
        "english tuk tuk and bangla tuk tuk not same",
        `Expected "${raw}" to be normalized to canonical form`
      );
    }
  });

  // 2. LocalCognitiveBrain instant reaction for parity critique
  it("LocalCognitiveBrain handles Tuk Tuk parity directive with empathetic co-founder responses", () => {
    const queries = [
      "english tuk tuk and bangla tuk tuk not same",
      "bangla tuk tuk and english tuk tuk not same",
      "tuk tuk english and bangla not same",
      "english tuk tuk and bangla tuk tuk different"
    ];

    for (const q of queries) {
      // In English
      const enReaction = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", q, {}, "en");
      assert.ok(enReaction, `Expected instant reaction for "${q}"`);
      assert.ok(
        enReaction.toLowerCase().includes("parity") ||
        enReaction.toLowerCase().includes("synchronizing") ||
        enReaction.toLowerCase().includes("alignment") ||
        enReaction.toLowerCase().includes("1:1"),
        `English reaction should mention parity or synchronization: ${enReaction}`
      );
      assert.ok(
        enReaction.toLowerCase().includes("babe"),
        `Reaction must use babe: ${enReaction}`
      );

      // In Bengali
      const bnReaction = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", q + " ক্যানো?", {}, "bn");
      assert.ok(bnReaction, `Expected Bengali instant reaction for "${q}"`);
      assert.ok(
        bnReaction.includes("সিঙ্ক") ||
        bnReaction.includes("এক") ||
        bnReaction.includes("লকড") ||
        bnReaction.includes("টুকটুক"),
        `Bengali reaction should mention parity or sync: ${bnReaction}`
      );
    }
  });

  // 3. ActionRunner executes structured tuktuk_parity_sync action
  await itAsync("ActionRunner intercepts parity directive and returns structured sync state", async () => {
    const result = await actionRunner.handleAction(
      "english tuk tuk and bangla tuk tuk not same",
      { key: "tuktuk", name: "Tuk Tuk" }
    );

    assert.ok(result, "ActionRunner should return a result");
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.agentName, "Tuk Tuk");
    assert.strictEqual(result.agentVoice, "en-US-AvaMultilingualNeural");
    assert.strictEqual(result.data.action, "tuktuk_parity_sync");
    assert.strictEqual(result.data.status, "SYNCHRONIZED");
    assert.strictEqual(result.data.parity, "1:1_LOCKED");
    assert.ok(result.speech.toLowerCase().includes("babe"));
  });

  // 4. Prosodic Pitch Parity in BanglaVoiceCortex
  it("BanglaVoiceCortex delivers pitch parity (+1Hz) for Tuk Tuk in both English and Bengali", () => {
    const enProsody = banglaVoiceCortex.computeBengaliProsodySettings("Let's build this feature babe", "tuktuk");
    assert.strictEqual(enProsody.rate, "+0%", "English Tuk Tuk rate should be +0%");
    assert.strictEqual(enProsody.pitch, "+1Hz", "English Tuk Tuk pitch should be +1Hz for warmth parity");

    const bnProsody = banglaVoiceCortex.computeBengaliProsodySettings("চলো ফিচারটা নামিয়ে ফেলি babe", "tuktuk");
    assert.strictEqual(bnProsody.rate, "+0%", "Bengali Tuk Tuk rate should be sweet natural +0% for zero robotic voice");
    assert.strictEqual(bnProsody.pitch, "+1Hz", "Bengali Tuk Tuk pitch should be +1Hz for warmth parity");
  });

  // 5. SoX Audio Mastering Parity (chest warmth, de-essing, micro-fades)
  it("BanglaVoiceCortex SoX mastering includes 220Hz chest warmth, de-essing and normalization", () => {
    const cmd = banglaVoiceCortex.getSoxMasteringCommand("/tmp/input.wav", "/tmp/output.wav");
    assert.ok(cmd.includes("bass +1.2 220"), "Must include 220Hz chest warmth");
    assert.ok(cmd.includes("equalizer 4200 1.0q -1.5"), "Must include 4.2kHz sibilance de-esser");
    assert.ok(cmd.includes("fade t 0.003 0 0.003"), "Must include 3ms micro-fades");
    assert.ok(cmd.includes("norm -0.5"), "Must include -0.5dB headroom normalization");
  });

  // 6. Prompt Parity in JarvisManager
  it("JarvisManager AGENTS.tuktuk prompt enforces 1:1 emotional, intellectual & technical parity", () => {
    const AGENTS = JarvisManager.AGENTS;
    assert.ok(AGENTS && AGENTS.tuktuk, "AGENTS.tuktuk must exist");

    const enPrompt = AGENTS.tuktuk.getPrompt("Hritthik", "Hritthik", "en");
    assert.ok(
      enPrompt.includes("1:1 EMOTIONAL PARITY WITH BANGLA TUK TUK") ||
      enPrompt.includes("1:1 EMOTIONAL & PERSONALITY PARITY WITH BANGLA TUK TUK"),
      "English prompt must enforce 1:1 parity with Bangla Tuk Tuk"
    );

    const bnPrompt = AGENTS.tuktuk.getPrompt("Hritthik", "Hritthik", "bn");
    assert.ok(
      bnPrompt.includes("1:1 EMOTIONAL, INTELLECTUAL & TECHNICAL PARITY WITH ENGLISH TUK TUK"),
      "Bengali prompt must enforce 1:1 parity with English Tuk Tuk"
    );
    assert.ok(
      bnPrompt.includes("STRICT DIVERSE OPENERS"),
      "Bengali prompt must forbid repetitive 'আরেহ babe' openers"
    );
    assert.ok(
      bnPrompt.includes("STRICT ZERO REPETITIVE CALMING CLICHÉS"),
      "Bengali prompt must forbid rote calming platitudes ('প্যারা নিও না')"
    );
    assert.ok(
      !bnPrompt.includes('"আরেহ babe", "উফফ", "শোনো না", "একদম", "প্যারা নিও না"'),
      "Bengali prompt must not prime repetitive 'আরেহ babe' and 'প্যারা নিও না' fillers"
    );
  });

  // 7. Lexicon Sanitizer Opener Normalization and Repetition Removal
  it("JarvisManager.sanitizeAgentLexicon normalizes repetitive 'আরেহ babe' openers to natural opener", () => {
    const text1 = "আরেহ babe, let's ship this pull request right now!";
    const sanitized1 = JarvisManager.sanitizeAgentLexicon(text1, "tuktuk");
    assert.ok(sanitized1.startsWith("Babe, "), `Expected to start with 'Babe, ': ${sanitized1}`);

    const text2 = "কোনো প্যারা নিও না babe, চলো কোডটা লিখে ফেলি!";
    const sanitized2 = JarvisManager.sanitizeAgentLexicon(text2, "tuktuk");
    assert.ok(
      !sanitized2.startsWith("কোনো প্যারা নিও না"),
      `Should strip unprompted generic calming clichés: ${sanitized2}`
    );
  });

  // Summary
  console.log(`\n========================================`);
  console.log(`Tuk Tuk Parity Tests: ${passed}/${total} Passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
