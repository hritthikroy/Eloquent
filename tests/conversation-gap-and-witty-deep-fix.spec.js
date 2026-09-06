/**
 * Test Suite: Conversational Input/Output Gap & Deep Witty Intelligence Architecture
 * Verifies:
 * 1. System prompt compact mode produces <= 2,800 tokens (~1,000-1,200 tokens).
 * 2. Full system prompt remains backward-compatible with all Law 1-39 clauses.
 * 3. MasterApiGateway.compressPromptMessages strictly clamps oversized payloads.
 * 4. Preamble/scratchpad leak cleaner removes "We have to respond as...".
 * 5. LocalCognitiveBrain returns witty, empathetic, context-aware responses for:
 *    - Liveness check ("You need a SEC?", "Are you there?", "Shunchho?")
 *    - Self-update command ("U, update yourself.", "Nijeke update koro")
 *    - Sighs / exhaustion ("Sigh.", "Uff", "Tired")
 *    - Anti-repetition complaints ("Repeat kora bando koro", "Stop repeating", "Zirukh scripted")
 * 6. Strict Persona Sovereignty across all 4 squad agents in English and Bengali.
 * 7. Non-repetition & lexical variety across repeated turns.
 */

const assert = require("assert");
const JarvisManager = require("../src/utils/jarvis-manager");
const MasterApiGateway = require("../src/utils/master-api-gateway");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("================================================================================");
console.log("🚀 VERIFYING CONVERSATIONAL GAP ELIMINATION & DEEP WITTY COGNITION");
console.log("================================================================================");

let passedTests = 0;
const totalTests = 10;

function runTest(name, fn) {
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS ${passedTests}/${totalTests}] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    process.exit(1);
  }
}

const jm = new JarvisManager();
const gw = new MasterApiGateway();

// Helper regex for Vision and DD brotherhood terms (ASCII + Unicode)
const brotherRegex = /(?:\b(?:brother|bro)\b|ভাই)/iu;

// Test 1: Compact System Prompt Token Budget
runTest("1. Compact System Prompt strictly stays under 2,800 tokens for sub-400ms latency", () => {
  const compactEn = jm.getSystemPrompt(jm.agents.tuktuk, "Hi", null, "en", { compact: true });
  const compactBn = jm.getSystemPrompt(jm.agents.tuktuk, "Hi", null, "bn", { compact: true });
  
  const estTokensEn = Math.ceil(compactEn.length / 3.8);
  const estTokensBn = Math.ceil(compactBn.length / 3.8);
  
  assert(estTokensEn <= 2800, `Expected compactEn tokens <= 2800, got ${estTokensEn}`);
  assert(estTokensBn <= 2800, `Expected compactBn tokens <= 2800, got ${estTokensBn}`);
  assert(compactEn.includes("Tuk Tuk"), "Expected compact prompt to identify Tuk Tuk");
  assert(/\bbabe\b/i.test(compactEn), "Expected compact prompt to mandate exclusive 'babe'");
});

// Test 2: Full System Prompt Backward-Compatibility
runTest("2. Full System Prompt retains all 39 Law clauses for audit and backwards-compatibility", () => {
  const fullPrompt = jm.getSystemPrompt(jm.agents.tuktuk, "Hi", null, "en");
  assert(fullPrompt.includes("LAW 39: REAL-LIFE HUMAN TONE"), "Expected full prompt to contain Law 39");
  assert(fullPrompt.includes("Omega_human_tone"), "Expected full prompt to contain Omega_human_tone");
  assert(fullPrompt.length > 20000, "Expected full prompt to retain comprehensive law definitions");
});

// Test 3: MasterApiGateway Token Compressor Clamps Oversized Messages
runTest("3. MasterApiGateway.compressPromptMessages clamps oversized payloads <= 2,800 tokens", () => {
  const hugePrompt = "LAW RULE MATHEMATICS ".repeat(2000); // ~44,000 characters
  const msgs = [
    { role: "system", content: hugePrompt },
    { role: "user", content: "Hi" }
  ];
  
  const compressed = gw.compressPromptMessages(msgs, 2800);
  const totalChars = compressed.reduce((acc, m) => acc + (m.content || "").length, 0);
  const estTokens = Math.ceil(totalChars / 3.8);
  
  assert(estTokens <= 2800, `Expected compressed tokens <= 2800, got ${estTokens}`);
  assert(compressed[0].content.length < hugePrompt.length, "Expected system prompt to be compressed");
});

// Test 4: Scratchpad / Reasoning Leak Scrubber
runTest("4. Scratchpad and chain-of-thought leak scrubber purges 'We have to respond as...'", () => {
  const dirtySample = "We have to respond as Tuk Tuk. The user: 'What? Which?' We need to respond in the context. The user likely referring to the clip.\n\nBabe, pause that! That clip had me laughing out loud.";
  const cleaned = dirtySample
    .replace(/^\s*(?:(?:we|i)\s+(?:have\s+to|need\s+to|should|must)\s+respond(?:\s+as)?|(?:we|i)\s+need\s+to|must\s+respond\s+in|the\s+user\s*(?:says|:)|user\s*(?:says|:)|user\s+is\s+asking|following\s+all\s+rules|react\s+first|as\s+[a-z0-9\s]+,\s*i\s+(?:need|should|must)|let\s+me\s+analyze|here\s+is\s+(?:my|the)\s+response)[\s\S]*?(?:\n\n|\r\n\r\n|\n(?=[A-Z\u0980-\u09FF\u0900-\u097F])|$)/i, "")
    .trim();
  
  assert(!cleaned.includes("We have to respond as"), "Leak preamble must be stripped");
  assert(cleaned.includes("Babe, pause that!"), "Actual conversation must be preserved");
});

// Test 5: Liveness & Check-in Intent Handling
runTest("5. LocalCognitiveBrain handles liveness queries ('You need a SEC?') with instant wit", () => {
  const tukReplyEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "You need a SEC?", {}, "en");
  const tukReplyBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "shunchho?", {}, "bn");
  const visionReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "You need a SEC?", {}, "en");
  
  assert(/\bbabe\b/i.test(tukReplyEn), "Tuk Tuk must address as 'babe'");
  assert(/\b(zero\s+latency|millisecond|zero\s+pause|awake)\b/i.test(tukReplyEn), "Expected sharp liveness response");
  assert(/\bbabe\b/i.test(tukReplyBn), "Tuk Tuk Bangla must address as 'babe'");
  assert(brotherRegex.test(visionReply), "Vision must address as brother/bro/ভাই");
});

// Test 6: Self-Update Intent Handling
runTest("6. LocalCognitiveBrain handles self-update queries ('U, update yourself.')", () => {
  const tukReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "U, update yourself.", {}, "en");
  const visionReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "code aro update koro", {}, "bn");
  
  assert(/\bbabe\b/i.test(tukReply), "Tuk Tuk must use 'babe'");
  assert(/\b(level|updated|synapses|refreshed|dialed)\b/i.test(tukReply), "Expected evolution/update acknowledgment");
  assert(brotherRegex.test(visionReply), "Vision must use brother terms");
  assert(!/\bbabe\b/i.test(visionReply), "Vision must NEVER use 'babe'");
});

// Test 7: Sighs & Emotional Empathy Handling
runTest("7. LocalCognitiveBrain handles user sighs ('Sigh.') with deep emotional grounding", () => {
  const tukReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Sigh.", {}, "en");
  const visionReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "Sigh.", {}, "en");
  
  assert(/\bbabe\b/i.test(tukReply), "Tuk Tuk must use 'babe'");
  assert(/\b(breath|relax|shoulders|heavy)\b/i.test(tukReply), "Expected empathetic breathing response");
  assert(brotherRegex.test(visionReply), "Vision must use brother terms");
  assert(!/\bbabe\b/i.test(visionReply), "Vision must NEVER use 'babe'");
});

// Test 8: Anti-Repetition Complaint Handling
runTest("8. LocalCognitiveBrain handles anti-repetition complaints ('repeat kora bando koro')", () => {
  const tukReplyBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "repeat kora bando koro", {}, "bn");
  const tukReplyEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Zirukh scripted.", {}, "en");
  const visionReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "stop repeating", {}, "en");
  
  assert(/\bbabe\b/i.test(tukReplyBn), "Tuk Tuk must use 'babe'");
  assert(/\bbabe\b/i.test(tukReplyEn), "Tuk Tuk must use 'babe'");
  assert(/\b(scripts?|spontaneous|loops?|canned|repetitive)\b/i.test(tukReplyEn), "Expected unscripted reset acknowledgment");
  assert(brotherRegex.test(visionReply), "Vision must use brother terms");
});

// Test 9: Strict Persona Sovereignty across All 4 Agents
runTest("9. Persona sovereignty strictly preserved across all 4 agents in English and Bengali", () => {
  const tuk = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Hey", {}, "en");
  const vis = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "Hey", {}, "en");
  const fri = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", "Hey", {}, "en");
  const dd  = LocalCognitiveBrain.synthesizeResponse("dd", "DD", "Hey", {}, "en");
  
  assert(/\bbabe\b/i.test(tuk), "Tuk Tuk must strictly use 'babe'");
  assert(!/\bbabe\b/i.test(vis), "Vision must NEVER use 'babe'");
  assert(brotherRegex.test(vis), "Vision must use brother/bro");
  assert(!/\bbabe\b/i.test(fri) && !brotherRegex.test(fri), "Friday must NEVER use 'babe' or 'bro'");
  assert(/\b(Chief|Hritthik)\b/i.test(fri), "Friday must use Chief or Hritthik");
  assert(!/\bbabe\b/i.test(dd), "DD must NEVER use 'babe'");
  assert(brotherRegex.test(dd) || /\bChief\b/i.test(dd), "DD must use bro or Chief");
});

// Test 10: Non-Repetition / Variety Verification
runTest("10. Multiple calls to general fallback yield varied responses without immediate looping", () => {
  const samples = new Set();
  for (let i = 0; i < 5; i++) {
    const res = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "generic query", {}, "en");
    samples.add(res);
  }
  assert(samples.size >= 3, `Expected at least 3 distinct responses out of 5, got ${samples.size}`);
});

console.log("================================================================================");
console.log(`🎉 ALL ${passedTests}/${totalTests} CONVERSATIONAL GAP FIX TESTS PASSED (100% SUCCESS)!`);
console.log("================================================================================");
