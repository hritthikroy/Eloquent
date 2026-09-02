// 4-Agent Voice Team Test Suite
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs = require("fs");
const { execSync } = require("child_process");

const AGENTS = [
  {
    key: "ava",
    name: "Ava",
    role: "Executive Co-Pilot & Director",
    voice: "en-US-AvaNeural",
    sample: "Hello Hritthik. I am Ava, your Executive Co-Pilot. I coordinate our full team and keep all operations moving forward smoothly."
  },
  {
    key: "andrew",
    name: "Andrew",
    role: "Lead Software Engineer",
    voice: "en-US-AndrewNeural",
    sample: "Hey Hritthik, Andrew here. I handle system architecture, deep code refactoring, and technical implementation."
  },
  {
    key: "jenny",
    name: "Jenny",
    role: "Research & Intelligence Specialist",
    voice: "en-US-JennyNeural",
    sample: "Hi Hritthik, I am Jenny. I handle deep research, data synthesis, competitor analysis, and organizational intelligence."
  },
  {
    key: "brian",
    name: "Brian",
    role: "System QA & Operations Commander",
    voice: "en-US-BrianNeural",
    sample: "Greetings, sir. Brian at your service. All system telemetry, automated test suites, and operational checks are green."
  }
];

async function playAgent(agent) {
  console.log("\n🎙️ Synthesizing " + agent.name + " (" + agent.role + ")...");
  console.log("   Voice: " + agent.voice);
  console.log("   Text: \"" + agent.sample + "\"");

  const tts = new MsEdgeTTS();
  await tts.setMetadata(agent.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const res = await tts.toFile("/tmp", agent.sample);
  const outPath = "/tmp/test_voice_" + agent.key + ".mp3";
  fs.renameSync(res.audioFilePath, outPath);

  console.log("🔊 Playing " + agent.name + " through speakers...");
  execSync("afplay " + outPath);
  console.log("✅ " + agent.name + " finished speaking.");
}

async function run() {
  const targetKey = process.argv[2] ? process.argv[2].toLowerCase().trim() : null;

  if (targetKey) {
    const found = AGENTS.find(a => a.key === targetKey || a.name.toLowerCase() === targetKey);
    if (!found) {
      console.error("❌ Agent \"" + targetKey + "\" not found. Available: ava, andrew, jenny, brian");
      process.exit(1);
    }
    await playAgent(found);
  } else {
    console.log("=========================================");
    console.log("🎧 4-AGENT AUTONOMOUS VOICE TEAM ROLLCALL");
    console.log("=========================================");
    for (const a of AGENTS) {
      await playAgent(a);
    }
    console.log("\n✨ All 4 agent voices tested and verified!");
  }
}

run().catch(err => {
  console.error("❌ Test voices error:", err);
  process.exit(1);
});
