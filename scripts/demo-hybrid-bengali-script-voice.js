#!/usr/bin/env node
/**
 * @file demo-hybrid-bengali-script-voice.js
 * @description Generates and plays ultra-high clarity live audio demo using native Bengali script
 * for Bengali words combined with English spellings for English loanwords using single voice souls.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { execSync } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");

const SAMPLES_DIR = path.resolve(__dirname, "../audio-samples");
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

const jarvisManager = new JarvisManager();

const HYBRID_DEMO_TURNS = [
  {
    agentKey: "tuktuk",
    agentName: "Tuk Tuk (Co-Founder & Partner)",
    voice: "en-US-AvaMultilingualNeural",
    text: "Hritthik babe, আমাদের code-mixed voice soul একদম single real dimension-এ fully active! Bangla আর English seamless mix-এ ultra smooth লাগছে!"
  },
  {
    agentKey: "vision",
    agentName: "Vision (Lead Systems Architect)",
    voice: "en-US-AndrewMultilingualNeural",
    text: "System architecture full green brother! আমাদের core backend pipeline, zero-copy IPC channels, আর real-time audio thread সব exact same soul-এ run করছে।"
  },
  {
    agentKey: "friday",
    agentName: "Friday (Quantitative Researcher)",
    voice: "en-US-EmmaMultilingualNeural",
    text: "Telemetry locked nominal, Chief! Real-time research metrics, empirical data models, and voice identity parity completely green with zero dimension shift."
  },
  {
    agentKey: "dd",
    agentName: "DD (DevOps Sentinel)",
    voice: "en-US-BrianMultilingualNeural",
    text: "DevOps sentinel reporting live bro! Audio ring buffer sub-15 millisecond latency-তে green, CPU overhead minimal, আর memory allocation 100% rock solid."
  }
];

async function generateAndPlayHybridDemo() {
  console.log("================================================================================");
  console.log("🎙️🔊 HYBRID SCRIPT (NATIVE BANGLA SCRIPT + ENGLISH LOANWORDS) VOICE DEMO");
  console.log("================================================================================");
  console.log("Synthesizing ultra-high clarity hybrid Bengali + English speech...\n");

  const partFiles = [];

  for (let i = 0; i < HYBRID_DEMO_TURNS.length; i++) {
    const spec = HYBRID_DEMO_TURNS[i];
    console.log(`--- [AGENT ${i + 1}/4] ${spec.agentName} ---`);
    console.log(`  Voice Model: ${spec.voice}`);

    let processedText = spec.text;
    if (banglaVoiceCortex && typeof banglaVoiceCortex.processHybridBengaliCodeMix === "function") {
      processedText = banglaVoiceCortex.processHybridBengaliCodeMix(processedText);
    }
    console.log(`  🗣️ Utterance: "${processedText}"`);

    const partPath = path.join(SAMPLES_DIR, `hybrid_script_${spec.agentKey}.mp3`);
    const tts = new MsEdgeTTS();
    await tts.setMetadata(spec.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const pitch = spec.agentKey === "tuktuk" ? "+1Hz" : "+0Hz";
    const res = await tts.toFile(SAMPLES_DIR, processedText, { rate: "+0%", pitch });
    fs.copyFileSync(res.audioFilePath, partPath);
    try { fs.unlinkSync(res.audioFilePath); } catch (_) {}
    partFiles.push(partPath);
  }

  const masterPath = path.join(SAMPLES_DIR, "hybrid_bengali_script_master_demo.mp3");
  const concatArgs = partFiles.map(f => `"${f}"`).join(" ");

  try {
    execSync(`sox ${concatArgs} "${masterPath}" pad 0 0.35 2>/dev/null`, { timeout: 15000 });
  } catch (_) {
    execSync(`cat ${concatArgs} > "${masterPath}"`);
  }

  // Cleanup temp files
  for (const f of partFiles) {
    try { fs.unlinkSync(f); } catch (_) {}
  }

  const stat = fs.statSync(masterPath);
  let duration = "N/A";
  try {
    const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${masterPath}"`).toString().trim();
    duration = `${parseFloat(probe).toFixed(2)}s`;
  } catch (_) {}

  console.log("\n================================================================================");
  console.log("🎉 HYBRID BANGLA SCRIPT DEMO SYNTHESIZED SUCCESSFULLY!");
  console.log(`💾 Master Audio: ${masterPath}`);
  console.log(`📦 Size:         ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`⏱️ Duration:     ${duration}`);
  console.log("================================================================================\n");

  console.log("🔊 Playing Hybrid High-Clarity Live Audio Demo on Mac Speaker via afplay...\n");
  try {
    execSync(`afplay "${masterPath}"`, { stdio: "inherit" });
    console.log("\n✨ Playback complete!");
  } catch (err) {
    console.warn("⚠️ Playback warning:", err.message);
  }
}

generateAndPlayHybridDemo().catch(err => {
  console.error("❌ Failed hybrid demo:", err);
  process.exit(1);
});
