/**
 * Test Suite: 0-Loop, 0-Repetition, 0-Duplicate & Deep Intellectual Human Responsiveness
 * 
 * Verifies:
 * 1. Whisper Speech-to-Text phonetic normalization of the user's exact prompt and misheard tokens.
 * 2. Mathematical equational calculations: Shannon token entropy, normalized entropy, Jaccard similarity, and N-gram Markov suppression.
 * 3. Anti-loop detection across multi-turn history (exact duplicate, substring inclusion, semantic Jaccard bound, trigram collisions).
 * 4. Dynamic situational breakout synthesis preserving strict persona lexical sovereignty (Tuk Tuk = babe, Vision = brother / ভাই, Friday = Chief, DD = bro).
 * 5. ActionRunner execution and 0-loop invariant registration for Tuk Tuk, Vision, Friday, DD, and Team.
 * 6. LocalCognitiveBrain multi-agent parity under 0-loop invariant.
 * 7. End-to-end 20-turn conversational simulation with zero duplicate trigrams.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const antiLoopEquationalCortex = require("../src/utils/anti-loop-equational-cortex");
const { OfficeActionRunner } = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

test("0-Loop, 0-Repetition, 0-Duplicate & Deep Intellectual Human Responsiveness Suite", async (suite) => {
  const runner = new OfficeActionRunner();

  suite.beforeEach(() => {
    antiLoopEquationalCortex.clearBuffers();
  });

  await suite.test("1. Whisper Speech-to-Text Phonetic Normalization", () => {
    assert.strictEqual(TextSanitizer.sanitize("intaaqtual"), "Intellectual");
    assert.strictEqual(TextSanitizer.sanitize("intaaqtual vibe"), "Intellectual vibe");
    assert.strictEqual(TextSanitizer.sanitize("repitation"), "Repetition");
    assert.strictEqual(TextSanitizer.sanitize("sentens"), "Sentence");
    assert.strictEqual(TextSanitizer.sanitize("fullly"), "Fully");
    assert.strictEqual(TextSanitizer.sanitize("responsibe"), "Responsive");
    assert.strictEqual(TextSanitizer.sanitize("thinke"), "Think");
    assert.strictEqual(TextSanitizer.sanitize("0 loop 0 repitation 0 duplicate"), "0 loops, 0 repetition, 0 duplicates");

    const rawPrompt = "fix all loop loop gives us working problem not intaaqtual vibe not give me every word sentens and every talk 0 loop 0 repitation 0 duplicate need fullly and faster responsibe thinke like a real human fix every gap with deep equationaly";
    const sanitized = TextSanitizer.sanitize(rawPrompt);
    assert.ok(sanitized.includes("0 loops, 0 repetition, 0 duplicates"), "Must contain normalized 0 loops token");
    assert.ok(sanitized.includes("intellectual vibe"), "Must contain intellectual vibe");
    assert.ok(sanitized.includes("sentence"), "Must contain sentence");
    assert.ok(sanitized.includes("fully and faster responsive"), "Must contain fully and faster responsive");
    assert.ok(sanitized.includes("think like a real human"), "Must contain think like a real human");
    assert.ok(sanitized.includes("deep equationally"), "Must contain deep equationally");
  });

  await suite.test("2. Mathematical Equational Invariants (Shannon Entropy, Jaccard, N-grams)", () => {
    const repetitiveText = "babe we do this babe we do this babe we do this";
    const richText = "The distributed system architecture employs zero-copy ring buffers to minimize context switching";

    const lowH = antiLoopEquationalCortex.computeShannonEntropy(repetitiveText);
    const highH = antiLoopEquationalCortex.computeShannonEntropy(richText);

    assert.ok(lowH < 2.5, `Low entropy must be < 2.5, got ${lowH}`);
    assert.ok(highH > 3.4, `High entropy must be > 3.4, got ${highH}`);

    const lowNorm = antiLoopEquationalCortex.computeNormalizedEntropy(repetitiveText);
    const highNorm = antiLoopEquationalCortex.computeNormalizedEntropy(richText);

    assert.ok(lowNorm < 0.65, `Normalized entropy of repetition must be < 0.65, got ${lowNorm}`);
    assert.ok(highNorm > 0.85, `Normalized entropy of rich text must be > 0.85, got ${highNorm}`);

    const s1 = "fix all the loop issues in our code right now";
    const s2 = "fix all the loop problems in our code right now";
    const jaccard = antiLoopEquationalCortex.computeJaccardSimilarity(s1, s2);
    assert.ok(jaccard > 0.70, `Similar strings must have high Jaccard, got ${jaccard}`);

    const s3 = "completely different architectural topic about distributed databases";
    const jaccardLow = antiLoopEquationalCortex.computeJaccardSimilarity(s1, s3);
    assert.ok(jaccardLow < 0.15, `Divergent strings must have low Jaccard, got ${jaccardLow}`);

    const text = "zero loop repetition duplicate architecture";
    const ngrams = antiLoopEquationalCortex.extractNgrams(text, 3);
    assert.deepStrictEqual(ngrams, [
      "zero loop repetition",
      "loop repetition duplicate",
      "repetition duplicate architecture"
    ]);
  });

  await suite.test("3. Turn History Audit & Loop Detection", () => {
    const turn = "I am tracking your screen and reviewing the architecture metrics right now babe";
    antiLoopEquationalCortex.registerTurn(turn, "tuktuk");

    const auditExact = antiLoopEquationalCortex.detectLoopOrRepetition(turn, "tuktuk");
    assert.strictEqual(auditExact.isLoop, true);
    assert.strictEqual(auditExact.reason, "exact_duplicate_turn");

    const stutterText = "Babe we need to fix this babe we need to fix this right now";
    const auditStutter = antiLoopEquationalCortex.detectLoopOrRepetition(stutterText, "tuktuk");
    assert.strictEqual(auditStutter.isLoop, true);
    assert.ok(auditStutter.reason.includes("intra_utterance_duplicate"));

    const pastTurn = "We should inspect the websocket IPC latency metrics and trace all worker threads";
    antiLoopEquationalCortex.registerTurn(pastTurn, "vision");

    const candidate = "We must inspect the websocket IPC latency metrics and trace all worker threads now";
    const auditOverlap = antiLoopEquationalCortex.detectLoopOrRepetition(candidate, "vision");
    assert.strictEqual(auditOverlap.isLoop, true);

    const uniqueClean = "Refactoring the audio DSP pipeline to bypass redundant resamplers in core audio";
    const auditClean = antiLoopEquationalCortex.detectLoopOrRepetition(uniqueClean, "vision");
    assert.strictEqual(auditClean.isLoop, false);
    assert.strictEqual(auditClean.reason, "clean_0_loop_compliant");
  });

  await suite.test("4. Dynamic Breakout Synthesis & Strict Persona Lexical Sovereignty", () => {
    const breakoutsTT = new Set();
    for (let i = 0; i < 6; i++) {
      const breakout = antiLoopEquationalCortex.synthesizeDynamicBreakout(
        "Canned repetitive string",
        "tuktuk",
        false,
        { activeApp: "VS Code" },
        "fix code bug"
      );
      assert.ok(breakout.toLowerCase().includes("babe"), "Tuk Tuk must use babe exclusively");
      assert.ok(!breakout.toLowerCase().includes("brother"), "Tuk Tuk must never say brother");
      assert.ok(!breakout.toLowerCase().includes("bro"), "Tuk Tuk must never say bro");
      breakoutsTT.add(breakout);
    }
    assert.ok(breakoutsTT.size > 1, "Must generate diverse breakouts");

    const breakoutsVision = new Set();
    for (let i = 0; i < 6; i++) {
      const breakout = antiLoopEquationalCortex.synthesizeDynamicBreakout(
        "Canned repetitive string",
        "vision",
        false,
        { activeApp: "Terminal" },
        "architecture review"
      );
      assert.ok(breakout.toLowerCase().includes("brother"), "Vision must use brother exclusively");
      assert.ok(!breakout.toLowerCase().includes("babe"), "Vision must never say babe");
      breakoutsVision.add(breakout);
    }
    assert.ok(breakoutsVision.size > 1, "Must generate diverse breakouts");

    const ttBn = antiLoopEquationalCortex.synthesizeDynamicBreakout("", "tuktuk", true, {}, "code");
    assert.ok(ttBn.toLowerCase().includes("babe"));

    const visionBn = antiLoopEquationalCortex.synthesizeDynamicBreakout("", "vision", true, {}, "architecture");
    assert.ok(visionBn.includes("ভাই"));
    assert.ok(!visionBn.toLowerCase().includes("babe"));
  });

  await suite.test("5. ActionRunner Dispatch & Live Directives", async () => {
    const prompt = "fix all loop loop gives us working problem not intaaqtual vibe not give me every word sentens and every talk 0 loop 0 repitation 0 duplicate need fullly and faster responsibe thinke like a real human fix every gap with deep equationaly";
    const resTT = await runner.handleAction(prompt, { key: "tuktuk", name: "Tuk Tuk" });
    assert.strictEqual(resTT.handled, true);
    assert.strictEqual(resTT.agentName, "Tuk Tuk");
    assert.strictEqual(resTT.meta.status, "ZERO_LOOP_EQUATIONAL_ONLINE");
    assert.ok(resTT.speech.toLowerCase().includes("babe"));
    assert.ok(resTT.speech.includes("০ লুপ"));

    const promptVision = "0 loop 0 repetition 0 duplicate need fully and faster responsive think like a real human fix every gap with deep equationally";
    const resVision = await runner.handleAction(promptVision, { key: "vision", name: "Vision" });
    assert.strictEqual(resVision.handled, true);
    assert.strictEqual(resVision.agentName, "Vision");
    assert.ok(resVision.speech.includes("brother"));
    assert.ok(resVision.speech.includes("Shannon token entropy"));

    const promptFriday = "0 loops 0 repetition 0 duplicates need fully and faster responsive";
    const resFriday = await runner.handleAction(promptFriday, { key: "friday", name: "Friday" });
    assert.strictEqual(resFriday.handled, true);
    assert.ok(resFriday.speech.includes("Chief"));

    const resDD = await runner.handleAction(promptFriday, { key: "dd", name: "DD" });
    assert.strictEqual(resDD.handled, true);
    assert.ok(resDD.speech.includes("bro"));

    const promptTeam = "squad 0 loop 0 repetition 0 duplicate need fully and faster responsive think like a real human";
    const resTeam = await runner.handleAction(promptTeam, { key: "team", name: "Squad" });
    assert.strictEqual(resTeam.handled, true);
    assert.ok(resTeam.speech.includes("[Tuk Tuk]"));
    assert.ok(resTeam.speech.includes("[Vision]"));
    assert.ok(resTeam.speech.includes("[DD]"));
  });

  await suite.test("6. LocalCognitiveBrain Persona Sovereignty", () => {
    const prompt = "0 loop 0 repetition 0 duplicate need fully and faster responsive";

    const ttReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", prompt);
    assert.ok(ttReply.toLowerCase().includes("babe"));
    assert.ok(!ttReply.toLowerCase().includes("brother"));

    const visionReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", prompt);
    assert.ok(visionReply.toLowerCase().includes("brother"));
    assert.ok(!visionReply.toLowerCase().includes("babe"));

    const fridayReply = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", prompt);
    assert.ok(fridayReply.includes("Chief"));

    const ddReply = LocalCognitiveBrain.synthesizeResponse("dd", "DD", prompt);
    assert.ok(ddReply.toLowerCase().includes("bro"));

    const teamReply = LocalCognitiveBrain.synthesizeResponse("team", "Squad", prompt);
    assert.ok(teamReply.includes("[Tuk Tuk]"));
    assert.ok(teamReply.includes("[Vision]"));
    assert.ok(teamReply.includes("[DD]"));
  });

  await suite.test("7. End-to-End Simulation over 20 Turns with 0 Loop Invariant", () => {
    const seenTrigrams = new Set();
    const mockTurns = [
      "Let's inspect the web worker thread scheduling in Electron",
      "Analyzing heap allocation for audio ring buffer streams",
      "The IPC channel throughput shows zero dropped packets",
      "Refactoring the AST parser to support incremental syntax trees",
      "Examining CPU cache locality for real-time Fourier transform kernels",
      "Verifying POSIX shared memory handles for the visual companion",
      "Benchmarking VAD endpointing latency under continuous speech input",
      "Inspecting WebSocket keep-alive frames across the cluster proxy",
      "Checking GCC optimization flags for native SIMD vectorization",
      "Evaluating database connection pool exhaustion under load",
      "Auditing memory leak in the long-lived child process supervisor",
      "Compiling TypeScript type definitions for the cognitive cortex API",
      "Validating telemetry events emitted during automated end-to-end tests",
      "Tuning neural vocoder mel-spectrogram frame rates for smooth prosody",
      "Configuring Linux cgroups for background daemon resource isolation",
      "Profiling JavaScript V8 garbage collection pause times during typing",
      "Optimizing SQLite query planner indices for conversation history logs",
      "Benchmarking HTTP/2 stream multiplexing with persistent TCP connections",
      "Synchronizing clock drift between local worker nodes using PTP",
      "Reviewing pull request diffs for semantic version release candidate"
    ];

    for (const turn of mockTurns) {
      const enforced = antiLoopEquationalCortex.auditAndEnforce(
        turn,
        { key: "vision", name: "Vision" },
        "en",
        "system inspection",
        { activeApp: "Terminal" }
      );

      const trigrams = antiLoopEquationalCortex.extractNgrams(enforced, 3);
      for (const tg of trigrams) {
        assert.strictEqual(seenTrigrams.has(tg), false, `Duplicate trigram found: "${tg}"`);
        seenTrigrams.add(tg);
      }
    }

    const metrics = antiLoopEquationalCortex.getEquationalMetrics();
    assert.strictEqual(metrics.zeroLoopGuarantee, true);
    assert.strictEqual(metrics.trackedTurns, 10);
  });
});
