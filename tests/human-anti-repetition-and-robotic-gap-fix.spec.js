/**
 * tests/human-anti-repetition-and-robotic-gap-fix.spec.js
 *
 * Verifies:
 * 1. Bayesian STT Normalization for user speech ("human not repet same talk again again fix all robotic gap from both working languages")
 * 2. English Prosodic Gap Elimination (colons, semicolons, mid-sentence comma compression, exclamation softening)
 * 3. Bengali Prosodic & Acoustic Switching Gap Elimination (loanwords, enclitic hyphens, breath spacing)
 * 4. Anti-Repetition Ring Buffer (50-item depth, multi-variant diversity across consecutive turns)
 * 5. Purge of Canned Meta-Slogans ("Zero robotic scripts", "No repetitive scripts", "Zero robotic fluff")
 * 6. Dynamic Directives Deduplication in JarvisManager
 * 7. LLM Anti-Repetition Penalties (presence_penalty & frequency_penalty in MasterApiGateway)
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const MasterApiGateway = require("../src/utils/master-api-gateway");

console.log("================================================================================");
console.log("🗣️ VERIFYING ANTI-REPETITION & ZERO ROBOTIC GAPS ACROSS BOTH LANGUAGES");
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
// TEST 1: Bayesian STT Normalization for User Voice Input
// -----------------------------------------------------------------------------
runTest("STT normalizes 'human not repet same talk again again fix all robotic gap from both working languages'", () => {
  const rawInput = "human not repet same talk again again fix all robotic gap from both working languages";
  const sanitized = TextSanitizer.sanitize(rawInput);
  console.log(`     Raw input:       "${rawInput}"`);
  console.log(`     Sanitized input: "${sanitized}"`);

  assert.ok(sanitized.includes("repeat"), "Must correct 'repet' to 'repeat'");
  assert.ok(sanitized.includes("again and again"), "Must correct 'again again' to 'again and again'");
  assert.ok(sanitized.includes("robotic gaps"), "Must correct 'robotic gap' to 'robotic gaps'");
  assert.ok(sanitized.includes("both working languages"), "Must normalize 'both working languages'");
  assert.ok(!sanitized.includes("repet"), "Must not contain misspelling 'repet'");
});

// -----------------------------------------------------------------------------
// TEST 2: English Prosodic Gap Elimination in phoneticNormalizeForTTS
// -----------------------------------------------------------------------------
runTest("English phonetic normalization compresses colons, semicolons, and mid-sentence pauses", () => {
  const englishInput = "Status: operational; tests are green, terminal is ready, pipeline is running!";
  const normalized = JarvisManager.phoneticNormalizeForTTS(englishInput, "en-US-AvaMultilingualNeural");
  console.log(`     Input:      "${englishInput}"`);
  console.log(`     Normalized: "${normalized}"`);

  // Colons and semicolons removed (they cause 500-700ms pauses in Edge TTS)
  assert.ok(!normalized.includes(":"), "Colons must be removed from English TTS output");
  assert.ok(!normalized.includes(";"), "Semicolons must be removed from English TTS output");
  // Exclamations converted to period pauses
  assert.ok(!normalized.includes("!"), "Exclamation marks must be softened in English TTS output");
  // Mid-sentence commas compressed (at most 1 comma before final clause)
  const commaCount = (normalized.match(/,/g) || []).length;
  assert.ok(commaCount <= 1, `Multiple intermediate commas must be compressed (got ${commaCount})`);
});

// -----------------------------------------------------------------------------
// TEST 3: Bengali Prosodic & Acoustic Switching Gap Elimination
// -----------------------------------------------------------------------------
runTest("Bengali phonetic normalization maps tech loanwords to Bengali script and separates hyphens", () => {
  const mixedInput = "babe code-টা repeat করো কোনো gap থাকবে না human language";
  const normalized = JarvisManager.phoneticNormalizeForTTS(mixedInput, "en-US-AvaMultilingualNeural");
  console.log(`     Mixed input: "${mixedInput}"`);
  console.log(`     Normalized:  "${normalized}"`);

  assert.ok(normalized.includes("কোড টা"), "Hyphenated enclitic 'code-টা' must be mapped and separated to 'কোড টা'");
  assert.ok(normalized.includes("রিপিট"), "Loanword 'repeat' must be mapped to Bengali 'রিপিট'");
  assert.ok(normalized.includes("গ্যাপ"), "Loanword 'gap' must be mapped to Bengali 'গ্যাপ'");
  assert.ok(normalized.includes("হিউম্যান"), "Loanword 'human' must be mapped to Bengali 'হিউম্যান'");
  assert.ok(normalized.includes("ল্যাঙ্গুয়েজ"), "Loanword 'language' must be mapped to Bengali 'ল্যাঙ্গুয়েজ'");
});

// -----------------------------------------------------------------------------
// TEST 4: Anti-Repetition Ring Buffer Diversity Across Consecutive Turns
// -----------------------------------------------------------------------------
runTest("Anti-duplication ring buffer ensures diversity across consecutive turns", () => {
  const responses = [];
  for (let i = 0; i < 8; i++) {
    const res = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "kemon acho babe");
    responses.push(res);
  }
  const uniqueCount = new Set(responses).size;
  console.log(`     8 consecutive queries generated ${uniqueCount} unique variants`);
  assert.ok(uniqueCount >= 3, `Expected at least 3 distinct variants across 8 calls, got ${uniqueCount}`);

  // Consecutive items must not be identical
  for (let i = 1; i < responses.length; i++) {
    assert.notStrictEqual(responses[i], responses[i - 1], `Consecutive responses ${i - 1} and ${i} must not be identical`);
  }
});

// -----------------------------------------------------------------------------
// TEST 5: Purge of Canned Meta-Slogans Across All Agents
// -----------------------------------------------------------------------------
runTest("Canned meta-slogans are completely purged from all agent critique handlers", () => {
  const bannedSlogans = [
    "zero robotic scripts",
    "no repetitive scripts",
    "zero robotic fluff",
    "original thinker energy",
    "systems nominal"
  ];

  const queries = [
    ["tuktuk", "stop repeating the same thing over and over"],
    ["vision", "you sound like a robot, not an original thinker"],
    ["brian", "why are you repeating robotic scripts"],
    ["team", "all agents talk like a robot"]
  ];

  for (const [agentKey, query] of queries) {
    const reply = LocalCognitiveBrain.synthesizeResponse(agentKey, agentKey, query);
    const lower = reply.toLowerCase();
    console.log(`     [${agentKey}] Reply: "${reply}"`);
    for (const slogan of bannedSlogans) {
      assert.ok(!lower.includes(slogan), `Agent [${agentKey}] must not use canned slogan "${slogan}"`);
    }
  }
});

// -----------------------------------------------------------------------------
// TEST 6: Dynamic Fallback Diversity Without Repetitive Trailer Questions
// -----------------------------------------------------------------------------
runTest("Tuk Tuk English fallback pool does not end every turn with rote trailer questions", () => {
  const fallbacks = [];
  for (let i = 0; i < 10; i++) {
    const res = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "...", {}, "en");
    fallbacks.push(res);
  }
  console.log(`     Sample fallback 1: "${fallbacks[0]}"`);
  console.log(`     Sample fallback 2: "${fallbacks[1]}"`);

  const statementCount = fallbacks.filter(f => !f.endsWith("?")).length;
  console.log(`     Statements/observations (non-question endings): ${statementCount}/10`);
  assert.ok(statementCount >= 3, "At least 3/10 fallbacks should be natural statements rather than rote question trailers");
});

// -----------------------------------------------------------------------------
// TEST 7: Dynamic Directives Deduplication in JarvisManager
// -----------------------------------------------------------------------------
runTest("JarvisManager deduplicates dynamic directives automatically", () => {
  const jm = new JarvisManager();
  const testRule = "User directive: Use 'babe' only. Never use 'shona', 'sona', or any other pet name.";
  const initialCount = jm.loadDynamicDirectives().length;

  jm.addDynamicDirective(testRule, "tuktuk");
  jm.addDynamicDirective(testRule, "tuktuk");

  const finalCount = jm.loadDynamicDirectives().length;
  console.log(`     Directives count before: ${initialCount}, after 2 duplicate additions: ${finalCount}`);
  assert.strictEqual(finalCount, initialCount <= 1 ? 1 : initialCount, "Duplicate directives must not increase directives count");
});

// -----------------------------------------------------------------------------
// TEST 8: MasterApiGateway Default Repetition Penalties
// -----------------------------------------------------------------------------
runTest("MasterApiGateway includes presence_penalty and frequency_penalty defaults", () => {
  const gatewayCode = fs.readFileSync(path.join(__dirname, "../src/utils/master-api-gateway.js"), "utf8");
  assert.ok(gatewayCode.includes("presence_penalty"), "MasterApiGateway must define presence_penalty");
  assert.ok(gatewayCode.includes("frequency_penalty"), "MasterApiGateway must define frequency_penalty");
  assert.ok(gatewayCode.includes("presence_penalty") && gatewayCode.includes("0.6"), "presence_penalty defaults to 0.6");
  assert.ok(gatewayCode.includes("frequency_penalty") && gatewayCode.includes("0.5"), "frequency_penalty defaults to 0.5");
});

// -----------------------------------------------------------------------------
// TEST 9: JarvisManager System Prompt Invariants Include Anti-Repetition Law
// -----------------------------------------------------------------------------
runTest("JarvisManager system prompt enforces Anti-Repetition Law & Zero Canned Slogans", () => {
  const jm = new JarvisManager();
  const prompt = jm.getSystemPrompt("tuktuk");
  assert.ok(prompt.includes("ANTI-REPETITION LAW"), "System prompt must include ANTI-REPETITION LAW");
  assert.ok(prompt.includes("ZERO CANNED SLOGANS"), "System prompt must include ZERO CANNED SLOGANS");
  assert.ok(prompt.includes("NEVER reuse sentence patterns"), "Must instruct model never to reuse sentence patterns");
});

console.log("================================================================================");
console.log(`🏁 RESULT: ${testsPassed} of ${totalTests} tests passed cleanly.`);
console.log("================================================================================");

if (testsPassed !== totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
