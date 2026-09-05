const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { WebsiteBuilderEngine, websiteBuilder } = require("../src/utils/website-builder");
const actionRunner = require("../src/utils/action-runner");

test("Vision Autonomous Voice Website Builder Suite", async (t) => {
  const engine = new WebsiteBuilderEngine();
  const activeVision = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };

  await t.test("1. Topic Extraction from Voice Prompts", () => {
    const topic1 = engine._extractTopic("Vision build a modern website for AI SaaS Startup");
    assert.equal(topic1, "AI SaaS Startup");

    const topic2 = engine._extractTopic("ekta landing page build kor for NextGen Blockchain in Banglish");
    assert.ok(topic2.includes("NextGen Blockchain"));
  });

  await t.test("2. Full Multi-File Web App Generation (HTML, CSS, JS)", async () => {
    const res = await engine.buildWebsiteFromVoice("build a website for Autonomous Dev Studio", { openBrowser: false });
    assert.equal(res.success, true);
    assert.equal(res.filesGenerated.length, 3);
    assert.ok(fs.existsSync(path.join(res.projectPath, "index.html")));
    assert.ok(fs.existsSync(path.join(res.projectPath, "styles.css")));
    assert.ok(fs.existsSync(path.join(res.projectPath, "app.js")));

    const html = fs.readFileSync(path.join(res.projectPath, "index.html"), "utf8");
    assert.ok(html.includes("Autonomous Dev Studio"));
    assert.ok(html.includes("Live System Console"));
    assert.ok(html.includes("styles.css"));
    assert.ok(html.includes("app.js"));
  });

  await t.test("3. ActionRunner Spoken Command Integration for Vision", async () => {
    const spokenRes = await actionRunner.handleAction(
      "Vision build a modern website for Cyberpunk AI Platform",
      activeVision
    );
    assert.equal(spokenRes.handled, true);
    assert.equal(spokenRes.agentName, "Vision");
    assert.ok(spokenRes.speech.includes("Vision here"));
    assert.ok(spokenRes.speech.includes("Cyberpunk AI Platform"));
  });
});
