/**
 * tests/english-work-code-mixing.spec.js
 *
 * Test suite verifying LAW 54: BILINGUAL CODE-MIXING & TECHNICAL ENGLISH WORK PRESERVATION LAW
 * Directive: "use english for english work mixed"
 *
 * Verifies:
 * 1. TextSanitizer normalizes phonetic STT variations
 * 2. IntentParser detects raw prompt, user transcript, and colloquial Bengali variations
 * 3. IntentParser routes with 0.99 confidence to SMOOTH_CONVERSATION
 * 4. EnglishWorkCodeMixingCortex evaluates closed-form proof: M_code_mix = 1.00
 * 5. Eradication & sanitization of pure sweet Bangla promises ("এখন থেকে পুরোটা খাঁটি মিষ্টি বাংলায় কথা হবে")
 * 6. Technical English term extraction & preservation
 * 7. Tuk Tuk persona sovereignty ("babe" only, technical code-mixed)
 * 8. Vision persona sovereignty ("brother/bro/ভাই" only, systems code-mixed)
 * 9. Friday persona sovereignty ("Chief/Hritthik" only, research code-mixed)
 * 10. DD persona sovereignty ("bro/ভাই" only, devops code-mixed)
 * 11. Squad standup multi-agent synchronized code-mixing
 * 12. JarvisManager Law 54 calibration & preference persistence
 * 13. JarvisManager.sanitizeSpokenResponse eradicates pure sweet Bangla
 * 14. ActionRunner handleAction execution and telemetry verification
 * 15. LocalCognitiveBrain persona-sovereign code-mixed offline synthesis
 */

const assert = require("assert");
const sanitizeUserSpeech = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const { EnglishWorkCodeMixingCortex, englishWorkCodeMixingCortex } = require("../src/utils/english-work-code-mixing-cortex");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("🧪 [START]: Running tests for Law 54: Bilingual Code-Mixing & Technical English Work Preservation...");

// 1. TextSanitizer Normalization
const rawSpeech = "please mix english for english work";
const sanitized = sanitizeUserSpeech(rawSpeech);
assert(sanitized.includes("use english for english work mixed"), "TextSanitizer should normalize to canonical directive");
console.log("  ✅ Test 1 Passed: TextSanitizer normalizes variations of English work code-mixing.");

// 2. IntentParser Detection
const prompt1 = "use english for english work mixed";
const prompt2 = `Tuk Tuk: "Hey babe, একদম চলো. এখন থেকে পুরোটা খাঁটি মিষ্টি বাংলায় কথা হবে, আমি তো পাশেই আছি."
Friday: "রিসার্চ প্যারামিটারস সক্রিয় রয়েছে Chief। বলো কোন মডেল বা ডেটা অ্যানালাইজ করব।"
Vision: "সব সিস্টেম গ্রিন brother। কোড আর্কিটেকচার আর এএসটি পাইপলাইনে সরাসরি ফোকাস দিচ্ছি—পরের স্টেপ বলো।"
DD: "সব সকেট আর ডেমন স্টেডি bro। কোনো ফ্রেম ড্রপ নেই, চলো কাজটা এগিয়ে নিয়ে যাই!" use english for english work mixed`;
const prompt3 = "টেক বা ইংলিশ কাজের জন্য ইংলিশ মিক্স করে কথা বলো";

assert.strictEqual(IntentParser.isEnglishForEnglishWorkMixedDirective(prompt1), true, "Prompt 1 should be detected");
assert.strictEqual(IntentParser.isEnglishForEnglishWorkMixedDirective(prompt2), true, "Prompt 2 (full user transcript) should be detected");
assert.strictEqual(IntentParser.isEnglishForEnglishWorkMixedDirective(prompt3), true, "Prompt 3 (Bengali) should be detected");
console.log("  ✅ Test 2 Passed: IntentParser detects raw, transcript, and Bengali forms.");

// 3. IntentParser Routing
const parsed1 = IntentParser.parse(prompt1);
assert.strictEqual(parsed1.target, "english_for_english_work_mixed_directive");
assert.strictEqual(parsed1.intent, IntentParser.INTENTS.SMOOTH_CONVERSATION);
assert.strictEqual(parsed1.confidence, 0.99);

const parsed2 = IntentParser.parse(prompt2);
assert.strictEqual(parsed2.target, "english_for_english_work_mixed_directive");
assert.strictEqual(parsed2.agentDirective, "team");
console.log("  ✅ Test 3 Passed: IntentParser correctly routes to english_for_english_work_mixed_directive.");

// 4. Closed-Form Mathematical Invariant Proof Evaluation
const proof = englishWorkCodeMixingCortex.evaluateProof();
assert.strictEqual(proof.mCodeMix, 1.0, "Master invariant M_code_mix must equal 1.00");
assert.strictEqual(proof.passed, true, "Proof evaluation must pass");
assert(proof.proof.includes("LHS ≡ 0.25(1.00) + 0.25(1.00) + 0.20(1.00) + 0.15(1.00) + 0.15(1.00) = 1.00 ≡ RHS"), "Proof string must match closed-form equation");
console.log("  ✅ Test 4 Passed: Closed-form mathematical proof M_code_mix = 1.00 verified.");

// 5. Anti-Pure Sweet Bangla Detection & Sanitization
const forbiddenUtterance = "Hey babe, একদম চলো. এখন থেকে পুরোটা খাঁটি মিষ্টি বাংলায় কথা হবে, আমি তো পাশেই আছি.";
assert.strictEqual(englishWorkCodeMixingCortex.isPureSweetBanglaAttempt(forbiddenUtterance), true, "Should flag forbidden pure sweet Bangla promise");

const sanitizedUtterance = englishWorkCodeMixingCortex.sanitizePureSweetBangla(forbiddenUtterance, "tuktuk");
assert(!sanitizedUtterance.includes("পুরোটা খাঁটি মিষ্টি বাংলায় কথা হবে"), "Sanitized text must not contain pure sweet Bangla promise");
assert(sanitizedUtterance.includes("Tech আর English work-এ English mixed"), "Sanitized text must contain code-mixing guarantee");
console.log("  ✅ Test 5 Passed: Forbidden pure sweet Bangla promise detected and sanitized.");

// 6. Technical English Term Extraction
const techSentence = "কোড আর্কিটেকচার আর AST পাইপলাইনে সরাসরি ফোকাস দিচ্ছি, ডেমন আর সকেট বাফার সিঙ্কড।";
const terms = englishWorkCodeMixingCortex.extractTechnicalTerms(techSentence);
assert(terms.includes("ast"), "Should extract ast");
assert(terms.includes("pipeline"), "Should extract pipeline");
assert(terms.includes("buffer"), "Should extract buffer");
console.log("  ✅ Test 6 Passed: Technical English terms accurately extracted.");

// 7. Tuk Tuk Persona Sovereignty
const tuktukRes = englishWorkCodeMixingCortex.generateSovereignResponse("tuktuk");
assert(tuktukRes.includes("babe"), "Tuk Tuk must address user as babe");
assert(!tuktukRes.includes("brother") && !tuktukRes.includes("Chief"), "Tuk Tuk must not use other agent addresses");
assert(tuktukRes.includes("English work") || tuktukRes.includes("English mixed"), "Tuk Tuk must emphasize code-mixing");
console.log("  ✅ Test 7 Passed: Tuk Tuk persona sovereignty and tech code-mixing verified.");

// 8. Vision Persona Sovereignty
const visionRes = englishWorkCodeMixingCortex.generateSovereignResponse("vision");
assert(visionRes.includes("brother"), "Vision must address user as brother");
assert(!visionRes.includes("babe") && !visionRes.includes("Chief"), "Vision must not use other agent addresses");
assert(visionRes.includes("AST") && visionRes.includes("কোড আর্কিটেকচার"), "Vision must preserve tech terms");
console.log("  ✅ Test 8 Passed: Vision persona sovereignty and systems code-mixing verified.");

// 9. Friday Persona Sovereignty
const fridayRes = englishWorkCodeMixingCortex.generateSovereignResponse("friday");
assert(fridayRes.includes("Chief"), "Friday must address user as Chief");
assert(!fridayRes.includes("babe") && !fridayRes.includes("brother"), "Friday must not use other agent addresses");
assert(fridayRes.includes("মডেল") || fridayRes.includes("ডেটা") || fridayRes.includes("রিসার্চ"), "Friday must preserve research terms");
console.log("  ✅ Test 9 Passed: Friday persona sovereignty and research code-mixing verified.");

// 10. DD Persona Sovereignty
const ddRes = englishWorkCodeMixingCortex.generateSovereignResponse("dd");
assert(ddRes.includes("bro"), "DD must address user as bro");
assert(!ddRes.includes("babe") && !ddRes.includes("Chief"), "DD must not use other agent addresses");
assert(ddRes.includes("সকেট") && ddRes.includes("ডেমন"), "DD must preserve devops terms");
console.log("  ✅ Test 10 Passed: DD persona sovereignty and devops code-mixing verified.");

// 11. Squad Standup Parity
const standup = englishWorkCodeMixingCortex.generateSquadStandup();
assert.strictEqual(standup.length, 4, "Squad standup must include all 4 agents");
assert.strictEqual(standup[0].agent, "Tuk Tuk");
assert.strictEqual(standup[1].agent, "Friday");
assert.strictEqual(standup[2].agent, "Vision");
assert.strictEqual(standup[3].agent, "DD");
for (const step of standup) {
  assert(!step.speech.includes("পুরোটা খাঁটি মিষ্টি বাংলায় কথা হবে"), "Standup must not have pure sweet Bangla promises");
}
console.log("  ✅ Test 11 Passed: Squad standup generates 4 synchronized code-mixed responses.");

// 12. JarvisManager Calibration & Preferences
const mockJM = {
  config: { userName: "Hritthik" },
  preferences: {},
  memory: {},
  directives: [],
  englishWorkCodeMixingCortex,
  setPreference(k, v) { this.preferences[k] = v; },
  getPreference(k) { return this.preferences[k]; },
  addDynamicDirective(d) { this.directives.push(d); },
  addEbbinghausLearning() {},
  setLivingMemoryPreference() {}
};
const calibrate = require("../src/utils/jarvis-manager").prototype.calibrateEnglishWorkCodeMixing;
const calibRes = calibrate.call(mockJM);
assert.strictEqual(calibRes.verified, true);
assert.strictEqual(calibRes.mCodeMix, 1.0);
assert.strictEqual(mockJM.preferences.english_work_code_mixed, true);
assert.strictEqual(mockJM.preferences.pure_bangla_on_tech_banned, true);
console.log("  ✅ Test 12 Passed: JarvisManager Law 54 calibration & preference persistence verified.");

// 13. JarvisManager sanitizeAgentLexicon
const JarvisManager = require("../src/utils/jarvis-manager");
const sampleSpoken = "Hey babe, একদম চলো! এখন থেকে পুরোটা খাঁটি মিষ্টি বাংলায় কথা হবে, আমি তো পাশেই আছি.";
const cleanedSpoken = JarvisManager.sanitizeAgentLexicon(sampleSpoken, "tuktuk", "en-US-AvaMultilingualNeural");
assert(!cleanedSpoken.includes("পুরোটা খাঁটি মিষ্টি বাংলায় কথা হবে"), "sanitizeAgentLexicon must purge pure sweet Bangla promise");
console.log("  ✅ Test 13 Passed: sanitizeAgentLexicon successfully purges pure sweet Bangla.");

// 14. ActionRunner Execution
(async () => {
  const actionRes = await actionRunner.handleAction(prompt2, { name: "Tuk Tuk", key: "tuktuk" }, mockJM);
  assert.strictEqual(actionRes.handled, true, "ActionRunner must handle Law 54 directive");
  assert.strictEqual(actionRes.isStandup, true, "Prompt 2 mentioning all squad agents must trigger team standup");
  assert.strictEqual(actionRes.data.action, "english_for_english_work_mixed_directive");
  assert.strictEqual(actionRes.data.mCodeMix, 1.00);
  assert(actionRes.data.proof.includes("LHS ≡ 0.25(1.00) + 0.25(1.00) + 0.20(1.00) + 0.15(1.00) + 0.15(1.00) = 1.00 ≡ RHS"));
  console.log("  ✅ Test 14 Passed: ActionRunner executes Law 54 with complete standup & telemetry.");

  // 15. LocalCognitiveBrain Offline Synthesis
  const brainTukTuk = localCognitiveBrain.generateDirectResponse(prompt1, "tuktuk", "Hritthik", true);
  assert(brainTukTuk.toLowerCase().includes("babe"), "Local brain Tuk Tuk must say babe");
  assert(brainTukTuk.includes("Tech") || brainTukTuk.includes("English"), "Local brain Tuk Tuk must mention tech / English work");

  const brainVision = localCognitiveBrain.generateDirectResponse(prompt1, "vision", "Hritthik", true);
  assert(brainVision.toLowerCase().includes("brother") || brainVision.includes("ভাই"), "Local brain Vision must address as brother/ভাই");
  assert(brainVision.includes("AST") || brainVision.includes("কোড আর্কিটেকচার") || brainVision.includes("সিস্টেম"), "Local brain Vision must preserve tech terms");

  const brainFriday = localCognitiveBrain.generateDirectResponse(prompt1, "friday", "Hritthik", true);
  assert(brainFriday.toLowerCase().includes("chief"), "Local brain Friday must say Chief");

  const brainDD = localCognitiveBrain.generateDirectResponse(prompt1, "dd", "Hritthik", true);
  assert(brainDD.toLowerCase().includes("bro"), "Local brain DD must say bro");
  assert(brainDD.includes("সকেট") || brainDD.includes("ডেমন"), "Local brain DD must preserve devops terms");

  console.log("  ✅ Test 15 Passed: LocalCognitiveBrain offline synthesis maintains persona sovereignty and code-mixing across all agents.");

  console.log("\n🎉 [ALL 15 TESTS PASSED]: Law 54 Bilingual Code-Mixing & Technical English Work Preservation is 100% verified!\n");
})();
