/**
 * tests/futuristic-2070-human-embodiment-intelligence.spec.js
 * 
 * Comprehensive Test Suite for 2070 Futuristic Human Embodiment & Multi-Agent Intelligence:
 * - Whisper STT Phonetic Normalization
 * - 2070 Embodiment Spectrum: Work, Think, Write, Blink & Eye, Persona Intellect
 * - Multi-Agent Verification: Tuk Tuk, Vision, Friday, DD
 * - ActionRunner Directive Interception
 * - LocalCognitiveBrain Persona Sovereignty
 * - Closed-Form Equational Proof (LHS ≡ RHS ≡ 100%)
 */

const test = require("node:test");
const assert = require("node:assert");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const futuristic2070HumanCortex = require("../src/utils/futuristic-2070-human-cortex");
const humanEyeCortex = require("../src/utils/human-eye-cortex");
const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

test("2070 Futuristic Human Embodiment & Multi-Agent Intelligence Suite", async (t) => {

  await t.test("1. Whisper STT Phonetic Normalization of 2070 Prompt", () => {
    const rawUserPrompt = "chack our input and output are fully humen like faster and profetional real humen conversation 0 bot feeling and all do deep test every agent need intiligent and intalactual like fully humen do deep research anf fix all the gap need thay work think write blink eye and all like a humen do need fully futersitic think like 2070 humens make and fix all gap equationaly";
    const sanitized = textSanitizer.sanitize(rawUserPrompt);

    console.log("   Sanitized Output: ", sanitized);

    assert.ok(sanitized.includes("Check our input and output are fully human"), "Sanitizer must normalize 'chack' -> 'Check'");
    assert.ok(sanitized.includes("professional"), "Sanitizer must normalize 'profetional' -> 'professional'");
    assert.ok(sanitized.includes("intelligent"), "Sanitizer must normalize 'intiligent' -> 'intelligent'");
    assert.ok(sanitized.includes("intellectual"), "Sanitizer must normalize 'intalactual' -> 'intellectual'");
    assert.ok(sanitized.includes("and"), "Sanitizer must normalize 'anf' -> 'and'");
    assert.ok(sanitized.includes("they"), "Sanitizer must normalize 'thay' -> 'they'");
    assert.ok(sanitized.includes("futuristic"), "Sanitizer must normalize 'futersitic' -> 'futuristic'");
    assert.ok(sanitized.includes("equationally"), "Sanitizer must normalize 'equationaly' -> 'equationally'");
  });

  await t.test("2. IntentParser Detection of 2070 Futuristic Human Directive", () => {
    const text = "Check our input and output are fully human-like, faster and professional real human conversation: 0 bot feeling and all, do deep test every agent need intelligent and intellectual like fully human, do deep research and fix all the gaps, need they work, think, write, blink eye and all like a human do, need fully futuristic think like 2070 humans, make and fix all gaps equationally";
    const isDetected = IntentParser.isFuturistic2070HumanEmbodimentDirective(text);

    assert.strictEqual(isDetected, true, "IntentParser must recognize 2070 Futuristic Human Embodiment Directive");
  });

  await t.test("3. 2070 Embodiment Spectrum Evaluation across All 4 Agents", () => {
    const agents = ["tuktuk", "vision", "friday", "dd"];

    for (const agentKey of agents) {
      const evaluation = futuristic2070HumanCortex.evaluateHumanEmbodiment(agentKey, "en");

      console.log(`   [${agentKey.toUpperCase()}] Verified: ${evaluation.verified}, Score: ${evaluation.percentage}%`);
      console.log(`   Proof: ${evaluation.equationalProof}`);

      assert.strictEqual(evaluation.verified, true, `Embodiment for ${agentKey} must be 100% verified`);
      assert.strictEqual(evaluation.percentage, 100, `Percentage for ${agentKey} must be 100%`);
      assert.strictEqual(evaluation.lhsEqualsRhs, true, `LHS must equal RHS for ${agentKey}`);
      assert.strictEqual(evaluation.pillars.work.verified, true);
      assert.strictEqual(evaluation.pillars.think.verified, true);
      assert.strictEqual(evaluation.pillars.write.verified, true);
      assert.strictEqual(evaluation.pillars.blinkEye.verified, true);
      assert.strictEqual(evaluation.pillars.personaIntellect.verified, true);
    }
  });

  await t.test("4. Biological Eye Blinking Kinematics & Foveated Acuity M(r) >= 0.90", () => {
    const eyeVerification = humanEyeCortex.verifyEquationalHumanEyeLearningAndSeeing();

    console.log(`   Biological Eye Verification: ${eyeVerification.verified}, Foveal Acuity: ${eyeVerification.dimensions.seeing.fovealAcuity}`);
    console.log(`   Blink Rate BPM: ${eyeVerification.dimensions.humanKinematics.spontaneousBlinkRateBpm}`);

    assert.strictEqual(eyeVerification.verified, true, "HumanEyeCortex must verify biological eye seeing and blinking");
    assert.ok(eyeVerification.dimensions.seeing.fovealAcuity >= 0.90, "Foveal acuity M(r) must be >= 0.90");
    assert.strictEqual(eyeVerification.dimensions.humanKinematics.minimumJerkSaccades, true);
    assert.strictEqual(eyeVerification.dimensions.humanKinematics.volkmannSuppression, true);
  });

  await t.test("5. ActionRunner Interception & 2070 Human Directive Dispatch", async () => {
    const speechText = "Check our input and output are fully human-like 0 bot feeling 2070 humans work think write blink eye equationally";
    const activeAgent = { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" };

    const result = await actionRunner.handleAction(speechText, activeAgent);

    console.log("   ActionRunner Result: ", result.speech);

    assert.strictEqual(result.handled, true, "ActionRunner must handle 2070 Futuristic Human directive");
    assert.strictEqual(result.action, "futuristic_2070_human_embodiment");
    assert.ok(result.speech.includes("babe") || result.speech.includes("2070"), "Tuk Tuk response must be persona-sovereign with pet name 'babe'");
    assert.strictEqual(result.data.year, 2070);
    assert.strictEqual(result.data.zeroBotFeeling, true);
  });

  await t.test("6. LocalCognitiveBrain Multi-Agent Persona Sovereignty under 2070 Directive", () => {
    const speechText = "Check our input and output are fully human-like 0 bot feeling 2070 humans work think write blink eye equationally";

    // 1. Tuk Tuk (English & Bengali) -> Exclusively "babe"
    const tuktukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", speechText, {}, "en");
    const tuktukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", speechText, {}, "bn");
    console.log("   Tuk Tuk EN: ", tuktukEn);
    console.log("   Tuk Tuk BN: ", tuktukBn);
    assert.ok(tuktukEn.toLowerCase().includes("babe"), "Tuk Tuk English must contain 'babe'");
    assert.ok(tuktukBn.toLowerCase().includes("babe"), "Tuk Tuk Bengali must contain 'babe'");
    assert.strictEqual(tuktukEn.toLowerCase().includes("shona"), false);
    assert.strictEqual(tuktukEn.toLowerCase().includes("bro"), false);

    // 2. Vision (English & Bengali) -> Exclusively "brother" / "ভাই"
    const visionEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", speechText, {}, "en");
    const visionBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", speechText, {}, "bn");
    console.log("   Vision EN:  ", visionEn);
    console.log("   Vision BN:  ", visionBn);
    assert.ok(visionEn.toLowerCase().includes("brother"), "Vision English must contain 'brother'");
    assert.ok(visionBn.includes("ভাই"), "Vision Bengali must contain 'ভাই'");
    assert.strictEqual(visionEn.toLowerCase().includes("babe"), false);

    // 3. Friday (English & Bengali) -> Exclusively "Chief" / "Hritthik"
    const fridayEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", speechText, {}, "en");
    const fridayBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", speechText, {}, "bn");
    console.log("   Friday EN:  ", fridayEn);
    console.log("   Friday BN:  ", fridayBn);
    assert.ok(fridayEn.includes("Chief") || fridayEn.includes("Hritthik"), "Friday English must contain 'Chief' or 'Hritthik'");
    assert.ok(fridayBn.includes("Chief") || fridayBn.includes("হৃত্তিক"), "Friday Bengali must contain 'Chief' or 'হৃত্তিক'");

    // 4. DD (English & Bengali) -> Exclusively "bro"
    const ddEn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", speechText, {}, "en");
    const ddBn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", speechText, {}, "bn");
    console.log("   DD EN:      ", ddEn);
    console.log("   DD BN:      ", ddBn);
    assert.ok(ddEn.toLowerCase().includes("bro"), "DD English must contain 'bro'");
    assert.ok(ddBn.toLowerCase().includes("bro"), "DD Bengali must contain 'bro'");
  });
});
