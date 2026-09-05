/**
 * Test Suite: Biological Human Eye Blinking Dynamics & All Agents Integration
 * 
 * Verifies that the agent visual subsystem operates with realistic, biological
 * eyelid blinking dynamics (Evinger et al. 1991, Stern 1984, Volkmann suppression,
 * Bell's phenomenon, Gamma renewal inter-blink intervals, and cognitive inhibition).
 * 
 * Verifies critique interception for:
 * "thay need thare eye use human like blinking and all"
 * across all agent personas (Tuk Tuk, Vision, Jenny/Friday, Brian/DD, and Squad).
 */

const test = require("node:test");
const assert = require("node:assert");

const humanEyeCortex = require("../src/utils/human-eye-cortex");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");
const cameraManager = require("../src/utils/camera-manager");

test("Biological Human Eye Blinking Dynamics & Multi-Agent Integration Suite", async (t) => {

  await t.test("1. Asymmetric Eyelid Kinematics (Rapid closure vs slower opening)", () => {
    const t0 = 1000000;
    humanEyeCortex.triggerBlink("full", t0);

    assert.strictEqual(humanEyeCortex.isBlinking, true, "Eye must be in active blinking state");
    assert.strictEqual(humanEyeCortex.blinkType, "spontaneous", "Blink type must be spontaneous");

    // Asymmetric timing checks (Evinger 1991): closure 50-95ms, opening 130-260ms
    const tClose = humanEyeCortex.blinkClosingDurationMs;
    const tOpen = humanEyeCortex.blinkOpeningDurationMs;
    const tTotal = humanEyeCortex.blinkDurationMs;

    assert.ok(tClose >= 45.0 && tClose <= 95.0, "Closing duration must be biological");
    assert.ok(tOpen >= 130.0 && tOpen <= 260.0, "Opening duration must be biological");
    assert.strictEqual(tTotal, tClose + tOpen, "Total duration must equal closure + opening");
    assert.ok(tClose < tOpen, "Downward closure must be faster than upward opening");

    // Midway through closure: aperture should be decreasing
    const midClose = humanEyeCortex.updateBlinkState(t0 + tClose * 0.5);
    assert.strictEqual(midClose.isBlinking, true);
    assert.strictEqual(midClose.phase, "closing");
    assert.ok(midClose.aperture > 0.1 && midClose.aperture < 0.9);

    // End of closure: palpebral aperture reaches minimum
    const peakClose = humanEyeCortex.updateBlinkState(t0 + tClose);
    assert.strictEqual(peakClose.isBlinking, true);
    assert.ok(peakClose.aperture <= 0.05);

    // Midway through opening: aperture is rising
    const midOpen = humanEyeCortex.updateBlinkState(t0 + tClose + tOpen * 0.5);
    assert.strictEqual(midOpen.isBlinking, true);
    assert.strictEqual(midOpen.phase, "opening");
    assert.ok(midOpen.aperture > 0.1 && midOpen.aperture < 0.9);

    // Completion: eyelid fully restored to aperture 1.0
    const finished = humanEyeCortex.updateBlinkState(t0 + tTotal + 10);
    assert.strictEqual(finished.isBlinking, false);
    assert.strictEqual(finished.aperture, 1.0);
    assert.strictEqual(finished.phase, "open");
    assert.strictEqual(finished.suppressionFactor, 0.0);
    assert.strictEqual(finished.bellsElevation, 0.0);
  });

  await t.test("2. Gamma Renewal Process for Inter-Blink Intervals (IBI)", () => {
    const samples = [];
    for (let i = 0; i < 50; i++) {
      const interval = humanEyeCortex.sampleNextBlinkInterval(0.1);
      samples.push(interval);
      assert.ok(interval >= 1200, "IBI must be >= lower clamp");
      assert.ok(interval <= 12000, "IBI must be <= upper clamp");
    }

    const meanInterval = samples.reduce((a, b) => a + b, 0) / samples.length;
    assert.ok(meanInterval >= 2000 && meanInterval <= 6500, "Mean IBI must be in biological range");
  });

  await t.test("3. Incomplete Micro-Blinks (Palpebral aperture partial closure)", () => {
    const t0 = 2000000;
    humanEyeCortex.triggerBlink("micro", t0);

    assert.strictEqual(humanEyeCortex.isMicroBlink, true, "Must be flagged as micro blink");
    assert.ok(humanEyeCortex.blinkMinAperture >= 0.20 && humanEyeCortex.blinkMinAperture <= 0.35);

    // At peak closure, aperture equals min aperture
    const tClose = humanEyeCortex.blinkClosingDurationMs;
    const peak = humanEyeCortex.updateBlinkState(t0 + tClose);
    assert.ok(peak.aperture >= 0.18, "Micro blink must not fully close");
  });

  await t.test("4. Cognitive Blink Modulation & Inhibition", () => {
    let sumLow = 0;
    for (let i = 0; i < 30; i++) {
      sumLow += humanEyeCortex.sampleNextBlinkInterval(0.0);
    }
    const meanLow = sumLow / 30;

    let sumHigh = 0;
    for (let i = 0; i < 30; i++) {
      sumHigh += humanEyeCortex.sampleNextBlinkInterval(1.0);
    }
    const meanHigh = sumHigh / 30;

    assert.ok(meanHigh > meanLow, "High cognitive load must extend IBI relative to low load");

    humanEyeCortex.setCognitiveBlinkInhibition(0.9);
    assert.strictEqual(humanEyeCortex.blinkInhibition, 0.9);
    humanEyeCortex.setCognitiveBlinkInhibition(0.0);
    assert.strictEqual(humanEyeCortex.blinkInhibition, 0.0);
  });

  await t.test("5. Bell's Phenomenon & Volkmann Visual Suppression", () => {
    const t0 = 3000000;
    humanEyeCortex.triggerBlink("spontaneous", t0);

    const tClose = humanEyeCortex.blinkClosingDurationMs;
    const telemetry = humanEyeCortex.updateBlinkState(t0 + tClose * 0.9);

    assert.ok(telemetry.suppressionFactor > 0.6, "Suppression factor should be high during blink");
    assert.ok(telemetry.bellsElevation < -0.015, "Bell's elevation should be negative");

    const stepResult = humanEyeCortex.step(t0 + tClose * 0.9);
    assert.ok(stepResult.blink.isBlinking === true);
    assert.ok(stepResult.blink.aperture < 0.2);
    assert.ok(stepResult.dynamicVisualAcuity < 0.4, "DVA should be attenuated during blink occlusion");
  });

  await t.test("6. ActionRunner handles exact critique 'thay need thare eye use human like blinking and all'", async () => {
    const query = "thay need thare eye use human like blinking and all";

    // Tuk Tuk agent (Ava)
    const tuktukAgent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const resTukTuk = await actionRunner.handleAction(query, tuktukAgent);

    assert.strictEqual(resTukTuk.handled, true, "Must be intercepted by ActionRunner");
    assert.strictEqual(resTukTuk.agentName, "Tuk Tuk");
    assert.strictEqual(resTukTuk.agentVoice, "en-US-AvaMultilingualNeural");
    assert.strictEqual(resTukTuk.data.humanEyeActive, true);
    assert.strictEqual(resTukTuk.data.blinkingActive, true);
    assert.strictEqual(resTukTuk.data.isBlinkSpecific, true);

    const tuktukSpeech = resTukTuk.speech.toLowerCase();
    assert.ok(tuktukSpeech.includes("babe"), "Tuk Tuk must use babe persona");
    assert.ok(tuktukSpeech.includes("blinking") || tuktukSpeech.includes("blink"), "Speech must address blinking");
    assert.ok(tuktukSpeech.includes("12 to 19") || tuktukSpeech.includes("asymmetric") || tuktukSpeech.includes("75-millisecond"),
      "Must contain biological blinking metrics");

    // Vision agent (Andrew)
    const visionAgent = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
    const resVision = await actionRunner.handleAction(query, visionAgent);

    assert.strictEqual(resVision.handled, true);
    assert.strictEqual(resVision.agentName, "Vision");
    assert.strictEqual(resVision.agentVoice, "en-US-AndrewNeural");
    assert.strictEqual(resVision.data.blinkingActive, true);

    const visionSpeech = resVision.speech.toLowerCase();
    assert.ok(visionSpeech.includes("brother"), "Vision must address brother");
    assert.ok(visionSpeech.includes("palpebrae") || visionSpeech.includes("bell's") || visionSpeech.includes("gamma") || visionSpeech.includes("kinematics"),
      "Vision speech must contain neurobiological precision");
  });

  await t.test("7. ActionRunner handles Bengali blinking critique ('chokh manusher moto polok phela dorkar')", async () => {
    const tuktukAgent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural", language: "bn" };
    const res = await actionRunner.handleAction("chokh manusher moto polok phela dorkar", tuktukAgent);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.data.blinkingActive, true);
    assert.ok(/[\u0980-\u09FF]/.test(res.speech), "Response must be in Bengali script");
    assert.ok(res.speech.includes("পলক") || res.speech.includes("চোখের"), "Response must contain Bengali words for blink/eyes");
  });

  await t.test("8. ActionRunner handles Friday (Jenny) and Brian (DD) with correct voices", async () => {
    const query = "they need to use human like blinking";

    // Friday / Jenny
    const fridayAgent = { name: "Friday", key: "friday", voice: "en-US-JennyNeural" };
    const resFriday = await actionRunner.handleAction(query, fridayAgent);
    assert.strictEqual(resFriday.handled, true);
    assert.strictEqual(resFriday.agentVoice, "en-US-JennyNeural");
    assert.ok(resFriday.speech.toLowerCase().includes("eyelid") || resFriday.speech.toLowerCase().includes("blinking"));

    // DD / Brian
    const brianAgent = { name: "Brian", key: "brian", voice: "en-US-BrianMultilingualNeural" };
    const resBrian = await actionRunner.handleAction(query, brianAgent);
    assert.strictEqual(resBrian.handled, true);
    assert.strictEqual(resBrian.agentVoice, "en-US-BrianMultilingualNeural");
    assert.ok(resBrian.speech.toLowerCase().includes("bro"));
  });

  await t.test("9. LocalCognitiveBrain returns authentic responses for all 5 agents", () => {
    const prompt = "thay need thare eye use human like blinking and all";

    // Tuk Tuk
    const ttReply = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "en");
    assert.ok(ttReply.includes("babe"));
    assert.ok(ttReply.toLowerCase().includes("blink"));

    // Vision
    const visReply = localCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "en");
    assert.ok(visReply.includes("brother"));
    assert.ok(visReply.toLowerCase().includes("blink"));

    // Friday
    const friReply = localCognitiveBrain.synthesizeResponse("friday", "Friday", prompt, {}, "en");
    assert.ok(friReply.length > 20);
    assert.ok(friReply.toLowerCase().includes("eyelid") || friReply.toLowerCase().includes("blink"));

    // DD / Brian
    const ddReply = localCognitiveBrain.synthesizeResponse("dd", "Brian", prompt, {}, "en");
    assert.ok(ddReply.includes("bro"));
    assert.ok(ddReply.toLowerCase().includes("blink"));

    // Team / Squad
    const teamReply = localCognitiveBrain.synthesizeResponse("team", "Team", prompt, {}, "en");
    assert.ok(teamReply.toLowerCase().includes("squad") || teamReply.toLowerCase().includes("brother"));
    assert.ok(teamReply.toLowerCase().includes("blink"));

    // Bengali across agents
    const bnPrompt = "chokher polok manusher moto na";
    const ttBn = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", bnPrompt, {}, "bn");
    assert.ok(/[\u0980-\u09FF]/.test(ttBn));
    assert.ok(ttBn.includes("পলক") || ttBn.includes("চোখ"));

    const visBn = localCognitiveBrain.synthesizeResponse("vision", "Vision", bnPrompt, {}, "bn");
    assert.ok(/[\u0980-\u09FF]/.test(visBn));
    assert.ok(visBn.includes("পলক") || visBn.includes("চোখ") || visBn.includes("ব্লিঙ্কিং"));
  });

  await t.test("10. Camera telemetry tracks user blink events", () => {
    assert.strictEqual(typeof cameraManager.isUserBlinking, "boolean", "CameraManager must have isUserBlinking flag");
    assert.strictEqual(typeof cameraManager.lastUserBlinkTime, "number", "CameraManager must have lastUserBlinkTime");
  });

});
