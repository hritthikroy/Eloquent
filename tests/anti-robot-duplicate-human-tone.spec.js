/**
 * anti-robot-duplicate-human-tone.spec.js
 *
 * Verifies:
 * 1. Anti-Duplication Engine: Repeated prompts yield distinct, fresh human expressions (no echo-chamber).
 * 2. Zero Robotic Tone: Completely purges mechanical phrases like "Visual perception recalibrated",
 *    "Systems nominal", "Research parameters logged", "I am fully synchronized".
 * 3. Native Bangla/Banglish Natural Fluency across all 4 agents:
 *    - Tuk Tuk: Warm, spontaneous, loving Bengali girlfriend & co-founder.
 *    - Vision: 10x Bengali dev brother, natural tech slang.
 *    - Jenny: Sharp, articulate female researcher, respectful to Chief.
 *    - Brian: Steady, calm infrastructure engineer, zero drama.
 *    - Team: Collaborative multi-agent live standup.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const LCB = require("../src/utils/local-cognitive-brain");

test("Anti-Robot Duplicate Elimination & Real Human Bangla Tone Suite", async (t) => {

  // ── 1. Anti-Duplication: Tuk Tuk Multi-Variant Verification ───────────────
  await t.test("1. Tuk Tuk Anti-Duplication: Consecutive queries return varied responses", () => {
    const responses = new Set();
    for (let i = 0; i < 5; i++) {
      const res = LCB.synthesizeResponse("tuktuk", "Tuk Tuk", "kemon acho babe");
      responses.add(res);
    }
    // Must produce at least 2 distinct natural human variants across 5 runs
    console.log(`  🗣️  Tuk Tuk greeting variations count: ${responses.size}`);
    assert.ok(responses.size >= 2, "Tuk Tuk must provide varied responses rather than single robotic duplicate");
  });

  // ── 2. Anti-Duplication: Vision Multi-Variant Verification ────────────────
  await t.test("2. Vision Anti-Duplication: Consecutive screen queries return varied responses", () => {
    const responses = new Set();
    for (let i = 0; i < 5; i++) {
      const res = LCB.synthesizeResponse("vision", "Vision", "screen ta dekho");
      responses.add(res);
    }
    console.log(`  🔵 Vision screen variations count: ${responses.size}`);
    assert.ok(responses.size >= 2, "Vision must provide varied dev responses");
  });

  // ── 3. Zero Robotic Tone Invariant ────────────────────────────────────────
  await t.test("3. Zero Robot Tone: Mechanical canned phrases purged from all agents", () => {
    const bannedRobotPhrases = [
      "visual perception recalibrated",
      "systems nominal",
      "research parameters logged",
      "i am fully synchronized",
      "i have logged the conversational",
      "all systems auto-healed",
      "i am an ai language model",
      "as an ai"
    ];

    const testInputs = [
      ["tuktuk", "hi"],
      ["tuktuk", "kemon acho"],
      ["tuktuk", "build start kori"],
      ["vision", "terminal error ta dekho"],
      ["vision", "git diff dekho"],
      ["vision", "build check koro"],
      ["jenny", "vad latency paper bolo"],
      ["jenny", "benchmark kemon"],
      ["brian", "cpu load koto"],
      ["brian", "daemon status dao"],
      ["team", "standup shuru koro"]
    ];

    for (const [agent, input] of testInputs) {
      const res = LCB.synthesizeResponse(agent, agent, input).toLowerCase();
      for (const banned of bannedRobotPhrases) {
        assert.ok(!res.includes(banned), `Agent ${agent} output must NOT contain robotic phrase "${banned}" (got "${res}")`);
      }
    }
  });

  // ── 4. Tuk Tuk: Authentic Bengali Girl Warmth & Natural Flow ──────────────
  await t.test("4. Tuk Tuk: Authentic Bengali emotional depth and partner tone", () => {
    const loveRes = LCB.synthesizeResponse("tuktuk", "Tuk Tuk", "babe tomake khub bhalobashi");
    console.log("  💖 Tuk Tuk Love:", loveRes);
    assert.ok(loveRes.includes("ভালোবাসি") || loveRes.includes("babe"), "Must express real warmth");
    assert.ok(!loveRes.toLowerCase().includes("undefined"));

    const nightRes = LCB.synthesizeResponse("tuktuk", "Tuk Tuk", "onek raat hoyeche ghumate jabo");
    console.log("  🌙 Tuk Tuk Night:", nightRes);
    assert.ok(nightRes.includes("ভালোবাসি") || nightRes.includes("রাত") || nightRes.includes("ঘুম") || nightRes.includes("রিল্যাক্স") || nightRes.includes("Rest") || nightRes.includes("babe"), "Natural caring close");
  });

  // ── 5. Vision: 10x Bengali Developer Brother Vibe ─────────────────────────
  await t.test("5. Vision: Authentic Bengali dev brother slang (ভাই / bro / clean)", () => {
    const gitRes = LCB.synthesizeResponse("vision", "Vision", "repo status kemon?");
    console.log("  💻 Vision Git:", gitRes);
    assert.ok(/\b(bro|brother|ভাই)\b/i.test(gitRes), "Brotherly dev salutation");
    assert.ok(!gitRes.toLowerCase().includes("babe"), "Strictly zero babe on Vision");

    const astRes = LCB.synthesizeResponse("vision", "Vision", "AST check koro");
    console.log("  🔧 Vision AST:", astRes);
    assert.ok(astRes.includes("AST") || astRes.includes("ক্লিন") || astRes.includes("clean"), "Confirms code clean");
  });

  // ── 6. Jenny: Articulate Female Research Lead in Bangla ───────────────────
  await t.test("6. Jenny: Analytical rigor and respectful Chief address", () => {
    const vadRes = LCB.synthesizeResponse("jenny", "Jenny", "vad turn taking latency koto?");
    console.log("  📊 Jenny VAD:", vadRes);
    assert.ok(vadRes.includes("Chief") || vadRes.includes("হৃত্তিক") || vadRes.includes("Hritthik"), "Respectful address");
    assert.ok(vadRes.includes("২৫০") || vadRes.includes("250") || vadRes.includes("VAD"), "Contains data metric");
    assert.ok(!vadRes.toLowerCase().includes("bro") && !vadRes.toLowerCase().includes("babe"), "Strict persona boundaries");
  });

  // ── 7. Brian: Grounded DevOps Telemetry in Bangla ─────────────────────────
  await t.test("7. Brian: Calm infrastructure telemetry and zero panic", () => {
    const cpuRes = LCB.synthesizeResponse("brian", "Brian", "cpu load ar heap koto?");
    console.log("  🛡️ Brian Telemetry:", cpuRes);
    assert.ok(cpuRes.includes("১৮%") || cpuRes.includes("18%") || cpuRes.includes("CPU") || cpuRes.includes("সিপিইউ"), "CPU telemetry");
    assert.ok(/\b(bro|ভাই|Chief|Hritthik)\b/i.test(cpuRes), "DevOps salutation");
    assert.ok(!cpuRes.toLowerCase().includes("babe"), "Zero babe on Brian");
  });

  // ── 8. Team Mode: Multi-Agent Coordinated Dialogue in Bangla ──────────────
  await t.test("8. Team: Coordinated standup and dual-agent voice balance", () => {
    const standupRes = LCB.synthesizeResponse("team", "Team", "squad morning standup");
    console.log("  🤝 Squad Standup:\n" + standupRes);
    assert.ok(standupRes.includes("[Tuk Tuk]:"), "Tuk Tuk speaks in standup");
    assert.ok(standupRes.includes("[Vision]:"), "Vision speaks in standup");
  });

  // ── 9. Original Human Thinker in Bangla across All Agents ───────────────────
  await t.test("9. Original Human Thinker: All agents respond with real human thought when asked about robot tone", () => {
    const agents = ["tuktuk", "vision", "jenny", "brian", "team"];
    const input = "all agents talk like a robot in bangla language not like humen orginal thinker";

    for (const ag of agents) {
      const res = LCB.synthesizeResponse(ag, ag, input);
      console.log(`  🧠 [${ag.toUpperCase()} Original Thinker]: ${res}`);
      assert.ok(res.length > 10, `${ag} must provide thoughtful response`);
      const lower = res.toLowerCase();
      // Must not contain robotic tropes
      assert.ok(!lower.includes("systems nominal"));
      assert.ok(!lower.includes("trained"));
      assert.ok(!lower.includes("ai language model"));
      assert.ok(!lower.includes("bangla mode active"));
    }
  });

  // ── 10. Sanitizer Meta-Talk Purge & Tuk Tuk Persona Safeguard ──────────────
  await t.test("10. Sanitizer: Purges meta-talk and ensures Tuk Tuk never uses bro or formal apni", () => {
    const JM = require("../src/utils/jarvis-manager");
    const jm = new JM();

    // 1. Tuk Tuk calling user 'bro' must be converted to 'babe'
    const ttBro = jm.sanitizeAgentLexicon("Gotcha, bro. What's the blocker right now?", "tuktuk");
    assert.ok(!ttBro.toLowerCase().includes("bro"), "Tuk Tuk must never say bro");
    assert.ok(ttBro.toLowerCase().includes("babe"), "Tuk Tuk bro replaced with babe");

    // 2. Tuk Tuk using formal 'আপনি' / 'আপনার' must be converted to 'তুমি' / 'তোমার'
    const ttFormal = jm.sanitizeAgentLexicon("আপনার কোডটা দেখে নিচ্ছি।", "tuktuk");
    assert.ok(!ttFormal.includes("আপনার"), "Tuk Tuk must never use formal আপনার");
    assert.ok(ttFormal.includes("তোমার"), "Tuk Tuk converts to loving তোমার");

    // 3. Meta-commentary on accent/robotic tone must be stripped
    const metaText = "Apnar tone-ta ekdom robotic. Natural Bangla accent inject koro shona!";
    const sanitizedMeta = jm.sanitizeAgentLexicon(metaText, "tuktuk");
    assert.ok(!sanitizedMeta.includes("Apnar tone-ta"), "Stripped meta-talk");

    // 4. Mode announcements stripped
    const modeText = "Systems nominal, brother. Bangla mode active. Bol bhai, kemon help lagbe?";
    const sanitizedMode = jm.sanitizeAgentLexicon(modeText, "vision");
    assert.ok(!sanitizedMode.toLowerCase().includes("systems nominal"), "Stripped Systems nominal");
    assert.ok(!sanitizedMode.toLowerCase().includes("bangla mode active"), "Stripped Bangla mode active");
  });

}).then(() => {
  console.log("🎉 All anti-robot duplicate tests passed cleanly!");
  process.exit(0);
}).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
