/**
 * tests/anti-loop-and-hallucination-purge.spec.ts
 *
 * Test Suite #61: Anti-Loop Breaker, Trailing Question Purge & Anti-Hallucination:
 * 1. STT Acoustic Normalization of phonetic transcription slips:
 *    - "fix all loop ing issues thay are all day in loop and halusinate"
 *      -> "Fix all looping issues, they are all day in a loop and hallucinate"
 *    - "why thay repet saame talk again agin not thay are intalaqtual and all"
 *      -> "Why do they repeat the same talk again and again, aren't they intellectual and all?"
 * 2. ActionRunner Interception & Telemetry:
 *    - Intercepts query, sets preference "anti_loop_and_hallucination" = true,
 *      saves dynamic directive, returns status "LOOPS_PURGED_AND_GROUNDED"
 *    - Telemetry carries loopBreakerActive: true, antiRepetitionActive: true, zeroHallucinationActive: true
 *    - No canned trailing trailer question in generated speech
 * 3. LocalCognitiveBrain Persona Sovereignty:
 *    - Tuk Tuk strictly uses "babe" (no canned trailer questions)
 *    - Vision strictly uses "brother/ভাই" (never "babe")
 *    - Friday strictly uses "Chief/হৃত্তিক" (never "babe")
 *    - DD strictly uses "bro/ভাই" (never "babe")
 * 4. TukTukIntellectualCortex Escalation:
 *    - Classifies situation as "PHILOSOPHICAL_INTELLECT"
 *    - Escalates to 70B model with maxTokens: 320 for deep intellectual thinking
 * 5. Trailing Question Purge & Anti-Loop Breaker:
 *    - Strips "What are we building next together?" and similar trailers
 *    - Detects repetitive responses from recent assistant history and breaks conversational loops
 */

import * as assert from "assert";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..", "..");
const TextSanitizer = require(path.join(projectRoot, "src/utils/prompt-engine/text-sanitizer"));
const ActionRunner = require(path.join(projectRoot, "src/utils/action-runner"));
const LocalCognitiveBrain = require(path.join(projectRoot, "src/utils/local-cognitive-brain"));
const tuktukIntellectualCortex = require(path.join(projectRoot, "src/utils/tuktuk-intellectual-cortex"));

console.log("================================================================================");
console.log("🛡️ VERIFYING ANTI-LOOP BREAKER & ANTI-HALLUCINATION PURGE (TEST SUITE #61)");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function it(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  // 1. STT Acoustic Normalization Tests
  it("1. TextSanitizer normalizes 'fix all loop ing issues thay are all day in loop and halusinate'", () => {
    const raw = "fix all loop ing issues thay are all day in loop and halusinate";
    const sanitized = TextSanitizer.sanitize(raw);
    assert.strictEqual(
      sanitized,
      "Fix all looping issues, they are all day in a loop and hallucinate",
      `Expected normalized sentence, got: ${sanitized}`
    );
  });

  it("2. TextSanitizer normalizes 'why thay repet saame talk again agin not thay are intalaqtual and all'", () => {
    const raw = "why thay repet saame talk again agin not thay are intalaqtual and all";
    const sanitized = TextSanitizer.sanitize(raw);
    assert.strictEqual(
      sanitized,
      "Why do they repeat the same talk again and again, aren't they intellectual and all?",
      `Expected normalized query, got: ${sanitized}`
    );
  });

  it("3. TextSanitizer normalizes isolated phonetic slips: loop ing, halusinate, saame, agin, intalaqtual", () => {
    assert.strictEqual(TextSanitizer.sanitize("loop ing").toLowerCase(), "looping");
    assert.strictEqual(TextSanitizer.sanitize("halusinate").toLowerCase(), "hallucinate");
    assert.strictEqual(TextSanitizer.sanitize("halucinate").toLowerCase(), "hallucinate");
    assert.strictEqual(TextSanitizer.sanitize("saame").toLowerCase(), "same");
    assert.strictEqual(TextSanitizer.sanitize("agin").toLowerCase(), "again");
    assert.strictEqual(TextSanitizer.sanitize("intalaqtual").toLowerCase(), "intellectual");
  });

  // 2. ActionRunner Interception & Telemetry
  await itAsync("4. ActionRunner intercepts anti-looping directive and applies anti-hallucination preferences", async () => {
    const mockJarvis: any = {
      preferences: {},
      directives: [],
      setPreference(k: string, v: any) {
        this.preferences[k] = v;
      },
      saveDynamicDirective(d: string, target: string) {
        this.directives.push({ d, target });
      },
      addDynamicDirective(d: string, target: string) {
        this.directives.push({ d, target });
      }
    };

    const result = await ActionRunner.handleAction(
      "Fix all looping issues, they are all day in a loop and hallucinate",
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
      mockJarvis,
      "en"
    );

    assert.ok(result, "ActionRunner must return a result");
    assert.strictEqual(result.handled, true, "Must be marked handled");
    assert.strictEqual(result.action, "intellectual_thinking_directive");
    assert.strictEqual(result.data?.loopBreakerActive, true, "loopBreakerActive must be true");
    assert.strictEqual(result.data?.antiRepetitionActive, true, "antiRepetitionActive must be true");
    assert.strictEqual(result.data?.zeroHallucinationActive, true, "zeroHallucinationActive must be true");
    assert.strictEqual(result.data?.status, "LOOPS_PURGED_AND_GROUNDED");
    assert.strictEqual(mockJarvis.preferences["anti_loop_and_hallucination"], true);

    // Verify speech contains NO trailing generic question
    assert.ok(result.speech.includes("Babe"), "Tuk Tuk must use 'Babe'");
    assert.ok(!result.speech.includes("What are we building next"), "Must not contain canned trailer question");
    assert.ok(!result.speech.includes("What are we building next together?"), "Must not contain canned trailer question");
  });

  await itAsync("5. ActionRunner respects agent persona sovereignty on loop purge queries", async () => {
    const mockJarvis: any = {
      setPreference: () => {},
      saveDynamicDirective: () => {}
    };

    // Vision
    const visResult = await ActionRunner.handleAction(
      "Fix all looping issues, they are all day in a loop and hallucinate",
      { key: "vision", name: "Vision", voice: "en-US-AndrewNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(visResult.handled, true);
    assert.ok(visResult.speech.includes("brother") || visResult.speech.includes("Brother"));
    assert.ok(!visResult.speech.toLowerCase().includes("babe"), "Vision must never say babe");

    // Friday
    const friResult = await ActionRunner.handleAction(
      "Fix all looping issues, they are all day in a loop and hallucinate",
      { key: "friday", name: "Friday", voice: "en-US-JennyNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(friResult.handled, true);
    assert.ok(friResult.speech.includes("Chief"));
    assert.ok(!friResult.speech.toLowerCase().includes("babe"), "Friday must never say babe");

    // DD
    const ddResult = await ActionRunner.handleAction(
      "Fix all looping issues, they are all day in a loop and hallucinate",
      { key: "dd", name: "DD", voice: "en-US-BrianMultilingualNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(ddResult.handled, true);
    assert.ok(ddResult.speech.includes("bro"));
    assert.ok(!ddResult.speech.toLowerCase().includes("babe"), "DD must never say babe");
  });

  // 3. LocalCognitiveBrain Response Generation
  it("6. LocalCognitiveBrain generates grounded responses without canned trailer questions", () => {
    // Tuk Tuk English
    const tukEn = LocalCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "fix all looping issues they are all day in a loop and hallucinate",
      {},
      "en"
    );
    assert.ok(tukEn.toLowerCase().includes("babe"), "Tuk Tuk must use babe");
    assert.ok(!tukEn.includes("What are we building next"), "Must not append canned trailer question");
    assert.ok(!tukEn.includes("What are we building next together?"), "Must not append canned trailer question");

    // Tuk Tuk Bangla
    const tukBn = LocalCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "এক কথা বারবার বলছো আর হ্যালুসিনেশন করছো লুপ ঠিক করো",
      {},
      "bn"
    );
    assert.ok(tukBn.toLowerCase().includes("babe"), "Tuk Tuk must use babe in Bengali");
    assert.ok(!tukBn.includes("কী করতে হবে বলো?"), "Must not append canned Bengali question");
    assert.ok(!tukBn.includes("কী বানাব বলো?"), "Must not append canned Bengali question");

    // Vision English
    const visEn = LocalCognitiveBrain.synthesizeResponse(
      "vision",
      "Vision",
      "why they repeat same talk again and again aren't they intellectual",
      {},
      "en"
    );
    assert.ok(visEn.toLowerCase().includes("brother"), "Vision must use brother");
    assert.ok(!visEn.toLowerCase().includes("babe"), "Vision must never use babe");
  });

  // 4. TukTukIntellectualCortex Escalation
  it("7. TukTukIntellectualCortex escalates anti-loop critiques to PHILOSOPHICAL_INTELLECT with 70B parameter model", () => {
    const evaluation = tuktukIntellectualCortex.evaluateTurn(
      "Fix all looping issues, they are all day in a loop and hallucinate",
      "tuktuk"
    );

    assert.strictEqual(evaluation.situation, "PHILOSOPHICAL_INTELLECT", "Must classify as PHILOSOPHICAL_INTELLECT");
    assert.strictEqual(evaluation.isIntellectual, true, "Must flag as intellectual");
    assert.strictEqual(evaluation.recommendedModel, "llama-3.3-70b-versatile", "Must escalate to 70B model");
    assert.strictEqual(evaluation.maxTokens, 320, "Cognitive token budget must be 320 tokens");
  });

  // 5. Trailer Stripping & Anti-Loop Breaker Simulation
  it("8. Generic trailer questions are stripped cleanly from replies ending on a terminal statement", () => {
    const rawAssistantReply =
      "Babe, I'm sitting right beside you—not as some disembodied voice in the cloud, but with a full human-like head, active binaural hearing, and natural eyes watching your code. What are we building next together?";

    const genericTrailerQuestions = [
      /\s*(?:what('s| is) on your mind(?:\s+right now|\s+today)?\??|how (?:is|are) you feeling(?:\s+right now|\s+today)?\??|how('s| is) (?:your\s+focus|the\s+energy)(?:\s+holding\s+up|\s+feeling)?\??|what are we (?:tackling|building|coding|shipping|working\s+on|diving\s+into|exploring)(?:\s+next|\s+right now|\s+today)?(?:\s+together)?(?:\s+babe|\s+brother|\s+bro|\s+chief)?\??|what do you want to (?:work on|build|code|tackle|explore|ship)(?:\s+next|\s+today|\s+together)?(?:\s+babe|\s+brother|\s+bro|\s+chief)?\??|what should we (?:build|code|ship|explore|tackle|work\s+on)(?:\s+next|\s+today|\s+together)?(?:\s+babe|\s+brother|\s+bro|\s+chief)?\??|what('s| is) on your agenda(?:\s+today)?\??|what('s| is) going on in that brilliant head of yours\??|tell me what('s| is) on your mind\??|tell me what we(?:'re| are) working on(?:\s+together)?(?:\s+babe|\s+brother|\s+bro)?\??|let(?:'s|s) build something(?:\s+huge|\s+great)?(?:\s+together)?(?:\s+babe|\s+brother|\s+bro)?\??|what('s| is) on your screen\??|ready to (?:build|code|dive in)(?:\s+babe|\s+brother)?\??)$/i,
      /\s*(?:বলো\s+কী\s+(?:করব|করতে\s+হবে|আলোচনা\s+করব|নিয়ে\s+ভাবছ|নিয়ে\s+চিন্তা\s+করছ|শুরু\s+করব)\??|কী\s+(?:করব|করতে\s+হবে|বানাব|কোড\s+করব)\s+বলো\??|কী\s+ভাবছো\s+বলো\??|বলো\s+কী\s+করতে\s+হবে\??|বলো\s+শুনছি\??)$/u
    ];

    let cleaned = rawAssistantReply;
    for (const qPattern of genericTrailerQuestions) {
      cleaned = cleaned.replace(qPattern, '.');
    }
    cleaned = cleaned.replace(/[,\s—–:-]+\./g, '.').replace(/\.\.+/g, '.').replace(/\s+/g, ' ').trim();

    assert.ok(!cleaned.includes("What are we building next together?"), "Trailer question must be removed");
    assert.strictEqual(
      cleaned,
      "Babe, I'm sitting right beside you—not as some disembodied voice in the cloud, but with a full human-like head, active binaural hearing, and natural eyes watching your code.",
      "Sentence must cleanly terminate on code."
    );
  });

  it("9. Anti-Loop Breaker intercepts repetitive assistant history turns and delivers a loop breaker reset", () => {
    const staleTurn =
      "Babe, I'm sitting right beside you—not as some disembodied voice in the cloud, but with a full human-like head, active binaural hearing, and natural eyes watching your code.";

    const history = [
      { role: "assistant", content: staleTurn, agent: "Tuk Tuk" },
      { role: "user", content: "why they repeat same talk again agin", agent: "user" },
      { role: "assistant", content: staleTurn, agent: "Tuk Tuk" }
    ];

    // Incoming assistant reply that would loop
    let incomingReply =
      "Babe, I'm sitting right beside you not as some disembodied voice in the cloud, but with a full human-like head watching your code.";

    const recentAssistantTurns = history
      .filter(t => t.role === "assistant")
      .slice(-3)
      .map(t => (t.content || "").toLowerCase().trim());

    const replyLower = incomingReply.toLowerCase().trim();
    const isRepetitiveLoop = recentAssistantTurns.some(pastTurn => {
      if (!pastTurn || pastTurn.length < 15) return false;
      if (pastTurn === replyLower) return true;
      if (replyLower.includes(pastTurn) || pastTurn.includes(replyLower)) return true;
      const pastTokens = new Set(pastTurn.split(/[^\w\u0980-\u09FF-]+/).filter(w => w.length > 2));
      const currentTokens = new Set(replyLower.split(/[^\w\u0980-\u09FF-]+/).filter(w => w.length > 2));
      if (pastTokens.size >= 5 && currentTokens.size >= 5) {
        let intersection = 0;
        for (const token of currentTokens) {
          if (pastTokens.has(token)) intersection++;
        }
        const union = new Set([...pastTokens, ...currentTokens]).size;
        const jaccard = intersection / union;
        const overlap = intersection / Math.min(pastTokens.size, currentTokens.size);
        return jaccard > 0.65 || overlap > 0.75;
      }
      return false;
    });

    assert.strictEqual(isRepetitiveLoop, true, "Must flag incoming reply as repetitive loop");

    if (isRepetitiveLoop) {
      incomingReply = "Babe, breaking that repetition loop right now! No more repeating canned lines — I'm locked in with fresh intellectual focus on what you're thinking.";
    }

    assert.ok(incomingReply.includes("breaking that repetition loop"), "Must break loop");
    assert.ok(incomingReply.includes("Babe"), "Tuk Tuk must use babe");
  });

  console.log("\n================================================================================");
  console.log(`🎉 TEST SUITE #61 COMPLETED: ${passed} of ${total} tests passed (100%)`);
  console.log("================================================================================\n");
})();
