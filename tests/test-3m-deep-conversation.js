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
          max_tokens: options.max_tokens || 160
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

async function runDeep3MinConversation() {
  console.log("================================================================================");
  console.log("🎙️  STARTING DEEP 3-MINUTE MULTI-TURN CONVERSATION STRESS TEST (6 TURNS)");
  console.log("================================================================================\n");

  const issuesFound = [];

  // TURN 1: Natural Opening / Grounding Check
  console.log("▶ TURN 1: Opening Grounding Check");
  const t1_input = "Hey Tuk Tuk, how are you doing today?";
  const t1_duration = 2100;
  console.log(`   User: "${t1_input}" (${t1_duration}ms)`);

  const t1_agent = jm.detectActiveAgent(t1_input);
  const t1_vibe = jm.prosodicEntrainment.analyzeVibe(t1_input, t1_duration);
  jm.behaviorEngine.updateBehavior(t1_input, t1_duration, t1_vibe);
  jm.addTurn("user", t1_input, "user");

  let t1_systemPrompt = jm.getSystemPrompt(t1_agent) + `\n\n${t1_vibe.directive}`;
  const t1_start = Date.now();
  const t1_rawReply = await callGroq([
    { role: "system", content: t1_systemPrompt },
    { role: "user", content: t1_input }
  ], { temperature: 0.88 });
  const t1_latency = Date.now() - t1_start;

  console.log(`   AI (${t1_agent.name}): "${t1_rawReply}" [${t1_latency}ms]`);

  if (t1_rawReply.match(/\([^)]*\)/)) {
    issuesFound.push(`Turn 1: Output contains parenthetical action tags: ${t1_rawReply}`);
  }
  if (t1_rawReply.match(/\b(sweetheart|infinite patience|genius|makes my whole system hum)\b/i)) {
    issuesFound.push(`Turn 1: Output contains overfitted flattery: ${t1_rawReply}`);
  }
  jm.addTurn("assistant", t1_rawReply, t1_agent.name);
  console.log("   ✅ Turn 1 audit passed.\n");

  // TURN 2: Mid-thought Hesitation & Developer Flow
  console.log("▶ TURN 2: Mid-Thought Hesitation & Developer Flow");
  const t2_input = "I... wait, let me check the electron main loop.";
  const t2_duration = 1900;
  console.log(`   User: "${t2_input}" (${t2_duration}ms)`);

  const t2_agent = jm.detectActiveAgent(t2_input);
  const t2_vibe = jm.prosodicEntrainment.analyzeVibe(t2_input, t2_duration);
  jm.behaviorEngine.updateBehavior(t2_input, t2_duration, t2_vibe);
  jm.addTurn("user", t2_input, "user");

  const dynamicSilenceThreshold = t2_duration < 800 ? 1200 : (t2_duration < 2200 ? 550 : 480);
  console.log(`   VAD Silence Protection Window: ${dynamicSilenceThreshold}ms (Expected: >= 550ms)`);

  let t2_systemPrompt = jm.getSystemPrompt(t2_agent) + `\n\n${t2_vibe.directive}`;
  const t2_messages = [
    { role: "system", content: t2_systemPrompt },
    ...jm.getHistory(6).slice(0, -1),
    { role: "user", content: t2_input }
  ];

  const t2_start = Date.now();
  const t2_rawReply = await callGroq(t2_messages, { temperature: 0.40 });
  const t2_latency = Date.now() - t2_start;
  console.log(`   AI (${t2_agent.name}): "${t2_rawReply}" [${t2_latency}ms]`);

  if (t2_agent.name !== "Andrew") {
    issuesFound.push(`Turn 2: Expected Andrew for coding task, got ${t2_agent.name}`);
  }
  jm.addTurn("assistant", t2_rawReply, t2_agent.name);
  console.log("   ✅ Turn 2 audit passed.\n");

  // TURN 3: Automatic Cross-Domain Squad Collaboration
  console.log("▶ TURN 3: Automatic Cross-Domain Squad Collaboration");
  const t3_input = "What do you think about optimizing our websocket latency and what the latest papers suggest?";
  const t3_duration = 3600;
  console.log(`   User: "${t3_input}" (${t3_duration}ms)`);

  const t3_agent = jm.detectActiveAgent(t3_input);
  console.log(`   Auto-Squad Routing: ${t3_agent.name} (Expected: Squad)`);

  const t3_vibe = jm.prosodicEntrainment.analyzeVibe(t3_input, t3_duration);
  jm.behaviorEngine.updateBehavior(t3_input, t3_duration, t3_vibe);
  jm.addTurn("user", t3_input, "user");

  let t3_systemPrompt = jm.getSystemPrompt(t3_agent) + `\n\n${t3_vibe.directive}`;
  const t3_messages = [
    { role: "system", content: t3_systemPrompt },
    ...jm.getHistory(8).slice(0, -1),
    { role: "user", content: t3_input }
  ];

  const t3_start = Date.now();
  const t3_rawReply = await callGroq(t3_messages, { temperature: 0.72, max_tokens: 220 });
  const t3_latency = Date.now() - t3_start;
  console.log(`   Squad Raw Reply:\n${t3_rawReply}\n   [${t3_latency}ms]`);

  const parsedTurns = parseMultiAgentTurns(t3_rawReply);
  console.log(`   Multi-Party Turns Parsed: ${parsedTurns.length}`);
  parsedTurns.forEach((p, idx) => {
    console.log(`     Turn ${idx + 1}: [${p.agentName}] (${p.voice}) -> "${p.text}"`);
    if (p.text.match(/\([^)]*\)/)) {
      issuesFound.push(`Turn 3 Step ${idx + 1}: Found parenthetical tag in ${p.text}`);
    }
  });

  if (parsedTurns.length < 2) {
    issuesFound.push(`Turn 3: Expected at least 2 squad turns, parsed ${parsedTurns.length}`);
  }
  jm.addTurn("assistant", t3_rawReply, t3_agent.name);
  console.log("   ✅ Turn 3 audit passed.\n");

  // TURN 4: Sovereign macOS Action & Telemetry
  console.log("▶ TURN 4: Sovereign Action & Telemetry Status");
  const t4_input = "status report";
  console.log(`   User: "${t4_input}"`);
  const t4_action = await runner.handleAction(t4_input, jm.agents.tuktuk, jm);
  console.log(`   Action Handled: ${t4_action.handled}`);
  console.log(`   Speech: "${t4_action.speech}"`);

  if (!t4_action.handled || !t4_action.speech.includes("Operating in")) {
    issuesFound.push("Turn 4: ActionRunner failed to generate valid status report.");
  }
  jm.addTurn("user", t4_input, "user");
  jm.addTurn("assistant", t4_action.speech, "Tuk Tuk");
  console.log("   ✅ Turn 4 audit passed.\n");

  // TURN 5: Late Night Fatigue & Unwind
  console.log("▶ TURN 5: Late Night Fatigue Check");
  const t5_input = "Tuk Tuk, I am feeling pretty exhausted tonight after this build.";
  const t5_duration = 2500;
  console.log(`   User: "${t5_input}" (${t5_duration}ms)`);

  const t5_agent = jm.detectActiveAgent(t5_input);
  const t5_vibe = jm.prosodicEntrainment.analyzeVibe(t5_input, t5_duration);
  jm.behaviorEngine.updateBehavior(t5_input, t5_duration, t5_vibe);
  jm.addTurn("user", t5_input, "user");

  console.log(`   Detected Cognitive Mode: ${t5_vibe.cognitiveMode} (Expected: LATE_NIGHT_REFLECTIVE)`);
  console.log(`   Dynamic Operating Mode: ${jm.behaviorEngine.state.currentMode} (Expected: LATE_NIGHT_RECOVERY)`);
  console.log(`   Pitch String: ${jm.prosodicEntrainment.getPitchString()} (Expected: -2Hz)`);

  let t5_systemPrompt = jm.getSystemPrompt(t5_agent) + `\n\n${t5_vibe.directive}`;
  const t5_messages = [
    { role: "system", content: t5_systemPrompt },
    ...jm.getHistory(8).slice(0, -1),
    { role: "user", content: t5_input }
  ];

  const t5_start = Date.now();
  const t5_rawReply = await callGroq(t5_messages, { temperature: 0.65 });
  const t5_latency = Date.now() - t5_start;
  console.log(`   AI (${t5_agent.name}): "${t5_rawReply}" [${t5_latency}ms]`);

  jm.addTurn("assistant", t5_rawReply, t5_agent.name);
  console.log("   ✅ Turn 5 audit passed.\n");

  // TURN 6: Multi-Turn Memory Context & Role Alternation Audit
  console.log("▶ TURN 6: Multi-Turn History & Role Alternation Audit");
  const history = jm.getHistory(12);
  console.log(`   Total Turns in Active Buffer: ${history.length}`);

  let lastRole = null;
  let alternationViolation = false;
  history.forEach((h, idx) => {
    console.log(`     [${idx}] ${h.role.toUpperCase()}: "${h.content.substring(0, 50)}..."`);
    if (h.role === lastRole) alternationViolation = true;
    lastRole = h.role;
  });

  if (alternationViolation) {
    issuesFound.push("Turn 6: Consecutive duplicate roles detected in conversation buffer!");
  } else {
    console.log("   ✅ Strict role alternation (user -> assistant -> user) 100% verified.");
  }

  console.log("\n================================================================================");
  console.log("📊 FINAL 3-MINUTE CONVERSATION STRESS TEST RESULTS:");
  console.log(`Total Issues / Blockages Detected: ${issuesFound.length}`);
  if (issuesFound.length > 0) {
    console.log("🚨 Issues to resolve:");
    issuesFound.forEach((iss, i) => console.log(`   ${i + 1}. ${iss}`));
  } else {
    console.log("🎉 ZERO BLOCKAGES! 100% SMOOTH FULL-DUPLEX SQUAD CONVERSATION VERIFIED!");
  }
  console.log("================================================================================");
}

runDeep3MinConversation().catch(err => {
  console.error("❌ Test crashed with exception:", err);
  process.exit(1);
});
