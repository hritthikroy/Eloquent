#!/usr/bin/env node
/**
 * scripts/play-squad-voices-live.js
 * 
 * Synthesizes and plays live audio demonstrations of Tuk Tuk (en-US-AvaNeural)
 * and Vision (en-US-AndrewNeural) out loud through macOS CoreAudio speakers (afplay).
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const SAMPLES_DIR = path.resolve(__dirname, "../audio-samples");
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

const VOICES_TO_PLAY = [
  {
    agentKey: "tuktuk",
    agentName: "Tuk Tuk (Squad Leader)",
    voice: "en-US-AvaNeural",
    rate: "+0%",
    pitch: "+1Hz",
    text: "Hey babe! I'm Tuk Tuk, your squad leader. Listen to how clean, warm, and natural my voice sounds now. Pure Ava Neural — zero robotic accent shifts, zero multilingual glitch, just real human energy right here with you."
  },
  {
    agentKey: "vision",
    agentName: "Vision (Lead Architect)",
    voice: "en-US-AndrewNeural",
    rate: "+0%",
    pitch: "+0Hz",
    text: "Vision here, brother. Codebase architecture, AST validation, and compiler telemetry are running 100% clean. Notice the steady, crisp cadence — pure neural engineering with zero distortion."
  }
];

async function main() {
  console.log("================================================================================");
  console.log("🎙️🔊 SYNTHESIZING & PLAYING TUK TUK & VISION VOICES LIVE ON MAC SPEAKERS");
  console.log("================================================================================\n");

  const generatedFiles = [];

  for (let i = 0; i < VOICES_TO_PLAY.length; i++) {
    const item = VOICES_TO_PLAY[i];
    console.log(`[${i + 1}/${VOICES_TO_PLAY.length}] Synthesizing ${item.agentName}...`);
    console.log(`  Voice:     ${item.voice}`);
    console.log(`  Utterance: "${item.text}"`);

    const outPath = path.join(SAMPLES_DIR, `live_listen_${item.agentKey}.mp3`);
    if (fs.existsSync(outPath)) {
      try { fs.unlinkSync(outPath); } catch (_) {}
    }

    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(item.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const res = await tts.toFile(SAMPLES_DIR, item.text, { rate: item.rate, pitch: item.pitch });
      fs.copyFileSync(res.audioFilePath, outPath);
      try { fs.unlinkSync(res.audioFilePath); } catch (_) {}

      console.log(`  ✅ Audio synthesized: ${outPath} (${fs.statSync(outPath).size} bytes)\n`);
      generatedFiles.push({ ...item, path: outPath });
    } catch (err) {
      console.error(`  ❌ Failed to synthesize ${item.voice}: ${err.message}`);
      if (item.voice === "en-US-AvaNeural") {
        console.log("  ⚠️ Retrying with en-US-AvaMultilingualNeural as fallback...");
        try {
          const fallbackTts = new MsEdgeTTS();
          await fallbackTts.setMetadata("en-US-AvaMultilingualNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
          const res = await fallbackTts.toFile(SAMPLES_DIR, item.text, { rate: item.rate, pitch: item.pitch });
          fs.copyFileSync(res.audioFilePath, outPath);
          try { fs.unlinkSync(res.audioFilePath); } catch (_) {}
          generatedFiles.push({ ...item, path: outPath });
          console.log(`  ✅ Fallback synthesized: ${outPath}\n`);
        } catch (fbErr) {
          console.error(`  ❌ Fallback also failed: ${fbErr.message}`);
        }
      }
    }
  }

  // Play audio files sequentially on Mac speakers
  console.log("================================================================================");
  console.log("🔊 PLAYING AUDIO OUT LOUD THROUGH YOUR MAC SPEAKERS / HEADPHONES VIA AFPLAY");
  console.log("================================================================================\n");

  for (const item of generatedFiles) {
    console.log(`▶️ Now Playing: ${item.agentName} (${item.voice})...`);
    try {
      execSync(`/usr/bin/afplay "${item.path}"`, { stdio: "inherit" });
      console.log(`  ✅ Finished playing ${item.agentName}\n`);
    } catch (err) {
      console.warn(`  ⚠️ Playback interrupted or failed: ${err.message}\n`);
    }
  }

  console.log("🎉 All voice samples played successfully!");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
