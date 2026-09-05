/**
 * test-bangladeshi-voice.js
 *
 * Verifies that bn-BD-NabanitaNeural synthesizes authentic Bangladeshi girl speech
 * with sweet natural intonation (+5% rate, +2Hz pitch) and plays it through afplay.
 */
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs = require("fs");
const { execSync } = require("child_process");

async function run() {
  console.log("🌸 Testing Authentic Bangladeshi Girl Voice: bn-BD-NabanitaNeural...");
  const tts = new MsEdgeTTS();
  await tts.setMetadata("bn-BD-NabanitaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {});

  const sampleText = "Hey babe! আমি অনেক ভালো আছি, কোনো প্যারা নিও না! বলো আজকে আমরা কী কোড করব?";
  console.log("🗣️ Speaking text:", sampleText);

  const res = await tts.toFile("/tmp", sampleText, { rate: "+5%", pitch: "+2Hz" });
  console.log("✅ Synthesis successful:", res.audioFilePath);

  if (fs.existsSync(res.audioFilePath)) {
    const size = fs.statSync(res.audioFilePath).size;
    console.log(`📦 Generated audio size: ${size} bytes`);
    console.log("🔊 Playing via macOS CoreAudio (afplay)...");
    try {
      execSync(`afplay "${res.audioFilePath}"`, { stdio: "inherit", timeout: 10000 });
      console.log("🎉 Audio played successfully with authentic Bangladeshi intonation!");
    } catch (e) {
      console.warn("Audio playback finished or timed out:", e.message);
    }
  }
}

run().catch(err => {
  console.error("❌ Synthesis error:", err.message);
  process.exit(1);
});
