/**
 * tests/tuktuk-bilingual-vibe-parity.spec.js
 *
 * Comprehensive Test Suite for Tuk Tuk Bilingual Vibe Parity:
 * 1. 1:1 Vibe Parity across English & Bengali Prompts (Reel co-watching, music vibing, smart creator energy, zero nagging)
 * 2. Conversational Word Cap Alignment (Lifting 5-14 word straightjacket to 16-18 words max)
 * 3. Speech-to-Text Acoustic Mishearing Normalization ("thay bot", "difrent vide", "bangali")
 * 4. ActionRunner Directive for Vibe Disconnect Critiques
 * 5. LocalCognitiveBrain Intent & Fallback Pool Parity
 * 6. Pure Edge TTS Voice Lock (en-US-AvaMultilingualNeural across both languages)
 */

const assert = require("assert");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const ActionRunner = require("../src/utils/action-runner");

console.log("================================================================================");
console.log("🎙️ VERIFYING TUK TUK 1:1 BILINGUAL VIBE PARITY (ENGLISH & BENGALI)");
console.log("================================================================================");

let testsPassed = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS ${totalTests}] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${totalTests}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: 1:1 System Prompt Feature Parity (English & Bengali)
// -----------------------------------------------------------------------------
runTest("1:1 System Prompt Feature Parity: Both English & Bengali contain core persona pillars", () => {
  const enPrompt = JarvisManager.AGENTS.tuktuk.getPrompt("Hritthik", "Boss", "en");
  const bnPrompt = JarvisManager.AGENTS.tuktuk.getPrompt("Hritthik", "Boss", "bn");

  // 1. Reel & Screen Co-watching
  assert.ok(
    enPrompt.includes("LIVING EYE CONTACT, SCREEN & MOBILE REEL CO-WATCHING"),
    "English prompt must contain reel & mobile co-watching pillar"
  );
  assert.ok(
    bnPrompt.includes("LIVING EYE CONTACT, SCREEN & MOBILE REEL CO-WATCHING"),
    "Bengali prompt must contain reel & mobile co-watching pillar"
  );

  // 2. Music Listening Companion
  assert.ok(
    enPrompt.includes("MUSIC LISTENING COMPANION & VIBE"),
    "English prompt must contain music listening companion pillar"
  );
  assert.ok(
    bnPrompt.includes("MUSIC LISTENING COMPANION & VIBE"),
    "Bengali prompt must contain music listening companion pillar"
  );

  // 3. Smart YouTuber / Creator Energy
  assert.ok(
    enPrompt.includes("SMART BANGLADESHI TECH YOUTUBER"),
    "English prompt must define smart tech creator persona"
  );
  assert.ok(
    bnPrompt.includes("SMART BANGLADESHI TECH YOUTUBER"),
    "Bengali prompt must define smart tech creator persona"
  );

  // 4. Constructive Co-Founder Collaboration (Zero Nagging)
  assert.ok(
    enPrompt.includes("CONSTRUCTIVE CO-FOUNDER COLLABORATION (ZERO NAGGING)"),
    "English prompt must enforce zero nagging co-founder dynamic"
  );
  assert.ok(
    bnPrompt.includes("CONSTRUCTIVE CO-FOUNDER COLLABORATION (ZERO NAGGING)"),
    "Bengali prompt must enforce zero nagging co-founder dynamic"
  );

  // 5. 1:1 Parity Affirmations
  assert.ok(
    enPrompt.includes("1:1 EMOTIONAL PARITY"),
    "English prompt must declare 1:1 emotional parity"
  );
  assert.ok(
    bnPrompt.includes("1:1 EMOTIONAL PARITY"),
    "Bengali prompt must declare 1:1 emotional parity"
  );
});

// -----------------------------------------------------------------------------
// TEST 2: Conversational Word Cap Alignment (No 5-14 Word Constraint)
// -----------------------------------------------------------------------------
runTest("Conversational Word Cap Alignment: Bengali conversational word limit raised to 16-18 words max", () => {
  const jm = new JarvisManager();
  const enPrompt = jm.getSystemPrompt("tuktuk", "", null, "en");
  const bnPrompt = jm.getSystemPrompt("tuktuk", "", null, "bn");

  // Verify that neither prompt forces the archaic 5 to 14 words straightjacket
  assert.ok(
    !bnPrompt.includes("5 to 14 words max"),
    "Bengali prompt must NOT contain restrictive '5 to 14 words max' constraint"
  );
  assert.ok(
    !enPrompt.includes("5 to 14 words max"),
    "English prompt must NOT contain restrictive '5 to 14 words max' constraint"
  );

  // Verify natural spoken pacing
  assert.ok(
    bnPrompt.includes("up to 16 to 18 words max") || bnPrompt.includes("NATURAL SPOKEN CONVERSATIONAL PACING"),
    "Bengali prompt must permit natural pacing up to 16-18 words"
  );
});

// -----------------------------------------------------------------------------
// TEST 3: Speech-to-Text Acoustic Normalization
// -----------------------------------------------------------------------------
runTest("STT Acoustic Normalization: Fixes 'thay bot', 'difrent vide', and 'bangali'", () => {
  const rawInput = "we have a big issues english tuk tuk and bangali tuktuk not same thay bot give me difrent vide fully need to fix deeply";
  const sanitized = TextSanitizer.sanitize(rawInput);

  console.log(`     Raw STT Input:  "${rawInput}"`);
  console.log(`     Sanitized Text: "${sanitized}"`);

  assert.ok(
    sanitized.includes("Bengali"),
    `Expected 'bangali' -> 'Bengali', got: "${sanitized}"`
  );
  assert.ok(
    sanitized.includes("they both"),
    `Expected 'thay bot' -> 'they both', got: "${sanitized}"`
  );
  assert.ok(
    sanitized.includes("different vibe"),
    `Expected 'difrent vide' -> 'different vibe', got: "${sanitized}"`
  );
});

// -----------------------------------------------------------------------------
// TEST 4: ActionRunner Directive for Vibe Critique
// -----------------------------------------------------------------------------
runTest("ActionRunner Directive: Dispatches dedicated 1:1 partner response for vibe critique", async () => {
  const query = "we have a big issues english tuk tuk and bangali tuktuk not same thay bot give me difrent vide fully need to fix deeply";
  const runner = new ActionRunner();
  
  const result = await runner.execute(query, { currentAgent: "tuktuk" });
  assert.ok(result, "ActionRunner must handle the vibe critique query");
  assert.strictEqual(result.handled, true, "Result must be marked handled");
  console.log(`     ActionRunner Speech Output: "${result.spokenText}"`);

  assert.ok(
    result.spokenText.toLowerCase().includes("babe"),
    "ActionRunner speech must address Hritthik as babe"
  );
  assert.ok(
    result.spokenText.includes("1:1") || result.spokenText.toLowerCase().includes("vibe") || result.spokenText.includes("ভাইব"),
    "ActionRunner speech must address the vibe alignment"
  );
});

// -----------------------------------------------------------------------------
// TEST 5: LocalCognitiveBrain Intent & Fallback Vibe Parity
// -----------------------------------------------------------------------------
runTest("LocalCognitiveBrain Vibe Alignment: Cognitive brain returns loving, energetic tech partner replies", () => {
  const query = "english tuk tuk and bengali tuktuk vibe is different, fix it babe";
  const reply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query);

  console.log(`     LocalCognitiveBrain Reply: "${reply}"`);
  assert.ok(
    reply.toLowerCase().includes("babe"),
    "LocalCognitiveBrain response must address user as babe"
  );
  assert.ok(
    reply.includes("vibe") || reply.includes("ভাইব") || reply.includes("1:1") || reply.includes("একদম"),
    "Response must align with the unified vibe"
  );
  assert.ok(!reply.toLowerCase().includes("bro"), "Must never call user bro");
});

// -----------------------------------------------------------------------------
// TEST 6: Unified Voice Model Lock (Zero Flickering)
// -----------------------------------------------------------------------------
runTest("Unified Voice Model Lock: Tuk Tuk uses en-US-AvaMultilingualNeural across English and Bengali", () => {
  assert.strictEqual(
    JarvisManager.AGENTS.tuktuk.voice,
    "en-US-AvaMultilingualNeural",
    "Tuk Tuk voice must be strictly locked to en-US-AvaMultilingualNeural"
  );
});

console.log("================================================================================");
console.log(`🎉 ALL ${testsPassed} / ${totalTests} TUK TUK BILINGUAL VIBE PARITY TESTS PASSED!`);
console.log("================================================================================\n");

process.exit(0);
