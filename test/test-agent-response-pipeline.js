const assert = require("assert");
const fs = require("fs");
const path = require("path");
const projectRoot = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });
const rawAxios = require("axios");
const axios = rawAxios.default || rawAxios;

const JarvisManager = require("../src/utils/jarvis-manager");
const jarvisManager = new JarvisManager(path.join(projectRoot, "userData"));
const actionRunner = require("../src/utils/action-runner");
const { GeminiClient } = require("../src/utils/gemini-client");

async function runTests() {
  console.log("=================================================");
  console.log("🧪 AGENT RESPONSE PIPELINE VERIFICATION SUITE");
  console.log("=================================================\n");

  // -------------------------------------------------------------
  // Test 1: isIndicAcousticHallucination
  // -------------------------------------------------------------
  console.log("1️⃣ Testing isIndicAcousticHallucination filter...");
  const mainContent = fs.readFileSync(path.join(projectRoot, "src/main.js"), "utf8");
  const indicMatch = mainContent.match(/function isIndicAcousticHallucination[\s\S]*?\n\}/);
  if (!indicMatch) throw new Error("Could not find isIndicAcousticHallucination in src/main.js");
  eval(indicMatch[0]);

  const validQueries = [
    "Hey Tuk Tuk, how are you?",
    "Tuk Tuk.",
    "Englishy misi misi bolo,.",
    "Tuk Tuk kemon acho?",
    "টুক টুক কেমন আছো?",
    "Hello Andrew",
    "ধীরে ধীরে বলো",
    "না না ঠিক আছে",
    "Brian system status check koro"
  ];

  for (const q of validQueries) {
    const isHallucination = isIndicAcousticHallucination(q);
    assert.strictEqual(isHallucination, false, `Expected "${q}" to NOT be discarded as hallucination!`);
    console.log(`   ✅ "${q}" -> PASS (NOT discarded)`);
  }

  // Corrupted Indic loop
  const corruptedQuery = "না না না না না না না না";
  assert.strictEqual(isIndicAcousticHallucination(corruptedQuery), true, "Expected 8x repeated Indic loop to be flagged!");
  console.log(`   ✅ "${corruptedQuery}" -> PASS (Correctly flagged as hallucination)`);

  // -------------------------------------------------------------
  // Test 2: isWhisperHallucination
  // -------------------------------------------------------------
  console.log("\n2️⃣ Testing isWhisperHallucination filter...");
  const whisperMatch = mainContent.match(/function isWhisperHallucination[\s\S]*?\n\}/);
  if (!whisperMatch) throw new Error("Could not find isWhisperHallucination in src/main.js");
  const SILENCE_HALLUCINATIONS = new Set(['you', 'bye', 'thank you', 'thanks']);
  eval(whisperMatch[0]);

  for (const q of ["Tuk Tuk", "Hey Tuk Tuk", "Hello Andrew", "Hey Brian"]) {
    const isH = isWhisperHallucination(q, 2000);
    assert.strictEqual(isH, false, `Expected "${q}" to NOT be discarded by isWhisperHallucination!`);
    console.log(`   ✅ "${q}" -> PASS (NOT discarded)`);
  }

  // -------------------------------------------------------------
  // Test 3: ActionRunner routing check for voice prompts
  // -------------------------------------------------------------
  console.log("\n3️⃣ Testing ActionRunner isFixDirective voice guard...");
  const voiceQuery = "Andrew fix your voice, remove this robotic sound";
  const mockAndrew = { key: "andrew", name: "Andrew", voice: "en-US-AndrewNeural" };
  const actionRes = await actionRunner.handleAction(voiceQuery, mockAndrew, jarvisManager, null, null);
  // It should NOT be handled as an Antigravity auto coding task!
  assert.strictEqual(actionRes.handled === true && actionRes.speech && actionRes.speech.includes("I am a text-based AI"), false,
    "Voice prompt should never trigger 'I am a text-based AI model' response!");
  console.log(`   ✅ "${voiceQuery}" -> PASS (Correctly bypassed auto-coding hijacking)`);

  // -------------------------------------------------------------
  // Test 4: Agent Persona Prompts & Lexicon Constraints for All 4 Agents
  // -------------------------------------------------------------
  console.log("\n4️⃣ Testing Agent Persona Prompts & Lexicon Constraints for All 4 Agents...");
  const agentsToTest = [
    { key: "tuktuk", name: "Tuk Tuk", expectedVoice: "en-US-AvaMultilingualNeural" },
    { key: "andrew", name: "Andrew", expectedVoice: "en-US-AndrewNeural" },
    { key: "brian", name: "Brian", expectedVoice: "en-US-BrianMultilingualNeural" },
    { key: "jenny", name: "Jenny", expectedVoice: "en-US-EmmaMultilingualNeural" }
  ];

  for (const agent of agentsToTest) {
    const agentDef = jarvisManager.agents[agent.key];
    assert.ok(agentDef, `Agent definition for ${agent.key} must exist`);
    assert.strictEqual(agentDef.voice, agent.expectedVoice, `Expected ${agent.name} voice to be ${agent.expectedVoice}`);
    
    const prompt = agentDef.getPrompt("Hritthik", "Hritthik");
    assert.ok(prompt.length > 50, `Prompt for ${agent.name} must be substantive`);
    assert.ok(prompt.includes(agent.name), `Prompt must include agent name ${agent.name}`);

    // Lexicon sanitization check: non-TukTuk agents must NEVER use "babe"
    if (agent.key !== "tuktuk") {
      const sanitized = jarvisManager.sanitizeAgentLexicon("Sure thing babe, let me check that.", agent.key, agent.expectedVoice);
      assert.strictEqual(sanitized.includes("babe"), false, `${agent.name} must never say babe!`);
      console.log(`   ✅ [${agent.name}]: Lexicon sanitization verified ("${sanitized}")`);
    } else {
      console.log(`   ✅ [${agent.name}]: Partner persona prompt verified (${prompt.length} chars)`);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 ALL AGENT RESPONSE PIPELINE TESTS PASSED (100%)");
  console.log("=================================================");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
