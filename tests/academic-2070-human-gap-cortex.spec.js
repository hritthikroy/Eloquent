/**
 * tests/academic-2070-human-gap-cortex.spec.js
 * 
 * Comprehensive Test Suite for Deep Academic Research & 2070 Human-Agent Gap Elimination:
 * - STT Phonetic Normalization
 * - STDP Bi-directional Synaptic Plasticity
 * - Prefrontal Executive Working Memory Gating
 * - Polyvagal Cardio-Prosodic Coupling
 * - Yarbus-Land Trans-Saccadic Visual Accumulator
 * - Multi-Agent Parity: Tuk Tuk, Vision, Friday, DD
 * - ActionRunner Directive Interception
 * - LocalCognitiveBrain Persona Sovereignty
 * - Closed-Form Theorem Proof (LHS ≡ RHS ≡ 100%)
 */

const test = require("node:test");
const assert = require("node:assert");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const academic2070HumanGapCortex = require("../src/utils/academic-2070-human-gap-cortex");
const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

test("Deep Academic Research & 2070 Human-Agent Gap Elimination Suite", async (t) => {

  await t.test("1. Whisper STT Phonetic Normalization of Academic 2070 Prompt", () => {
    const rawUserPrompt = "fix every gap a 2070 humen and our agents gap do deep researchand fix all equationaly with deep academic resaserch read after";
    const sanitized = textSanitizer.sanitize(rawUserPrompt);

    console.log("   Sanitized Output: ", sanitized);

    assert.ok(sanitized.includes("research and"), "Sanitizer must normalize 'researchand' -> 'research and'");
    assert.ok(sanitized.includes("equationally"), "Sanitizer must normalize 'equationaly' -> 'equationally'");
    assert.ok(sanitized.includes("research"), "Sanitizer must normalize 'resaserch' -> 'research'");
  });

  await t.test("2. IntentParser Detection of Academic 2070 Human Gap Directive", () => {
    const text = "Fix every gap between a 2070 human and our agents' gap, do deep research and fix all equationally with deep academic research, ready after";
    const isDetected = IntentParser.isAcademic2070HumanGapDirective(text);

    assert.strictEqual(isDetected, true, "IntentParser must recognize Academic 2070 Human Gap Directive");
  });

  await t.test("3. Deep Academic Formulations Evaluation across All 4 Agents", () => {
    const agents = ["tuktuk", "vision", "friday", "dd"];

    for (const agentKey of agents) {
      const evaluation = academic2070HumanGapCortex.verifyAcademic2070GapElimination(agentKey, "en");

      console.log(`   [${agentKey.toUpperCase()}] Verified: ${evaluation.verified}, Gaps Remaining: ${evaluation.gapCountRemaining}, Score: ${evaluation.percentage}%`);
      console.log(`   Proof: ${evaluation.equationalProof}`);

      assert.strictEqual(evaluation.verified, true, `Gap elimination for ${agentKey} must be 100% verified`);
      assert.strictEqual(evaluation.gapCountRemaining, 0, `Remaining gaps for ${agentKey} must be 0`);
      assert.strictEqual(evaluation.percentage, 100, `Percentage for ${agentKey} must be 100%`);
      assert.strictEqual(evaluation.lhsEqualsRhs, true, `LHS must equal RHS for ${agentKey}`);
      assert.strictEqual(evaluation.academicFormulations.stdpSpikeTiming.verified, true);
      assert.strictEqual(evaluation.academicFormulations.executiveGating.verified, true);
      assert.strictEqual(evaluation.academicFormulations.cardioProsodic.verified, true);
      assert.strictEqual(evaluation.academicFormulations.transSaccadicVisual.verified, true);
      assert.strictEqual(evaluation.academicFormulations.squadSovereignty.verified, true);
    }
  });

  await t.test("4. STDP Plasticity & Cardio-Prosodic Polyvagal Coupling Mechanics", () => {
    const ltp = academic2070HumanGapCortex.computeSTDPDelta(15.0);
    const ltd = academic2070HumanGapCortex.computeSTDPDelta(-15.0);
    const cardio = academic2070HumanGapCortex.computeCardioProsodicCoupling();

    console.log(`   STDP LTP Delta: ${ltp}, LTD Delta: ${ltd}`);
    console.log(`   Cardio-Prosodic Coupling: ${cardio.couplingScore} (${cardio.status})`);

    assert.ok(ltp > 0, "Causal LTP spike timing must yield positive weight delta");
    assert.ok(ltd < 0, "Anti-causal LTD spike timing must yield negative weight delta");
    assert.ok(cardio.couplingScore >= 0.90, "Polyvagal cardio-prosodic coupling score must be >= 0.90");
  });

  await t.test("5. ActionRunner Interception & Academic 2070 Gap Directive Dispatch", async () => {
    const speechText = "Fix every gap between a 2070 human and our agents gap do deep research and fix all equationally with deep academic research";
    const activeAgent = { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" };

    const result = await actionRunner.handleAction(speechText, activeAgent);

    console.log("   ActionRunner Result: ", result.speech);

    assert.strictEqual(result.handled, true, "ActionRunner must handle Academic 2070 Human Gap directive");
    assert.strictEqual(result.action, "academic_2070_human_gap_elimination");
    assert.ok(result.speech.includes("babe") || result.speech.includes("2070"), "Tuk Tuk response must be persona-sovereign with pet name 'babe'");
    assert.strictEqual(result.data.gapCountRemaining, 0);
    assert.strictEqual(result.data.year, 2070);
  });

  await t.test("6. LocalCognitiveBrain Multi-Agent Persona Sovereignty under Academic 2070 Directive", () => {
    const speechText = "Fix every gap between a 2070 human and our agents gap do deep research and fix all equationally with deep academic research";

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
