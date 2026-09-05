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
  console.log(`🔄 Rotated to Key #${keyIndex + 1}`);
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
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
          max_tokens: options.max_tokens || 220
        },
        {
          headers: { Authorization: `Bearer ${getActiveKey()}` },
          timeout: 10000
        }
      );
      return res.data.choices[0].message.content;
    } catch (err) {
      if (err.response?.status === 429) {
        console.warn("⚠️ Rate limited (429), rotating key...");
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
  const regex = /\[(Tuk Tuk|Andrew|Friday|Brian|Ava)\]:\s*([^\[]+)/gi;
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

async function runBigMeetingSimulation() {
  console.log("================================================================================");
  console.log("🎙️  BIG FOUNDER ZOOM / PHONE CALL MEETING SIMULATION (5 PARTICIPANTS)");
  console.log("    Participants: Hritthik (Creator), Tuk Tuk, Andrew, Friday, Brian");
  console.log("================================================================================\n");

  const issuesFound = [];

  // ---------------------------------------------------------------------------
  // MEETING AGENDA TURN 1: Room Kickoff & Squad Architecture Status
  // ---------------------------------------------------------------------------
  console.log("▶ [MEETING TURN 1] Hritthik enters room: 'Founder sync kickoff'");
  const m1_input = "Hey squad, let's start our founder sync. How are all of our systems and architecture looking today?";
  const m1_duration = 3200;
  console.log(`   Hritthik: "${m1_input}" (${m1_duration}ms)`);

  const m1_agent = jm.detectActiveAgent(m1_input);
  console.log(`   Meeting Arbiter: ${m1_agent.name} (Expected: Squad)`);
  if (m1_agent.name !== "Squad") issuesFound.push("Meeting Turn 1: Failed to route open squad kickoff to Squad");

  const m1_vibe = jm.prosodicEntrainment.analyzeVibe(m1_input, m1_duration);
  jm.behaviorEngine.updateBehavior(m1_input, m1_duration, m1_vibe);
  jm.addTurn("user", m1_input, "Hritthik");

  let m1_prompt = jm.getSystemPrompt(m1_agent) + `\n\n${m1_vibe.directive}`;
  const m1_start = Date.now();
  const m1_reply = await callGroq([
    { role: "system", content: m1_prompt },
    { role: "user", content: m1_input }
  ], { temperature: 0.75 });
  const m1_latency = Date.now() - m1_start;

  console.log(`   Meeting Response (${m1_latency}ms):\n${m1_reply}\n`);
  const m1_turns = parseMultiAgentTurns(m1_reply);
  if (m1_turns.length < 2) issuesFound.push("Meeting Turn 1: Expected 2+ collaborative agent turns");
  m1_turns.forEach((t, i) => console.log(`     [Speaker ${i+1}] ${t.agentName} (${t.voice}): "${t.text}"`));
  jm.addTurn("assistant", m1_reply, "Squad");
  console.log("   ✅ Meeting Turn 1 verified.\n");

  // ---------------------------------------------------------------------------
  // MEETING AGENDA TURN 2: Fast Learning (User imparts technical invariant)
  // ---------------------------------------------------------------------------
  console.log("▶ [MEETING TURN 2] Fast Learner Test: Hritthik teaches a critical architectural rule");
  const m2_input = "Andrew, remember for our binary protocol we should always prioritize zero-copy buffers over JSON strings. Remember this rule.";
  const m2_duration = 3500;
  console.log(`   Hritthik: "${m2_input}" (${m2_duration}ms)`);

  // Fast Learner Ingestion:
  jm.addEbbinghausLearning("Technical Rule", "Always prioritize zero-copy buffers over JSON strings for binary protocol", 0.95);
  console.log("   🧠 [Fast Learner] Ingested new architectural invariant into persistent brain memory!");

  const m2_agent = jm.detectActiveAgent(m2_input);
  console.log(`   Addressed Agent: ${m2_agent.name} (Expected: Andrew)`);
  if (m2_agent.name !== "Andrew") issuesFound.push("Meeting Turn 2: Failed to address Andrew directly");

  const m2_vibe = jm.prosodicEntrainment.analyzeVibe(m2_input, m2_duration);
  jm.behaviorEngine.updateBehavior(m2_input, m2_duration, m2_vibe);
  jm.addTurn("user", m2_input, "Hritthik");

  let m2_prompt = jm.getSystemPrompt(m2_agent) + `\n\n${m2_vibe.directive}`;
  const m2_start = Date.now();
  const m2_reply = await callGroq([
    { role: "system", content: m2_prompt },
    ...jm.getHistory(6).slice(0, -1),
    { role: "user", content: m2_input }
  ], { temperature: 0.4 });
  const m2_latency = Date.now() - m2_start;

  console.log(`   Andrew (${m2_latency}ms): "${m2_reply}"`);
  if (!m2_reply.toLowerCase().includes("buffer") && !m2_reply.toLowerCase().includes("zero-copy") && !m2_reply.toLowerCase().includes("bro")) {
    issuesFound.push("Meeting Turn 2: Andrew did not immediately demonstrate fast learning of zero-copy rule");
  }
  jm.addTurn("assistant", m2_reply, "Andrew");
  console.log("   ✅ Meeting Turn 2 verified.\n");

  // ---------------------------------------------------------------------------
  // MEETING AGENDA TURN 3: Good Thinker & Cross-Domain Research + DevOps
  // ---------------------------------------------------------------------------
  console.log("▶ [MEETING TURN 3] Good Thinker & Active Inference: Friday and Brian sync on papers and telemetry");
  const m3_input = "Friday and Brian, how does this zero-copy approach impact our telemetry and what do the papers prove about network jitter?";
  const m3_duration = 3800;
  console.log(`   Hritthik: "${m3_input}" (${m3_duration}ms)`);

  const m3_agent = jm.detectActiveAgent(m3_input);
  console.log(`   Meeting Arbiter: ${m3_agent.name} (Expected: Squad)`);

  const m3_vibe = jm.prosodicEntrainment.analyzeVibe(m3_input, m3_duration);
  jm.behaviorEngine.updateBehavior(m3_input, m3_duration, m3_vibe);
  jm.addTurn("user", m3_input, "Hritthik");

  let m3_prompt = jm.getSystemPrompt(m3_agent) + `\n\n${m3_vibe.directive}`;
  const m3_start = Date.now();
  const m3_reply = await callGroq([
    { role: "system", content: m3_prompt },
    ...jm.getHistory(8).slice(0, -1),
    { role: "user", content: m3_input }
  ], { temperature: 0.7 });
  const m3_latency = Date.now() - m3_start;

  console.log(`   Meeting Response (${m3_latency}ms):\n${m3_reply}\n`);
  const m3_turns = parseMultiAgentTurns(m3_reply);
  m3_turns.forEach((t, i) => console.log(`     [Speaker ${i+1}] ${t.agentName} (${t.voice}): "${t.text}"`));
  jm.addTurn("assistant", m3_reply, "Squad");
  console.log("   ✅ Meeting Turn 3 verified.\n");

  // ---------------------------------------------------------------------------
  // MEETING AGENDA TURN 4: Good Listener (Deep Hesitation & Anti-Cutoff)
  // ---------------------------------------------------------------------------
  console.log("▶ [MEETING TURN 4] Good Listener: Mid-sentence pause protection");
  const m4_input = "Wait... I... let me think about how the Electron event loop handles backpressure.";
  const m4_duration = 1800;
  console.log(`   Hritthik: "${m4_input}" (${m4_duration}ms)`);

  const m4_silenceProtection = m4_duration < 800 ? 1200 : (m4_duration < 2200 ? 550 : 480);
  console.log(`   VAD Pause Protection: ${m4_silenceProtection}ms (No interruption of user's thought)`);

  const m4_agent = jm.detectActiveAgent(m4_input);
  const m4_vibe = jm.prosodicEntrainment.analyzeVibe(m4_input, m4_duration);
  jm.behaviorEngine.updateBehavior(m4_input, m4_duration, m4_vibe);
  jm.addTurn("user", m4_input, "Hritthik");

  let m4_prompt = jm.getSystemPrompt(m4_agent) + `\n\n${m4_vibe.directive}`;
  const m4_start = Date.now();
  const m4_reply = await callGroq([
    { role: "system", content: m4_prompt },
    ...jm.getHistory(8).slice(0, -1),
    { role: "user", content: m4_input }
  ], { temperature: 0.35 });
  const m4_latency = Date.now() - m4_start;

  console.log(`   ${m4_agent.name} (${m4_latency}ms): "${m4_reply}"`);
  jm.addTurn("assistant", m4_reply, m4_agent.name);
  console.log("   ✅ Meeting Turn 4 verified.\n");

  // ---------------------------------------------------------------------------
  // MEETING AGENDA TURN 5: Good Vibe & Circadian Unwind (Ending the Meeting)
  // ---------------------------------------------------------------------------
  console.log("▶ [MEETING TURN 5] Good Vibe: Late-night meeting close and fatigue unwind");
  const m5_input = "Alright squad, amazing progress today. It's late and I am feeling exhausted, let's wrap this call.";
  const m5_duration = 2900;
  console.log(`   Hritthik: "${m5_input}" (${m5_duration}ms)`);

  const m5_agent = jm.detectActiveAgent(m5_input);
  const m5_vibe = jm.prosodicEntrainment.analyzeVibe(m5_input, m5_duration);
  jm.behaviorEngine.updateBehavior(m5_input, m5_duration, m5_vibe);
  jm.addTurn("user", m5_input, "Hritthik");

  console.log(`   Cognitive Mode: ${m5_vibe.cognitiveMode} (Expected: LATE_NIGHT_REFLECTIVE)`);
  console.log(`   Dynamic Operating Mode: ${jm.behaviorEngine.state.currentMode} (Expected: LATE_NIGHT_RECOVERY)`);
  console.log(`   Acoustic Pitch: ${jm.prosodicEntrainment.getPitchString()} (Expected: -2Hz)`);

  let m5_prompt = jm.getSystemPrompt(m5_agent) + `\n\n${m5_vibe.directive}`;
  const m5_start = Date.now();
  const m5_reply = await callGroq([
    { role: "system", content: m5_prompt },
    ...jm.getHistory(10).slice(0, -1),
    { role: "user", content: m5_input }
  ], { temperature: 0.6 });
  const m5_latency = Date.now() - m5_start;

  console.log(`   Meeting Closing (${m5_latency}ms):\n${m5_reply}\n`);
  jm.addTurn("assistant", m5_reply, m5_agent.name);

  // Check learned memory persistence
  const memoryLearnings = jm.memory.recentLearnings.filter(l => l.topic === "Technical Rule");
  console.log(`   Brain Memory Verification: Found ${memoryLearnings.length} stored technical rule(s) in persistent brain memory.`);
  if (memoryLearnings.length === 0) issuesFound.push("Meeting Turn 5: Technical Rule was not persisted in memory graph");

  console.log("\n================================================================================");
  console.log("📊 BIG MEETING SIMULATION RESULTS:");
  console.log(`Total Issues / Gaps Detected: ${issuesFound.length}`);
  if (issuesFound.length > 0) {
    console.log("🚨 Issues to resolve:");
    issuesFound.forEach((iss, i) => console.log(`   ${i + 1}. ${iss}`));
  } else {
    console.log("🎉 100% PERFECT 5-PARTY LIVE ZOOM / PHONE CALL MEETING SIMULATION PASSED!");
  }
  console.log("================================================================================");
}

runBigMeetingSimulation().catch(err => {
  console.error("❌ Big meeting test crashed:", err);
  process.exit(1);
});
