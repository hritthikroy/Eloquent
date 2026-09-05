const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const testPhrases = [
  {
    id: "pure_bn",
    label: "Pure Conversational Bengali",
    text: "ভাই, সমস্ত টেস্ট পাস করেছে আর ব্যাকএন্ড পাইপলাইন সম্পূর্ণ রেডি।"
  },
  {
    id: "tech_banglish",
    label: "Tech Code-Switching Banglish",
    text: "Brother, Go concurrency আর zero-copy IPC পাইপলাইন একদম ক্লিন।"
  }
];

const voices = [
  { id: "pradeep", name: "bn-BD-PradeepNeural", type: "Native Bangladeshi Male" },
  { id: "andrew", name: "en-US-AndrewMultilingualNeural", type: "US Multilingual Male" }
];

async function benchmark() {
  console.log("================================================================================");
  console.log("🎙️ ACOUSTIC BENCHMARK: bn-BD-PradeepNeural vs en-US-AndrewMultilingualNeural");
  console.log("================================================================================\n");

  const results = [];

  for (const voice of voices) {
    for (const phrase of testPhrases) {
      const outName = `/tmp/${voice.id}_${phrase.id}.mp3`;
      const t0 = Date.now();
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice.name, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {});
        const res = await tts.toFile("/tmp", phrase.text, { rate: "+0%", pitch: "+0Hz" });
        fs.copyFileSync(res.audioFilePath, outName);
        const latencyMs = Date.now() - t0;
        const stat = fs.statSync(outName);

        // Analyze with ffprobe
        let duration = "N/A";
        try {
          const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outName}"`).toString().trim();
          duration = `${parseFloat(probe).toFixed(2)}s`;
        } catch (_) {}

        results.push({
          voice: voice.name,
          accent: voice.type,
          test: phrase.label,
          file: outName,
          latency: `${latencyMs}ms`,
          size: `${(stat.size / 1024).toFixed(1)} KB`,
          duration
        });
      } catch (err) {
        results.push({
          voice: voice.name,
          accent: voice.type,
          test: phrase.label,
          file: "FAILED",
          latency: "ERR",
          size: "0",
          duration: "N/A",
          error: err.message
        });
      }
    }
  }

  console.table(results.map(r => ({
    Voice: r.voice,
    Accent: r.accent,
    Test: r.test,
    Duration: r.duration,
    Latency: r.latency,
    File: r.file
  })));

  console.log("\n📁 Generated Audio Files for Listening Comparison:");
  console.log("1. Pradeep (Pure Bengali):      afplay /tmp/pradeep_pure_bn.mp3");
  console.log("2. Andrew  (Pure Bengali):      afplay /tmp/andrew_pure_bn.mp3");
  console.log("3. Pradeep (Tech Banglish):     afplay /tmp/pradeep_tech_banglish.mp3");
  console.log("4. Andrew  (Tech Banglish):     afplay /tmp/andrew_tech_banglish.mp3");
}

benchmark();
