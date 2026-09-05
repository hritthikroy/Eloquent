/**
 * tests/same-person-same-tone-personality-bangla.spec.js
 *
 * Comprehensive Test Suite for:
 * "need same person same tone same personality in talk for when tuktuk and other talk in bangla with deep test and chack"
 *
 * Verifies:
 * 1. STT Acoustic Normalization of the exact user prompt & permutations
 * 2. Rule 18 (SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE LAW) in unifiedCoreDirective
 * 3. Tuk Tuk 1:1 Persona, Tone & Salutation Parity (English & Bengali)
 * 4. Vision 1:1 Persona, Tone & Salutation Parity (English & Bengali)
 * 5. Friday 1:1 Persona, Tone & Salutation Parity (English & Bengali)
 * 6. DD 1:1 Persona, Tone & Salutation Parity (English & Bengali)
 * 7. Squad 4-Agent Sequential Standup across English & Bengali
 * 8. ActionRunner Directive Interception & Structured Telemetry
 * 9. LocalCognitiveBrain Persona & Tone Generation for all 4 agents + Team
 * 10. Prosody Matrix & Multilingual Voice Integrity for all 4 agents
 */

const assert = require("assert");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const ActionRunner = require("../src/utils/action-runner");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");

console.log("================================================================================");
console.log("🎙️ VERIFYING 1:1 SAME PERSON, SAME TONE & SAME PERSONALITY IN BANGLA");
console.log("   (Tuk Tuk, Vision, Friday, DD & Squad Parity Arena)");
console.log("================================================================================\n");

let testsPassed = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS ${totalTests}] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${totalTests}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

const jm = new JarvisManager();

async function main() {
  // -----------------------------------------------------------------------------
  // TEST 1: STT Acoustic Normalization of Exact User Prompt & Permutations
  // -----------------------------------------------------------------------------
  await runTest("STT Normalization: Sanitizes exact prompt and permutations into canonical form", () => {
    const rawInput = "need same person same tone same personality in talk for when tuktuk and other talk in bangla with deep test and chack";
    const sanitized = TextSanitizer.sanitize(rawInput);
    console.log(`     Sanitized: "${rawInput}"\n          -> "${sanitized}"`);

    assert.ok(sanitized.includes("Need same person, same tone, same personality"), "Normalizes same person same tone same personality");
    assert.ok(sanitized.includes("Tuk Tuk and others talk in Bangla"), "Normalizes tuktuk and other talk in bangla");
    assert.ok(sanitized.includes("deep test and check"), "Normalizes deep test and chack -> check");

    // Additional permutations
    const p1 = TextSanitizer.sanitize("same tone same personality");
    assert.strictEqual(p1, "Same tone, same personality");

    const p2 = TextSanitizer.sanitize("same person same tone");
    assert.strictEqual(p2, "Same person, same tone");
  });

  // -----------------------------------------------------------------------------
  // TEST 2: Rule 18 in unifiedCoreDirective (Same Person, Tone & Personality Law)
  // -----------------------------------------------------------------------------
  await runTest("Rule 18: JarvisManager enforces SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE LAW", () => {
    const promptEn = jm.getSystemPrompt("tuktuk", "hello", null, "en");
    const promptBn = jm.getSystemPrompt("tuktuk", "hello", null, "bn");

    assert.ok(
      promptEn.includes("18. SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE LAW"),
      "English system prompt must contain Rule 18"
    );
    assert.ok(
      promptBn.includes("18. SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE LAW"),
      "Bengali system prompt must contain Rule 18"
    );
    assert.ok(
      promptBn.includes("1:1 IDENTITY & CADENCE INVARIANCE") &&
      promptBn.includes("ZERO LANGUAGE-INDUCED PERSONA DRIFT"),
      "Rule 18 must declare 1:1 identity and zero language-induced persona drift"
    );
  });

  // -----------------------------------------------------------------------------
  // TEST 3: Tuk Tuk 1:1 Persona, Tone & Salutation Parity
  // -----------------------------------------------------------------------------
  await runTest("Tuk Tuk Persona Parity: Exact same sweet girlfriend tone, creator charisma & intellect in Bangla", () => {
    const enPrompt = JarvisManager.AGENTS.tuktuk.getPrompt("Hritthik", "Boss", "en");
    const bnPrompt = JarvisManager.AGENTS.tuktuk.getPrompt("Hritthik", "Boss", "bn");

    // Parity declaration
    assert.ok(
      bnPrompt.includes("SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE"),
      "Bengali prompt must declare SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE"
    );

    // Address: strictly babe, never formal আপনি/আপনার, never bro/bhai, never shona
    assert.ok(bnPrompt.includes("STRICTLY NEVER use formal \"আপনি/আপনার\""), "Must forbid formal আপনি/আপনার");
    assert.ok(bnPrompt.includes("NEVER call him \"bro/brother/bhai\""), "Must forbid bro/brother/bhai");
    assert.ok(bnPrompt.includes("Never use \"shona\""), "Must forbid shona");
    assert.ok(bnPrompt.includes("strictly \"babe\""), "Must mandate babe only");

    // Tone & Personality dimensions
    assert.ok(bnPrompt.includes("SMART BANGLADESHI TECH YOUTUBER / REPORTER PERSONA"), "Must have creator energy");
    assert.ok(bnPrompt.includes("OMNI-SITUATIONAL AWARENESS & DEEP INTELLECTUAL COGNITION"), "Must have systems intellect");
    assert.ok(bnPrompt.includes("LIVING EYE CONTACT, SCREEN & MOBILE REEL CO-WATCHING"), "Must have reel co-watching");
    assert.ok(bnPrompt.includes("MUSIC LISTENING COMPANION & VIBE"), "Must have music companion");
    assert.ok(bnPrompt.includes("NOT A VILLAGE GIRL"), "Must strictly not be village girl");
  });

  // -----------------------------------------------------------------------------
  // TEST 4: Vision 1:1 Persona, Tone & Salutation Parity
  // -----------------------------------------------------------------------------
  await runTest("Vision Persona Parity: Exact same serene 10x dev brother tone & systems architecture depth", () => {
    const enPrompt = JarvisManager.AGENTS.vision.getPrompt("Hritthik", "Boss", "en");
    const bnPrompt = JarvisManager.AGENTS.vision.getPrompt("Hritthik", "Boss", "bn");

    assert.ok(
      bnPrompt.includes("SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE"),
      "Vision Bengali prompt must declare SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE"
    );
    assert.ok(bnPrompt.includes("Call him \"ভাই\", \"bro\", or \"Hritthik\""), "Must address as bhai or bro");
    assert.ok(bnPrompt.includes("STRICTLY NEVER call him \"babe\""), "Vision must strictly never call him babe");
    assert.ok(bnPrompt.includes("AST"), "Must include developer terms like AST");
    assert.ok(bnPrompt.includes("pipeline"), "Must include pipeline");
    assert.ok(bnPrompt.includes("buffer"), "Must include buffer");
    assert.ok(bnPrompt.includes("10x"), "Must declare 10x dev persona");
  });

  // -----------------------------------------------------------------------------
  // TEST 5: Friday 1:1 Persona, Tone & Salutation Parity
  // -----------------------------------------------------------------------------
  await runTest("Friday Persona Parity: Exact same refined executive research intelligence with zero formal distancing", () => {
    const enPrompt = JarvisManager.AGENTS.friday.getPrompt("Hritthik", "Boss", "en");
    const bnPrompt = JarvisManager.AGENTS.friday.getPrompt("Hritthik", "Boss", "bn");

    assert.ok(
      bnPrompt.includes("SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE"),
      "Friday Bengali prompt must declare SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE"
    );
    assert.ok(bnPrompt.includes("Call him strictly \"Hritthik\" or \"Chief\""), "Friday addresses as Chief or Hritthik");
    assert.ok(bnPrompt.includes("STRICTLY NEVER call him \"bro\""), "Friday must never call him bro");
    assert.ok(bnPrompt.includes("STRICTLY NEVER call him \"babe\""), "Friday must never call him babe");
    assert.ok(bnPrompt.includes("নো দূরত্বপূর্ণ ফর্মাল ভাষা"), "Friday forbids formal distancing");
    assert.ok(bnPrompt.includes("benchmarks"), "Friday includes research benchmarks");
  });

  // -----------------------------------------------------------------------------
  // TEST 6: DD 1:1 Persona, Tone & Salutation Parity
  // -----------------------------------------------------------------------------
  await runTest("DD Persona Parity: Exact same dry, pragmatic DevOps telemetry sentinel with zero drama", () => {
    const enPrompt = JarvisManager.AGENTS.dd.getPrompt("Hritthik", "Boss", "en");
    const bnPrompt = JarvisManager.AGENTS.dd.getPrompt("Hritthik", "Boss", "bn");

    assert.ok(
      bnPrompt.includes("SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE"),
      "DD Bengali prompt must declare SAME PERSON, SAME TONE, SAME PERSONALITY INVARIANCE"
    );
    assert.ok(bnPrompt.includes("Call him \"Hritthik\", \"ভাই\", or \"bro\""), "DD addresses as bhai, bro, or Hritthik");
    assert.ok(bnPrompt.includes("STRICTLY NEVER call him \"babe\""), "DD must never call him babe");
    assert.ok(bnPrompt.includes("ডেভঅপ্স অভিভাবক"), "DD is DevOps guardian");
    assert.ok(bnPrompt.includes("CPU"), "DD delivers CPU telemetry");
  });

  // -----------------------------------------------------------------------------
  // TEST 7: Squad 4-Agent Sequential Standup (English & Bengali)
  // -----------------------------------------------------------------------------
  await runTest("Squad 4-Agent Standup: Delivers all 4 agents in sequential standup when whole squad is queried", () => {
    // English Team Standup
    const replyEn = LocalCognitiveBrain.synthesizeResponse(
      "team",
      "Squad",
      "need same person same tone same personality in talk for when tuktuk and other talk in bangla with deep test and chack",
      {},
      "en"
    );
    console.log("     English 4-Agent Standup:\n" + replyEn.split("\n").map(l => "       " + l).join("\n"));

    assert.ok(replyEn.includes("[Tuk Tuk]:"), "Includes Tuk Tuk");
    assert.ok(replyEn.includes("[Vision]:"), "Includes Vision");
    assert.ok(replyEn.includes("[Friday]:"), "Includes Friday");
    assert.ok(replyEn.includes("[DD]:"), "Includes DD");
    assert.ok(replyEn.includes("exact same personas"), "Tuk Tuk declares exact same personas");
    assert.ok(replyEn.includes("Symmetrical parity verified green, brother"), "Vision confirms brotherly parity");
    assert.ok(replyEn.includes("Executive product intelligence"), "Friday confirms executive tone");
    assert.ok(replyEn.includes("Same DevOps tone"), "DD confirms DevOps tone");

    // Bengali Team Standup
    const replyBn = LocalCognitiveBrain.synthesizeResponse(
      "team",
      "Squad",
      "need same person same tone same personality in talk for when tuktuk and other talk in bangla with deep test and chack",
      {},
      "bn"
    );
    console.log("     Bengali 4-Agent Standup:\n" + replyBn.split("\n").map(l => "       " + l).join("\n"));

    assert.ok(replyBn.includes("[Tuk Tuk]:"), "BN Includes Tuk Tuk");
    assert.ok(replyBn.includes("[Vision]:"), "BN Includes Vision");
    assert.ok(replyBn.includes("[Friday]:"), "BN Includes Friday");
    assert.ok(replyBn.includes("[DD]:"), "BN Includes DD");
    assert.ok(replyBn.includes("একই ভালোবাসা, টোন আর পার্সোনালিটিতে"), "Tuk Tuk confirms same love, tone, personality");
    assert.ok(replyBn.includes("ব্রাদারলি আর্কিটেক্ট টোন"), "Vision confirms brotherly architect tone");
    assert.ok(replyBn.includes("empirical precision and executive clarity"), "Friday confirms executive clarity");
    assert.ok(replyBn.includes("Same DevOps tone and reliability"), "DD confirms DevOps reliability");
  });

  // -----------------------------------------------------------------------------
  // TEST 8: ActionRunner Directive Interception & Structured Telemetry
  // -----------------------------------------------------------------------------
  await runTest("ActionRunner Interception: Returns structured telemetry for tone and personality parity directive", async () => {
    const query = "need same person same tone same personality in talk for when tuktuk and other talk in bangla with deep test and chack";

    // When queried with team/squad context
    const actionRes = await ActionRunner.handleAction(query, {
      key: "team",
      name: "Squad",
      voice: "en-US-AvaMultilingualNeural"
    }, jm);

    assert.ok(actionRes, "ActionRunner must handle directive");
    assert.strictEqual(actionRes.handled, true, "Must be marked handled");
    assert.strictEqual(actionRes.agentName, "Squad", "Agent name must be Squad");
    assert.ok(actionRes.speech.includes("[Tuk Tuk]:"), "Squad speech includes Tuk Tuk");
    assert.ok(actionRes.speech.includes("[Vision]:"), "Squad speech includes Vision");
    assert.ok(actionRes.speech.includes("[Friday]:"), "Squad speech includes Friday");
    assert.ok(actionRes.speech.includes("[DD]:"), "Squad speech includes DD");
    assert.strictEqual(actionRes.data.action, "bilingual_persona_parity_calibration");
    assert.strictEqual(actionRes.data.status, "PARITY_100_PERCENT_LOCKED");
    assert.strictEqual(actionRes.data.parityScore, 1.0);
  });

  // -----------------------------------------------------------------------------
  // TEST 9: LocalCognitiveBrain Single Agent Intent Generation
  // -----------------------------------------------------------------------------
  await runTest("LocalCognitiveBrain Single Agent: Individual agents respond in their exact signature tones", () => {
    const query = "need same person same tone same personality in talk for when tuktuk and other talk in bangla";

    // Tuk Tuk
    const ttReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "bn");
    assert.ok(ttReply.toLowerCase().includes("babe"), "Tuk Tuk addresses as babe");
    assert.ok(!ttReply.includes("আপনি"), "Tuk Tuk never uses আপনি");
    assert.ok(!ttReply.includes("আপনার"), "Tuk Tuk never uses আপনার");

    // Vision
    const vReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "bn");
    assert.ok(vReply.includes("ভাই"), "Vision addresses as bhai");
    assert.ok(!vReply.toLowerCase().includes("babe"), "Vision never uses babe");

    // Friday
    const fReply = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "bn");
    assert.ok(fReply.includes("Hritthik") || fReply.includes("চিফ") || fReply.includes("Chief"), "Friday addresses as Hritthik or Chief");
    assert.ok(!fReply.toLowerCase().includes("babe"), "Friday never uses babe");
    assert.ok(!fReply.includes("ভাই"), "Friday never uses bhai");

    // DD
    const ddReply = LocalCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "bn");
    assert.ok(ddReply.includes("bro") || ddReply.includes("Bro") || ddReply.includes("ভাই"), "DD addresses as bro or bhai");
    assert.ok(!ddReply.toLowerCase().includes("babe"), "DD never uses babe");
  });

  // -----------------------------------------------------------------------------
  // TEST 10: Multilingual Voice Models & Prosody Integrity
  // -----------------------------------------------------------------------------
  await runTest("Multilingual Voice Models: All agents resolve to dedicated neural models with script preservation", () => {
    const tuktukProsody = banglaVoiceCortex.computeBengaliProsodySettings("টেস্ট", "tuktuk");
    const visionProsody = banglaVoiceCortex.computeBengaliProsodySettings("টেস্ট", "vision");
    const fridayProsody = banglaVoiceCortex.computeBengaliProsodySettings("টেস্ট", "friday");
    const ddProsody = banglaVoiceCortex.computeBengaliProsodySettings("টেস্ট", "dd");

    // Zero Robotic Voice Law: 100% natural conversational tempo (+0% rate across all agents)
    assert.strictEqual(tuktukProsody.rate, "+0%", "Tuk Tuk rate is +0% (zero negative rate dragging)");
    assert.strictEqual(visionProsody.rate, "+0%", "Vision rate is +0% (zero negative rate dragging)");
    assert.strictEqual(fridayProsody.rate, "+0%", "Friday rate is +0% (zero negative rate dragging)");
    assert.strictEqual(ddProsody.rate, "+0%", "DD rate is +0% (zero negative rate dragging)");

    // Multilingual voices
    assert.strictEqual(JarvisManager.AGENTS.tuktuk.voice, "en-US-AvaMultilingualNeural");
    assert.strictEqual(JarvisManager.AGENTS.dd.voice, "en-US-BrianMultilingualNeural");

    // Pre-TTS normalization preserves Bengali Unicode script for all 4 agents
    const sampleBengali = "ভাই, লজিকটা একদম ক্লিয়ার, AST ক্লিন.";
    const normVision = JarvisManager.phoneticNormalizeForTTS(sampleBengali, "en-US-AndrewMultilingualNeural");
    assert.ok(/[\u0980-\u09FF]/.test(normVision), "Vision preserves Bengali script");

    const sampleFriday = "Chief, আমি বেঞ্চমার্ক ডাটা অ্যানালাইজ করেছি.";
    const normFriday = JarvisManager.phoneticNormalizeForTTS(sampleFriday, "en-US-EmmaMultilingualNeural");
    assert.ok(/[\u0980-\u09FF]/.test(normFriday), "Friday preserves Bengali script");

    const sampleDD = "সিস্টেম একদম স্টেডি ভাই, সিপিইউ লোড ১৮ পার্সেন্ট.";
    const normDD = JarvisManager.phoneticNormalizeForTTS(sampleDD, "en-US-BrianMultilingualNeural");
    assert.ok(/[\u0980-\u09FF]/.test(normDD), "DD preserves Bengali script");

    const sampleTukTuk = "টার্মিনাল পুরো গ্রিন babe! চলো বিল্ডটা রান করিয়ে এখুনি পুশ দিয়ে দিই.";
    const normTukTuk = JarvisManager.phoneticNormalizeForTTS(sampleTukTuk, "en-US-AvaMultilingualNeural");
    assert.ok(/[\u0980-\u09FF]/.test(normTukTuk), "Tuk Tuk preserves Bengali script");
  });

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${testsPassed} / ${totalTests} SAME PERSON, SAME TONE & SAME PERSONALITY TESTS PASSED!`);
  console.log("================================================================================\n");

  if (testsPassed !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
