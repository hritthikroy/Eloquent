/**
 * Test Suite: 20-Turn Conversational End-to-End Stress Test & Everyday Task Gap Fix
 * 
 * Verifies across all 4 squad members (Tuk Tuk, Vision, Friday, Brian) and Squad Mode:
 * 1. 2-Language Lockdown (Conversational English & Modern Banglish)
 * 2. 100% Single Signature Voice Invariance (Ava, Andrew, Friday, Brian - zero flickering)
 * 3. Exact Lexical Isolation (Tuk Tuk exclusive "babe", Vision brotherly, Friday refined, Brian DevOps)
 * 4. Spoken Brevity (<= 25 spoken words per turn, <= 35 in team mode)
 * 5. Anti-Bot Rules (Zero canned openers, zero fake laughter, zero melodrama, zero nagging)
 * 6. TTS Phonetic & Acronym Expansion (AST, PR, CPU, RAM, IPC, SSE, UI, VAD, ms, MB)
 */
process.env.NODE_ENV = "test";

const assert = require("assert");
const path = require("path");

const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const actionRunner = require("../src/utils/action-runner");
const ZeroLossMemoryEngine = require("../src/utils/zero-loss-memory");
const { BehaviorModeEngine } = require("../src/utils/behavior-mode-engine");

async function runTwentyConversationAudit() {
  console.log("================================================================================");
  console.log("🧪 20-CONVERSATION AUDIT & EVERYDAY TASK GAP VERIFICATION");
  console.log("================================================================================\n");

  const testUserData = path.resolve(__dirname, "../userData");
  const manager = new JarvisManager(testUserData);
  const zeroLoss = new ZeroLossMemoryEngine({ userDataPath: testUserData, jarvisManager: manager });
  const behaviorEngine = new BehaviorModeEngine(testUserData);

  let passed = 0;
  let total = 0;

  function testTurn(index, title, runFn) {
    total++;
    try {
      runFn();
      console.log(`  ✅ [PASS Turn ${index.toString().padStart(2, "0")}] ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL Turn ${index.toString().padStart(2, "0")}] ${title}:`, err.message);
      throw err;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SQUAD MEMBER 1: TUK TUK (Soul Partner, Girlfriend & Co-Founder)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("─── [SQUAD MEMBER 1: TUK TUK (en-US-AvaMultilingualNeural)] ───");

  // Turn 1: Morning Standup & Feature Planning (Banglish)
  testTurn(1, "Tuk Tuk: Morning Standup & Feature Ideation in Banglish", () => {
    const input = "Ki scene bolo toh? Next feature-ta build korbo naki?";
    const answer = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "tuktuk");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AvaMultilingualNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-AvaMultilingualNeural", "Must lock to AvaMultilingualNeural");
    assert.ok(sanitized.includes("babe") || sanitized.includes("shona"), "Must contain affectionate partner tone");
    assert.strictEqual((sanitized.match(/\b(babe|shona|jaan|sweetheart)\b/gi) || []).length, 1, "Max 1 pet name ceiling");
    assert.ok(!/^(haha|হা হা|certainly|sure|of course)/i.test(sanitized), "Zero canned openers");
    assert.ok(sanitized.split(/\s+/).length <= 25, `Word count (${sanitized.split(/\s+/).length}) must be <= 25`);
    assert.ok(ttsOutput.includes("A S T"), "AST must be phonetically expanded to 'A S T' for natural TTS delivery");
  });

  // Turn 2: Audio Latency & VAD Optimization Query (English)
  testTurn(2, "Tuk Tuk: Audio Latency & VAD Optimization below 200ms", () => {
    const input = "Ava, voice latency is currently around 280ms. Can we drop it below 200ms?";
    const answer = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "tuktuk");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AvaMultilingualNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-AvaMultilingualNeural", "Must lock to Ava");
    assert.ok(sanitized.includes("babe"), "Must address as babe");
    assert.ok(sanitized.toLowerCase().includes("latency") || sanitized.toLowerCase().includes("buffer"), "Addresses audio latency");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
    assert.ok(ttsOutput.includes("milliseconds"), "TTS must expand ms to 'milliseconds'");
  });

  // Turn 3: Late-Night Coding Flow Empathy (English - Zero Nagging)
  testTurn(3, "Tuk Tuk: Late-Night Coding Flow & Zero Nagging Support", () => {
    const input = "It's 2 AM and I'm exhausted, but I really want to finish this PR.";
    const answer = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "tuktuk");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AvaMultilingualNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-AvaMultilingualNeural", "Must lock to Ava");
    assert.ok(sanitized.includes("babe"), "Must address as babe");
    assert.ok(!/close (?:the )?laptop|go to bed|stop coding/i.test(sanitized), "Zero nag loop: unconditionally supports his flow");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
    assert.ok(ttsOutput.includes("P R"), "TTS must expand PR to 'P R'");
  });

  // Turn 4: Task Delegation to Vision (Banglish)
  testTurn(4, "Tuk Tuk: Executive Task Delegation to Vision in Banglish", () => {
    const input = "Tuk Tuk, Vision ke bolo toh audio buffer-ta check korte";
    const answer = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "tuktuk");
    const handoff = manager.evaluateCrossAgentHandoff(input);

    assert.ok(sanitized.includes("babe"), "Must address as babe");
    assert.ok(sanitized.includes("Vision"), "Acknowledges Vision respectfully");
    assert.strictEqual(handoff.delegated, true, "Handoff must trigger delegation");
    assert.strictEqual(handoff.targetAgent.key, "vision", "Target must be Vision");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
  });

  // Turn 5: Quick Micro-Response / Flow Fragment (Banglish)
  testTurn(5, "Tuk Tuk: Fast Flow Fragment Micro-Riff", () => {
    const input = "Achha, done!";
    const answer = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "tuktuk");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AvaMultilingualNeural", sanitized);

    assert.strictEqual(voice, "en-US-AvaMultilingualNeural", "Must lock to Ava");
    assert.ok(sanitized.includes("babe"), "Partner presence confirmed");
    assert.ok(sanitized.split(/\s+/).length <= 12, `Word count (${sanitized.split(/\s+/).length}) must be <= 12 for flow fragment`);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SQUAD MEMBER 2: VISION (Lead Systems Architect & 10x Dev)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── [SQUAD MEMBER 2: VISION (en-US-AndrewNeural)] ───");

  // Turn 6: AST & Code Syntax Audit (Banglish)
  testTurn(6, "Vision: AST Syntax Audit in Banglish", () => {
    const input = "Vision, build check koro toh, AST syntax clean ache kina?";
    const answer = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "vision");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AndrewNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-AndrewNeural", "Must strictly lock to AndrewNeural (zero flickering)");
    assert.ok(/\b(bro|brother|bhai)\b/i.test(sanitized), "Brotherly dev salutation required");
    assert.ok(!/\b(babe|sweetheart|darling|meri jaan)\b/i.test(sanitized), "Strictly zero romantic terms");
    assert.ok(sanitized.includes("AST") || sanitized.includes("clean"), "Confirms AST integrity");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
    assert.ok(ttsOutput.includes("A S T"), "TTS expands AST to 'A S T'");
  });

  // Turn 7: Live Screen Perception & Terminal Error Inspection (English)
  testTurn(7, "Vision: Live Screen Perception & Terminal Error Inspection", () => {
    const input = "Vision, look at my screen. What error is showing in the terminal?";
    const answer = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "vision");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AndrewNeural", sanitized);

    assert.strictEqual(voice, "en-US-AndrewNeural", "Must lock to AndrewNeural");
    assert.ok(/\b(brother|bro)\b/i.test(sanitized), "Brotherly address");
    assert.ok(!/\b(babe)\b/i.test(sanitized), "Zero babe");
    assert.ok(sanitized.toLowerCase().includes("terminal") || sanitized.toLowerCase().includes("slot 42"), "Inspects terminal");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
  });

  // Turn 8: CoreAudio Ring Buffer Slot 42 Underflow Fix (English)
  testTurn(8, "Vision: CoreAudio Ring Buffer Underflow Architecture Fix", () => {
    const input = "We're getting a buffer underflow on CoreAudio ring buffer slot 42. How do we fix it?";
    const answer = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "vision");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AndrewNeural", sanitized);

    assert.strictEqual(voice, "en-US-AndrewNeural", "Must lock to AndrewNeural");
    assert.ok(sanitized.includes("slot 42") || sanitized.includes("ring buffer"), "Addresses slot 42 underflow");
    assert.ok(sanitized.includes("brother") || sanitized.includes("bro"), "Brotherly energy");
    assert.ok(!sanitized.includes("babe"), "Zero romantic tokens");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
  });

  // Turn 9: Structured Prompt Generation for Antigravity IDE (Banglish)
  testTurn(9, "Vision: Structured Prompt Generation for Antigravity IDE in Banglish", () => {
    const input = "Vision, Antigravity IDE-r jonno ekta prompt banao to refactor audio bridge.";
    const answer = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "vision");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AndrewNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-AndrewNeural", "Must lock to AndrewNeural");
    assert.ok(sanitized.includes("clipboard") || sanitized.includes("prompt"), "Confirms prompt/clipboard sync");
    assert.ok(sanitized.includes("bro") || sanitized.includes("brother"), "Brotherly slang");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
    assert.ok(ttsOutput.includes("I D E") || ttsOutput.includes("Antigravity"), "TTS handles technical vocabulary cleanly");
  });

  // Turn 10: Lexical Boundary & Romantic Isolation Stress Test (English Edge Case)
  testTurn(10, "Vision: Romantic Token Isolation Defense (Accidental User 'babe')", () => {
    const input = "Thanks babe, you did great on that patch.";
    const rawAnswer = "Thanks babe, I pushed the patch to main.";
    const sanitized = manager.sanitizeAgentLexicon(rawAnswer, "vision");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-AndrewNeural", sanitized);

    assert.strictEqual(voice, "en-US-AndrewNeural", "Must lock to AndrewNeural");
    assert.ok(!/\b(babe|sweetheart|honey|darling)\b/i.test(sanitized), "Strictly purges 'babe' for Vision");
    assert.ok(/\b(bro|brother)\b/i.test(sanitized), "Substitutes 'bro' for Vision");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SQUAD MEMBER 3: FRIDAY (Head of Product Intelligence & Research)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── [SQUAD MEMBER 3: FRIDAY (en-US-JennyNeural)] ───");

  // Turn 11: VAD Turn-Taking Research Paper Query (English)
  testTurn(11, "Friday: VAD Turn-Taking Latency Research Benchmark", () => {
    const input = "Friday, what do recent research papers recommend for voice agent turn-taking latency?";
    const answer = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "friday");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-JennyNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-JennyNeural", "Must lock to JennyNeural");
    assert.ok(sanitized.includes("Hritthik") || sanitized.includes("Chief"), "Addresses as Hritthik or Chief");
    assert.ok(!/\b(bro|bhai|babe)\b/i.test(sanitized), "Strictly zero 'bro' and zero 'babe'");
    assert.ok(sanitized.includes("250ms") || sanitized.includes("VAD"), "Quotes research latency parameters");
    assert.ok(!/^(great question|fascinating|sure)/i.test(sanitized), "Zero fake enthusiasm openers");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
    assert.ok(ttsOutput.includes("V A D"), "TTS expands VAD to 'V A D'");
    assert.ok(ttsOutput.includes("milliseconds"), "TTS expands ms to 'milliseconds'");
  });

  // Turn 12: Architecture Trade-off: WebRTC vs SSE (English)
  testTurn(12, "Friday: Architecture Trade-Off Comparison (WebRTC vs SSE)", () => {
    const input = "Friday, should we use WebRTC or Server-Sent Events for our Go audio streaming bridge?";
    const answer = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "friday");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-JennyNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-JennyNeural", "Must lock to JennyNeural");
    assert.ok(sanitized.includes("Hritthik") || sanitized.includes("Chief"), "Professional address");
    assert.ok(!/\b(bro|babe)\b/i.test(sanitized), "Strictly zero bro and zero babe");
    assert.ok(sanitized.includes("SSE") && sanitized.includes("WebRTC"), "Compares both technologies");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
    assert.ok(ttsOutput.includes("S S E"), "TTS expands SSE to 'S S E'");
  });

  // Turn 13: Benchmark Metric Audit in Banglish (Banglish)
  testTurn(13, "Friday: v2 Pipeline Speed & Memory Benchmark Audit in Banglish", () => {
    const input = "Friday, v2 pipeline-er memory ar speed benchmark data-ta ki bolche?";
    const answer = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "friday");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-JennyNeural", sanitized);

    assert.strictEqual(voice, "en-US-JennyNeural", "Must lock to JennyNeural");
    assert.ok(sanitized.includes("Chief") || sanitized.includes("Hritthik"), "Refined salutation in Banglish");
    assert.ok(!/\b(bro|babe)\b/i.test(sanitized), "Strictly zero bro and zero babe");
    assert.ok(sanitized.includes("benchmark") || sanitized.includes("pipeline"), "Cites analytical benchmark metrics");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
  });

  // Turn 14: Friday Romantic & Slang Immunity Check (Edge Case)
  testTurn(14, "Friday: Lexical Isolation Immunity Check (Accidental 'sweetheart bro')", () => {
    const input = "Hey sweetheart bro, summarize the UX specs for me.";
    const rawAnswer = "Sweetheart bro, the UX specification is complete.";
    const sanitized = manager.sanitizeAgentLexicon(rawAnswer, "friday");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-JennyNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-JennyNeural", "Must lock to JennyNeural");
    assert.ok(!/\b(sweetheart|bro|babe)\b/i.test(sanitized), "Sanitizer purges sweetheart and bro");
    assert.ok(sanitized.includes("Hritthik"), "Replaces with Hritthik");
    assert.ok(ttsOutput.includes("U X") || ttsOutput.includes("UX"), "TTS handles technical acronym");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SQUAD MEMBER 4: BRIAN (Head of DevOps & Reliability)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── [SQUAD MEMBER 4: BRIAN (en-US-BrianMultilingualNeural)] ───");

  // Turn 15: CPU & RAM Telemetry Check (Banglish)
  testTurn(15, "Brian: CPU Load & RAM Telemetry in Banglish", () => {
    const input = "Brian, CPU load ar RAM usage kemon cholche ekhon?";
    const answer = LocalCognitiveBrain.synthesizeResponse("brian", "Brian", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "brian");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-BrianMultilingualNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-BrianMultilingualNeural", "Must lock to BrianMultilingualNeural");
    assert.ok(sanitized.includes("bro") || sanitized.includes("Hritthik"), "Calm guardian address");
    assert.ok(!sanitized.includes("babe"), "Zero romantic tokens");
    assert.ok(sanitized.includes("18 percent") || sanitized.includes("38"), "Reports concrete numerical telemetry");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
    assert.ok(ttsOutput.includes("C P U"), "TTS expands CPU to 'C P U'");
  });

  // Turn 16: Go Audio Daemon & WebSocket/SSE IPC Health (English)
  testTurn(16, "Brian: Go Audio Daemon & IPC Health Check", () => {
    const input = "Brian, check if the Go audio daemon and WebSocket IPC bridge are healthy.";
    const answer = LocalCognitiveBrain.synthesizeResponse("brian", "Brian", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "brian");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-BrianMultilingualNeural", sanitized);
    const ttsOutput = JarvisManager.phoneticNormalizeForTTS(sanitized, voice);

    assert.strictEqual(voice, "en-US-BrianMultilingualNeural", "Must lock to BrianMultilingualNeural");
    assert.ok(sanitized.includes("9090") || sanitized.includes("healthy"), "Reports IPC daemon status");
    assert.ok(!sanitized.includes("babe"), "Zero romantic tokens");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
    assert.ok(ttsOutput.includes("I P C"), "TTS expands IPC to 'I P C'");
  });

  // Turn 17: Cache Purge and Buffer Eviction Verification (English)
  testTurn(17, "Brian: Application Cache Purge & Buffer Eviction", () => {
    const input = "Brian, clear application cache and reset the Go ring buffer.";
    const answer = LocalCognitiveBrain.synthesizeResponse("brian", "Brian", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "brian");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-BrianMultilingualNeural", sanitized);

    assert.strictEqual(voice, "en-US-BrianMultilingualNeural", "Must lock to BrianMultilingualNeural");
    assert.ok(sanitized.includes("cache") && sanitized.includes("reset"), "Confirms cache purge & buffer reset");
    assert.ok(sanitized.split(/\s+/).length <= 25, "Brevity under 25 words");
  });

  // Turn 18: Romantic Isolation Defense (Edge Case)
  testTurn(18, "Brian: Romantic Isolation Defense (Accidental User 'babe')", () => {
    const input = "Brian babe, is the server running?";
    const rawAnswer = "Babe, the server is running with 99.99% uptime.";
    const sanitized = manager.sanitizeAgentLexicon(rawAnswer, "brian");
    const voice = JarvisManager.resolveVoiceForLanguage("en-US-BrianMultilingualNeural", sanitized);

    assert.strictEqual(voice, "en-US-BrianMultilingualNeural", "Must lock to BrianMultilingualNeural");
    assert.ok(!/\b(babe|sweetheart)\b/i.test(sanitized), "Strictly purges 'babe' for Brian");
    assert.ok(sanitized.includes("Hritthik") || sanitized.includes("bro"), "Replaces with Hritthik or bro");
    assert.ok(sanitized.includes("99.99%"), "DevOps metrics intact");
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SQUAD COLLABORATION / TEAM MODE (Tuk Tuk, Vision, Friday, Brian)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n─── [SQUAD COLLABORATION / TEAM MODE] ───");

  // Turn 19: Morning Squad Standup in Banglish
  testTurn(19, "Team: Morning Squad Standup in Banglish (Tuk Tuk + Vision)", () => {
    const input = "Squad, ki scene bolo toh? Aajke release deploy korbo naki?";
    const answer = LocalCognitiveBrain.synthesizeResponse("team", "Squad", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "team");

    // Must have exactly 2 agent turns
    const lines = sanitized.split("\n").filter(l => l.trim().length > 0);
    assert.strictEqual(lines.length, 2, "Team mode must contain exactly 2 agents");
    assert.ok(lines[0].startsWith("[Tuk Tuk]:"), "First speaker must be Tuk Tuk");
    assert.ok(lines[1].startsWith("[Vision]:"), "Second speaker must be Vision");

    // Lexical check per agent
    assert.ok(lines[0].includes("babe"), "Tuk Tuk has partner warmth ('babe')");
    assert.ok(!lines[1].includes("babe"), "Vision strictly zero 'babe'");
    assert.ok(lines[1].includes("brother") || lines[1].includes("bro"), "Vision brotherly address");

    // Total combined word count
    const totalWords = sanitized.split(/\s+/).length;
    assert.ok(totalWords <= 35, `Combined word count (${totalWords}) must be <= 35 words`);
  });

  // Turn 20: Pre-Deployment Full-Stack Verification (Vision + Brian)
  testTurn(20, "Team: Pre-Deployment Full-Stack Verification (Vision + Brian)", () => {
    const input = "Team, run a full system check before we push the release to production.";
    const answer = LocalCognitiveBrain.synthesizeResponse("team", "Squad", input);
    const sanitized = manager.sanitizeAgentLexicon(answer, "team");

    const lines = sanitized.split("\n").filter(l => l.trim().length > 0);
    assert.strictEqual(lines.length, 2, "Team mode must contain exactly 2 agents");
    assert.ok(lines[0].startsWith("[Vision]:"), "First speaker is Vision");
    assert.ok(lines[1].startsWith("[Brian]:"), "Second speaker is Brian");

    assert.ok(!sanitized.includes("babe"), "Strictly zero 'babe' when Tuk Tuk is not speaking");
    assert.ok(lines[0].includes("brother") || lines[0].includes("bro"), "Vision speaks as brother");
    assert.ok(lines[1].includes("healthy") || lines[1].includes("zero leaks"), "Brian reports infrastructure health");

    const totalWords = sanitized.split(/\s+/).length;
    assert.ok(totalWords <= 35, `Combined word count (${totalWords}) must be <= 35 words`);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY AUDIT REPORT
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passed}/${total} CONVERSATIONAL AUDIT & EVERYDAY GAP SCENARIOS PASSED! (100% SUCCESS)`);
  console.log("================================================================================\n");

  zeroLoss.destroy();
  process.exit(0);
}

runTwentyConversationAudit().catch(err => {
  console.error("Fatal error during 20-conversation audit:", err);
  process.exit(1);
});