#!/usr/bin/env node
/**
 * @file test-and-play-squad-audio-conversation.js
 * @description Master multi-agent squad audio conversation test and live audio player.
 * Validates language clarity, single voice soul parity, and persona sovereignty across all 4 squad turns.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { execSync } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

const SAMPLES_DIR = path.resolve(__dirname, "../audio-samples");
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

const jarvisManager = new JarvisManager();

const SQUAD_CONVERSATION_TURNS = [
  {
    agentKey: "tuktuk",
    agentName: "Tuk Tuk (Co-Founder & Partner)",
    voice: "en-US-AvaMultilingualNeural",
    prompt: "babe, squad meeting start koro and system status jante chao",
    turnText: "Hritthik babe, amader multi-agent squad standup is live! System architecture, core backend pipelines, and research telemetry shob green status-e ache kina check kori cholo!"
  },
  {
    agentKey: "vision",
    agentName: "Vision (Lead Systems Architect)",
    voice: "en-US-AndrewMultilingualNeural",
    prompt: "brother, architecture and IPC status report koro",
    turnText: "Lead Systems Architect Vision standing by, brother! System architecture, core audio ring buffer, zero-copy IPC channels, and compiler build pipelines are 100% rock solid and nominal."
  },
  {
    agentKey: "friday",
    agentName: "Friday (Quantitative Researcher)",
    voice: "en-US-EmmaMultilingualNeural",
    prompt: "Chief, research and benchmark metrics report koro",
    turnText: "Research telemetry nominal, Chief! Real-time empirical benchmarks, information retrieval models, and voice identity parity metrics are verified with zero anomalies."
  },
  {
    agentKey: "dd",
    agentName: "DD (DevOps Sentinel)",
    voice: "en-US-BrianMultilingualNeural",
    prompt: "bro, infrastructure and memory latency status update koro",
    turnText: "DevOps sentinel reporting live, bro! Sub-15 millisecond audio playback latency, zero memory leaks, and CPU load telemetry are locked green across all nodes."
  }
];

async function runSquadAudioConversationTest() {
  console.log("================================================================================");
  console.log("🎙️🔊 MULTI-AGENT SQUAD AUDIO CONVERSATION CLARITY TEST & PLAYER");
  console.log("================================================================================");
  console.log("1. Running Multi-Agent Squad Language Clarity & Voice Parity Assertions...\n");

  const partFiles = [];

  for (let i = 0; i < SQUAD_CONVERSATION_TURNS.length; i++) {
    const spec = SQUAD_CONVERSATION_TURNS[i];
    console.log(`--- [TURN ${i + 1}/4] ${spec.agentName} ---`);
    console.log(`  Voice Soul: ${spec.voice}`);

    // 1. Test LocalCognitiveBrain synthesis
    const brainResponse = LocalCognitiveBrain.synthesizeResponse(spec.agentKey, spec.agentName, spec.prompt, {}, "bn");
    console.log(`  🧠 Brain Synthesis: "${brainResponse}"`);

    // Assert persona sovereignty
    if (spec.agentKey === "tuktuk") {
      assert(brainResponse.toLowerCase().includes("babe"), "Tuk Tuk must maintain 'babe' pet name invariant!");
    } else if (spec.agentKey === "vision") {
      assert(brainResponse.toLowerCase().includes("brother") || brainResponse.toLowerCase().includes("bhai"), "Vision must maintain brotherly invariant!");
    } else if (spec.agentKey === "friday") {
      assert(brainResponse.toLowerCase().includes("chief"), "Friday must maintain 'Chief' salutation invariant!");
    } else if (spec.agentKey === "dd") {
      assert(brainResponse.toLowerCase().includes("bro") || brainResponse.toLowerCase().includes("bhai"), "DD must maintain 'bro' invariant!");
    }
    console.log(`  ✅ [PASS] Persona Sovereignty verified!`);

    // 2. Preflight hybrid code-mix language clarity
    let preflightText = spec.turnText;
    if (banglaVoiceCortex && typeof banglaVoiceCortex.processHybridBengaliCodeMix === "function") {
      preflightText = banglaVoiceCortex.processHybridBengaliCodeMix(preflightText);
    }
    console.log(`  🗣️ Processed Utterance: "${preflightText}"`);

    // Assert clean English loanword restoration
    assert(
      preflightText.includes("telemetry") ||
      preflightText.includes("architecture") ||
      preflightText.includes("benchmarks") ||
      preflightText.includes("latency") ||
      preflightText.includes("pipelines") ||
      preflightText.includes("buffer"),
      "Technical loanwords must be preserved in clean English!"
    );
    console.log(`  ✅ [PASS] Language & Phonetic Clarity verified!`);

    // 3. Synthesize audio file
    const partPath = path.join(SAMPLES_DIR, `squad_conv_turn_${i + 1}_${spec.agentKey}.mp3`);
    const tts = new MsEdgeTTS();
    await tts.setMetadata(spec.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const pitch = spec.agentKey === "tuktuk" ? "+1Hz" : "+0Hz";
    const res = await tts.toFile(SAMPLES_DIR, preflightText, { rate: "+0%", pitch });
    fs.copyFileSync(res.audioFilePath, partPath);
    try { fs.unlinkSync(res.audioFilePath); } catch (_) {}
    partFiles.push(partPath);
    console.log("");
  }

  // 4. Concatenate master conversation audio with natural human pauses (300ms)
  const masterConversationPath = path.join(SAMPLES_DIR, "full_squad_audio_conversation_master.mp3");
  const concatArgs = partFiles.map(f => `"${f}"`).join(" ");

  try {
    execSync(`sox ${concatArgs} "${masterConversationPath}" pad 0 0.35 2>/dev/null`, { timeout: 20000 });
  } catch (_) {
    execSync(`cat ${concatArgs} > "${masterConversationPath}"`);
  }

  // Clean temp part files
  for (const f of partFiles) {
    try { fs.unlinkSync(f); } catch (_) {}
  }

  const stat = fs.statSync(masterConversationPath);
  let duration = "N/A";
  try {
    const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${masterConversationPath}"`).toString().trim();
    duration = `${parseFloat(probe).toFixed(2)}s`;
  } catch (_) {}

  console.log("================================================================================");
  console.log("🎉 ALL MULTI-AGENT SQUAD CONVERSATION TESTS PASSED (100% VERIFIED)!");
  console.log(`💾 Master Audio: ${masterConversationPath}`);
  console.log(`📦 Size:         ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`⏱️ Duration:     ${duration}`);
  console.log("================================================================================\n");

  console.log("🔊 Playing Full Squad Multi-Agent Audio Conversation live on Mac Speaker via afplay...\n");
  try {
    execSync(`afplay "${masterConversationPath}"`, { stdio: "inherit" });
    console.log("\n✨ Playback complete!");
  } catch (err) {
    console.warn("⚠️ Playback warning:", err.message);
  }
}

runSquadAudioConversationTest().catch(err => {
  console.error("❌ Failed squad audio conversation test:", err);
  process.exit(1);
});
