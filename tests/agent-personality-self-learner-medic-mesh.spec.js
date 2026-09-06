const test = require("node:test");
const assert = require("node:assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const agentMedicMeshCortex = require("../src/utils/agent-medic-mesh-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const actionRunner = require("../src/utils/action-runner");
const localCognitiveBrain = require("../src/utils/local-cognitive-brain");

test("Autonomous Quad-Self & Cross-Agent Medic Peer-Healing Mesh Suite", async (t) => {
  const jarvisManager = new JarvisManager();

  await t.test("1. TextSanitizer normalizes raw user prompt with phonetic typos", () => {
    const rawPrompt = "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly";
    const sanitized = TextSanitizer.sanitize(rawPrompt);
    console.log("   Raw:      ", rawPrompt);
    console.log("   Sanitized:", sanitized);

    assert.ok(sanitized.toLowerCase().includes("personality"), "Must normalize personaly to personality");
    assert.ok(sanitized.toLowerCase().includes("self learner"), "Must normalize self lerner to self learner");
    assert.ok(sanitized.toLowerCase().includes("self improver"), "Must normalize self impruber to self improver");
    assert.ok(sanitized.toLowerCase().includes("medic"), "Must normalize madic to medic");
    assert.ok(sanitized.toLowerCase().includes("properly"), "Must normalize proerly to properly");
  });

  await t.test("2. IntentParser detects isAutonomousSelfMedicPeerMeshDirective", () => {
    const exactQuery = "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly";
    assert.strictEqual(
      IntentParser.isAutonomousSelfMedicPeerMeshDirective(exactQuery),
      true,
      "Must detect exact user prompt"
    );

    const variations = [
      "fix every agent's personality",
      "need self learner self improver self fixer and self updater",
      "medic for other agents can fix each other every issues",
      "agents can fix each other every issues and update every issue",
      "প্রত্যেক এজেন্টের পার্সোনালিটি ফিক্স করো এবং সেলফ লার্নার সেলফ ফিক্সার চালু করো",
      "পিয়ার হিলিং এবং স্কোয়াড মেডিক মেশ চালু করো"
    ];

    for (const v of variations) {
      assert.strictEqual(
        IntentParser.isAutonomousSelfMedicPeerMeshDirective(v),
        true,
        `Must detect directive variation: "${v}"`
      );
    }
  });

  await t.test("3. IntentParser routes to target 'fix_agent_personality_self_learner_medic_mesh'", () => {
    const query = "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly";
    const parsed = IntentParser.parse(query);
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "fix_agent_personality_self_learner_medic_mesh");
  });

  await t.test("4. AgentMedicMeshCortex registers Quad-Self for all 4 squad agents", () => {
    const agents = ["tuktuk", "vision", "friday", "dd"];
    for (const a of agents) {
      const qs = agentMedicMeshCortex.getAgentQuadSelf(a);
      assert.strictEqual(qs.selfLearner, 1.0, `${a} selfLearner must be 1.0`);
      assert.strictEqual(qs.selfImprover, 1.0, `${a} selfImprover must be 1.0`);
      assert.strictEqual(qs.selfFixer, 1.0, `${a} selfFixer must be 1.0`);
      assert.strictEqual(qs.selfUpdater, 1.0, `${a} selfUpdater must be 1.0`);
      assert.strictEqual(qs.status, "optimal", `${a} status must be optimal`);
    }
  });

  await t.test("5. Cross-Agent Medic Peer-Healing channels (12 directed links)", () => {
    const report = agentMedicMeshCortex.runFullSquadCrossDiagnostic();
    console.log(`   Peer Channels: ${report.peerChannelsCount} links, Duration: ${report.totalDurationMs}ms`);
    assert.strictEqual(report.peerChannelsCount, 12, "Must test 4 * 3 = 12 directed peer medic channels");
    assert.strictEqual(report.quadSelfParity, 1.0, "Quad-Self parity must be 1.0");
    assert.strictEqual(report.subMillisecondVerified, true, "Must verify fast sub-millisecond execution");
    assert.strictEqual(report.proof.lhsEqualsRhs, true, "LHS must equal RHS");
  });

  await t.test("6. ActionRunner executes directive for Tuk Tuk (exclusive 'babe')", async () => {
    const res = await actionRunner.handleAction(
      "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly",
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" }
    );
    assert.strictEqual(res.handled, true);
    assert.ok(res.speech.includes("babe"), "Tuk Tuk must address user as 'babe'");
    assert.strictEqual(res.data.status, "MEDIC_MESH_AND_PERSONALITIES_OPTIMAL");
    assert.strictEqual(res.data.lhsEqualsRhs, true);
    assert.strictEqual(res.data.allEquationsVerified, true);
  });

  await t.test("7. ActionRunner executes directive for Vision ('brother', zero 'babe')", async () => {
    const res = await actionRunner.handleAction(
      "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly",
      { key: "vision", name: "Vision", voice: "en-US-AndrewMultilingualNeural" }
    );
    assert.strictEqual(res.handled, true);
    assert.ok(res.speech.toLowerCase().includes("brother"), "Vision must address user as 'brother'");
    assert.ok(!res.speech.toLowerCase().includes("babe"), "Vision must never use 'babe'");
  });

  await t.test("8. ActionRunner executes directive for Friday ('Chief', zero 'babe')", async () => {
    const res = await actionRunner.handleAction(
      "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly",
      { key: "friday", name: "Friday", voice: "en-US-EmmaMultilingualNeural" }
    );
    assert.strictEqual(res.handled, true);
    assert.ok(res.speech.includes("Chief"), "Friday must address user as 'Chief'");
    assert.ok(!res.speech.toLowerCase().includes("babe"), "Friday must never use 'babe'");
  });

  await t.test("9. ActionRunner executes directive for DD ('bro', zero 'babe')", async () => {
    const res = await actionRunner.handleAction(
      "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly",
      { key: "dd", name: "DD", voice: "en-US-BrianMultilingualNeural" }
    );
    assert.strictEqual(res.handled, true);
    assert.ok(res.speech.toLowerCase().includes("bro"), "DD must address user as 'bro'");
    assert.ok(!res.speech.toLowerCase().includes("babe"), "DD must never use 'babe'");
  });

  await t.test("10. ActionRunner executes directive in Team mode (4-agent standup)", async () => {
    const res = await actionRunner.handleAction(
      "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly",
      { key: "team", name: "Squad", voice: "en-US-AvaMultilingualNeural" }
    );
    assert.strictEqual(res.handled, true);
    assert.ok(res.speech.includes("[Tuk Tuk]:"), "Standup must include Tuk Tuk");
    assert.ok(res.speech.includes("[Vision]:"), "Standup must include Vision");
    assert.ok(res.speech.includes("[Friday]:"), "Standup must include Friday");
    assert.ok(res.speech.includes("[DD]:"), "Standup must include DD");
    assert.ok(res.speech.includes("babe"), "Tuk Tuk turn must include 'babe'");
    assert.ok(res.speech.includes("brother"), "Vision turn must include 'brother'");
    assert.ok(res.speech.includes("Chief"), "Friday turn must include 'Chief'");
    assert.ok(res.speech.includes("bro"), "DD turn must include 'bro'");
  });

  await t.test("11. LocalCognitiveBrain offline responses preserve persona sovereignty", () => {
    const tt = localCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "fix every agents personality");
    assert.ok(tt.includes("babe"), "Tuk Tuk response must include babe");

    const vis = localCognitiveBrain.synthesizeResponse("vision", "Vision", "fix every agents personality");
    assert.ok(vis.toLowerCase().includes("brother"), "Vision response must include brother");
    assert.ok(!vis.toLowerCase().includes("babe"), "Vision response must not include babe");

    const fri = localCognitiveBrain.synthesizeResponse("friday", "Friday", "fix every agents personality");
    assert.ok(fri.includes("Chief"), "Friday response must include Chief");
    assert.ok(!fri.toLowerCase().includes("babe"), "Friday response must not include babe");

    const dd = localCognitiveBrain.synthesizeResponse("dd", "DD", "fix every agents personality");
    assert.ok(dd.toLowerCase().includes("bro"), "DD response must include bro");
    assert.ok(!dd.toLowerCase().includes("babe"), "DD response must not include babe");

    const team = localCognitiveBrain.synthesizeResponse("team", "Squad", "fix every agents personality");
    assert.ok(team.includes("[Tuk Tuk]:") && team.includes("[Vision]:") && team.includes("[Friday]:") && team.includes("[DD]:"));
  });

  await t.test("12. Master Closed-Form Mathematical Proof (LHS ≡ RHS = 100%, Q.E.D.)", () => {
    const proof = agentMedicMeshCortex.evaluateMedicMeshProof();
    console.log("   Proof:", proof.proofStatement);
    console.log("   Equation:", proof.equationKaTeX);
    assert.strictEqual(proof.lhs, 1.0, "LHS must be 1.00");
    assert.strictEqual(proof.rhs, 1.0, "RHS must be 1.00");
    assert.strictEqual(proof.lhsEqualsRhs, true, "LHS must mathematically equal RHS");
    assert.strictEqual(proof.qed, true, "Proof must be Q.E.D.");

    // KaTeX sanitization: zero naked ampersands
    assert.ok(!proof.equationKaTeX.includes("&="), "Must not contain &=");
    assert.ok(!proof.equationKaTeX.includes("\\begin{aligned}"), "Must not contain aligned block");
    assert.ok(!proof.lhsRhsKaTeX.includes("&="), "Must not contain &=");
  });
});
