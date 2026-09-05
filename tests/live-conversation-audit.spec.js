const assert = require("assert");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");

console.log("================================================================================");
console.log("🔬 LIVE CONVERSATION FORENSIC AUDIT & EQUATIONAL FIX VERIFICATION SUITE");
console.log("================================================================================");

const jm = new JarvisManager();

// -----------------------------------------------------------------------------
// TEST 1: Directive "Remove the shona sound use babe only" & Dynamic Invariant L_pet
// -----------------------------------------------------------------------------
console.log("\n--- TEST 1: Pet-Name Invariant & Dynamic Preference Enforcement ---");

const prefChange1 = jm.detectPreferenceChange("Remove the shona sound use babe only.");
console.log("detectPreferenceChange result:", prefChange1);
assert.strictEqual(prefChange1?.type, "pet_name", "Should detect pet_name preference change");
assert.strictEqual(prefChange1?.preferredPetName, "babe", "preferredPetName should be 'babe'");
assert(Array.isArray(prefChange1?.bannedPetNames), "bannedPetNames should be an array");
assert(prefChange1.bannedPetNames.includes("shona"), "bannedPetNames must include 'shona'");

// Test LocalCognitiveBrain response to "Remove the shona sound use babe only."
const petReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Remove the shona sound use babe only.");
console.log("Tuk Tuk reply to pet directive:\n", petReply);
assert(petReply.toLowerCase().includes("babe"), "Tuk Tuk must use 'babe'");
assert(!petReply.toLowerCase().includes("shona"), "Tuk Tuk must NOT say 'shona'");

// Test Bengali directive
const petReplyBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Chou na sound ki bondo koro.");
console.log("Tuk Tuk reply to 'Chou na sound ki bondo koro':\n", petReplyBn);
assert(petReplyBn.toLowerCase().includes("babe"), "Tuk Tuk must use 'babe'");
assert(!petReplyBn.toLowerCase().includes("shona"), "Tuk Tuk must NOT say 'shona'");

// Test sanitizeAgentLexicon substitutes 'shona' with 'babe' for Tuk Tuk
const rawShonaTurn = "Shona, excitement ta feel korchi. Ki idea ta?";
const sanitizedShona = jm.sanitizeAgentLexicon(rawShonaTurn, "tuktuk");
console.log("Sanitized shona turn:", sanitizedShona);
assert(!sanitizedShona.toLowerCase().includes("shona"), "Sanitized turn must NOT contain 'shona'");
assert(sanitizedShona.toLowerCase().includes("babe"), "Sanitized turn must substitute with 'babe'");

console.log("✅ [PASS Test 1] Pet-Name Invariant L_pet completely enforced with 0 'shona' regressions!");

// -----------------------------------------------------------------------------
// TEST 2: Persona Sovereignty Invariant S_persona (Tuk Tuk NEVER calls user 'bro')
// -----------------------------------------------------------------------------
console.log("\n--- TEST 2: Persona Sovereignty Invariant S_persona (Anti-Bro Guard) ---");

const broTurn1 = "Gotcha, bro. What's the blocker right now?";
const sanitizedBro1 = jm.sanitizeAgentLexicon(broTurn1, "tuktuk");
console.log("Raw Tuk Tuk turn:", broTurn1);
console.log("Sanitized Tuk Tuk turn:", sanitizedBro1);
assert(!sanitizedBro1.toLowerCase().includes("bro"), "Tuk Tuk must never say 'bro'");
assert(sanitizedBro1.toLowerCase().includes("babe"), "Tuk Tuk must replace 'bro' with 'babe'");

const broTurn2 = "Hyan bhai, ami dekhchi.";
const sanitizedBro2 = jm.sanitizeAgentLexicon(broTurn2, "tuktuk");
console.log("Sanitized Bengali brotherly turn:", sanitizedBro2);
assert(!sanitizedBro2.toLowerCase().includes("bhai"), "Tuk Tuk must never say 'bhai'");

// Vision CAN use 'bro'
const visionTurn = "Gotcha, bro. Systems nominal.";
const sanitizedVision = jm.sanitizeAgentLexicon(visionTurn, "vision");
assert(sanitizedVision.toLowerCase().includes("bro"), "Vision is allowed to use 'bro'");

console.log("✅ [PASS Test 2] Persona Sovereignty Invariant S_persona strictly verified!");

// -----------------------------------------------------------------------------
// TEST 3: Meta-Voice Feedback & Anti-Coaching Inversion Defense (Phi_voice)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 3: Voice Quality Feedback Absorption & Anti-Coaching Defense ---");

// Test user critique: "Bangla Languista, Real Womaner, Motoh, Hocha Na."
const feedbackReply1 = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Bangla Languista, Real Womaner, Motoh, Hocha Na.");
console.log("Tuk Tuk reply to real woman critique:\n", feedbackReply1);
assert(feedbackReply1.toLowerCase().includes("babe"), "Tuk Tuk must address user as 'babe'");
assert(
  feedbackReply1.toLowerCase().includes("soft") ||
  feedbackReply1.toLowerCase().includes("natural") ||
  feedbackReply1.includes("সফট") ||
  feedbackReply1.includes("ন্যাচারাল"),
  "Tuk Tuk must acknowledge and soften tone"
);
assert(!feedbackReply1.toLowerCase().includes("apnar tone"), "Tuk Tuk must NOT criticize user's tone");
assert(!feedbackReply1.toLowerCase().includes("robotic lagche"), "Tuk Tuk must NOT say user sounds robotic");

// Test user critique: "Bangla pronunciation thik koro"
const feedbackReply2 = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Bangla pronunciation thik koro");
console.log("Tuk Tuk reply to pronunciation critique:\n", feedbackReply2);
assert(!feedbackReply2.toLowerCase().includes("inject koro"), "Tuk Tuk must NOT tell user to inject accent");

// Test sanitizeAgentLexicon strips LLM patronizing inverted coaching if leaked
const invertedCoachingTurn = "Apnar tone-ta ekdom robotic. Natural Bangla accent inject koro shona! Ki lagbe bolo?";
const sanitizedCoaching = jm.sanitizeAgentLexicon(invertedCoachingTurn, "tuktuk");
console.log("Sanitized inverted coaching turn:\n", sanitizedCoaching);
assert(!sanitizedCoaching.toLowerCase().includes("robotic"), "Must strip robotic accusation");
assert(!sanitizedCoaching.toLowerCase().includes("inject koro"), "Must strip 'inject koro' instruction");
assert(!sanitizedCoaching.toLowerCase().includes("apnar"), "Must strip formal 'apnar'");

console.log("✅ [PASS Test 3] Anti-Coaching Inversion Defense Phi_voice verified with 0 user lecturing!");

// -----------------------------------------------------------------------------
// TEST 4: Indic Grammatical Register Concordance (R_concord)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 4: Indic Register Concordance R_concord (Tomar vs Apnar) ---");

const formalTurn1 = "Apnar ki lagbe bolun? Apni ekhon free achen?";
const sanitizedFormal1 = jm.sanitizeAgentLexicon(formalTurn1, "tuktuk");
console.log("Sanitized formal turn 1:", sanitizedFormal1);
assert(!sanitizedFormal1.toLowerCase().includes("apnar"), "Must not use 'apnar'");
assert(!sanitizedFormal1.toLowerCase().includes("apni"), "Must not use 'apni'");
assert(
  sanitizedFormal1.toLowerCase().includes("tomar") ||
  sanitizedFormal1.toLowerCase().includes("tumi") ||
  sanitizedFormal1.includes("তোমার") ||
  sanitizedFormal1.includes("তুমি"),
  "Must use familiar 'tomar' / 'tumi'"
);

const formalTurn2 = "আপনার কোডটা চেক করছি, আপনি দেখুন।";
const sanitizedFormal2 = jm.sanitizeAgentLexicon(formalTurn2, "tuktuk");
console.log("Sanitized formal Bengali script:", sanitizedFormal2);
assert(!sanitizedFormal2.includes("আপনার"), "Must not use 'আপনার'");
assert(!sanitizedFormal2.includes("আপনি"), "Must not use 'আপনি'");
assert(sanitizedFormal2.includes("তোমার") || sanitizedFormal2.includes("তুমি"), "Must use 'তোমার' / 'তুমি'");

console.log("✅ [PASS Test 4] Indic Register Concordance R_concord verified!");

// -----------------------------------------------------------------------------
// TEST 5: Bayesian Acoustic Phonetic Normalizer (D_Bayes)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 5: Bayesian Acoustic Phonetic Normalization D_Bayes ---");

const rawWhisper1 = "Bang naprononcio siya, Tikoro.";
const sanitizedWhisper1 = TextSanitizer.sanitize(rawWhisper1);
console.log(`"${rawWhisper1}" -> "${sanitizedWhisper1}"`);
assert(sanitizedWhisper1.toLowerCase().includes("bangla pronunciation thik koro"), "Must normalize to 'Bangla pronunciation thik koro'");

const rawWhisper2 = "Hoche na bangla unicorius koro.";
const sanitizedWhisper2 = TextSanitizer.sanitize(rawWhisper2);
console.log(`"${rawWhisper2}" -> "${sanitizedWhisper2}"`);
assert(sanitizedWhisper2.toLowerCase().includes("unicode use"), "Must normalize unicorius to unicode use");

const rawWhisper3 = "Chou na sound ki bondo koro.";
const sanitizedWhisper3 = TextSanitizer.sanitize(rawWhisper3);
console.log(`"${rawWhisper3}" -> "${sanitizedWhisper3}"`);
assert(sanitizedWhisper3.toLowerCase().includes("shona sound"), "Must normalize chou na sound to shona sound");

const rawWhisper4 = "Bangla tonta tiko koro.";
const sanitizedWhisper4 = TextSanitizer.sanitize(rawWhisper4);
console.log(`"${rawWhisper4}" -> "${sanitizedWhisper4}"`);
assert(sanitizedWhisper4.toLowerCase().includes("tone-ta thik"), "Must normalize tonta tiko to tone-ta thik");

console.log("✅ [PASS Test 5] Bayesian Acoustic Phonetic Normalizer D_Bayes verified!");

// -----------------------------------------------------------------------------
// TEST 6: Whisper Glued Agent Token Un-gluing & Banglish Normalization
// -----------------------------------------------------------------------------
console.log("\n--- TEST 6: Whisper Glued Agent Token Un-gluing & Banglish Normalization ---");

const glued1 = TextSanitizer.sanitize("Visionfix yourself first.");
console.log(`"Visionfix yourself first." -> "${glued1}"`);
assert(glued1.includes("Vision fix"), "Must unglue 'Visionfix' to 'Vision fix'");

const glued2 = TextSanitizer.sanitize("It takes Visionto fix everyone.");
console.log(`"It takes Visionto fix everyone." -> "${glued2}"`);
assert(glued2.includes("Vision to"), "Must unglue 'Visionto' to 'Vision to'");

const glued3 = TextSanitizer.sanitize("Is Visionchecking the pipeline properly? Check.");
console.log(`"Is Visionchecking the pipeline properly? Check." -> "${glued3}"`);
assert(glued3.includes("Vision checking"), "Must unglue 'Visionchecking' to 'Vision checking'");

const glued4 = TextSanitizer.sanitize("Denny has any way,.");
console.log(`"Denny has any way,." -> "${glued4}"`);
assert(glued4.includes("Jenny has any way"), "Must normalize 'Denny' to 'Jenny'");

const glued5 = TextSanitizer.sanitize("Bangla kothe bolo, Jey.");
console.log(`"Bangla kothe bolo, Jey." -> "${glued5}"`);
assert(glued5.includes("kotha bolo"), "Must normalize 'kothe bolo' to 'kotha bolo'");
assert(glued5.includes("Jenny"), "Must normalize 'Jey' to 'Jenny'");

const glued6 = TextSanitizer.sanitize("Ndh, bangla conversation, taro smooth koro, jenny.");
console.log(`"taro smooth koro" -> "${glued6}"`);
assert(glued6.includes("aro smooth"), "Must normalize 'taro smooth' to 'aro smooth'");

console.log("✅ [PASS Test 6] Glued Agent Tokens un-glued & Banglish phonetics normalized!");

// -----------------------------------------------------------------------------
// TEST 7: Forensic Turn Agent Routing Verification
// -----------------------------------------------------------------------------
console.log("\n--- TEST 7: Forensic Turn Agent Routing Verification ---");

const route1 = jm.detectActiveAgent("Visionfix yourself first.");
console.log(`Routing for "Visionfix yourself first.": ${route1.name}`);
assert.strictEqual(route1.key, "vision", "Must route 'Visionfix' to Vision, NOT Tuk Tuk");

const route2 = jm.detectActiveAgent("Is Visionchecking the pipeline properly? Check.");
console.log(`Routing for "Is Visionchecking the pipeline properly? Check.": ${route2.name}`);
assert.strictEqual(route2.key, "vision", "Must route 'Visionchecking' to Vision, NOT Tuk Tuk");

const route3 = jm.detectActiveAgent("Denny has any way,.");
console.log(`Routing for "Denny has any way,.": ${route3.name}`);
assert.strictEqual(route3.key, "jenny", "Must route 'Denny has any way' to Jenny");

const route4 = jm.detectActiveAgent("Bangla kothe bolo, Jey.");
console.log(`Routing for "Bangla kothe bolo, Jey.": ${route4.name}`);
assert.strictEqual(route4.key, "jenny", "Must route 'Bangla kothe bolo, Jey.' to Jenny");

console.log("✅ [PASS Test 7] All 4 misrouted forensic turns now route 100% accurately!");

// -----------------------------------------------------------------------------
// TEST 8: Jenny Web Research Capability vs VAD Hallucination Isolation
// -----------------------------------------------------------------------------
console.log("\n--- TEST 8: Jenny Web Research vs VAD Hallucination Isolation ---");

const jennyWebReplyEn = LocalCognitiveBrain.synthesizeResponse("jenny", "Jenny", "Jenny has any web research access or not?", {}, "en");
console.log("Jenny reply to web research inquiry (EN):\n", jennyWebReplyEn);
assert(!jennyWebReplyEn.toLowerCase().includes("vad"), "Jenny must NOT hallucinate VAD turn-taking quote for web research inquiry!");
assert(!jennyWebReplyEn.toLowerCase().includes("sub-250ms"), "Jenny must NOT quote sub-250ms VAD!");
assert(
  jennyWebReplyEn.toLowerCase().includes("web") ||
  jennyWebReplyEn.toLowerCase().includes("research") ||
  jennyWebReplyEn.toLowerCase().includes("intelligence") ||
  jennyWebReplyEn.toLowerCase().includes("access"),
  "Jenny must confirm web research access"
);

const jennyWebReplyBn = LocalCognitiveBrain.synthesizeResponse("jenny", "Jenny", "Jenny web research access ache kina bolo", {}, "bn");
console.log("Jenny reply to web research inquiry (BN):\n", jennyWebReplyBn);
assert(!jennyWebReplyBn.toLowerCase().includes("vad"), "Jenny BN must NOT hallucinate VAD quote");
assert(jennyWebReplyBn.includes("ওয়েব") || jennyWebReplyBn.includes("রিসার্চ"), "Jenny must confirm web research access in Bengali");

// Ensure VAD quote STILL fires when VAD or latency paper IS specifically asked
const jennyVadReply = LocalCognitiveBrain.synthesizeResponse("jenny", "Jenny", "What does the research paper say about VAD turn taking latency?", {}, "en");
console.log("Jenny reply to explicit VAD inquiry:\n", jennyVadReply);
assert(jennyVadReply.toLowerCase().includes("vad"), "Jenny must answer VAD when VAD is specifically queried");

console.log("✅ [PASS Test 8] Jenny Web Research confirmed & VAD hallucination decoupled!");

// -----------------------------------------------------------------------------
// TEST 9: Tuk Tuk Consecutive Anti-Duplication Ring Buffer
// -----------------------------------------------------------------------------
console.log("\n--- TEST 9: Tuk Tuk Consecutive Anti-Duplication Ring Buffer ---");

const promptA = "Can't wait to see the fidgetter, not to see the fidgetter.";
const promptB = "Is it a video from Sambique Clones? Please look for the video today.";

const reply1 = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", promptA, {}, "en");
const reply2 = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", promptB, {}, "en");
console.log("Turn 1 Screen Reply:\n", reply1);
console.log("Turn 2 Screen Reply:\n", reply2);

assert.notStrictEqual(reply1, reply2, "Consecutive screen replies must NOT be identical!");

// Also verify build/code queries don't repeat static strings
const replyBuild1 = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Let's build and code this component", {}, "en");
const replyBuild2 = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Run the tests and deploy", {}, "en");
console.log("Turn 1 Build Reply:\n", replyBuild1);
console.log("Turn 2 Build Reply:\n", replyBuild2);
assert.notStrictEqual(replyBuild1, replyBuild2, "Consecutive build replies must NOT be identical!");

console.log("✅ [PASS Test 9] Tuk Tuk consecutive repetitions eliminated via multi-variant pools!");

// -----------------------------------------------------------------------------
// TEST 10: Anti-Flicker Language Hysteresis (ELCT Hysteresis Barrier)
// -----------------------------------------------------------------------------
console.log("\n--- TEST 10: Anti-Flicker Language Hysteresis ---");

// Set to Bengali mode
jm.currentLanguageMode = "bn";
jm.config.conversationLanguage = "bn";

// 1. Short acoustic noise fragment in English (Whisper hallucination)
const noise1 = "In the world.";
const langAfterNoise1 = jm.evaluateLanguageTransition(noise1);
console.log(`"${noise1}" in BN mode -> Evaluated Lang: ${langAfterNoise1}`);
assert.strictEqual(langAfterNoise1, "bn", "Short English noise must NOT flip Bengali mode to English!");

const noise2 = "In the background, the.";
const langAfterNoise2 = jm.evaluateLanguageTransition(noise2);
console.log(`"${noise2}" in BN mode -> Evaluated Lang: ${langAfterNoise2}`);
assert.strictEqual(langAfterNoise2, "bn", "Short English noise must NOT flip Bengali mode to English!");

// 2. Explicit switch command DOES switch
const explicitEn = "Switch to English please.";
const langAfterExplicit = jm.evaluateLanguageTransition(explicitEn);
console.log(`"${explicitEn}" -> Evaluated Lang: ${langAfterExplicit}`);
assert.strictEqual(langAfterExplicit, "en", "Explicit command must transition to English");

// 3. Spoken Bengali directive switches back
const explicitBn = "Bangla kothe bolo, Jey.";
const langAfterExplicitBn = jm.evaluateLanguageTransition(explicitBn);
console.log(`"${explicitBn}" -> Evaluated Lang: ${langAfterExplicitBn}`);
assert.strictEqual(langAfterExplicitBn, "bn", "Spoken 'Bangla kothe bolo, Jey' must switch to Bengali");

console.log("✅ [PASS Test 10] Anti-Flicker Language Hysteresis strictly verified with 0 flickering!");

console.log("\n================================================================================");
console.log("🎉 ALL 10 LIVE CONVERSATION FORENSIC AUDIT TESTS PASSED (100% SUCCESS)!");
console.log("================================================================================\n");

process.exit(0);
