/**
 * Comprehensive Automated Verification Suite for:
 * - IntentParser prompt detection ("Write a prompt for fixing this kind of all issues")
 * - Multi-agent prompt directives across Friday, DD, Tuk Tuk, Vision
 * - PromptAssembler senior-developer technical objective assembly without awkward phrasing
 * - PromptEngineer recursive self-correction & 100% AST schema compliance
 * - End-to-end PromptEngine pipeline execution
 */

const assert = require("assert");
const {
  PromptEngine,
  IntentParser,
  PromptAssembler,
  INTENTS
} = require("../src/utils/prompt-engine");
const { PromptEngineer } = require("../dist-ts/src/core/prompt-engineer");
const { PromptAstValidator } = require("../dist-ts/src/utils/ast-validator");

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

async function runAllTests() {
  console.log("\n🧪 ===========================================================================");
  console.log("   PROMPT ENGINE RESILIENCE & FIX-ALL-ISSUES ASSEMBLY TEST SUITE");
  console.log("===========================================================================\n");

  const rawUserPrompt = "Write a prompt for fixing this kind of all issues";

  // TEST 1: IntentParser Prompt Detection & Target Extraction
  console.log("📦 1. IntentParser Prompt Detection & Prefix Stripping Tests:");

  await runTest("Extracts clean target from 'Write a prompt for fixing this kind of all issues'", () => {
    const parsed = IntentParser.parse(rawUserPrompt);
    assert.strictEqual(parsed.intent, INTENTS.GENERATE_PROMPT, "Must detect GENERATE_PROMPT");
    assert.strictEqual(parsed.target, "fixing this kind of all issues", "Must strip 'Write a prompt for ' prefix");
    assert.strictEqual(parsed.agentDirective, "vision", "Default agent must be vision");
  });

  await runTest("Routes multi-agent prompt directives across all 4 squad agents", () => {
    const friday = IntentParser.parse("Tell Friday to write a prompt for fixing all issues");
    assert.strictEqual(friday.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(friday.agentDirective, "friday");
    assert.strictEqual(friday.target, "fixing all issues");

    const dd = IntentParser.parse("Tell DD to write up a prompt for fixing this issue");
    assert.strictEqual(dd.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(dd.agentDirective, "dd");
    assert.strictEqual(dd.target, "fixing this issue");

    const tuktuk = IntentParser.parse("Tuk Tuk, craft a developer prompt for fixing this issue");
    assert.strictEqual(tuktuk.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(tuktuk.agentDirective, "tuktuk");
    assert.strictEqual(tuktuk.target, "fixing this issue");

    const vision = IntentParser.parse("Tell Vision to craft a developer prompt for prompt engineering pipeline resilience");
    assert.strictEqual(vision.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(vision.agentDirective, "vision");
    assert.strictEqual(vision.target, "prompt engineering pipeline resilience");
  });

  await runTest("Handles shorthand and direct prompt variations", () => {
    const v1 = IntentParser.parse("write prompt for fixing this issue");
    assert.strictEqual(v1.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(v1.target, "fixing this issue");

    const v2 = IntentParser.parse("craft a prompt for AST schema compliance");
    assert.strictEqual(v2.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(v2.target, "AST schema compliance");
  });

  // TEST 2: PromptAssembler Clean Objective & Section Structure
  console.log("\n📦 2. PromptAssembler 4-Section Output & Zero-Filler Tests:");

  await runTest("Assembles clean, senior-developer Antigravity prompt without awkward phrasing", async () => {
    const assembled = await PromptAssembler.assemble({
      sanitizedText: rawUserPrompt
    });

    // Verify 4 strict sections exist
    assert.ok(assembled.includes("Clear Technical Objective"), "Must contain Clear Technical Objective");
    assert.ok(assembled.includes("Key Files / Architecture"), "Must contain Key Files / Architecture");
    assert.ok(assembled.includes("Quality Requirements & AST Verification"), "Must contain Quality Requirements");
    assert.ok(assembled.includes("Next Steps & Continuation Roadmap"), "Must contain Next Steps");

    // Verify zero awkward phrasing
    assert.ok(!assembled.includes("Implement Write a prompt for"), "Must NEVER contain 'Implement Write a prompt for'");
    assert.ok(!assembled.includes("Implement fixing"), "Must NEVER contain 'Implement fixing'");
    assert.ok(!assembled.includes("Write a prompt for"), "Objective must not repeat prompt command");

    // Verify authoritative objective
    assert.ok(
      assembled.includes("Implement prompt engineering pipeline resilience, multi-agent intent parsing, and AST schema compliance"),
      "Must form authoritative technical objective"
    );

    // Verify relevant architecture files
    assert.ok(assembled.includes("src/utils/prompt-engine/intent-parser.js"));
    assert.ok(assembled.includes("src/utils/prompt-engine/prompt-assembler.js"));
    assert.ok(assembled.includes("src/core/prompt-engineer.ts"));
  });

  await runTest("Assembles prompt from direct 'fixing this kind of all issues' target", async () => {
    const assembled = await PromptAssembler.assemble({
      sanitizedText: "fixing this kind of all issues"
    });

    assert.ok(!assembled.includes("Implement fixing"));
    assert.ok(assembled.includes("Clear Technical Objective"));
    assert.ok(assembled.includes("prompt engineering pipeline resilience"));
  });

  // TEST 3: PromptEngineer TypeScript AST Schema Compliance
  console.log("\n📦 3. PromptEngineer Recursive Self-Correction & AST Validation Tests:");

  await runTest("PromptEngineer strips prompt command prefix and generates valid AST", async () => {
    const metaPrompt = await PromptEngineer.generateMetaPrompt(rawUserPrompt);

    assert.ok(metaPrompt.clearTechnicalObjective.length > 0);
    assert.ok(!metaPrompt.clearTechnicalObjective.includes("Write a prompt for"));
    assert.ok(metaPrompt.keyFilesArchitecture.length >= 2);
    assert.ok(metaPrompt.qualityRequirementsAndAstVerification.length >= 2);

    const validation = PromptAstValidator.validate(metaPrompt.rawText);
    assert.strictEqual(validation.isValid, true, "Meta-prompt must be 100% AST valid");
  });

  // TEST 4: End-to-End PromptEngine Pipeline Execution
  console.log("\n📦 4. End-to-End PromptEngine Pipeline Tests:");

  await runTest("PromptEngine.process runs end-to-end for 'Write a prompt for fixing this kind of all issues'", async () => {
    const res = await PromptEngine.process(rawUserPrompt);

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.intent, INTENTS.GENERATE_PROMPT);
    assert.ok(typeof res.prompt === "string");
    assert.ok(res.prompt.includes("Clear Technical Objective"));
    assert.ok(res.prompt.includes("Key Files / Architecture"));
    assert.ok(res.prompt.includes("Quality Requirements & AST Verification"));
    assert.ok(res.prompt.includes("Next Steps & Continuation Roadmap"));
    assert.ok(!res.prompt.includes("Implement Write a prompt for"));
    assert.ok(res.speech.includes("developer prompt"));
  });

  await runTest("PromptEngine.process supports Friday persona prompt dispatch", async () => {
    const res = await PromptEngine.process("Tell Friday to write a prompt for fixing all issues");

    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.intent, INTENTS.GENERATE_PROMPT);
    assert.ok(res.speech.includes("Chief"), "Friday must address user as Chief");
  });

  console.log("\n===========================================================================");
  console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("===========================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("🌟 PROMPT FIX-ALL-ISSUES PIPELINE VERIFIED 100% CLEAN!\n");
  }
}

runAllTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
