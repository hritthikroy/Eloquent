const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

describe("Conversational Self-Repair & Dynamic Self-Healing", () => {
  let jarvis;
  const testUserData = path.join(__dirname, "test-user-data-repair");

  before(() => {
    if (!fs.existsSync(testUserData)) fs.mkdirSync(testUserData, { recursive: true });
    jarvis = new JarvisManager(testUserData);
    jarvis.config.userName = "Hritthik";
  });

  after(() => {
    if (fs.existsSync(testUserData)) {
      try { fs.rmSync(testUserData, { recursive: true, force: true }); } catch (_) {}
    }
  });

  it("1. detectConversationalRepair identifies explicit corrections", () => {
    const r1 = jarvis.detectConversationalRepair("No, not React, I meant Svelte");
    assert.ok(r1, "Should detect 'No, not X, I meant Y'");
    assert.strictEqual(r1.detected, true);
    assert.ok(r1.correction.toLowerCase().includes("svelte"));

    const r2 = jarvis.detectConversationalRepair("Actually, I meant dark mode");
    assert.ok(r2);
    assert.ok(r2.correction.toLowerCase().includes("dark mode"));

    const r3 = jarvis.detectConversationalRepair("Correction: use port 8080 instead");
    assert.ok(r3);
    assert.ok(r3.correction.toLowerCase().includes("port 8080"));

    const r4 = jarvis.detectConversationalRepair("That's wrong, it should be Node 22");
    assert.ok(r4);

    const r5 = jarvis.detectConversationalRepair("Bhul hoyeche, eta Go backend hobe");
    assert.ok(r5);

    const r6 = jarvis.detectConversationalRepair("Galti ho gayi, ye MongoDB nahi PostgreSQL hai");
    assert.ok(r6);
  });

  it("2. returns null for ordinary non-correction dialogue", () => {
    const r = jarvis.detectConversationalRepair("Let's build the new vision dashboard today.");
    assert.strictEqual(r, null);
  });

  it("3. learnFromInteraction updates memory and prunes conflicting preferences on repair", () => {
    // Initial state
    jarvis.memory.learnedPreferences = ["Prefers: Angular framework", "Theme: light"];

    // User corrects: "No, not Angular, I meant Next.js"
    jarvis.learnFromInteraction("No, not Angular, I meant Next.js", "Got it, switching to Next.js!", "Tuk Tuk");

    // Check recentLearnings has Conversational Repair
    const repairLearning = jarvis.memory.recentLearnings.find(l => l.topic === "Conversational Repair");
    assert.ok(repairLearning, "Recent learnings should store Conversational Repair insight");
    assert.ok(repairLearning.insight.includes("Next.js"));
    assert.ok(repairLearning.salience >= 0.95, "Salience should be high priority >= 0.95");

    // Check that Angular was pruned from learnedPreferences
    const hasAngular = jarvis.memory.learnedPreferences.some(p => p.toLowerCase().includes("angular"));
    assert.strictEqual(hasAngular, false, "Old contradictory preference 'Angular' should be pruned");

    // Check that Next.js preference was added
    const hasNext = jarvis.memory.learnedPreferences.some(p => p.toLowerCase().includes("next.js"));
    assert.strictEqual(hasNext, true, "New corrected preference should be present");
  });

  it("4. LocalCognitiveBrain synthesizes dynamic self-repair responses across languages", () => {
    // Tuk Tuk Bengali
    const ttBengali = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Bhul hoyeche, nijeke correct koro");
    assert.ok(ttBengali.includes("correct") || ttBengali.includes("Bujhte perechi"));

    // Tuk Tuk Hindi
    const ttHindi = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Galti ho gayi, fix yourself");
    assert.ok(ttHindi.includes("Samajh gayi") || ttHindi.includes("correct"));

    // Tuk Tuk English
    const ttEng = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "No I meant use dark mode instead");
    assert.ok(ttEng.includes("self-corrected") || ttEng.includes("babe"));

    // Vision / Andrew
    const visionResp = LocalCognitiveBrain.synthesizeResponse("andrew", "Andrew", "Fix that error and repair parameters");
    assert.ok(visionResp.includes("self-corrected") || visionResp.includes("auto-healed") || visionResp.includes("brother"));
  });

  it("5. learnFromInteraction captures multilingual preferences and team praise", () => {
    // Bengali preference
    jarvis.learnFromInteraction("Amar pochondo Tailwind CSS and TypeScript", "Noted babe!", "Tuk Tuk");
    const hasTailwind = jarvis.memory.learnedPreferences.some(p => p.toLowerCase().includes("tailwind"));
    assert.strictEqual(hasTailwind, true, "Should capture Bengali 'Amar pochondo' preference");

    // Positive team praise
    jarvis.learnFromInteraction("Shabash Vision, great work!", "Thank you bro!", "Vision");
    const praiseLearning = jarvis.memory.recentLearnings.find(l => l.topic === "Team Synergy" || l.insight.includes("workflow feedback"));
    assert.ok(praiseLearning, "Should record positive team feedback");
  });

  it("6. LocalCognitiveBrain handles rapid fragments and friendly team bonding", () => {
    const fragmentBengali = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "bolo");
    assert.ok(fragmentBengali.includes("babe") || fragmentBengali.includes("Shunchhi"));

    const praiseVision = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "shabash bhai");
    assert.ok(praiseVision.includes("brother") || praiseVision.includes("momentum"));

    const teamResp = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "How are we doing squad?");
    assert.ok(teamResp.includes("[Tuk Tuk]") && teamResp.includes("[Vision]"));
  });
});
