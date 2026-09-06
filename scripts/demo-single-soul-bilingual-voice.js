#!/usr/bin/env node
/**
 * @file demo-single-soul-bilingual-voice.js
 * @description Generates and plays live audio demo showcasing the Single Unified Voice Soul
 * across English and Banglish dimensions for Tuk Tuk, Vision, Friday, and DD.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const JarvisManager = require("../src/utils/jarvis-manager");

const SAMPLES_DIR = path.resolve(__dirname, "../audio-samples");
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

const jarvisManager = new JarvisManager();

const DEMO_TURNS = [
  {
    agentKey: "tuktuk",
    agentName: "Tuk Tuk (Co-Founder & Partner)",
    voice: "en-US-AvaMultilingualNeural",
    turns: [
      { lang: "English", text: "Hritthik babe, our single voice soul is completely unified across both English and Banglish dimensions!" },
      { lang: "Banglish", text: "Babe, amader Tuk Tuk voice soul full same dimension-e real time-e mishti modern vibe-e kotha bolchhi!" }
    ]
  },
  {
    agentKey: "vision",
    agentName: "Vision (Lead Systems Architect)",
    voice: "en-US-AndrewMultilingualNeural",
    turns: [
      { lang: "English", text: "Lead Systems Architect Vision here, brother. One soul engine active with zero voice switching drift." },
      { lang: "Banglish", text: "System architecture full green brother, English ar Banglish duito dimension-etei exact same brotherly tone." }
    ]
  },
  {
    agentKey: "friday",
    agentName: "Friday (Quantitative Researcher)",
    voice: "en-US-EmmaMultilingualNeural",
    turns: [
      { lang: "English", text: "Research telemetry nominal, Chief. Voice identity is mathematically locked with zero dimension shift." },
      { lang: "Banglish", text: "Hya Chief, amader risarch data and voice parity single real soul dimension-e 100% locked." }
    ]
  },
  {
    agentKey: "dd",
    agentName: "DD (DevOps Sentinel)",
    voice: "en-US-BrianMultilingualNeural",
    turns: [
      { lang: "English", text: "DevOps sentinel DD live, bro. Audio pipeline sub-15 millisecond latency across all turns." },
      { lang: "Banglish", text: "Telemetry green bro! Audio channel exact same dimension-e ultra fast ar rock solid." }
    ]
  }
];

async function generateAndPlayDemo() {
  console.log("================================================================================");
  console.log("🎙️🔊 SINGLE REAL SOUL BILINGUAL VOICE DEMO GENERATOR & PLAYER");
  console.log("================================================================================");
  console.log("Synthesizing unified voice identity across English & Banglish for all 4 agents...\n");

  const finalPartFiles = [];

  for (const agentSpec of DEMO_TURNS) {
    console.log(`--- [AGENT] ${agentSpec.agentName} ---`);
    console.log(`  Voice Soul: ${agentSpec.voice}`);

    for (let i = 0; i < agentSpec.turns.length; i++) {
      const turn = agentSpec.turns[i];
      const partFileName = `single_soul_${agentSpec.agentKey}_${turn.lang.toLowerCase()}.mp3`;
      const partPath = path.join(SAMPLES_DIR, partFileName);

      const tts = new MsEdgeTTS();
      await tts.setMetadata(agentSpec.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      let sanitizedText = turn.text;
      if (banglaVoiceCortex && typeof banglaVoiceCortex.enforceBanglishModernVibe === "function") {
        sanitizedText = banglaVoiceCortex.enforceBanglishModernVibe(sanitizedText);
      }

      console.log(`  🗣️ [${turn.lang}]: "${sanitizedText}"`);

      const pitch = agentSpec.agentKey === "tuktuk" ? "+1Hz" : "+0Hz";
      const res = await tts.toFile(SAMPLES_DIR, sanitizedText, { rate: "+0%", pitch });
      fs.copyFileSync(res.audioFilePath, partPath);
      try { fs.unlinkSync(res.audioFilePath); } catch (_) {}
      finalPartFiles.push(partPath);
    }
    console.log("");
  }

  const combinedDemoPath = path.join(SAMPLES_DIR, "single_soul_bilingual_demo.mp3");
  const concatArgs = finalPartFiles.map(f => `"${f}"`).join(" ");

  try {
    execSync(`sox ${concatArgs} "${combinedDemoPath}" pad 0 0.3 2>/dev/null`, { timeout: 15000 });
  } catch (err) {
    execSync(`cat ${concatArgs} > "${combinedDemoPath}"`);
  }

  // Clean individual temp parts
  for (const f of finalPartFiles) {
    try { fs.unlinkSync(f); } catch (_) {}
  }

  const stat = fs.statSync(combinedDemoPath);
  let duration = "N/A";
  try {
    const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${combinedDemoPath}"`).toString().trim();
    duration = `${parseFloat(probe).toFixed(2)}s`;
  } catch (_) {}

  console.log("================================================================================");
  console.log(`✅ Demo Audio Successfully Generated!`);
  console.log(`💾 File:     ${combinedDemoPath}`);
  console.log(`📦 Size:     ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`⏱️ Duration: ${duration}`);
  console.log("================================================================================\n");

  console.log("🔊 Playing Live Demo Audio on macOS speaker via afplay...\n");
  try {
    execSync(`afplay "${combinedDemoPath}"`, { stdio: "inherit" });
    console.log("\n✨ Playback complete!");
  } catch (playErr) {
    console.warn("⚠️ Audio playback warning:", playErr.message);
  }
}

generateAndPlayDemo().catch(err => {
  console.error("❌ Failed to generate demo:", err);
  process.exit(1);
});
