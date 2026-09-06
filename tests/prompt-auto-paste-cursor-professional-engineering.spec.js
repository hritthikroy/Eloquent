#!/usr/bin/env node
/**
 * tests/prompt-auto-paste-cursor-professional-engineering.spec.js
 * 
 * Unit & Integration Verification Suite for:
 * 1. STT Normalization of raw prompt auto-paste & professional prompt engineering utterances in TextSanitizer
 * 2. IntentParser classification of prompt_auto_paste_at_cursor_and_professional_engineering_directive (0.99 confidence)
 * 3. Preference calibration in JarvisManager (auto_paste_at_cursor_enabled, professional_prompt_engineering_active)
 * 4. Senior 10x developer prompt engineering structure in PromptAssembler (Objective, Files, Verification, Next Steps)
 * 5. Clipboard copy & cursor auto-paste execution in PromptEngine & ActionRunner
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const JarvisManager = require("../src/utils/jarvis-manager");
const PromptAssembler = require("../src/utils/prompt-engine/prompt-assembler");
const { PromptEngine } = require("../src/utils/prompt-engine");
const actionRunner = require("../src/utils/action-runner");

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
  console.log("🚀 RUNNING PROMPT AUTO-PASTE AT CURSOR & PROFESSIONAL ENGINEERING TEST SUITE");
  console.log("================================================================================\n");

  await runTest("1. TextSanitizer STT Normalization for prompt auto-paste at cursor", async () => {
    const rawInput = "prompt not pest on my keybor cursor and all prompt need a profetional prompt enginiaring like";
    const sanitized = TextSanitizer.sanitize(rawInput);
    console.log(`  Sanitized Output: "${sanitized}"`);
    assert.strictEqual(
      sanitized,
      "Prompt not pasting on my keyboard cursor, auto-paste prompt at cursor and All prompts need professional prompt engineering like"
    );
  });

  await runTest("2. IntentParser Classification for prompt auto-paste at cursor directive", async () => {
    const input = "Prompt not pasting on my keyboard cursor, auto-paste prompt at cursor and All prompts need professional prompt engineering";
    const parsed = IntentParser.parse(input);
    console.log(`  Target:     "${parsed.target}"`);
    console.log(`  Confidence: ${parsed.confidence}`);
    assert.strictEqual(parsed.confidence, 0.99);
    assert.strictEqual(parsed.target, "prompt_auto_paste_at_cursor_and_professional_engineering_directive");
    assert.strictEqual(parsed.action, "prompt_auto_paste_at_cursor_and_professional_engineering_directive");
  });

  await runTest("3. JarvisManager Preference Calibration for auto-pasting at cursor", async () => {
    const telemetry = JarvisManager.calibratePromptAutoPasteAtCursorAndProfessionalEngineering();
    assert.strictEqual(telemetry.autoPasteAtCursorEnabled, true);
    assert.strictEqual(telemetry.professionalPromptEngineeringActive, true);
    assert.strictEqual(telemetry.promptCursorPastingLocked, true);
    assert.strictEqual(telemetry.promptEngineeringStandardLevel, "10x_senior_architect");
    assert.strictEqual(telemetry.status, "PROMPT_AUTO_PASTE_AT_CURSOR_AND_PROFESSIONAL_ENGINEERING_LOCKED");
  });

  await runTest("4. PromptAssembler 4-Section Senior Developer Structure", async () => {
    const assembled = await PromptAssembler.assemble({
      sanitizedText: "Fix audio buffer latency and align sample rates in recorder",
      enrichedContext: { contextSummary: "Eloquent Desktop App Workspace" }
    });

    console.log("  --- Assembled Prompt Snippet ---");
    console.log(assembled.slice(0, 250) + "...\n");

    assert.ok(assembled.includes("Clear Technical Objective"), "Must contain Clear Technical Objective section");
    assert.ok(assembled.includes("Key Files / Architecture"), "Must contain Key Files / Architecture section");
    assert.ok(assembled.includes("Quality Requirements & AST Verification"), "Must contain Quality Requirements section");
    assert.ok(assembled.includes("Next Steps & Continuation Roadmap"), "Must contain Next Steps section");
    assert.ok(!assembled.startsWith("Sure"), "Must not contain conversational preamble");
    assert.ok(!assembled.startsWith("```"), "Must not enclose entire prompt in outer markdown code blocks");
  });

  await runTest("5. ActionRunner Execution & Auto-Paste Directive Resolution", async () => {
    const result = await actionRunner.handleAction(
      "prompt not pest on my keybor cursor and all prompt need a profetional prompt enginiaring",
      { key: "vision", name: "Vision", voice: "en-US-AndrewNeural" }
    );

    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.agentName, "Vision");
    assert.strictEqual(result.data.action, "prompt_auto_paste_at_cursor_and_professional_engineering_directive");
    assert.strictEqual(result.data.autoPasteAtCursorEnabled, true);
    assert.strictEqual(result.data.professionalPromptEngineeringActive, true);
  });

  console.log("\n================================================================================");
  console.log(`🏁 FINAL RESULT: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main();
