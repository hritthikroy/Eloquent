/**
 * Test Suite: Biological Human Eye Dynamics & Critique Interceptor
 * 
 * Verifies that the agent vision and eye-tracking subsystem operates with
 * biological human eye dynamics (Schwartz foveation, Bahill saccades, fixational drift)
 * rather than static robotic camera stares.
 * 
 * Verifies handling of user critique:
 * "thay are not use thare eye like humen" and natural variations.
 */

const test = require("node:test");
const assert = require("node:assert");

const humanEyeCortex = require("../src/utils/human-eye-cortex");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

test("Biological Human Eye Dynamics & Critique Interceptor Suite", async (t) => {

  await t.test("1. humanEyeCortex.activateHumanEyeMode initializes biological parameters", () => {
    const activation = humanEyeCortex.activateHumanEyeMode({
      gaze: { x: 0.52, y: 0.48 },
      userCursor: { x: 0.55, y: 0.50, active: true }
    });

    assert.strictEqual(activation.active, true, "Mode must be active");
    assert.strictEqual(activation.mode, "human_biological", "Mode must be human_biological");
    assert.ok(typeof activation.gaze.x === "number", "Gaze x must be number");
    assert.ok(typeof activation.gaze.y === "number", "Gaze y must be number");
    assert.ok(activation.fovealCrop.width > 0, "Foveal crop must have width");
    assert.ok(activation.fovealCrop.height > 0, "Foveal crop must have height");
    assert.ok(activation.dynamicVisualAcuity > 0, "Dynamic visual acuity must be positive");
    assert.ok(activation.pupilDiameterMm >= 2.0 && activation.pupilDiameterMm <= 8.0, "Pupil diameter in biological range");
  });

  await t.test("2. ActionRunner handles exact critique 'thay are not use thare eye like humen' with Tuk Tuk", async () => {
    const agent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
    const query = "thay are not use thare eye like humen";

    const res = await actionRunner.handleAction(query, agent);

    assert.strictEqual(res.handled, true, "Must be handled as human eye critique");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.humanEyeActive, true);
    assert.strictEqual(res.data.eyeMode, "human_biological");

    // Must NOT contain robotic boilerplate
    const lower = res.speech.toLowerCase();
    assert.ok(!lower.includes("locked on your screen babe! what do you want me to inspect"), "Must not use robotic boilerplate");
    assert.ok(!lower.includes("recalibrated and locked"), "Must not say recalibrated and locked");

    // Must acknowledge the critique naturally
    assert.ok(lower.includes("right babe") || lower.includes("robotic") || lower.includes("human eye dynamics") || lower.includes("foveal"), 
      `Must contain natural acknowledgement, got: ${res.speech}`);
  });

  await t.test("3. ActionRunner handles critique variations with Vision agent", async () => {
    const agent = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
    const variations = [
      "they are not using their eyes like humans",
      "not use eye like human",
      "eyes not like humans",
      "use eye like human"
    ];

    for (const query of variations) {
      const res = await actionRunner.handleAction(query, agent);
      assert.strictEqual(res.handled, true, `Query "${query}" must be handled`);
      assert.strictEqual(res.agentName, "Vision");
      assert.strictEqual(res.data.humanEyeActive, true);

      const lower = res.speech.toLowerCase();
      assert.ok(!lower.includes("what do you want me to look at"), `Must not be robotic prompt, got: ${res.speech}`);
      assert.ok(lower.includes("brother") || lower.includes("schwartz") || lower.includes("foveation") || lower.includes("saccadic"),
        `Vision should respond with architectural/biological precision, got: ${res.speech}`);
    }
  });

  await t.test("4. ActionRunner handles Bengali human eye critique ('chokh manusher moto na')", async () => {
    const tuktukAgent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural", language: "bn" };
    const res = await actionRunner.handleAction("chokh manusher moto na", tuktukAgent);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.data.humanEyeActive, true);
    assert.ok(/[\u0980-\u09FF]/.test(res.speech), `Response must be in Bengali, got: ${res.speech}`);
    assert.ok(res.speech.includes("মানুষের") || res.speech.includes("ফোকাস") || res.speech.includes("চোখ"),
      `Response must talk about biological human eyes, got: ${res.speech}`);
  });

  await t.test("5. LocalCognitiveBrain returns biological eye responses across agents", () => {
    const tuktukReply = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "thay are not use thare eye like humen", {}, "en");
    assert.ok(typeof tuktukReply === "string" && tuktukReply.length > 10);
    assert.ok(!tuktukReply.toLowerCase().includes("locked on your screen babe! what do you want me to inspect"));
    assert.ok(tuktukReply.toLowerCase().includes("babe"));

    const visionReply = localCognitiveBrain.synthesizeResponse("vision", "Vision", "thay are not use thare eye like humen", {}, "en");
    assert.ok(typeof visionReply === "string" && visionReply.length > 10);
    assert.ok(visionReply.toLowerCase().includes("brother") || visionReply.toLowerCase().includes("foveation"));

    const squadReply = localCognitiveBrain.synthesizeResponse("team", "Team", "they are not using their eyes like humans", {}, "en");
    assert.ok(typeof squadReply === "string" && squadReply.length > 10);
    assert.ok(squadReply.toLowerCase().includes("squad") || squadReply.toLowerCase().includes("brother"));

    // Bengali
    const bnReply = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "chokh manusher moto na", {}, "bn");
    assert.ok(/[\u0980-\u09FF]/.test(bnReply));
  });

});
