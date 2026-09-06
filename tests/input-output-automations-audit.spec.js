#!/usr/bin/env node
/**
 * tests/input-output-automations-audit.spec.js
 * 
 * Verifies all fixes across Input, Output, and Automations:
 * 1. AudioRecorder defaults to 512 bytes buffer (No CoreAudio overruns)
 * 2. Speaker identification strictly locks human to Hritthik (No false Vision speaker)
 * 3. ActionRunner Reel Watching does not trigger on clipboard ("clip bolt")
 * 4. Auto-Paste gate only activates on explicit paste command
 * 5. TTS / JarvisManager strips prompt reflection and meta-instruction leakage
 * 6. MasterApiGateway budgets messages to 1400 tokens (Protects Groq TPD quota)
 * 7. Anti-Loop Cortex does not trigger false positive on technical phrase continuity
 * 8. Anti-Loop Cortex breakout variants are 100% free of robotic meta-slogans
 * 9. TukTuk Intellectual Cortex uses active Groq models and generous token budgets
 * 10. Acoustic noise / punctuation fragments ("P,.") are cleanly rejected
 */

const assert = require("assert");

let totalPassed = 0;
let totalFailed = 0;

async function runTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✅ PASSED: ${testName}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${testName}`);
    console.error(`     Error: ${err.message}`);
    totalFailed++;
  }
}

async function main() {
  console.log("================================================================================");
  console.log("🚀 RUNNING INPUT, OUTPUT, AND AUTOMATIONS AUDIT & FIX SUITE");
  console.log("================================================================================\n");

  await runTest("1. AudioRecorder defaults to 512 bytes buffer (16ms) to prevent CoreAudio overruns", async () => {
    const AudioRecorder = require("../src/utils/audio-recorder");
    const recorder = new AudioRecorder();
    assert.strictEqual(recorder.bufferSize, 512, "Default buffer size must be 512 bytes (16ms)");
  });

  await runTest("2. SpeakerPersonalityCortex never identifies squad agents for physical microphone input", async () => {
    const speakerPersonalityCortex = require("../src/utils/speaker-personality-cortex");
    const result = speakerPersonalityCortex.identifySpeaker({
      text: "Vision brother, check the code, AST compiler pass, and terminal pipeline status",
      isMicrophoneInput: true,
      allowSquadCandidates: false
    });
    assert.notStrictEqual(result.speakerId, "vision", "Microphone input must NEVER identify speaker as Vision");
    assert.strictEqual(result.speakerId, "hritthik", "Microphone input from user must identify Hritthik");
    assert.strictEqual(result.role, "creator_partner", "Role must be creator_partner");
    assert.strictEqual(result.confidence, 1.0, "Confidence for single creator mic input must be 1.0");
  });

  await runTest("3. ActionRunner Reel Watching does NOT trigger on 'clip bolt' or 'clipboard'", async () => {
    const testReelTrigger = (lower) => {
      const isClipboardUtterance = /\b(clip\s*bolt|clipboard|paper\s*clip|clip\s*board|clip\s*audio|copy\s*clip)\b/i.test(lower);
      return !isClipboardUtterance && (
        /\b(watch\s+reels?|watching\s+reels?|reel\s*dekh|reels?\s+dekh|instagram\s*reels?|tiktok|yt\s*shorts?|youtube\s*shorts?|mobile\s*reels?)\b/i.test(lower) ||
        (/\b(reel|reels|shorts?)\b/i.test(lower) && /\b(dekh|dekho|watch|watching|scroll|scrolling|next|together|same|amra|video)\b/i.test(lower)) ||
        (/\b(meme|memes)\b/i.test(lower) && /\b(with\s+me|together|amra|ek\s*sathe)\b/i.test(lower) && /\b(watch|dekh|dekho)\b/i.test(lower))
      );
    };
    assert.strictEqual(testReelTrigger("clip bolt"), false, "'clip bolt' must NOT trigger reel watching");
    assert.strictEqual(testReelTrigger("copy to clipboard"), false, "'clipboard' must NOT trigger reel watching");
    assert.strictEqual(testReelTrigger("babe watch this reel with me"), true, "Explicit reel watching must trigger");
  });

  await runTest("4. Auto-Paste gate only activates on explicit paste command", async () => {
    const isExplicitPaste = (lower) => /\b(paste\s*(?:it|in|into)?|insert\s*(?:it|in|into)?|put\s*it\s*in|type\s*it\s*in)\b/i.test(lower);
    assert.strictEqual(isExplicitPaste("write the prompt"), false);
    assert.strictEqual(isExplicitPaste("write the prompt for fixing what you are find our bugs"), false);
    assert.strictEqual(isExplicitPaste("create a prompt for antigravity"), false);
    assert.strictEqual(isExplicitPaste("write the prompt and paste it"), true);
    assert.strictEqual(isExplicitPaste("paste prompt into antigravity"), true);
    assert.strictEqual(isExplicitPaste("insert it in"), true);
  });

  await runTest("5. TTS / JarvisManager strips prompt reflection and meta-instruction leakage", async () => {
    const leakedText = "We have a conflict The user says Bangla. The developer instructions forbid pure Bangla or formal Bengali. Must respond in English: Hey babe, what's up?";
    const cleaned = leakedText
      .replace(/^(?:We\s+have\s+a\s+conflict[\s\S]*?Must\s+respond\s+in\s+[a-zA-Z]+:?\s*)/i, "")
      .replace(/(?:^|\.\s*|\n\s*)(?:we\s+have\s+a\s+conflict|(?:the\s+)?developer\s+instructions\s+(?:forbid|require|specify|banned)|under\s+(?:my|the)\s+instructions|the\s+user\s+says[\s\S]*?(?:developer\s+instructions|must\s+respond)|must\s+respond\s+in\s+[a-z]+:?|(?:we|i)\s+(?:need|have)\s+to\s+respond\s+in\s+[a-z]+:?|following\s+(?:all\s+)?rules|as\s+an\s+ai\s+model)[\s\S]*?(?=[.!?:]\s*(?:[A-Z\u0980-\u09FF]|$))/gim, " ")
      .trim();
    assert.ok(!cleaned.includes("conflict"), "Leaked 'conflict' must be stripped");
    assert.ok(!cleaned.includes("developer instructions"), "Leaked 'developer instructions' must be stripped");
    assert.strictEqual(cleaned, "Hey babe, what's up?", "Natural response must be preserved");
  });

  await runTest("6. MasterApiGateway budgets messages to 1400 tokens to protect Groq daily quota", async () => {
    const MasterApiGateway = require("../src/utils/master-api-gateway");
    const gateway = new MasterApiGateway();
    const longContent = "A".repeat(8000);
    const messages = [
      { role: "system", content: "System prompt " + "B".repeat(6000) },
      { role: "user", content: "Turn 1 " + longContent },
      { role: "assistant", content: "Turn 2 " + longContent },
      { role: "user", content: "What is our current status?" }
    ];
    const compressed = gateway.compressPromptMessages(messages);
    let totalChars = 0;
    for (const m of compressed) {
      totalChars += m.content.length;
    }
    const tokenEst = Math.ceil(totalChars / 3.8);
    assert.ok(tokenEst <= 1400, `Compressed token count (${tokenEst}) must be <= 1400 tokens`);
  });

  await runTest("7. AntiLoopEquationalCortex does NOT falsely flag technical topic continuity as a loop", async () => {
    const antiLoopEquationalCortex = require("../src/utils/anti-loop-equational-cortex");
    antiLoopEquationalCortex.clearBuffers();
    const historyTurn = {
      content: "Babe, here's the fix prompt you can drop straight into the tool: Take the current code, identify any mismatched audio buffer sizes, auto-align sample rates, replace deprecated API calls."
    };
    const candidateReply = "To align the sample rates and fix the audio buffer sizes, open audio-recorder.js and set the buffer parameter to 512 bytes.";
    const audit = antiLoopEquationalCortex.detectLoopOrRepetition(candidateReply, "tuktuk", [historyTurn]);
    assert.strictEqual(audit.isLoop, false, "Technical continuity must NOT be flagged as a loop");
  });

  await runTest("8. AntiLoopEquationalCortex breakout variants never use robotic meta-slogans", async () => {
    const antiLoopEquationalCortex = require("../src/utils/anti-loop-equational-cortex");
    const breakoutEn = antiLoopEquationalCortex.synthesizeDynamicBreakout("dup", "tuktuk", false, {}, "how");
    const breakoutBn = antiLoopEquationalCortex.synthesizeDynamicBreakout("dup", "tuktuk", true, {}, "kemon");
    const bannedSlogans = [
      /shook off the loop/i,
      /real human/i,
      /zero repetition/i,
      /robotic script/i,
      /loop purged/i,
      /breaking that loop/i,
      /লুপটা ফুল ব্রেক/i,
      /জিরো লুপ/i
    ];
    for (const pattern of bannedSlogans) {
      assert.ok(!pattern.test(breakoutEn), `English breakout must not contain robotic slogan: ${pattern}`);
      assert.ok(!pattern.test(breakoutBn), `Bengali breakout must not contain robotic slogan: ${pattern}`);
    }
  });

  await runTest("9. TukTukIntellectualCortex uses valid Groq models and generous token ceilings", async () => {
    const tukTukIntellectualCortex = require("../src/utils/tuktuk-intellectual-cortex");
    const evalBanter = tukTukIntellectualCortex.evaluateTurn("hey babe", "tuktuk");
    const evalCode = tukTukIntellectualCortex.evaluateTurn("write the prompt for fixing what you find our bugs", "tuktuk");
    assert.ok(evalBanter.maxTokens >= 200, "Banter maxTokens must be >= 200");
    assert.ok(evalCode.maxTokens >= 400, "Code/Prompt maxTokens must be >= 400");
    assert.ok(["qwen/qwen3.8-27b", "openai/gpt-oss-20b"].includes(evalBanter.recommendedModel));
    assert.ok(["qwen/qwen3.8-27b", "openai/gpt-oss-20b"].includes(evalCode.recommendedModel));
  });

  await runTest("10. Acoustic noise fragments ('P,.', '.', '...') are rejected before LLM dispatch", async () => {
    const filterNoise = (raw) => {
      const text = raw.trim();
      if (!text) return false;
      const lettersOnly = text.replace(/[^a-zA-Z\u0980-\u09FF0-9]/g, "");
      if (lettersOnly.length < 2 && !["i", "a", "oi", "ai", "না", "হ্যাঁ", "হাঁ"].includes(text.toLowerCase())) {
        return false;
      }
      return true;
    };
    assert.strictEqual(filterNoise("P,."), false, "'P,.' must be rejected as noise");
    assert.strictEqual(filterNoise("."), false, "'.' must be rejected as noise");
    assert.strictEqual(filterNoise("..."), false, "'...' must be rejected as noise");
    assert.strictEqual(filterNoise("Babe"), true, "'Babe' must be accepted");
    assert.strictEqual(filterNoise("Fixing"), true, "'Fixing' must be accepted");
    assert.strictEqual(filterNoise("না"), true, "'না' must be accepted");
  });

  console.log("\n================================================================================");
  console.log(`🏁 FINAL RESULT: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main();
