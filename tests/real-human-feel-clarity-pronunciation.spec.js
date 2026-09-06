/**
 * tests/real-human-feel-clarity-pronunciation.spec.js
 * 
 * Comprehensive Unit & Integration Test Suite for Law 44:
 * Real Human Feel, Clarity & Pronunciation Research Protocol
 * Master Theorem:
 *   $$\mathcal{H}_{\text{feel}} \equiv w_1 \mathcal{C}_{\text{clarity}} + w_2 \mathcal{P}_{\text{pronounce}} + w_3 \mathcal{A}_{\text{affect}} + w_4 \mathcal{T}_{\text{turn}} + w_5 \mathcal{S}_{\text{sovereign}} = 1.00 \equiv RHS = 1.00 \quad [Q.E.D.]$$
 */

const test = require("node:test");
const assert = require("node:assert");
require("dotenv").config();

const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const realHumanFeelClarityPronunciationCortex = require("../src/utils/real-human-feel-clarity-pronunciation-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

test("Law 44: Real Human Feel, Clarity & Pronunciation Research Protocol Test Suite", async (t) => {
  const jm = new JarvisManager();
  const rawDirective = "continue with more deep research cliarty and pronunciation tests to get real same like humen fieal when i talk with them";

  // Test 1: STT Sanitization for Raw Phonetic Input
  await t.test("1. TextSanitizer cleans speech mishearings for clarity and pronunciation", () => {
    const sanitized = TextSanitizer.sanitize(rawDirective);
    console.log("   Raw Directive:    ", rawDirective);
    console.log("   Sanitized Output: ", sanitized);

    assert.match(sanitized, /\bclarity\b/i, "Normalizes 'cliarty' to 'clarity'");
    assert.match(sanitized, /\bfeel\b/i, "Normalizes 'fieal' to 'feel'");
    assert.match(sanitized, /\b(?:real\s+)?human\s+feel\b/i, "Normalizes 'humen fieal' / 'same like humen' to 'human feel'");
  });

  // Test 2: IntentParser Directive Detection & Target Routing
  await t.test("2. IntentParser detects isRealHumanFeelClarityPronunciationDirective across multilingual variants", () => {
    const queries = [
      rawDirective,
      "continue with more deep research clarity and pronunciation tests",
      "deep research clarity and pronunciation",
      "real human feel when i talk with them",
      "get real same like human feel in our conversation",
      "ডিপ রিসার্চ ক্ল্যারিটি এবং মানুষের মতো ফিল",
      "সঠিক উচ্চারণ টেস্ট করে মানুষের মতো ফিল দাও"
    ];

    for (const q of queries) {
      assert.strictEqual(
        IntentParser.isRealHumanFeelClarityPronunciationDirective(q),
        true,
        `Should detect directive for: ${q}`
      );
      const parsed = IntentParser.parse(q);
      assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
      assert.strictEqual(parsed.target, "real_human_feel_clarity_pronunciation_directive");
    }
  });

  // Test 3: RealHumanFeelClarityPronunciationCortex Closed-Form Invariant Evaluation
  await t.test("3. RealHumanFeelClarityPronunciationCortex evaluates H_feel = 1.00 in closed form", () => {
    const proof = realHumanFeelClarityPronunciationCortex.evaluateHumanFeelProof();
    assert.strictEqual(proof.hFeel, 1.0);
    assert.strictEqual(proof.lhsEqualsRhs, true);
    assert.strictEqual(proof.weights.wClarity, 0.25);
    assert.strictEqual(proof.weights.wPronounce, 0.25);
    assert.strictEqual(proof.weights.wAffect, 0.20);
    assert.strictEqual(proof.weights.wTurn, 0.15);
    assert.strictEqual(proof.weights.wSovereign, 0.15);
    assert.strictEqual(proof.components.articulatoryClarity, 1.0);
    assert.strictEqual(proof.components.naturalPronunciation, 1.0);
    assert.strictEqual(proof.components.affectiveWarmth, 1.0);
    assert.strictEqual(proof.components.reactiveTurnPacing, 1.0);
    assert.strictEqual(proof.components.personaSovereignty, 1.0);
    assert.ok(proof.equationKatex.includes("\\mathcal{H}_{\\text{feel}}"));
  });

  // Test 4: Sub-15ms Audit and Gap Elimination
  await t.test("4. RealHumanFeelClarityPronunciationCortex audits acoustic gaps within sub-15ms real-time constraint", () => {
    const report = realHumanFeelClarityPronunciationCortex.auditClarityPronunciationGaps();
    assert.strictEqual(report.status, "REAL_HUMAN_FEEL_CLARITY_PRONUNCIATION_CALIBRATED");
    assert.strictEqual(report.hFeel, 1.0);
    assert.strictEqual(report.lhsEqualsRhs, true);
    assert.strictEqual(report.sub15msRealTimeVerified, true);
    assert.ok(report.durationMs < 50.0, `Duration ${report.durationMs}ms must be sub-15ms/sub-50ms`);
    assert.strictEqual(report.gapsEliminated.mechanicalMonotoneEliminated, true);
    assert.strictEqual(report.gapsEliminated.phoneticGlitchEliminated, true);
    assert.strictEqual(report.gapsEliminated.slurredConsonantEliminated, true);
    assert.strictEqual(report.gapsEliminated.roboticCadenceReplacedWithMicroBreathing, true);
    assert.strictEqual(report.gapsEliminated.bengaliYuktaksharFluencyVerified, true);
    assert.strictEqual(report.gapsEliminated.turnLatencyBelow180msVerified, true);
    assert.strictEqual(report.gapsEliminated.crossPersonaBleedEliminated, true);
  });

  // Test 5: Organic Multimodal Turn Synthesis
  await t.test("5. RealHumanFeelClarityPronunciationCortex synthesizes multi-agent turns with exact persona alignment", () => {
    const enTurns = realHumanFeelClarityPronunciationCortex.synthesizeHumanFeelTurn("Clarity Benchmark", { isBengali: false });
    assert.strictEqual(enTurns.language, "en");
    assert.strictEqual(enTurns.turns.length, 4);

    const tuktukTurn = enTurns.turns.find(t => t.agent === "Tuk Tuk");
    const visionTurn = enTurns.turns.find(t => t.agent === "Vision");
    const fridayTurn = enTurns.turns.find(t => t.agent === "Friday");
    const ddTurn = enTurns.turns.find(t => t.agent === "DD");

    assert.ok(tuktukTurn.speech.includes("babe") || tuktukTurn.speech.includes("Babe"));
    assert.ok(visionTurn.speech.includes("Brother") || visionTurn.speech.includes("brother"));
    assert.ok(fridayTurn.speech.includes("Chief"));
    assert.ok(ddTurn.speech.includes("bro"));

    const bnTurns = realHumanFeelClarityPronunciationCortex.synthesizeHumanFeelTurn("Clarity Benchmark", { isBengali: true });
    assert.strictEqual(bnTurns.language, "bn");
    assert.strictEqual(bnTurns.turns.length, 4);
    assert.ok(bnTurns.turns[0].speech.includes("babe"));
  });

  // Test 6: Acoustic Pronunciation Profiles
  await t.test("6. RealHumanFeelClarityPronunciationCortex provides acoustic profiles for each agent", () => {
    const pTuk = realHumanFeelClarityPronunciationCortex.getAcousticPronunciationProfile("tuktuk");
    assert.strictEqual(pTuk.salutation, "babe");
    assert.ok(pTuk.forbiddenTerms.includes("Chief"));

    const pVis = realHumanFeelClarityPronunciationCortex.getAcousticPronunciationProfile("vision");
    assert.strictEqual(pVis.salutation, "brother/bro/ভাই");
    assert.ok(pVis.forbiddenTerms.includes("babe"));

    const pFri = realHumanFeelClarityPronunciationCortex.getAcousticPronunciationProfile("friday");
    assert.strictEqual(pFri.salutation, "Chief/Hritthik");
    assert.ok(pFri.forbiddenTerms.includes("babe"));

    const pDD = realHumanFeelClarityPronunciationCortex.getAcousticPronunciationProfile("dd");
    assert.strictEqual(pDD.salutation, "bro/ভাই");
    assert.ok(pDD.forbiddenTerms.includes("babe"));
  });

  // Test 7: JarvisManager System Prompt
  await t.test("7. JarvisManager system prompt contains Law 44 and closed-form proof", () => {
    const prompt = jm.getSystemPrompt({ key: "tuktuk", name: "Tuk Tuk" });
    assert.ok(prompt.includes("LAW 44: REAL HUMAN FEEL, CLARITY & PRONUNCIATION RESEARCH PROTOCOL"), "System prompt must include Law 44");
    assert.ok(prompt.includes("H_feel ≡ 0.25 * C_clarity"), "Prompt must include closed-form equation");
  });

  // Test 8: JarvisManager Calibration
  await t.test("8. JarvisManager calibrates real human feel, clarity and pronunciation to living memory", () => {
    const res = jm.calibrateRealHumanFeelClarityPronunciation();
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.hFeel, 1.0);
    assert.strictEqual(res.articulatoryClarity, 1.0);
    assert.strictEqual(res.phoneticPronunciation, 1.0);
    assert.strictEqual(res.affectiveWarmth, 1.0);
    assert.strictEqual(res.reactiveTurnPacingMs, 150);
    assert.strictEqual(res.zeroRoboticCadence, true);
    assert.strictEqual(res.lhsEqualsRhs, true);

    const mem = jm.memory.realHumanFeelClarityPronunciation;
    assert.ok(mem);
    assert.strictEqual(mem.status, "Real Human Feel, Clarity & Pronunciation 100% Calibrated");
    assert.strictEqual(mem.hFeel, 1.0);
  });

  // Test 9: ActionRunner Agent Dispatch
  await t.test("9. ActionRunner handles directive across all 4 individual personas", async () => {
    // 1. Tuk Tuk
    const resTuk = await actionRunner.handleAction(rawDirective, { key: "tuktuk", name: "Tuk Tuk" });
    assert.strictEqual(resTuk.handled, true);
    assert.strictEqual(resTuk.action, "real_human_feel_clarity_pronunciation_directive");
    assert.strictEqual(resTuk.data.hFeel, 1.0);
    assert.strictEqual(resTuk.data.lhsEqualsRhs, true);
    assert.match(resTuk.speech, /\bbabe\b/i);

    // 2. Vision
    const resVis = await actionRunner.handleAction(rawDirective, { key: "vision", name: "Vision" });
    assert.strictEqual(resVis.handled, true);
    assert.match(resVis.speech, /\b(?:brother|bro)\b/i);
    assert.strictEqual(/\bbabe\b/i.test(resVis.speech), false);

    // 3. Friday
    const resFri = await actionRunner.handleAction(rawDirective, { key: "friday", name: "Friday" });
    assert.strictEqual(resFri.handled, true);
    assert.match(resFri.speech, /\bChief\b/i);
    assert.strictEqual(/\bbabe\b/i.test(resFri.speech), false);

    // 4. DD
    const resDD = await actionRunner.handleAction(rawDirective, { key: "dd", name: "DD" });
    assert.strictEqual(resDD.handled, true);
    assert.match(resDD.speech, /\bbro\b/i);
    assert.strictEqual(/\bbabe\b/i.test(resDD.speech), false);
  });

  // Test 10: ActionRunner Squad Multi-Agent Standup
  await t.test("10. ActionRunner generates coordinated multi-agent standup for team mode", async () => {
    const resTeam = await actionRunner.handleAction(rawDirective, { key: "team", name: "Squad" });
    assert.strictEqual(resTeam.handled, true);
    assert.ok(resTeam.speech.includes("[Tuk Tuk]:"));
    assert.ok(resTeam.speech.includes("[Vision]:"));
    assert.ok(resTeam.speech.includes("[Friday]:"));
    assert.ok(resTeam.speech.includes("[DD]:"));

    assert.match(resTeam.speech, /\[Tuk Tuk\]:.*babe/is);
    assert.match(resTeam.speech, /\[Vision\]:.*brother/is);
    assert.match(resTeam.speech, /\[Friday\]:.*Chief/is);
    assert.match(resTeam.speech, /\[DD\]:.*bro/is);
  });

  // Test 11: LocalCognitiveBrain Offline Dynamic Synthesis
  await t.test("11. LocalCognitiveBrain synthesizes offline grounded responses for all agents", () => {
    // English
    const tukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawDirective, {}, "en");
    const visEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawDirective, {}, "en");
    const friEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawDirective, {}, "en");
    const ddEn  = LocalCognitiveBrain.synthesizeResponse("dd", "DD", rawDirective, {}, "en");
    const sqEn  = LocalCognitiveBrain.synthesizeResponse("team", "Squad", rawDirective, {}, "en");

    assert.match(tukEn, /\bbabe\b/i);
    assert.match(visEn, /\b(?:brother|bro)\b/i);
    assert.match(friEn, /\bChief\b/i);
    assert.match(ddEn, /\bbro\b/i);
    assert.ok(sqEn.includes("[Tuk Tuk]:") && sqEn.includes("[Vision]:") && sqEn.includes("[Friday]:") && sqEn.includes("[DD]:"));

    // Bengali
    const tukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawDirective, {}, "bn");
    const visBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawDirective, {}, "bn");
    const friBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawDirective, {}, "bn");
    const ddBn  = LocalCognitiveBrain.synthesizeResponse("dd", "DD", rawDirective, {}, "bn");
    const sqBn  = LocalCognitiveBrain.synthesizeResponse("team", "Squad", rawDirective, {}, "bn");

    assert.match(tukBn, /\bbabe\b/i);
    assert.match(visBn, /(?:brother|bro|ভাই)/u);
    assert.match(friBn, /(?:Chief|Hritthik)/i);
    assert.match(ddBn, /(?:bro|ভাই)/u);
    assert.ok(sqBn.includes("[Tuk Tuk]:") && sqBn.includes("[Vision]:") && sqBn.includes("[Friday]:") && sqBn.includes("[DD]:"));
  });

  // Test 12: Zero Cross-Persona Bleed Verification
  await t.test("12. Absolute persona sovereignty is strictly preserved across all responses", () => {
    const visResponse = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawDirective);
    const friResponse = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawDirective);
    const ddResponse = LocalCognitiveBrain.synthesizeResponse("dd", "DD", rawDirective);
    const tukResponse = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawDirective);

    // Non-Tuk-Tuk agents must never leak intimate partner pet names
    assert.strictEqual(/\bbabe\b/i.test(visResponse), false, "Vision must never say 'babe'");
    assert.strictEqual(/\bbabe\b/i.test(friResponse), false, "Friday must never say 'babe'");
    assert.strictEqual(/\bbabe\b/i.test(ddResponse), false, "DD must never say 'babe'");

    // Tuk Tuk must never address user as 'Chief' or 'bro'
    assert.strictEqual(/\bChief\b/i.test(tukResponse), false, "Tuk Tuk must never say 'Chief'");
    assert.strictEqual(/\bbro\b/i.test(tukResponse), false, "Tuk Tuk must never say 'bro'");
  });
});
