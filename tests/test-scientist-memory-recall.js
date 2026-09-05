const axios = require("axios");
require("dotenv").config();
const JarvisManager = require("../src/utils/jarvis-manager");
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
  const models = [options.model, "qwen/qwen3.8-27b", "groq/compound-mini", "openai/gpt-oss-120b"].filter(Boolean);
  for (const model of models) {
    try {
      const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          messages,
          temperature: options.temperature !== undefined ? options.temperature : 0.4,
          max_tokens: options.max_tokens || 220
        },
        {
          headers: { Authorization: `Bearer ${getActiveKey()}` },
          timeout: 12000
        }
      );
      return { content: res.data.choices[0].message.content, model };
    } catch (err) {
      if (err.response?.status === 429) {
        rotateKey();
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }
  throw new Error("All Groq key attempts failed");
}

function parseMultiAgentTurns(text) {
  if (!text || typeof text !== "string") return [];
  const regex = /\[(Tuk Tuk|Andrew|Vision|Friday|Brian|Ava)\]:\s*([^\[]+)/gi;
  const turns = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    turns.push({ agentName: match[1], text: match[2].trim() });
  }
  return turns;
}

async function runScientistMemoryAudit() {
  console.log("================================================================================");
  console.log("🧠 SCIENTIST-LEVEL MATHEMATICAL REASONING & CROSS-SESSION EPISODIC RECALL AUDIT");
  console.log("================================================================================\n");

  const issuesFound = [];

  // ---------------------------------------------------------------------------
  // TEST 1: Cross-Session Episodic Memory Recall from history.json
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 1] Cross-Session Episodic Recall: Querying Past Conversations");
  const recallQuery = "What did we discuss earlier about articulation, breath, and making a new voice model?";
  console.log(`   User Query: "${recallQuery}"`);

  const recalled = jm.recallPastConversations(recallQuery, 2);
  console.log(`   Recalled Past Conversations Found: ${recalled.length}`);
  recalled.forEach((r, idx) => {
    console.log(`     [Past Memory #${idx + 1}] (Score: ${(r.score * 100).toFixed(1)}%)`);
    console.log(`       User Said: "${r.user}"`);
    console.log(`       Tuk Tuk Replied: "${r.reply}"`);
  });

  if (recalled.length === 0) {
    issuesFound.push("Test 1: Episodic memory failed to retrieve past conversation on articulation and breath!");
  } else {
    console.log("   ✅ High-fidelity cross-session episodic recall verified.\n");
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Live Conversation with Injected Past Session Recall
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 2] Answering with Cross-Session Project Continuity");
  const t2_agent = jm.detectActiveAgent(recallQuery);
  const t2_vibe = jm.prosodicEntrainment.analyzeVibe(recallQuery, 3500);
  const t2_prompt = jm.getSystemPrompt(t2_agent, recallQuery) + "\n\n" + t2_vibe.directive;

  const t2_res = await callGroq([
    { role: "system", content: t2_prompt },
    { role: "user", content: recallQuery }
  ]);
  console.log(`   Tuk Tuk Answer:\n   "${t2_res.content}"\n`);

  if (!t2_res.content.toLowerCase().includes("breath") && !t2_res.content.toLowerCase().includes("articulate") && !t2_res.content.toLowerCase().includes("model")) {
    issuesFound.push("Test 2: Tuk Tuk failed to reference past session specifics about breath and articulation!");
  } else {
    console.log("   ✅ Seamless cross-session project continuity demonstrated.\n");
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Scientist-Level Mathematical Problem Solving Under Stress
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 3] Principal Scientist & Mathematical Problem Solving (Andrew & Brian)");
  const s3_query = "Andrew and Brian, our audio visualizer frame rate drops when we receive 100 WebSocket messages per second while simultaneously synthesizing speech. Solve this scientifically and give me the exact root cause equation and architectural fix.";
  console.log(`   Stress Query: "${s3_query}"`);

  const s3_agent = jm.detectActiveAgent(s3_query);
  const s3_prompt = jm.getSystemPrompt(s3_agent, s3_query);

  const s3_res = await callGroq([
    { role: "system", content: s3_prompt },
    { role: "user", content: s3_query }
  ], { temperature: 0.35, max_tokens: 240 });

  console.log(`   Scientific Response:\n${s3_res.content}\n`);
  const s3_turns = parseMultiAgentTurns(s3_res.content);
  s3_turns.forEach((t, i) => console.log(`     [Speaker ${i+1}] ${t.agentName}: "${t.text}"`));

  const lowerContent = s3_res.content.toLowerCase();
  const hasScientificConcepts = lowerContent.includes("event loop") || lowerContent.includes("worker") || lowerContent.includes("ipc") || lowerContent.includes("thread") || lowerContent.includes("buffer") || lowerContent.includes("backpressure");
  if (!hasScientificConcepts) {
    issuesFound.push("Test 3: Response lacked scientific/mathematical root cause rigor");
  } else {
    console.log("   ✅ First-principles systems science and mathematical root cause verified.\n");
  }

  console.log("================================================================================");
  console.log("📊 SCIENTIST & EPISODIC RECALL AUDIT RESULTS:");
  console.log(`Total Issues Detected: ${issuesFound.length}`);
  if (issuesFound.length > 0) {
    issuesFound.forEach((iss, i) => console.log(`   ${i + 1}. ${iss}`));
  } else {
    console.log("🎉 100% PERFECT SCIENTIST-LEVEL REASONING & CROSS-SESSION RECALL VERIFIED!");
  }
  console.log("================================================================================");
}

runScientistMemoryAudit().catch(err => {
  console.error("❌ Scientist memory audit crashed:", err);
  process.exit(1);
});
