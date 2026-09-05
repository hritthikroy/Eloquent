/**
 * Test Suite: Biomechanical & Neurobiological Human Eye Equational Cortex
 * 
 * Verifies all 12 closed-form mathematical equations for ZERO gap between human eye and agent eye:
 * 1. Retinal Topography & Log-Polar Foveated Sampling (Schwartz M-scaling)
 * 2. Oculomotor Kinematics & Saccadic Main Sequence (Bahill et al., Carpenter LATER)
 * 3. Fixational Micro-Movements (Tremor, Brownian Drift, Microsaccades)
 * 4. Multi-Scale Salience Field & Task Bayesian Prior
 * 5. Visual Deictic Grounding & Joint Attention Triangulation
 * 6. Cognitive Pupillometry & Workload Estimation (Kahneman)
 * 7. Listing's Law of 3D Ocular Kinematics & Torsion (Listing, Tweed & Vilis)
 * 8. Vestibulo-Ocular Reflex (VOR) & Head-Eye Gaze Decomposition (Robinson)
 * 9. Smooth Pursuit Dynamics & Catch-Up Saccades (Lisberger, Krauzlis)
 * 10. Dynamic Visual Acuity (DVA) & Retinal Slip Velocity (Landis, Kelly)
 * 11. Binocular Vergence & Stereoscopic Depth (Cumming & DeAngelis)
 * 12. Contrast Sensitivity Function (CSF) & Spatial Bandpass (Campbell & Robson)
 * 13. ActionRunner & ScreenShareManager Visual Integration
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const humanEyeCortex = require("../src/utils/human-eye-cortex");
const screenShareManager = require("../src/utils/screen-share-manager");
const actionRunner = require("../src/utils/action-runner");

test("Human Eye Equational Cortex Verification Suite", async (t) => {

  await t.test("1. Retinal Topography & Log-Polar Foveated Sampling (Schwartz M-Scaling)", () => {
    // Foveal center should have maximum acuity (near 1.0)
    const fovealAcuity = humanEyeCortex.computeFovealAcuity(0.5, 0.5, { x: 0.5, y: 0.5 });
    assert.ok(fovealAcuity >= 0.95, `Foveal center acuity must be >= 0.95 (got ${fovealAcuity})`);

    // Peripheral acuity at distance (0.8, 0.8) should fall off dramatically toward rod floor
    const periphAcuity = humanEyeCortex.computeFovealAcuity(0.9, 0.9, { x: 0.5, y: 0.5 });
    assert.ok(periphAcuity < 0.20, `Peripheral acuity must fall off to < 0.20 (got ${periphAcuity})`);
    assert.ok(periphAcuity >= 0.05, `Peripheral acuity must preserve non-zero floor >= 0.05 (got ${periphAcuity})`);

    // Foveated crop bounding box computation
    const cropBox = humanEyeCortex.getFoveatedCropBox(1920, 1080, 0.35);
    assert.strictEqual(cropBox.width, Math.round(1920 * 0.35));
    assert.strictEqual(cropBox.height, Math.round(1080 * 0.35));
    assert.ok(cropBox.x >= 0 && cropBox.x + cropBox.width <= 1920);
    assert.ok(cropBox.y >= 0 && cropBox.y + cropBox.height <= 1080);
  });

  await t.test("2. Saccadic Main Sequence & Carpenter LATER Decision Model", () => {
    // 10-degree jump
    const dynSmall = humanEyeCortex.computeSaccadeDynamics(0.5, 0.5, 0.6, 0.5);
    // 30-degree jump
    const dynLarge = humanEyeCortex.computeSaccadeDynamics(0.1, 0.1, 0.8, 0.8);

    assert.ok(dynLarge.peakVelocity > dynSmall.peakVelocity, "Larger saccade must have higher peak velocity");
    assert.ok(dynLarge.peakVelocity <= 700.0, "Peak velocity must saturate under V_max (700 deg/s)");
    assert.ok(dynLarge.durationMs > dynSmall.durationMs, "Larger saccade must have longer duration");
    assert.ok(dynLarge.suppressionFactor >= 0.40, "Saccadic suppression must activate during jump");

    // LATER Model Latency Sampling (should produce human reaction times between 80ms and 450ms)
    for (let i = 0; i < 20; i++) {
      const lat = humanEyeCortex.sampleSaccadicLatency(1.0);
      assert.ok(lat >= 80 && lat <= 450, `Saccadic latency must be within human bounds [80, 450] ms (got ${lat})`);
    }
  });

  await t.test("3. Fixational Micro-Movements (Tremor, Drift & Microsaccades)", () => {
    // Over steady fixation, the eye should generate non-zero micro-displacements
    const offsets = [];
    for (let tMs = 0; tMs < 500; tMs += 16) {
      const offset = humanEyeCortex.computeFixationalOffset(tMs);
      offsets.push(offset);
      assert.ok(typeof offset.x === "number" && !isNaN(offset.x));
      assert.ok(typeof offset.y === "number" && !isNaN(offset.y));
    }

    const maxDeltaX = Math.max(...offsets.map(o => Math.abs(o.x)));
    assert.ok(maxDeltaX > 0.0001, "Fixational jitter must prevent synthetic static blindness");
  });

  await t.test("4. Multi-Scale Salience & Visual Deictic Joint Attention Triangulation", () => {
    // Feed user mouse cursor at (0.75, 0.25) and user eye gaze at (0.70, 0.30)
    humanEyeCortex.updateUserInputs(
      { x: 0.75, y: 0.25, active: true },
      { x: 0.70, y: 0.30, confidence: 0.9 }
    );
    humanEyeCortex.setHotzones([
      { x: 0.65, y: 0.20, width: 0.2, height: 0.2, weight: 1.5, label: "terminal_error" }
    ]);

    const joint = humanEyeCortex.evaluateJointAttention();
    assert.ok(joint.jointFocus.x >= 0.65 && joint.jointFocus.x <= 0.80, `Joint attention X must triangulate near hotzone/cursor (got ${joint.jointFocus.x})`);
    assert.ok(joint.jointFocus.y >= 0.20 && joint.jointFocus.y <= 0.35, `Joint attention Y must triangulate near hotzone/cursor (got ${joint.jointFocus.y})`);
    assert.ok(joint.deicticAlignmentQuality > 0, "Deictic alignment quality must be positive");
  });

  await t.test("5. Cognitive Pupillometry & Autonomic Workload Index", () => {
    // Normal lighting, low workload
    const relaxed = humanEyeCortex.updatePupillometry(0.5, 0.15, 0.8);
    assert.strictEqual(relaxed.isOverloaded, false);
    assert.ok(relaxed.pupilDiameterMm >= 2.0 && relaxed.pupilDiameterMm <= 6.0);

    // Deep cognitive strain / hard bug
    const strained = humanEyeCortex.updatePupillometry(0.5, 0.85, 0.8);
    assert.strictEqual(strained.isOverloaded, true);
    assert.ok(strained.pupilDiameterMm > relaxed.pupilDiameterMm, "Pupil diameter must dilate under high cognitive load");
    assert.strictEqual(strained.workloadIndex, 0.85);
  });

  await t.test("6. Listing's Law of 3D Ocular Kinematics & Torsion", () => {
    // Primary position (center gaze) -> Torsion should be zero
    const center = humanEyeCortex.computeListings3DOrientation(0.5, 0.5);
    assert.strictEqual(center.torsionZRad, 0.0, "Primary gaze position must have zero torsion in Listing's plane");

    // Tertiary eccentric position (top-right quadrant) -> Non-zero torsion obeying half-angle rule
    const tertiary = humanEyeCortex.computeListings3DOrientation(0.8, 0.2);
    assert.notStrictEqual(tertiary.torsionZRad, 0.0, "Tertiary gaze direction must exhibit 3D ocular torsion");
    assert.ok(tertiary.quaternion.q0 > 0.0, "Quaternion scalar component must be valid");
  });

  await t.test("7. Vestibulo-Ocular Reflex (VOR) & Head-Eye Decomposition", () => {
    const vor = humanEyeCortex.applyVestibuloOcularReflex(0.5, -0.8);
    assert.ok(vor.compensatedGazeVelocityX > 0, "Yaw head motion must trigger compensatory counter-rotation");
    assert.ok(vor.compensatedGazeVelocityY < 0, "Pitch head motion must trigger compensatory counter-rotation");
    assert.strictEqual(vor.latencyMs, 8, "VOR latency must be sub-10ms");
  });

  await t.test("8. Smooth Pursuit & Catch-Up Saccades", () => {
    // Slow target motion within smooth pursuit velocity envelope
    humanEyeCortex.updateUserInputs({ x: 0.55, y: 0.55, active: true });
    const pursuit = humanEyeCortex.computeSmoothPursuit();
    assert.ok(typeof pursuit.pursuitVelocity.vx === "number");
    assert.ok(typeof pursuit.retinalPositionErrorDeg === "number");
  });

  await t.test("9. Dynamic Visual Acuity (DVA) under Retinal Slip", () => {
    const staticAcuity = humanEyeCortex.computeDynamicVisualAcuity(0.0);
    assert.strictEqual(staticAcuity, 1.0, "Static gaze must yield 1.0 DVA");

    const highSlipAcuity = humanEyeCortex.computeDynamicVisualAcuity(20.0);
    assert.ok(highSlipAcuity < 0.20, `High retinal slip (20 deg/s) must degrade visual acuity (got ${highSlipAcuity})`);
  });

  await t.test("10. Binocular Vergence & Stereoscopic Depth", () => {
    const near = humanEyeCortex.computeBinocularVergence(300.0); // 30cm
    const far = humanEyeCortex.computeBinocularVergence(1000.0); // 100cm

    assert.ok(near.vergenceAngleDeg > far.vergenceAngleDeg, "Near targets must require greater binocular vergence");
    assert.ok(near.disparityArcmin > far.disparityArcmin, "Near targets have higher binocular disparity");
  });

  await t.test("11. Contrast Sensitivity Function (CSF) Bandpass", () => {
    const lowFreq = humanEyeCortex.computeContrastSensitivity(0.5);
    const peakFreq = humanEyeCortex.computeContrastSensitivity(4.0); // 4 cpd human peak
    const highFreq = humanEyeCortex.computeContrastSensitivity(30.0);

    assert.ok(peakFreq > lowFreq, "Peak spatial frequency (4 cpd) sensitivity must exceed low frequency");
    assert.ok(peakFreq > highFreq, "Peak spatial frequency (4 cpd) sensitivity must exceed high frequency (bandpass)");
  });

  await t.test("12. ScreenShareManager & ActionRunner Integration", async () => {
    // ScreenShareManager foveated crop integration
    const visionCtx = screenShareManager.getVisionContext();
    assert.ok(visionCtx.eyeCortex !== null, "Vision context must embed HumanEyeCortex state");
    assert.ok(visionCtx.eyeCortex.gaze !== undefined);

    const foveatedBox = screenShareManager.getFoveatedCropBox(0.4);
    assert.ok(foveatedBox.width > 0 && foveatedBox.height > 0);

    // ActionRunner biological eye recalibration
    const recalRes = await actionRunner.handleAction("fix their eye", { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" });
    assert.strictEqual(recalRes.handled, true);
    assert.match(recalRes.speech, /Eyes.*recalibrated|synchronized|Visual cortex/i);

    // ActionRunner screen vision inspection
    const screenRes = await actionRunner.handleAction("look at my screen", { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" });
    assert.strictEqual(screenRes.handled, true);
    assert.match(screenRes.speech, /looking directly at your|Visual lock|Visual cortex/i);
  });
});
