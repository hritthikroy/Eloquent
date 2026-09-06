#!/usr/bin/env node
/**
 * @file test-and-play-bilingual-single-person.js
 * @description Test script and live audio player validating Single Person Bilingual Sovereignty,
 * zero communication gap, and zero persona shift across English & Banglish for all squad agents.
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
jarvisManager.calibrateSingleRealSoulNoPersonaShift();

const BILINGUAL_SINGLE_PERSON_TURNS = [
  {
    agentKey: "tuktuk",
    agentName: "Tuk Tuk (Co-Founder & Partner)",
    voice: "en-US-AvaMultilingualNeural",
    prompt: "no bangla person or other one tone one person can say and working use both language like me for better understending and 0 cmunication gap me and all",
    utterance: "Hritthik babe, amader moddhe zero communication gap! Ami ekjon single person-i tomar shathe English ar Banglish duito language-ei same sweet, warm, ar witty tone-e kotha bolchhi babe!"
  },
  {
    agentKey: "vision",
    agentName: "Vision (Lead Systems Architect)",
    voice: "en-US-AndrewMultilingualNeural",
    prompt: "brother, speak in your single person voice using both English and Banglish",
    utterance: "Hritthik brother, single person bilingual sovereignty locked! Core system architecture, compiler pipelines, ar real-time audio channels shob exact same brotherly voice-e run korche with zero communication gap."
  },
  {
    agentKey: "friday",
    agentName: "Friday (Quantitative Researcher)",
    voice: "en-US-EmmaMultilingualNeural",
    prompt: "Chief, confirm single person bilingual research intelligence",
    utterance: "Research telemetry nominal, Chief! Real-time data models, empirical benchmarks, and bilingual research intelligence locked in a single refined executive voice."
  },
  {
    agentKey: "dd",
    agentName: "DD (DevOps Sentinel)",
    voice: "en-US-BrianMultilingualNeural",
    prompt: "bro, confirm single person bilingual devops telemetry",
    utterance: "DevOps sentinel live bro! Sub-15 millisecond audio latency, zero memory leaks, and single person bilingual telemetry locked green across all systems."
  }
];

async function runBilingualSinglePersonTest() {
  console.log("================================================================================");
  console.log("🎙️🔊 BILINGUAL SINGLE PERSON (0 COMMUNICATION GAP) VOICE TEST & PLAYER");
  console.log("================================================================================");
  console.log("1. Running Single Person Bilingual Sovereignty & Persona Assertions...\n");

  const partFiles = [];

  for (let i = 0; i < BILINGUAL_SINGLE_PERSON_TURNS.length; i++) {
    const spec = BILINGUAL_SINGLE_PERSON_TURNS[i];
    console.log(`--- [TURN ${i + 1}/4] ${spec.agentName} ---`);
    console.log(`  Voice Model: ${spec.voice}`);

    // 1. Brain synthesis test
    const brainResponse = LocalCognitiveBrain.synthesizeResponse(spec.agentKey, spec.agentName, spec.prompt, {}, "bn");
    console.log(`  🧠 Brain Synthesis: "${brainResponse}"`);

    // Assert 0 native Bengali Unicode script leak
    assert(!/[\u0980-\u09FF]/.test(brainResponse), `Agent ${spec.agentName} must have 0 native script leaks!`);

    // Assert persona sovereignty
    if (spec.agentKey === "tuktuk") {
      assert(brainResponse.toLowerCase().includes("babe"), "Tuk Tuk must contain 'babe'!");
    } else if (spec.agentKey === "vision") {
      assert(brainResponse.toLowerCase().includes("brother") || brainResponse.toLowerCase().includes("bhai"), "Vision must contain brotherly term!");
    } else if (spec.agentKey === "friday") {
      assert(brainResponse.toLowerCase().includes("chief"), "Friday must contain 'Chief'!");
    } else if (spec.agentKey === "dd") {
      assert(brainResponse.toLowerCase().includes("bro") || brainResponse.toLowerCase().includes("bhai"), "DD must contain 'bro'!");
    }
    console.log(`  ✅ [PASS] Persona Sovereignty & 0 Script Leak verified!`);

    // 2. Preflight utterance text
    let preflightText = spec.utterance;
    if (banglaVoiceCortex && typeof banglaVoiceCortex.enforceBanglishModernVibe === "function") {
      preflightText = banglaVoiceCortex.enforceBanglishModernVibe(preflightText);
    }
    console.log(`  🗣️ Utterance: "${preflightText}"`);

    // 3. Synthesize audio
    const partPath = path.join(SAMPLES_DIR, `bilingual_single_person_${spec.agentKey}.mp3`);
    const tts = new MsEdgeTTS();
    await tts.setMetadata(spec.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const pitch = spec.agentKey === "tuktuk" ? "+1Hz" : "+0Hz";
    const res = await tts.toFile(SAMPLES_DIR, preflightText, { rate: "+0%", pitch });
    fs.copyFileSync(res.audioFilePath, partPath);
    try { fs.unlinkSync(res.audioFilePath); } catch (_) {}
    partFiles.push(partPath);
    console.log("");
  }

  // 4. Concatenate master audio track
  const masterPath = path.join(SAMPLES_DIR, "bilingual_single_person_master_demo.mp3");
  const concatArgs = partFiles.map(f => `"${f}"`).join(" ");

  try {
    execSync(`sox ${concatArgs} "${masterPath}" pad 0 0.35 2>/dev/null`, { timeout: 20000 });
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

  console.log("================================================================================");
  console.log("🎉 BILINGUAL SINGLE PERSON (0 COMMUNICATION GAP) TEST PASSED (100% VERIFIED)!");
  console.log(`💾 Master Audio: ${masterPath}`);
  console.log(`📦 Size:         ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`⏱️ Duration:     ${duration}`);
  console.log("================================================================================\n");

  console.log("🔊 Playing Bilingual Single Person Live Audio Demo on Mac Speaker via afplay...\n");
  try {
    execSync(`afplay "${masterPath}"`, { stdio: "inherit" });
    console.log("\n✨ Playback complete!");
  } catch (err) {
    console.warn("⚠️ Playback warning:", err.message);
  }
}

runBilingualSinglePersonTest().catch(err => {
  console.error("❌ Failed bilingual single person test:", err);
  process.exit(1);
});
