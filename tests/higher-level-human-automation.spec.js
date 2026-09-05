const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const { humanActionCortex } = require("../src/utils/human-action-cortex");
const humanEyeCortex = require("../src/utils/human-eye-cortex");
const actionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const JarvisManager = require("../src/utils/jarvis-manager");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { cyberAgent2070 } = require("../src/core/agent/cyber-agent-2070");

test("Higher-Level Biological Human Automation Suite", async (t) => {
  const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
  const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const activeVision = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };

  await t.test("1. TextSanitizer normalizes 'higher lavel' and 'automations'", () => {
    const raw = "fix every automation need higher lavel human like automations";
    const sanitized = textSanitizer.sanitize(raw);
    assert.match(sanitized, /higher level/i);
    assert.match(sanitized, /automation/i);
  });

  await t.test("2. Fitts' Law Minimum-Jerk Trajectory Planning", () => {
    const start = { x: 100, y: 150 };
    const end = { x: 800, y: 650 };
    const traj = humanActionCortex.planMinimumJerkTrajectory(start, end);

    assert.ok(traj.distancePx > 700, "Distance calculation accurate");
    assert.ok(traj.durationMs >= 200, "Duration must follow Fitts' Law");
    assert.strictEqual(traj.steps, 26, "25 steps plus endpoint");
    assert.ok(traj.maxVelocityPxPerSec > 0, "Velocity profile generated");

    // Verify minimum-jerk bell curve: mid-trajectory velocity is higher than endpoints
    const startVel = traj.trajectory[1].velocityPxPerSec;
    const midVel = traj.trajectory[12].velocityPxPerSec;
    const endVel = traj.trajectory[traj.trajectory.length - 2].velocityPxPerSec;

    assert.ok(midVel > startVel, "Midpoint velocity must exceed launch velocity");
    assert.ok(midVel > endVel, "Midpoint velocity must exceed terminal landing velocity");
    assert.ok(Math.abs(traj.endPosition.x - end.x) < 5, "Endpoint x accurate within tremor bounds");
    assert.ok(Math.abs(traj.endPosition.y - end.y) < 5, "Endpoint y accurate within tremor bounds");
  });

  await t.test("3. Log-Normal Human Typing Cadence with Digraph Bursts & Micro-Hesitations", () => {
    const text = "the quick brown fox jumps";
    const typingPlan = humanActionCortex.generateHumanTypingPlan(text);

    assert.strictEqual(typingPlan.totalCharacters, text.length);
    assert.ok(typingPlan.estimatedDurationMs > 500, "Typing takes realistic human time");
    assert.ok(typingPlan.calculatedWpm >= 20 && typingPlan.calculatedWpm <= 160, "WPM in human biological range");

    // Verify common digraph acceleration ('th')
    const thPair = typingPlan.keystrokePlan.find(k => k.char === 'h' && k.isDigraphBurst);
    assert.ok(thPair, "Common digraph 'th' must be identified as motor memory burst");
    assert.ok(thPair.delayMs <= 65, "Digraph burst delay must be fast (35-65ms)");

    // Verify word boundary cognitive hesitation (spaces)
    const spaceKey = typingPlan.keystrokePlan.find(k => k.char === ' ');
    assert.ok(spaceKey, "Space key must exist in plan");
    assert.strictEqual(spaceKey.isHesitation, true, "Word boundary must be marked as cognitive hesitation");
    assert.ok(spaceKey.delayMs >= 150, "Cognitive boundary hesitation must be >= 150ms");
  });

  await t.test("4. Inertial Parabolic Scrolling with Viscous Exponential Decay", () => {
    const scrollPlan = humanActionCortex.generateInertialScrollPlan(1200, 450);

    assert.strictEqual(scrollPlan.totalDistancePx, 1200);
    assert.ok(scrollPlan.steps >= 15);
    
    // First steps must have larger delta than late steps due to exponential decay
    const earlyDelta = scrollPlan.scrollPlan[1].deltaPx;
    const lateDelta = scrollPlan.scrollPlan[scrollPlan.scrollPlan.length - 1].deltaPx;
    assert.ok(earlyDelta > lateDelta, "Early inertial scroll velocity must exceed decaying velocity");

    const finalCumulative = scrollPlan.scrollPlan[scrollPlan.scrollPlan.length - 1].cumulativePx;
    assert.ok(Math.abs(finalCumulative - 1200) < 5, "Scroll cumulative distance reaches target");
  });

  await t.test("5. Gaze-Anchored Preflight Verification with HumanEyeCortex", () => {
    const target = { x: 0.65, y: 0.45 };
    const check = humanActionCortex.verifyGazeBeforeAction(target, humanEyeCortex);

    assert.strictEqual(check.verified, true);
    assert.ok(check.gazeDwellMs >= 80 && check.gazeDwellMs <= 160, "Biological gaze dwell within 80-160ms");
    assert.ok(check.fovealAcuity >= 0.70, "Foveal acuity must be verified before motor trigger");
    assert.strictEqual(check.readyForMotorExecution, true);
  });

  await t.test("6. Contextual Cognitive Deliberation Windows", () => {
    const readWindow = humanActionCortex.computeDeliberationWindow("read");
    const writeWindow = humanActionCortex.computeDeliberationWindow("write_file");
    const deployWindow = humanActionCortex.computeDeliberationWindow("deploy", "high");

    assert.ok(readWindow.hesitationMs < 60, "Read operations must hesitate minimally (<60ms)");
    assert.ok(writeWindow.hesitationMs >= 150, "File write operations must have thoughtful safety pause");
    assert.ok(deployWindow.hesitationMs >= 200, "High-impact deployments must have rigorous deliberation pause");
  });

  await t.test("7. ActionRunner handles exact user prompt 'fix every automation need higher lavel human like automations'", async () => {
    const prompt = "fix every automation need higher lavel human like automations";
    const res = await actionRunner.handleAction(prompt, activeTukTuk, jarvis);

    assert.strictEqual(res.handled, true, "Must be handled by ActionRunner");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.action, "higher_level_human_automation");
    assert.strictEqual(res.data.status, "HIGHER_LEVEL_HUMAN_ONLINE");
    assert.strictEqual(res.data.kinematics, "minimum_jerk_fitts_law");
    assert.strictEqual(res.data.typingCadence, "log_normal_burstiness");
    assert.strictEqual(res.data.gazeAnchorPreflight, "verified");

    // Check lexical sovereignty
    assert.match(res.speech, /babe/i, "Tuk Tuk must address Hritthik as babe");
    assert.match(res.speech, /Vision/i, "Tuk Tuk must reference Vision");
    assert.ok(!res.speech.toLowerCase().includes("locked on your screen babe! what do you want me to inspect"), "No robotic canned openers");
  });

  await t.test("8. ActionRunner handles Bengali 'shob automation manusher moto koro'", async () => {
    const res = await actionRunner.handleAction("shob automation manusher moto koro", activeTukTuk, jarvis);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.data.action, "higher_level_human_automation");
    assert.match(res.speech, /babe/i);
    assert.match(res.speech, /মানুষের|মিনিমাম-জার্ক/i);
  });

  await t.test("9. LocalCognitiveBrain synthesizes higher-level automation responses across personas", () => {
    const prompt = "fix every automation need higher lavel human like automations";

    // Tuk Tuk
    const tuktukRes = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt, {}, "en");
    assert.match(tuktukRes, /babe/i);
    assert.match(tuktukRes, /human|fitts|minimum-jerk|cadence/i);
    assert.ok(!tuktukRes.includes("bro"), "Tuk Tuk must never call user 'bro'");

    // Vision
    const visionRes = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt, {}, "en");
    assert.match(visionRes, /brother/i);
    assert.match(visionRes, /Flash-Hogan|minimum-jerk|kinematics/i);
    assert.ok(!visionRes.includes("babe"), "Vision must never call user 'babe'");

    // Team
    const teamRes = LocalCognitiveBrain.synthesizeResponse("team", "Squad", prompt, {}, "en");
    assert.match(teamRes, /\[Tuk Tuk\]:/i);
    assert.match(teamRes, /\[Vision\]:/i);
  });

  await t.test("10. CyberAgent2070 Engine exposes getHumanActionCortex", () => {
    const cortex = cyberAgent2070.getHumanActionCortex();
    assert.ok(cortex, "HumanActionCortex must be accessible");
    assert.strictEqual(typeof cortex.planMinimumJerkTrajectory, "function");
    assert.strictEqual(typeof cortex.generateHumanTypingPlan, "function");
  });
});
