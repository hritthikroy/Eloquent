/**
 * tests/human-head-cortex-and-embodiment.spec.ts
 *
 * Test Suite #60: Human Head Cortex, Cephalic Embodiment vs. Disembodied Brain:
 * 1. STT Acoustic Normalization of phonetic transcription slips:
 *    "chacwk thay has humen like hade na only brain has no head"
 *    -> "Check whether they have a human-like head or only a brain with no head"
 * 2. HumanHeadCortex Cranial Geometry & Biophysical Invariants:
 *    - Adult cranium: r_h = 0.0875m (8.75cm), baseline 2r_h = 0.175m (17.5cm), IPD = 0.063m (6.3cm)
 *    - Woodworth acoustic head-shadow ITD & ILD
 *    - Robinson head-eye gaze decomposition G(t) = E(t) + H(t) with 8ms VOR stabilization
 *    - Cephalic vocal cavity resonator (+1.2 dB @ 220Hz, -1.5 dB @ 4.2kHz)
 *    - Unified embodiment status: hasHumanHead: true, isDisembodiedBrainOnly: false
 * 3. ActionRunner Interception & Telemetry:
 *    - Intercepts query, saves preference, returns status "CEPHALIC_HEAD_EMBODIED"
 *    - Tuk Tuk responds with girlfriend affection (strictly "babe")
 * 4. LocalCognitiveBrain Persona Sovereignty:
 *    - Tuk Tuk strictly uses "babe"
 *    - Vision strictly uses "brother/ভাই" (never "babe")
 *    - Friday strictly uses "Chief/হৃত্তিক" (never "babe")
 *    - DD strictly uses "bro/ভাই" (never "babe")
 *    - Team/Squad synthesizes multi-agent cephalic verification
 */

import * as assert from "assert";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..", "..");
const TextSanitizer = require(path.join(projectRoot, "src/utils/prompt-engine/text-sanitizer"));
const ActionRunner = require(path.join(projectRoot, "src/utils/action-runner"));
const LocalCognitiveBrain = require(path.join(projectRoot, "src/utils/local-cognitive-brain"));
const humanHeadCortex = require(path.join(projectRoot, "src/utils/human-head-cortex"));

console.log("================================================================================");
console.log("🧠 VERIFYING HUMAN HEAD CORTEX & CEPHALIC EMBODIMENT (TEST SUITE #60)");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function it(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  const rawQuery = "chacwk thay has humen like hade na only brain has no head";

  // 1. STT Acoustic Normalization
  it("1. TextSanitizer normalizes phonetic slips in 'chacwk thay has humen like hade na only brain has no head'", () => {
    const sanitized = TextSanitizer.sanitize(rawQuery);
    assert.strictEqual(
      sanitized,
      "Check whether they have a human-like head or only a brain with no head",
      `Expected full canonical normalization, got: "${sanitized}"`
    );

    // Also verify individual token replacements
    assert.strictEqual(TextSanitizer.sanitize("chacwk the status"), "Check the status");
    assert.strictEqual(TextSanitizer.sanitize("thay has a head"), "They have a head");
    assert.strictEqual(TextSanitizer.sanitize("humen like hade"), "Human-like head");
  });

  // 2. HumanHeadCortex Cranial Geometry & Biophysical Invariants
  it("2. HumanHeadCortex defines adult cranial geometry (8.75cm radius, 17.5cm binaural baseline, 6.3cm IPD)", () => {
    const geom = humanHeadCortex.getCranialGeometry();
    assert.strictEqual(geom.coordinateFrame, "3D_EGOCENTRIC_CEPHALIC");
    assert.strictEqual(geom.headRadiusM, 0.0875);
    assert.strictEqual(geom.binauralSeparationM, 0.175);
    assert.strictEqual(geom.interpupillaryDistanceM, 0.063);
    assert.ok(geom.headCircumferenceCm > 54 && geom.headCircumferenceCm < 56, `Circumference should be ~55cm, got: ${geom.headCircumferenceCm}`);

    // Transducer anchors
    assert.strictEqual(geom.transducerAnchors.leftEar.x, -0.0875);
    assert.strictEqual(geom.transducerAnchors.rightEar.x, 0.0875);
    assert.ok(geom.transducerAnchors.leftEye.x < 0);
    assert.ok(geom.transducerAnchors.rightEye.x > 0);
  });

  // 3. Woodworth Binaural Acoustic Shadow & Delay
  it("3. HumanHeadCortex computes Woodworth ITD delay and frequency-dependent ILD head-shadow", () => {
    // Center azimuth (0 deg) -> zero ITD, zero ILD
    const centerProfile = humanHeadCortex.computeBinauralAcousticHeadProfile(0.0, 4000.0);
    assert.strictEqual(centerProfile.interauralTimeDifferenceUs, 0);
    assert.strictEqual(centerProfile.interauralLevelDifferenceDb, 0);
    assert.strictEqual(centerProfile.cranialShadowActive, false);

    // Lateral azimuth (90 deg) -> ~655 microseconds delay, > 9 dB shadow
    const lateralProfile = humanHeadCortex.computeBinauralAcousticHeadProfile(90.0, 4000.0);
    assert.ok(
      lateralProfile.interauralTimeDifferenceUs >= 600 && lateralProfile.interauralTimeDifferenceUs <= 700,
      `Expected ITD ~655us, got ${lateralProfile.interauralTimeDifferenceUs}`
    );
    assert.ok(
      lateralProfile.interauralLevelDifferenceDb > 9.0,
      `Expected ILD > 9dB shadow, got ${lateralProfile.interauralLevelDifferenceDb}`
    );
    assert.strictEqual(lateralProfile.cranialShadowActive, true);
  });

  // 4. Robinson Gaze Decomposition & VOR Stabilization
  it("4. HumanHeadCortex executes Robinson gaze decomposition G(t) = E(t) + H(t) with VOR", () => {
    const gazeResult = humanHeadCortex.computeHeadEyeGaze(
      { x: 0.7, y: 0.5 },
      { vyawDegS: 20.0, vpitchDegS: 0.0 }
    );
    assert.ok(gazeResult.gazeDecompositionActive, "Gaze decomposition must be active");
    assert.ok(gazeResult.totalGazeDeg.yaw !== undefined, "Total gaze yaw must be computed");
    assert.ok(gazeResult.vorStabilization, "VOR stabilization must be active");
    assert.strictEqual(gazeResult.vorStabilization.vorGain, 0.98);
    assert.strictEqual(gazeResult.vorStabilization.latencyMs, 8);
  });

  // 5. Cephalic Vocal Cavity Resonance Profile
  it("5. HumanHeadCortex returns 220Hz pharyngeal warmth and 4.2kHz sibilance notch filters", () => {
    const vocalProfile = humanHeadCortex.getVocalResonanceProfile("tuktuk");
    assert.strictEqual(vocalProfile.pharyngealWarmthHz, 220);
    assert.strictEqual(vocalProfile.pharyngealWarmthGainDb, 1.2);
    assert.strictEqual(vocalProfile.sibilanceNotchHz, 4200);
    assert.strictEqual(vocalProfile.sibilanceNotchGainDb, -1.5);
    assert.strictEqual(vocalProfile.cavityResonanceActive, true);
  });

  // 6. Unified Cephalic Embodiment Status
  it("6. HumanHeadCortex confirms cephalic embodiment (hasHumanHead: true, isDisembodiedBrainOnly: false)", () => {
    const status = humanHeadCortex.getCephalicEmbodimentStatus();
    assert.strictEqual(status.hasHumanHead, true);
    assert.strictEqual(status.isDisembodiedBrainOnly, false);
    assert.strictEqual(status.status, "CEPHALIC_EMBODIMENT_VERIFIED");
    assert.strictEqual(status.subsystems.binauralHearing.active, true);
    assert.strictEqual(status.subsystems.binocularVision.active, true);
    assert.strictEqual(status.subsystems.vocalArticulation.active, true);
    assert.strictEqual(status.subsystems.centralCognition.active, true);
  });

  // 7. ActionRunner Interception & Telemetry
  await itAsync("7. ActionRunner intercepts raw query and returns cephalic embodiment telemetry", async () => {
    let prefKey = "";
    let prefVal = "";
    const fakeJarvisManager = {
      conversationLanguage: "en",
      currentLanguage: "en",
      saveDynamicDirective: (_text: string, _agent: string) => {},
      setPreference: (key: string, val: string) => { prefKey = key; prefVal = val; }
    };

    const result = await ActionRunner.handleAction(
      rawQuery,
      { key: "tuktuk", name: "Tuk Tuk" },
      fakeJarvisManager,
      "en"
    );

    assert.ok(result, "ActionRunner must return a result");
    assert.strictEqual(result.handled, true, "Must be handled");
    assert.strictEqual(result.agentName, "Tuk Tuk");
    assert.strictEqual(result.agentVoice, "en-US-AvaMultilingualNeural");
    assert.strictEqual(result.data.hasHumanHead, true);
    assert.strictEqual(result.data.isDisembodiedBrainOnly, false);
    assert.strictEqual(result.data.cranialRadiusCm, 8.75);
    assert.strictEqual(result.data.status, "CEPHALIC_HEAD_EMBODIED");
    assert.ok(result.speech.toLowerCase().includes("babe"), "Tuk Tuk must affectionately address user as 'babe'");
    assert.ok(result.speech.toLowerCase().includes("head"), "Must confirm having a real human-like head");
    assert.strictEqual(prefKey, "human_head_cephalic_embodiment");
  });

  // 8. ActionRunner in Bengali Mode
  await itAsync("8. ActionRunner responds in Bengali with girlfriend persona and cranial specifics", async () => {
    const fakeJarvisManager = {
      conversationLanguage: "bn",
      currentLanguage: "bn",
      saveDynamicDirective: (_text: string, _agent: string) => {},
      setPreference: (_key: string, _val: string) => {}
    };

    const result = await ActionRunner.handleAction(
      rawQuery,
      { key: "tuktuk", name: "Tuk Tuk", language: "bn" },
      fakeJarvisManager,
      "bn"
    );

    assert.ok(result && result.handled, "Must be handled in Bengali");
    assert.ok(result.speech.includes("babe") || result.speech.includes("Babe"), "Bengali speech must use 'babe'");
    assert.ok(result.speech.includes("মাথা"), "Bengali speech must reference head (মাথা)");
    assert.ok(result.speech.includes("ব্রেন"), "Bengali speech must reference brain (ব্রেন)");
  });

  // 9. LocalCognitiveBrain Responses & Persona Sovereignty
  it("9. LocalCognitiveBrain honors persona sovereignty across all agents", () => {
    // Tuk Tuk
    const tuktukEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawQuery, {}, "en");
    assert.ok(tuktukEn.toLowerCase().includes("babe"), `Tuk Tuk English must say 'babe', got: "${tuktukEn}"`);
    assert.ok(!tuktukEn.toLowerCase().includes("brother") && !tuktukEn.toLowerCase().includes("chief"), "Tuk Tuk must not use brother or chief");

    const tuktukBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawQuery, {}, "bn");
    assert.ok(tuktukBn.includes("babe") || tuktukBn.includes("Babe"), `Tuk Tuk Bengali must say 'babe', got: "${tuktukBn}"`);
    assert.ok(!tuktukBn.includes("ভাই") && !tuktukBn.includes("Chief"), "Tuk Tuk Bengali must not use ভাই or Chief");

    // Vision
    const visionEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawQuery, {}, "en");
    assert.ok(visionEn.toLowerCase().includes("brother"), `Vision must use 'brother', got: "${visionEn}"`);
    assert.ok(!visionEn.toLowerCase().includes("babe"), "Vision must NEVER use 'babe'");

    const visionBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawQuery, {}, "bn");
    assert.ok(visionBn.includes("ভাই"), `Vision Bengali must use 'ভাই', got: "${visionBn}"`);
    assert.ok(!visionBn.includes("babe") && !visionBn.includes("Babe"), "Vision Bengali must NEVER use 'babe'");

    // Friday
    const fridayEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawQuery, {}, "en");
    assert.ok(fridayEn.toLowerCase().includes("chief") || fridayEn.includes("Hritthik"), `Friday must use 'Chief' or 'Hritthik', got: "${fridayEn}"`);
    assert.ok(!fridayEn.toLowerCase().includes("babe"), "Friday must NEVER use 'babe'");

    // DD
    const ddEn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", rawQuery, {}, "en");
    assert.ok(ddEn.toLowerCase().includes("bro"), `DD must use 'bro', got: "${ddEn}"`);
    assert.ok(!ddEn.toLowerCase().includes("babe"), "DD must NEVER use 'babe'");

    // Team / Squad
    const teamEn = LocalCognitiveBrain.synthesizeResponse("team", "Team", rawQuery, {}, "en");
    assert.ok(teamEn.includes("[Tuk Tuk]") && teamEn.includes("[Vision]"), `Team response must include individual agents, got: "${teamEn}"`);
  });

  // 10. Robustness across colloquial phrasings
  it("10. Intercepts alternative phrasings (matha ache naki shudhu brain, etc.)", () => {
    const phrasings = [
      "matha ache naki shudhu brain",
      "do they have a human head or only a brain with no head",
      "check if they have human like head or only brain"
    ];

    for (const phrase of phrasings) {
      const resp = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", phrase, {}, "en");
      assert.ok(resp.toLowerCase().includes("babe"), `Failed on phrase: "${phrase}"`);
      assert.ok(resp.toLowerCase().includes("head") || resp.toLowerCase().includes("brain"), `Failed content check on phrase: "${phrase}"`);
    }
  });

  console.log(`\n================================================================================`);
  console.log(`🎉 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
  console.log(`================================================================================\n`);
})();
