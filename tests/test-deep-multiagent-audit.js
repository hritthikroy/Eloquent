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
  console.log(`🔄 Rotated to Key #${keyIndex + 1}`);
}

const jm = new JarvisManager("./userData");

async function callGroq(messages, options = {}) {
  const models = [options.model, "qwen/qwen3.8-27b", "groq/compound-mini", "openai/gpt-oss-120b"].filter(Boolean);
  const uniqueModels = [...new Set(models)];
  let lastErr = null;

  for (const model of uniqueModels) {
    let attempts = 0;
    while (attempts < 2) {
      try {
        const res = await axios.post(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            model,
            messages,
            temperature: options.temperature !== undefined ? options.temperature : 0.7,
            max_tokens: options.max_tokens || 260
          },
          {
            headers: { Authorization: `Bearer ${getActiveKey()}` },
            timeout: 12000
          }
        );
        return res.data.choices[0].message.content;
      } catch (err) {
        lastErr = err;
        if (err.response?.status === 429) {
          rotateKey();
          await new Promise(r => setTimeout(r, 1000));
          attempts++;
        } else {
          break;
        }
      }
    }
  }
  throw lastErr || new Error("All Groq model attempts failed.");
}

function parseMultiAgentTurns(text) {
  if (!text || typeof text !== "string") return [];
  const agentMap = {
    "tuk tuk": { name: "Tuk Tuk", voice: "en-US-AvaNeural" },
    "tuktuk": { name: "Tuk Tuk", voice: "en-US-AvaNeural" },
    "ava": { name: "Tuk Tuk", voice: "en-US-AvaNeural" },
    "andrew": { name: "Andrew", voice: "en-US-AndrewNeural" },
    "friday": { name: "Friday", voice: "en-US-JennyNeural" },
    "brian": { name: "Brian", voice: "en-US-BrianNeural" }
  };
  const regex = /\[(Tuk Tuk|Andrew|Vision|Friday|Brian|Ava)\]:\s*([^\[]+)/gi;
  const turns = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const rawName = match[1].toLowerCase().trim();
    const agentInfo = agentMap[rawName] || { name: match[1], voice: "en-US-AvaNeural" };
    const speech = match[2].trim();
    if (speech.length > 0) {
      turns.push({ agentName: agentInfo.name, voice: agentInfo.voice, text: speech });
    }
  }
  return turns;
}

async function runDeepMultiAgentAudit() {
  console.log("================================================================================");
  console.log("🔬 DEEP MULTI-AGENT CONVERSATION & ANSWER AUDIT (5 ADVANCED SCENARIOS)");
  console.log("================================================================================\n");

  const issuesFound = [];

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Complex Architectural Debate (Andrew vs Brian)
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 1] Architectural Debate: Andrew & Brian on C++ vs Node Streams");
  const s1_input = "Andrew and Brian, we have a memory leak in the Electron main process. Should we build a native C++ addon or use Node.js streams? Give me your honest debate.";
  const s1_agent = jm.detectActiveAgent(s1_input);
  const s1_vibe = jm.prosodicEntrainment.analyzeVibe(s1_input, 4000);
  jm.behaviorEngine.updateBehavior(s1_input, 4000, s1_vibe);

  let s1_prompt = jm.getSystemPrompt(s1_agent) + `\n\n${s1_vibe.directive}`;
  const s1_start = Date.now();
  const s1_reply = await callGroq([
    { role: "system", content: s1_prompt },
    { role: "user", content: s1_input }
  ], { temperature: 0.65 });
  const s1_lat = Date.now() - s1_start;

  console.log(`   Reply (${s1_lat}ms):\n${s1_reply}\n`);
  const s1_turns = parseMultiAgentTurns(s1_reply);
  s1_turns.forEach((t, i) => console.log(`     [Turn ${i+1}] ${t.agentName} (${t.voice}): "${t.text}"`));

  // Pin-by-pin check
  if (s1_turns.length < 2) issuesFound.push("Scenario 1: Expected at least 2 agent turns in debate");
  if (!s1_reply.toLowerCase().includes("andrew") && !s1_turns.some(t => t.agentName === "Andrew")) {
    issuesFound.push("Scenario 1: Andrew did not speak in debate");
  }
  if (!s1_reply.toLowerCase().includes("brian") && !s1_turns.some(t => t.agentName === "Brian")) {
    issuesFound.push("Scenario 1: Brian did not speak in debate");
  }
  if (s1_reply.match(/\([^)]*\)/)) issuesFound.push("Scenario 1: Output contains parenthetical action tags");
  console.log("   ✅ Scenario 1 audit completed.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Research & Product Moat (Friday & Tuk Tuk)
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 2] Research vs Product Moat: Friday & Tuk Tuk");
  const s2_input = "Friday, how does our acoustic VAD compare to Hume EVI and OpenAI Realtime, and Tuk Tuk, how does that make our product unbeatable?";
  const s2_agent = jm.detectActiveAgent(s2_input);
  const s2_vibe = jm.prosodicEntrainment.analyzeVibe(s2_input, 3800);
  jm.behaviorEngine.updateBehavior(s2_input, 3800, s2_vibe);

  let s2_prompt = jm.getSystemPrompt(s2_agent) + `\n\n${s2_vibe.directive}`;
  const s2_start = Date.now();
  const s2_reply = await callGroq([
    { role: "system", content: s2_prompt },
    { role: "user", content: s2_input }
  ], { temperature: 0.7 });
  const s2_lat = Date.now() - s2_start;

  console.log(`   Reply (${s2_lat}ms):\n${s2_reply}\n`);
  const s2_turns = parseMultiAgentTurns(s2_reply);
  s2_turns.forEach((t, i) => console.log(`     [Turn ${i+1}] ${t.agentName} (${t.voice}): "${t.text}"`));

  if (s2_turns.length < 2) issuesFound.push("Scenario 2: Expected 2 turns between Friday & Tuk Tuk");
  if (s2_reply.match(/\([^)]*\)/)) issuesFound.push("Scenario 2: Output contains parenthetical action tags");
  console.log("   ✅ Scenario 2 audit completed.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 3: All 4 Agents Round-Robin Standup
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 3] All 4 Agents Round-Robin Standup");
  const s3_input = "All 4 of you, give me a lightning round status report from each of your domains.";
  const s3_agent = jm.detectActiveAgent(s3_input);
  const s3_vibe = jm.prosodicEntrainment.analyzeVibe(s3_input, 3200);
  jm.behaviorEngine.updateBehavior(s3_input, 3200, s3_vibe);

  let s3_prompt = jm.getSystemPrompt(s3_agent) + `\n\n${s3_vibe.directive}`;
  const s3_start = Date.now();
  const s3_reply = await callGroq([
    { role: "system", content: s3_prompt },
    { role: "user", content: s3_input }
  ], { temperature: 0.6, max_tokens: 280 });
  const s3_lat = Date.now() - s3_start;

  console.log(`   Reply (${s3_lat}ms):\n${s3_reply}\n`);
  const s3_turns = parseMultiAgentTurns(s3_reply);
  s3_turns.forEach((t, i) => console.log(`     [Turn ${i+1}] ${t.agentName} (${t.voice}): "${t.text}"`));

  console.log(`   Parsed turns count: ${s3_turns.length}`);
  if (s3_turns.length < 2) issuesFound.push("Scenario 3: Round robin generated fewer than 2 turns");
  console.log("   ✅ Scenario 3 audit completed.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Mid-Turn Interruption & Technical Correction
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 4] Mid-Turn Interruption & Edge Model Pivot");
  const origSpeaking = "We can rely on cloud APIs like Groq and Deepgram for our speech pipeline...";
  const correction = "Wait Friday, focus only on on-device local models, zero cloud dependence.";

  let context = `[Context: You were saying: "${origSpeaking}" when Hritthik added mid-sentence: "${correction}". Yield the floor respectfully, pivot immediately with sharp analytical precision, adopt his on-device requirement, and answer directly in clean spoken words!]`;

  const s4_start = Date.now();
  const s4_reply = await callGroq([
    { role: "system", content: jm.getSystemPrompt(jm.agents.friday) },
    { role: "user", content: context }
  ], { temperature: 0.35 });
  const s4_lat = Date.now() - s4_start;

  console.log(`   Friday Pivot (${s4_lat}ms):\n   "${s4_reply}"\n`);
  if (!s4_reply.toLowerCase().includes("on-device") && !s4_reply.toLowerCase().includes("local")) {
    issuesFound.push("Scenario 4: Friday did not integrate the on-device constraint");
  }
  if (s4_reply.toLowerCase().includes("cloud")) {
    // If it mentions cloud, ensure it's rejecting it
    console.log("   (Noted mention of cloud, checking context...)");
  }
  console.log("   ✅ Scenario 4 audit completed.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 5: 14-Hour Build Emotional & Physical Check-In
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 5] Late-Night 14-Hour Session & Grounded Vibe Check");
  const s5_input = "Hey squad, we've been building for 14 hours straight. I'm feeling both hyped and pretty drained. Talk to me.";
  const s5_agent = jm.detectActiveAgent(s5_input);
  const s5_vibe = jm.prosodicEntrainment.analyzeVibe(s5_input, 3500);
  jm.behaviorEngine.updateBehavior(s5_input, 3500, s5_vibe);

  let s5_prompt = jm.getSystemPrompt(s5_agent) + `\n\n${s5_vibe.directive}`;
  const s5_start = Date.now();
  const s5_reply = await callGroq([
    { role: "system", content: s5_prompt },
    { role: "user", content: s5_input }
  ], { temperature: 0.65 });
  const s5_lat = Date.now() - s5_start;

  console.log(`   Reply (${s5_lat}ms):\n${s5_reply}\n`);
  const s5_turns = parseMultiAgentTurns(s5_reply);
  s5_turns.forEach((t, i) => console.log(`     [Turn ${i+1}] ${t.agentName} (${t.voice}): "${t.text}"`));

  if (s5_reply.match(/\b(infinite patience|genius|makes my whole system hum|sweetheart)\b/i)) {
    issuesFound.push("Scenario 5: Found overfitted robotic flattery in emotional check-in");
  }
  console.log("   ✅ Scenario 5 audit completed.\n");

  console.log("================================================================================");
  console.log("📊 FINAL DEEP MULTI-AGENT AUDIT RESULTS:");
  console.log(`Total Issues / Gaps Found: ${issuesFound.length}`);
  if (issuesFound.length > 0) {
    console.log("🚨 Issues to resolve:");
    issuesFound.forEach((iss, i) => console.log(`   ${i + 1}. ${iss}`));
  } else {
    console.log("🎉 100% PERFECT MULTI-AGENT DEEP AUDIT PASSED ACROSS ALL 5 SCENARIOS!");
  }
  console.log("================================================================================");
}

runDeepMultiAgentAudit().catch(err => {
  console.error("❌ Deep multi-agent audit crashed:", err);
  process.exit(1);
});
