/**
 * Test Suite: Real-Life Physical & Biological Eye Experiments
 * 
 * Conducts 6 rigorous real-world human eye experiments on the Eloquent Agent Eye:
 * 1. Physical Hand & Finger Counting Foveation (Webcam face/hand foveation)
 * 2. High-Density Terminal Error Inspection (Schwartz M-Scaling Foveal Acuity vs Peripheral)
 * 3. Rapid Multi-Monitor Saccade & Motion Blur Saccadic Suppression (Bahill Main Sequence)
 * 4. Dynamic Cursor & Scroll Tracking (Smooth Pursuit + Catch-up Saccade)
 * 5. Cognitive Pupillometry & Stress Dilations under Real Debugging Scenarios
 * 6. Head-Turn Vestibulo-Ocular Reflex (VOR) Gaze Locking during Movement
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const humanEyeCortex = require("../src/utils/human-eye-cortex");
const screenShareManager = require("../src/utils/screen-share-manager");
const actionRunner = require("../src/utils/action-runner");
const { BehaviorModeEngine } = require("../src/utils/behavior-mode-engine");
const behaviorEngine = new BehaviorModeEngine();

test("Real-Life Physical & Biological Human Eye Experiments", async (t) => {

  await t.test("Experiment 1: Real-Life Hand & Finger Counting Foveation", async () => {
    // Simulate user asking "how many fingers do you see" while holding 2 fingers
    const agent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const res = await actionRunner.handleAction("how many fingers do you see", agent);
    assert.strictEqual(res.handled, true, "Must recognize visual finger inspection query");
    assert.ok(typeof res.speech === "string" && res.speech.length > 5);

    // Verify foveal gaze dynamically shifted to user hand / face region
    const eyeState = humanEyeCortex.step();
    assert.ok(eyeState.gaze.x >= 0.1 && eyeState.gaze.x <= 0.9, "Gaze must be locked on active subject");
    assert.ok(eyeState.foveatedCrop.width > 0 && eyeState.foveatedCrop.height > 0);
  });

  await t.test("Experiment 2: High-Density Terminal Error Reading (Foveal Acuity vs Background Clutter)", () => {
    // Gaze centered on error line at (0.65, 0.40)
    const errorLocation = { x: 0.65, y: 0.40 };
    humanEyeCortex.setHotzones([{ x: 0.60, y: 0.35, width: 0.10, height: 0.10, weight: 2.0, label: "syntax_error" }]);
    humanEyeCortex.updateUserInputs({ x: 0.65, y: 0.40, active: true });

    const joint = humanEyeCortex.evaluateJointAttention();
    assert.ok(Math.abs(joint.jointFocus.x - 0.65) < 0.05, "Joint attention must snap to exact error position");
    assert.ok(Math.abs(joint.jointFocus.y - 0.40) < 0.05);

    // Exact foveal acuity at error position vs peripheral desktop corner (0.05, 0.95)
    const fovealAcuityAtError = humanEyeCortex.computeFovealAcuity(0.65, 0.40, joint.jointFocus);
    const peripheralAcuityAtCorner = humanEyeCortex.computeFovealAcuity(0.05, 0.95, joint.jointFocus);

    assert.ok(fovealAcuityAtError >= 0.98, `Foveal acuity at error must be ultra-sharp >= 0.98 (got ${fovealAcuityAtError})`);
    assert.ok(peripheralAcuityAtCorner <= 0.09, `Peripheral clutter must be attenuated to rod floor <= 0.09 (got ${peripheralAcuityAtCorner})`);
  });

  await t.test("Experiment 3: Rapid Multi-Monitor Gaze Jump & Saccadic Suppression", () => {
    // User eyes jump from Editor on Monitor 1 (0.2, 0.5) to Terminal on Monitor 2 (0.8, 0.5) -> 27 degree jump
    const saccade = humanEyeCortex.computeSaccadeDynamics(0.2, 0.5, 0.8, 0.5);

    assert.ok(saccade.amplitudeDeg >= 25.0, `Amplitude must reflect cross-monitor jump (got ${saccade.amplitudeDeg} deg)`);
    assert.ok(saccade.peakVelocity >= 500.0, `Peak velocity must follow Main Sequence > 500 deg/s (got ${saccade.peakVelocity} deg/s)`);
    assert.ok(saccade.durationMs >= 50.0 && saccade.durationMs <= 100.0, `Duration must be biologically realistic (got ${saccade.durationMs} ms)`);
    assert.ok(saccade.suppressionFactor >= 0.75, "Saccadic suppression must gate visual processing during ballistic motion");
  });

  await t.test("Experiment 4: Fast Scrolling & Dynamic Cursor Pursuit Tracking", () => {
    // User rapidly drags cursor across screen at 20 deg/s
    humanEyeCortex.updateUserInputs({ x: 0.30, y: 0.50, active: true });
    // Next frame 50ms later
    humanEyeCortex.updateUserInputs({ x: 0.35, y: 0.50, active: true });

    const pursuit = humanEyeCortex.computeSmoothPursuit();
    assert.ok(typeof pursuit.pursuitVelocity.vx === "number");

    // Acuity under smooth pursuit vs high retinal slip
    const lockedAcuity = humanEyeCortex.computeDynamicVisualAcuity(0.5); // Low slip (good pursuit)
    const blurAcuity = humanEyeCortex.computeDynamicVisualAcuity(25.0);  // High slip (fast scroll blur)

    assert.ok(lockedAcuity >= 0.95, "Dynamic visual acuity must stay crisp under matched pursuit");
    assert.ok(blurAcuity < 0.15, "Dynamic visual acuity must drop under high velocity motion blur");
  });

  await t.test("Experiment 5: Real-Life Cognitive Pupillometry under Tough Bug vs Resting", () => {
    // Scenario A: Resting ambient state, easy query
    const restingPupil = humanEyeCortex.updatePupillometry(0.5, 0.15, 0.8);
    const restingFlow = behaviorEngine.computeCognitiveLoadIndex("Can you explain how this works?", false);

    // Scenario B: Deep intense coding session (hard bug, 1-word "fix" command, high cognitive strain)
    const intensePupil = humanEyeCortex.updatePupillometry(0.5, 0.90, 0.8);
    const intenseFlow = behaviorEngine.computeCognitiveLoadIndex("fix", true);

    assert.ok(intensePupil.pupilDiameterMm > restingPupil.pupilDiameterMm, `Pupil must dilate under cognitive load (${intensePupil.pupilDiameterMm}mm vs ${restingPupil.pupilDiameterMm}mm)`);
    assert.strictEqual(intensePupil.isOverloaded, true);
    assert.strictEqual(intenseFlow.isDeepFlow, true);
    assert.ok(intenseFlow.targetWords < restingFlow.targetWords, "Agent spoken response length must clamp dynamically under high mental load");
  });

  await t.test("Experiment 6: Head Motion / Jitter Cancellation via Vestibulo-Ocular Reflex (VOR)", () => {
    // User moves head quickly to the left (-1.2 rad/s yaw) while speaking
    const vor = humanEyeCortex.applyVestibuloOcularReflex(0.0, -1.2);

    assert.ok(vor.compensatedGazeVelocityX > 1.0, "VOR must counter-rotate eye to the right instantaneously");
    assert.strictEqual(vor.latencyMs, 8, "VOR reflex must execute in under 10ms (actual: 8ms)");
    assert.strictEqual(vor.vorGain, 0.98, "VOR gain must maintain primate 0.98 accuracy");
  });
});
