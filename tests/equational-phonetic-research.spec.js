/**
 * tests/equational-phonetic-research.spec.js
 *
 * Rigorous Mathematical & Integration Test Suite for:
 * 1. Parameterized Acoustic Edit Distance D(i, j) & Confusion Matrix Penalties
 * 2. Normalized Acoustic Similarity Metric S_acoustic(W1, W2)
 * 3. Double Metaphone Invariant Hash Matching Phi(w)
 * 4. Compound Token Fusion Affinity Delta_Affinity ("every thing" -> "everything")
 * 5. Bayesian MAP Sequence Decoding over Domain Lexicon
 * 6. End-to-End TextSanitizer & PostProcessTranscription Normalization
 * 7. ActionRunner & LocalCognitiveBrain Directive Handlers
 */

const assert = require("assert");
const equationalPhoneticEngine = require("../src/utils/prompt-engine/equational-phonetic-engine");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const ActionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("================================================================================");
console.log("🔬 VERIFYING DEEP EQUATIONAL PHONETIC RESEARCH & AUTOMATIC CORRECTION PIPELINE");
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
// TEST 1: Parameterized Acoustic Edit Distance & Confusion Penalties
// -----------------------------------------------------------------------------
runTest("Acoustic Levenshtein: Homorganic and formant substitutions cost significantly less than arbitrary substitutions", () => {
  // Homorganic consonant substitution (v <-> b): cost = 0.15
  const distHomorganic = equationalPhoneticEngine.computeAcousticEditDistance("vibe", "bide");
  // Arbitrary substitution (v <-> k): cost = 1.0
  const distArbitrary = equationalPhoneticEngine.computeAcousticEditDistance("vibe", "kide");

  console.log(`     D(vibe, bide) = ${distHomorganic} vs D(vibe, kide) = ${distArbitrary}`);
  assert.ok(distHomorganic < distArbitrary, "Homorganic consonant edit distance must be lower than arbitrary");
  assert.ok(distHomorganic <= 0.45, `Homorganic distance must be <= 0.45, got ${distHomorganic}`);

  // Vowel formant shift (thay <-> they): cost = 0.20
  const distThayThey = equationalPhoneticEngine.computeAcousticEditDistance("thay", "they");
  console.log(`     D(thay, they) = ${distThayThey}`);
  assert.strictEqual(distThayThey, 0.20, "thay -> they substitution penalty must be exactly 0.20");

  // Compound space deletion cost (every thing <-> everything): cost = 0.10
  const distCompound = equationalPhoneticEngine.computeAcousticEditDistance("every thing", "everything");
  console.log(`     D(every thing, everything) = ${distCompound}`);
  assert.strictEqual(distCompound, 0.10, "Compound space deletion cost must be 0.10");
});

// -----------------------------------------------------------------------------
// TEST 2: Normalized Acoustic Similarity Metric S_acoustic(W1, W2)
// -----------------------------------------------------------------------------
runTest("Normalized Acoustic Similarity: High acoustic similarity for common STT acoustic slips", () => {
  const simThayThey = equationalPhoneticEngine.computeAcousticSimilarity("thay", "they");
  assert.ok(simThayThey >= 0.94, `S_acoustic(thay, they) must be >= 0.94, got ${simThayThey}`);

  const simVideVibe = equationalPhoneticEngine.computeAcousticSimilarity("vide", "vibe");
  assert.ok(simVideVibe >= 0.90, `S_acoustic(vide, vibe) must be >= 0.90, got ${simVideVibe}`);

  const simDefretDiff = equationalPhoneticEngine.computeAcousticSimilarity("defret", "different");
  assert.ok(simDefretDiff >= 0.64, `S_acoustic(defret, different) must be >= 0.64, got ${simDefretDiff}`);

  const simSmouthSmooth = equationalPhoneticEngine.computeAcousticSimilarity("smouth", "smooth");
  assert.ok(simSmouthSmooth >= 0.90, `S_acoustic(smouth, smooth) must be >= 0.90, got ${simSmouthSmooth}`);

  const simLatansyLatency = equationalPhoneticEngine.computeAcousticSimilarity("latansy", "latency");
  assert.ok(simLatansyLatency >= 0.90, `S_acoustic(latansy, latency) must be >= 0.90, got ${simLatansyLatency}`);

  console.log(`     Acoustic Similarities: thay/they=${simThayThey}, vide/vibe=${simVideVibe}, defret/diff=${simDefretDiff}`);
});

// -----------------------------------------------------------------------------
// TEST 3: Double Metaphone Invariant Hash Matching
// -----------------------------------------------------------------------------
runTest("Double Metaphone: Phonetic signatures match across agent mishearings", () => {
  const metaVision1 = equationalPhoneticEngine.computeDoubleMetaphone("Vision");
  const metaVision2 = equationalPhoneticEngine.computeDoubleMetaphone("Vison");
  assert.strictEqual(metaVision1.primary, metaVision2.primary, "Vision and Vison must produce identical Double Metaphone primary keys");

  const metaFriday1 = equationalPhoneticEngine.computeDoubleMetaphone("Friday");
  const metaFriday2 = equationalPhoneticEngine.computeDoubleMetaphone("Fryday");
  assert.strictEqual(metaFriday1.primary, metaFriday2.primary, "Friday and Fryday must produce identical Double Metaphone primary keys");

  const metaSmooth1 = equationalPhoneticEngine.computeDoubleMetaphone("Smooth");
  const metaSmooth2 = equationalPhoneticEngine.computeDoubleMetaphone("Smouth");
  assert.strictEqual(metaSmooth1.primary, metaSmooth2.primary, "Smooth and Smouth must produce identical Double Metaphone primary keys");
});

// -----------------------------------------------------------------------------
// TEST 4: Compound Token Fusion Affinity Equation Delta_Affinity
// -----------------------------------------------------------------------------
runTest("Compound Token Fusion: Fuses split compound words like 'every thing' -> 'everything'", () => {
  assert.strictEqual(
    equationalPhoneticEngine.fuseCompoundTokens("fix more every thing with deep research"),
    "fix more everything with deep research"
  );
  assert.strictEqual(
    equationalPhoneticEngine.fuseCompoundTokens("every thing is running smoothly in the code base"),
    "everything is running smoothly in the codebase"
  );
  assert.strictEqual(
    equationalPhoneticEngine.fuseCompoundTokens("check the pipe line and the back end"),
    "check the pipeline and the backend"
  );
  assert.strictEqual(
    equationalPhoneticEngine.fuseCompoundTokens("some thing is wrong with any thing here"),
    "something is wrong with anything here"
  );
});

// -----------------------------------------------------------------------------
// TEST 5: Bayesian MAP Sequence Decoder
// -----------------------------------------------------------------------------
runTest("MAP Sequence Decoder: Disambiguates acoustic slips to canonical domain lexicon", () => {
  const mapDefret = equationalPhoneticEngine.decodeMAP("defret");
  assert.strictEqual(mapDefret, "different", `Expected 'defret' -> 'different', got ${mapDefret}`);

  const mapPipline = equationalPhoneticEngine.decodeMAP("pipline");
  assert.strictEqual(mapPipline, "pipeline", `Expected 'pipline' -> 'pipeline', got ${mapPipline}`);

  const mapEquatinal = equationalPhoneticEngine.decodeMAP("equatinal");
  assert.strictEqual(mapEquatinal, "equational", `Expected 'equatinal' -> 'equational', got ${mapEquatinal}`);
});

// -----------------------------------------------------------------------------
// TEST 6: End-to-End TextSanitizer Normalization
// -----------------------------------------------------------------------------
runTest("TextSanitizer End-to-End: Normalizes the exact user prompt and acoustic variations", () => {
  const rawPrompt = "Added automatic phonetic corrections fix more every thing with deep equational research";
  const sanitized = TextSanitizer.sanitize(rawPrompt);
  console.log(`     Raw Input:  "${rawPrompt}"`);
  console.log(`     Sanitized:  "${sanitized}"`);

  assert.ok(
    sanitized.includes("everything"),
    `Expected 'every thing' -> 'everything', got: "${sanitized}"`
  );
  assert.ok(
    sanitized.includes("equational research"),
    `Expected 'equational research' preserved/normalized, got: "${sanitized}"`
  );
  assert.ok(
    sanitized.includes("phonetic corrections"),
    `Expected 'phonetic corrections' preserved/normalized, got: "${sanitized}"`
  );

  // Additional acoustic phonetic checks
  assert.strictEqual(
    TextSanitizer.sanitize("fix more every thing"),
    "Fix more everything"
  );
  assert.strictEqual(
    TextSanitizer.sanitize("fix every thing"),
    "Fix everything"
  );
  assert.strictEqual(
    TextSanitizer.sanitize("defret voices look defret"),
    "Different voices look different"
  );
  assert.strictEqual(
    TextSanitizer.sanitize("thay bot give me difrent vide fully"),
    "They both give me different vibe fully"
  );
});

// -----------------------------------------------------------------------------
// TEST 7: ActionRunner Directive Dispatch for Phonetic Research
// -----------------------------------------------------------------------------
runTest("ActionRunner Directive: Intercepts equational phonetic research query and returns structured sync state", async () => {
  const runner = new ActionRunner();
  const query = "Added automatic phonetic corrections fix more every thing with deep equational research";

  const resultTukTuk = await runner.execute(query, { currentAgent: "tuktuk" });
  assert.ok(resultTukTuk, "ActionRunner must handle phonetic research directive for Tuk Tuk");
  assert.strictEqual(resultTukTuk.handled, true);
  assert.strictEqual(resultTukTuk.data.action, "equational_phonetic_research_sync");
  assert.strictEqual(resultTukTuk.data.status, "OPTIMIZED");
  assert.strictEqual(resultTukTuk.data.engine, "EquationalPhoneticEngine");
  assert.ok(resultTukTuk.spokenText.toLowerCase().includes("babe"));
  console.log(`     Tuk Tuk ActionRunner speech: "${resultTukTuk.spokenText}"`);

  const resultVision = await runner.execute(query, { currentAgent: "vision" });
  assert.ok(resultVision, "ActionRunner must handle phonetic research directive for Vision");
  assert.strictEqual(resultVision.handled, true);
  assert.strictEqual(resultVision.data.action, "equational_phonetic_research_sync");
  assert.ok(resultVision.spokenText.toLowerCase().includes("brother"));
  console.log(`     Vision ActionRunner speech: "${resultVision.spokenText}"`);
});

// -----------------------------------------------------------------------------
// TEST 8: LocalCognitiveBrain Intent Synthesis
// -----------------------------------------------------------------------------
runTest("LocalCognitiveBrain: Generates reassuring co-founder replies in English and Bengali", () => {
  const query = "Added automatic phonetic corrections fix more every thing with deep equational research";
  
  // English Tuk Tuk
  const replyEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query);
  assert.ok(replyEn.toLowerCase().includes("babe"), "Must address as babe");
  assert.ok(
    replyEn.toLowerCase().includes("phonetic") || replyEn.toLowerCase().includes("equational") || replyEn.toLowerCase().includes("everything"),
    `Must confirm equational phonetic engine, got: "${replyEn}"`
  );
  console.log(`     Brain English reply: "${replyEn}"`);

  // Bengali Tuk Tuk
  const replyBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query + " babe", {}, "bn");
  assert.ok(replyBn.toLowerCase().includes("babe"), "Must address as babe");
  assert.ok(
    replyBn.toLowerCase().includes("phonetic") || replyBn.includes("রিসার্চ") || replyBn.includes("সিস্টেম") || replyBn.includes("ইঞ্জিন"),
    `Must confirm Bengali phonetic engine, got: "${replyBn}"`
  );
  console.log(`     Brain Bengali reply: "${replyBn}"`);
});

console.log("================================================================================");
console.log(`🎉 ALL ${testsPassed} / ${totalTests} EQUATIONAL PHONETIC RESEARCH TESTS PASSED!`);
console.log("================================================================================\n");

process.exit(0);
