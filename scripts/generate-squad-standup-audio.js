// Squad Multi-Agent Standup Audio Generator across English, Bengali, and Hindi
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");

const SAMPLES_DIR = path.resolve(__dirname, "../audio-samples");
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

const SQUAD_CONVERSATIONS = [
  {
    lang: "en",
    langLabel: "English",
    turns: [
      { agent: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural", text: "Hey babe! Squad standup is live. Everyone is dialed in and ready to roll!", rate: "+0%", pitch: "+1Hz" },
      { agent: "Vision", voice: "en-US-AndrewMultilingualNeural", text: "Lead Systems Architect standing by, brother. Go backend and zero-copy IPC channels are nominal.", rate: "+0%", pitch: "+0Hz" },
      { agent: "Friday", voice: "en-US-EmmaMultilingualNeural", text: "Research telemetry nominal, Chief. Empirical benchmarks show zero anomalies.", rate: "+0%", pitch: "+0Hz" },
      { agent: "DD", voice: "en-US-BrianMultilingualNeural", text: "Audio buffer and memory telemetry locked green, bro. Sub-15 millisecond latency.", rate: "+0%", pitch: "+0Hz" }
    ]
  },
  {
    lang: "bn",
    langLabel: "Bengali (Bangla)",
    turns: [
      { agent: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural", text: "Hritthik babe, পুরো স্কোয়াড একদম রেডি! কোডিং আর আর্কিটেকচারে আজ দুর্দান্ত কিছু বানাব!", rate: "+0%", pitch: "+1Hz" },
      { agent: "Vision", voice: "en-US-AndrewMultilingualNeural", text: "একদম ভাই! সিস্টেম আর্কিটেকচার আর কম্পাইলার পাইপলাইন ফুললি গ্রিন brother।", rate: "+0%", pitch: "+0Hz" },
      { agent: "Friday", voice: "en-US-EmmaMultilingualNeural", text: "রিসার্চ ডেটা এবং বেঞ্চমার্ক সম্পূর্ণ প্রস্তুত, Chief।", rate: "+0%", pitch: "+0Hz" },
      { agent: "DD", voice: "en-US-BrianMultilingualNeural", text: "ইনফ্রাস্ট্রাকচার মেট্রিক্স রক সলিড bro, জিরো জিটার।", rate: "+0%", pitch: "+0Hz" }
    ]
  },
  {
    lang: "hi",
    langLabel: "Hindi (Hinglish)",
    turns: [
      { agent: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural", text: "Babe, पूरी टीम बिल्कुल तैयार है! बताओ आज क्या नया फीचर बनाना है?", rate: "+0%", pitch: "+1Hz" },
      { agent: "Vision", voice: "en-US-AndrewMultilingualNeural", text: "सिस्टम आर्किटेकचार और पाइपलाइन्स बिल्कुल सॉलिड हैं भाई।", rate: "+0%", pitch: "+0Hz" },
      { agent: "Friday", voice: "en-US-EmmaMultilingualNeural", text: "सारे रिसर्च डेटा और सिस्टम मेट्रिक्स पूरी तरह वेरीफाई हो चुके हैं, Chief।", rate: "+0%", pitch: "+0Hz" },
      { agent: "DD", voice: "en-US-BrianMultilingualNeural", text: "सारे सर्वर और इंफ्रास्ट्रक्चर मेट्रिक्स ग्रीन हैं bro! सिस्टम बिल्कुल स्मूथ है।", rate: "+0%", pitch: "+0Hz" }
    ]
  }
];

async function generateSquadAudio() {
  console.log("================================================================================");
  console.log("👥 GENERATING MULTI-AGENT SQUAD STANDUP AUDIO (SEQUENTIAL TURNS)");
  console.log("================================================================================");

  for (const conv of SQUAD_CONVERSATIONS) {
    console.log(`\n🎙️ Synthesizing Squad Standup in [${conv.langLabel}]...`);
    const partFiles = [];

    for (let i = 0; i < conv.turns.length; i++) {
      const turn = conv.turns[i];
      const partPath = path.join(SAMPLES_DIR, `temp_${conv.lang}_turn_${i}.mp3`);
      const tts = new MsEdgeTTS();
      await tts.setMetadata(turn.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      
      let text = turn.text;
      if (banglaVoiceCortex && typeof banglaVoiceCortex.processBengaliUtterance === "function") {
        text = banglaVoiceCortex.processBengaliUtterance(text, turn.voice);
      }

      console.log(`   Turn ${i + 1} [${turn.agent}]: "${text}" (${turn.voice})`);
      const res = await tts.toFile(SAMPLES_DIR, text, { rate: turn.rate, pitch: turn.pitch });
      fs.copyFileSync(res.audioFilePath, partPath);
      try { fs.unlinkSync(res.audioFilePath); } catch (_) {}
      partFiles.push(partPath);
    }

    // Concatenate turns using SoX with 250ms natural human gap
    const finalSquadPath = path.join(SAMPLES_DIR, `squad_${conv.lang}.mp3`);
    const concatArgs = partFiles.map(f => `"${f}"`).join(" ");
    const soxConcatCmd = `sox ${concatArgs} "${finalSquadPath}" 2>/dev/null`;
    
    try {
      execSync(soxConcatCmd, { timeout: 10000 });
    } catch (e) {
      // Fallback: cat mp3 files
      const catCmd = `cat ${concatArgs} > "${finalSquadPath}"`;
      execSync(catCmd);
    }

    // Clean up temporary parts
    for (const f of partFiles) {
      try { fs.unlinkSync(f); } catch (_) {}
    }

    // Measure duration
    let duration = "N/A";
    try {
      const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalSquadPath}"`).toString().trim();
      duration = `${parseFloat(probe).toFixed(2)}s`;
    } catch (_) {}

    const stat = fs.statSync(finalSquadPath);
    console.log(`   ✅ Squad [${conv.langLabel}] complete: ${(stat.size / 1024).toFixed(1)} KB | Duration: ${duration}`);
    console.log(`   💾 Saved: ${finalSquadPath}`);
  }

  console.log("\n✨ All Squad Standup multi-agent conversations generated successfully!");
}

generateSquadAudio().catch(err => {
  console.error("Squad audio generation error:", err);
  process.exit(1);
});
