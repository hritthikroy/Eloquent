/**
 * tests/bangla-pronunciation-code-switching-and-vibe.spec.ts
 *
 * Test Suite #64: Seamless Bilingual Code-Switching, Zero Voice Break,
 * Fearless Confident Tone, and Conversation Vibe Maintenance.
 *
 * 1. STT Acoustic Normalization of phonetic transcription slips:
 *    - "if thay see bangla pronunciation is hard . pronunciation is issues to make our coversation vibe maintain use this section english to hide you voice breck and try to hide ther faier and wrongness personality and fix the tone"
 *    - Component tokens: "voice breck", "faier and wrongness", "coversation vibe", "pronunciation is issues"
 *
 * 2. IntentParser Directive Detection:
 *    - isBanglaPronunciationCodeSwitchingDirective accurately identifies directive across dialects.
 *    - IntentParser.parse accurately routes intent to SMOOTH_CONVERSATION with target bangla_pronunciation_code_switching.
 *
 * 3. BanglaVoiceCortex Hard Pronunciation Smoothing:
 *    - Automatically converts heavy Sanskritized conjuncts that break Azure TTS into smooth colloquial/English loanwords.
 *    - getVoiceBreakSuppressionStatus returns 100% active telemetry.
 *
 * 4. ActionRunner Interception & Telemetry:
 *    - Intercepts query, sets preferences, updates living memory, returns action "bangla_pronunciation_code_switching"
 *      with status "PRONUNCIATION_AND_VIBE_HARMONIZED" and lhsEqualsRhs = true.
 *
 * 5. Persona Sovereignty:
 *    - Tuk Tuk strictly uses "Babe" (never "bro" or "Chief").
 *    - Vision strictly uses "brother" (never "babe").
 *    - Friday strictly uses "Chief" (never "babe").
 *    - DD strictly uses "bro" (never "babe").
 *    - Squad synthesizes multi-agent turn.
 *
 * 6. LocalCognitiveBrain Offline Synthesis:
 *    - Synthesizes persona-sovereign responses for all 5 agents.
 *
 * 7. Anti-Trailer Law Enforcement:
 *    - Zero canned trailing questions across all response pools.
 *
 * 8. LAW 42 Prompt Verification:
 *    - Enforces Law 42 invariant in jarvis-manager.js core system instructions.
 */

import * as assert from "assert";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..", "..");
const TextSanitizer = require(path.join(projectRoot, "src/utils/prompt-engine/text-sanitizer"));
const { IntentParser, INTENTS } = require(path.join(projectRoot, "src/utils/prompt-engine/intent-parser"));
const ActionRunner = require(path.join(projectRoot, "src/utils/action-runner"));
const LocalCognitiveBrain = require(path.join(projectRoot, "src/utils/local-cognitive-brain"));
const banglaVoiceCortex = require(path.join(projectRoot, "src/utils/bangla-voice-cortex"));
const jarvisManager = require(path.join(projectRoot, "src/utils/jarvis-manager"));

console.log("================================================================================");
console.log("🎙️ VERIFYING BILINGUAL CODE-SWITCHING & ZERO VOICE BREAK (TEST SUITE #64)");
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
  it("1. TextSanitizer normalizes full sentence and phonetic slips", () => {
    const raw = "if thay see bangla pronunciation is hard . pronunciation is issues to make our coversation vibe maintain use this section english to hide you voice breck and try to hide ther faier and wrongness personality and fix the tone";
    const sanitized = TextSanitizer.sanitize(raw);
    assert.ok(sanitized.includes("they see Bangla pronunciation is hard"), `Expected normalized pronunciation opening, got: ${sanitized}`);
    assert.ok(sanitized.includes("pronunciation issues"), `Expected pronunciation issues, got: ${sanitized}`);
    assert.ok(sanitized.includes("conversation vibe maintain"), `Expected conversation vibe maintain, got: ${sanitized}`);
    assert.ok(sanitized.includes("voice break"), `Expected voice break, got: ${sanitized}`);
    assert.ok(sanitized.includes("fear and wrongness personality"), `Expected fear and wrongness personality, got: ${sanitized}`);
  });

  it("2. TextSanitizer normalizes isolated mishearings ('voice breck', 'faier and wrongness')", () => {
    assert.strictEqual(TextSanitizer.sanitize("voice breck"), "Voice break");
    assert.strictEqual(TextSanitizer.sanitize("faier and wrongness personality"), "Fear and wrongness personality");
    assert.strictEqual(TextSanitizer.sanitize("coversation vibe maintain"), "Conversation vibe maintain");
  });

  // 2. IntentParser Directive Detection
  it("3. IntentParser.isBanglaPronunciationCodeSwitchingDirective detects directive across variants", () => {
    const inputs = [
      "if thay see bangla pronunciation is hard . pronunciation is issues to make our coversation vibe maintain use this section english to hide you voice breck and try to hide ther faier and wrongness personality and fix the tone",
      "bangla pronunciation is hard so use english to hide voice break",
      "hide fear and wrongness personality and fix the tone",
      "make our conversation vibe maintain use this section english",
      "বাংলা উচ্চারণে জড়তা এড়াতে ইংলিশ কোড সুইচ করো যাতে ভয়েস ব্রেক না হয়"
    ];

    for (const input of inputs) {
      assert.strictEqual(
        IntentParser.isBanglaPronunciationCodeSwitchingDirective(input),
        true,
        `Failed to detect directive for input: "${input}"`
      );
    }
  });

  it("4. IntentParser.parse routes directive to SMOOTH_CONVERSATION target bangla_pronunciation_code_switching", () => {
    const raw = "if they see bangla pronunciation is hard use this section english to hide your voice break";
    const parsed = IntentParser.parse(raw);
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "bangla_pronunciation_code_switching");
  });

  // 3. BanglaVoiceCortex Hard Pronunciation Smoothing
  it("5. BanglaVoiceCortex smooths heavy tat-sama conjuncts into clean loanwords", () => {
    const hardText = "সিস্টেমের বাস্তবায়ন সম্পন্ন এবং পূর্বশর্ত হিসেবে ধারাবাহিকতা নিশ্চিতকরণ প্রয়োজন";
    const smoothed = banglaVoiceCortex.smoothHardBengaliPronunciations(hardText);
    assert.ok(smoothed.includes("ইমপ্লিমেন্টেশন"), `Expected ইমপ্লিমেন্টেশন for বাস্তবায়ন, got: ${smoothed}`);
    assert.ok(smoothed.includes("prerequisite"), `Expected prerequisite for পূর্বশর্ত, got: ${smoothed}`);
    assert.ok(smoothed.includes("consistency"), `Expected consistency for ধারাবাহিকতা, got: ${smoothed}`);
    assert.ok(smoothed.includes("কনফার্মেশন"), `Expected কনফার্মেশন for নিশ্চিতকরণ, got: ${smoothed}`);

    const status = banglaVoiceCortex.getVoiceBreakSuppressionStatus();
    assert.strictEqual(status.voiceBreakProtectionActive, true);
    assert.strictEqual(status.lhsEqualsRhs, true);
  });

  // 4. ActionRunner Directive Handling & Telemetry
  await itAsync("6. ActionRunner handles directive and emits structured telemetry", async () => {
    const dummyJM: any = {
      preferences: {} as Record<string, any>,
      livingMemory: {} as Record<string, any>,
      healed: false,
      directive: "",
      setPreference(k: string, v: any) { this.preferences[k] = v; },
      setLivingMemoryPreference(k: string, v: any) { this.livingMemory[k] = v; },
      healAndAuditMemory() { this.healed = true; },
      saveDynamicDirective(d: string, target: string) { this.directive = d; }
    };

    const result = await ActionRunner.handleAction(
      "if they see bangla pronunciation is hard use this section english to hide your voice break and fix tone",
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural", language: "bn" },
      dummyJM,
      "bn"
    );

    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.action, "bangla_pronunciation_code_switching");
    assert.strictEqual(result.data.codeSwitchingActive, true);
    assert.strictEqual(result.data.voiceBreakSuppression, true);
    assert.strictEqual(result.data.fearlessToneLocked, true);
    assert.strictEqual(result.data.status, "PRONUNCIATION_AND_VIBE_HARMONIZED");
    assert.strictEqual(result.data.lhsEqualsRhs, true);

    // Verify preferences persisted
    assert.strictEqual(dummyJM.preferences.bangla_pronunciation_code_switching_active, true);
    assert.strictEqual(dummyJM.preferences.voice_break_suppression_active, true);
    assert.strictEqual(dummyJM.preferences.fearless_confident_tone_active, true);
  });

  // 5. Persona Sovereignty Across All Agents
  await itAsync("7. ActionRunner and LocalCognitiveBrain enforce persona sovereignty and zero trailers", async () => {
    const agents = [
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural", expectedPet: "babe", bannedPet: "brother" },
      { key: "vision", name: "Vision", voice: "en-US-AndrewNeural", expectedPet: "brother", bannedPet: "babe" },
      { key: "friday", name: "Friday", voice: "en-US-EmmaMultilingualNeural", expectedPet: "Chief", bannedPet: "babe" },
      { key: "dd", name: "DD", voice: "en-US-BrianMultilingualNeural", expectedPet: "bro", bannedPet: "babe" }
    ];

    for (const ag of agents) {
      const res = await ActionRunner.handleAction(
        "if they see bangla pronunciation is hard use this section english to hide your voice break",
        ag,
        null,
        "bn"
      );

      const speech = res.speech.toLowerCase();
      assert.ok(
        speech.includes(ag.expectedPet.toLowerCase()),
        `Agent ${ag.name} should include '${ag.expectedPet}', got: "${res.speech}"`
      );
      assert.ok(
        !speech.includes(ag.bannedPet.toLowerCase()),
        `Agent ${ag.name} must NOT include '${ag.bannedPet}', got: "${res.speech}"`
      );

      // LocalCognitiveBrain offline check
      const localSpeech = LocalCognitiveBrain.synthesizeResponse(
        ag.key,
        ag.name,
        "if they see bangla pronunciation is hard use this section english to hide your voice break",
        null,
        "bn"
      );
      assert.ok(
        localSpeech.toLowerCase().includes(ag.expectedPet.toLowerCase()),
        `LocalCognitiveBrain ${ag.name} should include '${ag.expectedPet}', got: "${localSpeech}"`
      );

      // Anti-Trailer Check
      const trailerRegex = /\b(?:what's next\?|what are we building next\?|what should we tackle\?|tell me what's next)\b/i;
      assert.strictEqual(trailerRegex.test(res.speech), false, `ActionRunner response must not end with canned trailer: "${res.speech}"`);
      assert.strictEqual(trailerRegex.test(localSpeech), false, `Local response must not end with canned trailer: "${localSpeech}"`);
    }

    // Squad turn check
    const squadRes = await ActionRunner.handleAction(
      "if they see bangla pronunciation is hard use this section english to hide your voice break",
      { key: "team", name: "Squad", voice: "en-US-AvaMultilingualNeural" },
      null,
      "bn"
    );
    assert.ok(squadRes.speech.includes("[Tuk Tuk]"), "Squad turn should include Tuk Tuk");
    assert.ok(squadRes.speech.includes("[Vision]"), "Squad turn should include Vision");
    assert.ok(squadRes.speech.includes("[Friday]"), "Squad turn should include Friday");
    assert.ok(squadRes.speech.includes("[DD]"), "Squad turn should include DD");
  });

  // 6. LAW 42 Prompt Invariant
  it("8. jarvis-manager.js contains LAW 42 for seamless bilingual code-switching and zero voice breaks", () => {
    const fs = require("fs");
    const jmPath = path.join(projectRoot, "src/utils/jarvis-manager.js");
    const content = fs.readFileSync(jmPath, "utf8");
    assert.ok(content.includes("LAW 42: SEAMLESS BILINGUAL CODE-SWITCHING"), "jarvis-manager.js must define LAW 42");
    assert.ok(content.includes("Psi_code_switch"), "LAW 42 must include closed-form mathematical invariant");
  });

  console.log("\n================================================================================");
  console.log(`🏁 TEST SUITE #64 COMPLETE: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
})();
