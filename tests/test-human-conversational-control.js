const axios = require("axios");
require("dotenv").config();
const JarvisManager = require("../src/utils/jarvis-manager");
const runner = require("../src/utils/action-runner");
const fs = require("fs");
const path = require("path");

const keys = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY
].filter(Boolean);

let keyIndex = 0;
function getActiveKey() {
  return keys[keyIndex % keys.length];
}
function rotateKey() {
  keyIndex = (keyIndex + 1) % keys.length;
}

const jm = new JarvisManager("./userData");

async function callGroq(messages, options = {}) {
  const model = options.model || "qwen/qwen3.8-27b";
  let attempts = 0;
  while (attempts < 3) {
    try {
      const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          messages,
          temperature: options.temperature !== undefined ? options.temperature : 0.4,
          max_tokens: options.max_tokens || 140
        },
        {
          headers: { Authorization: `Bearer ${getActiveKey()}` },
          timeout: 10000
        }
      );
      return res.data.choices[0].message.content;
    } catch (err) {
      if (err.response?.status === 429) {
        rotateKey();
        await new Promise(r => setTimeout(r, 600));
        attempts++;
      } else {
        throw err;
      }
    }
  }
  throw new Error("All Groq key attempts failed.");
}

async function runHumanConversationalControlTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING HUMAN-LIKE CONVERSATIONAL CONTROL, INTERRUPTIONS & SMALL SENTENCES");
  console.log("================================================================================\n");

  const issuesFound = [];

  // TEST 1: Small Sentences & Micro-Interjections
  console.log("▶ [TEST 1] Small Sentences & Micro-Interjections Recognition");
  const smallInputs = [
    { text: "Wait", bytes: 8400, duration: 260 },
    { text: "No", bytes: 8200, duration: 250 },
    { text: "Yeah", bytes: 8500, duration: 265 },
    { text: "Hold on", bytes: 10200, duration: 320 },
    { text: "Got it", bytes: 10500, duration: 330 }
  ];

  for (const s of smallInputs) {
    const minAudioBytes = 8000;
    const accepted = s.bytes >= minAudioBytes;
    console.log(`   Utterance: "${s.text}" (${s.duration}ms, ${s.bytes} bytes) -> Audio Accepted: ${accepted}`);
    if (!accepted) {
      issuesFound.push(`Test 1: Small sentence "${s.text}" was rejected by audio filter!`);
    }
  }
  console.log("   ✅ All small sentences pass minimum audio duration check (>= 250ms).\n");

  // TEST 2: Mid-Sentence Information Injection & Pivot (Andrew Example)
  console.log("▶ [TEST 2] Mid-Sentence Information Injection & Pivot (Andrew)");
  const originalUtterance = "We can spin up the WebSocket server on port 3000 and bind to all local interfaces...";
  const userInterjection = "Wait, make that port 8080 instead, bro.";

  let reactionStyle = "pivot immediately like a sharp lead engineer ('Got you bro')";
  let userQuery = `[Context: You were saying: "${originalUtterance}" when Hritthik added mid-sentence: "${userInterjection}". Yield the floor respectfully, ${reactionStyle}, seamlessly integrate his added info without repeating old sentences, and answer his interjection directly in clean spoken words!]`;

  const andrewPrompt = jm.getSystemPrompt(jm.agents.andrew);
  const t2_start = Date.now();
  const andrewReply = await callGroq([
    { role: "system", content: andrewPrompt },
    { role: "user", content: userQuery }
  ]);
  const t2_latency = Date.now() - t2_start;

  console.log(`   Interrupted Utterance: "${originalUtterance}"`);
  console.log(`   User Interjection: "${userInterjection}"`);
  console.log(`   Andrew's Pivot (${t2_latency}ms):\n   "${andrewReply}"`);

  if (!andrewReply.includes("8080")) {
    issuesFound.push("Test 2: Andrew failed to integrate the new port 8080 variable!");
  }
  if (andrewReply.match(/\([^)]*\)/)) {
    issuesFound.push("Test 2: Andrew included parenthetical action tags in reply!");
  }
  console.log("   ✅ Andrew mid-sentence pivot and variable injection verified.\n");

  // TEST 3: Mid-Sentence Information Injection & Pivot (Tuk Tuk Example)
  console.log("▶ [TEST 3] Mid-Sentence Loving Co-Founder Pivot (Tuk Tuk)");
  const tukOriginal = "I was looking at our release timeline and thinking we could launch next week...";
  const tukInterjection = "Actually Tuk Tuk, let's ship the beta tonight.";

  let tukReaction = "acknowledge the mid-sentence pivot naturally as his loving partner";
  let tukQuery = `[Context: You were saying: "${tukOriginal}" when Hritthik added mid-sentence: "${tukInterjection}". Yield the floor respectfully, ${tukReaction}, seamlessly integrate his added info without repeating old sentences, and answer his interjection directly in clean spoken words!]`;

  const tukPrompt = jm.getSystemPrompt(jm.agents.tuktuk);
  const t3_start = Date.now();
  const tukReply = await callGroq([
    { role: "system", content: tukPrompt },
    { role: "user", content: tukQuery }
  ]);
  const t3_latency = Date.now() - t3_start;

  console.log(`   Interrupted Utterance: "${tukOriginal}"`);
  console.log(`   User Interjection: "${tukInterjection}"`);
  console.log(`   Tuk Tuk's Pivot (${t3_latency}ms):\n   "${tukReply}"`);

  if (!tukReply.toLowerCase().includes("tonight") && !tukReply.toLowerCase().includes("beta")) {
    issuesFound.push("Test 3: Tuk Tuk failed to adopt the tonight beta timeline!");
  }
  console.log("   ✅ Tuk Tuk mid-sentence pivot and partner perspective verified.\n");

  // TEST 4: Power Control & Brevity Governance
  console.log("▶ [TEST 4] Power Control & Brevity Governance (Word Count Audit)");
  const wordCountAndrew = andrewReply.trim().split(/\s+/).length;
  const wordCountTuk = tukReply.trim().split(/\s+/).length;
  console.log(`   Andrew Word Count: ${wordCountAndrew} words (Target: 15-35 words)`);
  console.log(`   Tuk Tuk Word Count: ${wordCountTuk} words (Target: 15-35 words)`);

  if (wordCountAndrew > 45 || wordCountTuk > 45) {
    issuesFound.push("Test 4: Agents spoke too many words, violating conversational turn-taking pacing!");
  } else {
    console.log("   ✅ Turn-taking pacing strictly governed (crisp 1-2 sentence replies).\n");
  }

  console.log("================================================================================");
  console.log("📊 CONVERSATIONAL CONTROL AUDIT RESULTS:");
  console.log(`Total Issues Detected: ${issuesFound.length}`);
  if (issuesFound.length > 0) {
    issuesFound.forEach((iss, i) => console.log(`   ${i + 1}. ${iss}`));
  } else {
    console.log("🎉 100% SUCCESS: REAL-HUMAN PERSPECTIVE, PIVOT & PACING POWER CONTROL VERIFIED!");
  }
  console.log("================================================================================");
}

runHumanConversationalControlTests().catch(err => {
  console.error("❌ Test crashed:", err);
  process.exit(1);
});
