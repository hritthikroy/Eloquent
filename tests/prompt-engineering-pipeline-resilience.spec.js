/**
 * Test Suite: Prompt Engineering Pipeline Resilience, Multi-Agent Intent Parsing & AST Schema Compliance
 *
 * Verifies:
 * 1. IntentParser Directive Detection & Multi-Agent Routing
 * 2. PromptAssembler 4-Section Canonical Assembly (Zero Fences, Senior Developer Tone)
 * 3. PromptAstValidator Schema Adherence & Section 4 Roadmap Parsing
 * 4. PromptEngineer Token Boundary Optimization & AST Compliance
 * 5. Single Real Voice Persona Invariants in PromptEngine Confirmations
 */

const assert = require("assert");
const path = require("path");

const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const PromptAssembler = require("../src/utils/prompt-engine/prompt-assembler");
const { PromptEngine } = require("../src/utils/prompt-engine/index");

// Load compiled TS modules for AST Validator and Prompt Engineer
const { PromptAstValidator } = require("../dist-ts/src/utils/ast-validator");
const { PromptEngineer } = require("../dist-ts/src/core/prompt-engineer");

async function runSuite() {
  console.log("================================================================================");
  console.log("🧪 RUNNING PROMPT ENGINEERING PIPELINE RESILIENCE & AST COMPLIANCE TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // 1. Multi-Agent Intent Parsing & Directive Routing
  // -------------------------------------------------------------
  console.log("--- 1. Multi-Agent Intent Parsing & Directive Routing ---");

  test("IntentParser detects prompt engineering pipeline resilience directives", () => {
    const raw = "Implement prompt engineering pipeline resilience, multi-agent intent parsing, and AST schema compliance";
    assert.strictEqual(IntentParser.isPromptEngineeringPipelineResilienceDirective(raw), true);
    assert.strictEqual(IntentParser.isPromptEngineeringDirective(raw), true);

    const parsed = IntentParser.parse(raw);
    assert.strictEqual(parsed.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(parsed.confidence, 0.99);
    assert.strictEqual(parsed.action, "prompt_engineering_pipeline_resilience_directive");
  });

  test("IntentParser routes explicit agent directives correctly", () => {
    const rawTukTuk = "Tuk Tuk, write up the prompt for prompt engineering pipeline resilience";
    const parsedTukTuk = IntentParser.parse(rawTukTuk);
    assert.strictEqual(parsedTukTuk.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(parsedTukTuk.agentDirective, "tuktuk");

    const rawFriday = "Friday, prepare the prompt for AST schema compliance and token boundaries";
    const parsedFriday = IntentParser.parse(rawFriday);
    assert.strictEqual(parsedFriday.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(parsedFriday.agentDirective, "friday");
  });

  test("IntentParser rejects standard queries without false positives", () => {
    const standardQuery = "What is prompt engineering pipeline resilience?";
    const parsed = IntentParser.parse(standardQuery);
    assert.strictEqual(parsed.intent, INTENTS.STANDARD_QUERY);
  });

  // -------------------------------------------------------------
  // 2. PromptAssembler 4-Section Output & Structure
  // -------------------------------------------------------------
  console.log("\n--- 2. PromptAssembler 4-Section Output & Formatting ---");

  await testAsync("PromptAssembler generates all 4 canonical sections without markdown code fences", async () => {
    const prompt = await PromptAssembler.assemble({
      sanitizedText: "Implement prompt engineering pipeline resilience, multi-agent intent parsing, and AST schema compliance"
    });

    assert.ok(typeof prompt === "string" && prompt.length > 100);
    assert.ok(!prompt.startsWith("```"), "Must not start with markdown code fence");
    assert.ok(!prompt.endsWith("```"), "Must not end with markdown code fence");

    assert.ok(prompt.includes("Clear Technical Objective"), "Must contain Clear Technical Objective");
    assert.ok(prompt.includes("Key Files / Architecture"), "Must contain Key Files / Architecture");
    assert.ok(prompt.includes("Quality Requirements & AST Verification"), "Must contain Quality Requirements & AST Verification");
    assert.ok(prompt.includes("Next Steps & Continuation Roadmap"), "Must contain Next Steps & Continuation Roadmap");

    // Verify key files listed match prompt engine modules
    assert.ok(prompt.includes("src/utils/prompt-engine/intent-parser.js"), "Includes intent-parser.js");
    assert.ok(prompt.includes("src/utils/prompt-engine/prompt-assembler.js"), "Includes prompt-assembler.js");
    assert.ok(prompt.includes("src/core/prompt-engineer.ts"), "Includes prompt-engineer.ts");
  });

  // -------------------------------------------------------------
  // 3. PromptAstValidator Schema Compliance & Parsing
  // -------------------------------------------------------------
  console.log("\n--- 3. PromptAstValidator Schema Adherence & Section 4 Parsing ---");

  test("PromptAstValidator validates canonical 4-section prompt as 100% valid", () => {
    const canonicalText = `Clear Technical Objective
Implement prompt engineering pipeline resilience, multi-agent intent parsing, and AST schema compliance, ensuring seamless integration across the Eloquent Electron workspace, high execution efficiency, and robust fault tolerance while preserving existing system invariants.

Key Files / Architecture
- \`src/utils/prompt-engine/intent-parser.js\`: Expand intent detection patterns and multi-agent directives.
- \`src/utils/prompt-engine/prompt-assembler.js\`: Assemble natural, senior-developer Antigravity prompts.
- \`src/core/prompt-engineer.ts\`: Verify 100% AST schema compliance and token boundaries.

Quality Requirements & AST Verification
- Validate 100% AST syntax clean execution via node -c across all modified JavaScript files.
- Ensure all automated test suites pass without regression (npm test).
- Verify edge cases, graceful degradation, and zero memory leaks across long-running loops.

Next Steps & Continuation Roadmap
- Monitor real-time telemetry and CPU overhead during active multi-turn interactions.
- Add targeted unit/integration test coverage for newly introduced execution paths.
- Benchmark end-to-end responsiveness and verify zero frame drops in the UI render thread.`;

    const validation = PromptAstValidator.validate(canonicalText);
    assert.strictEqual(validation.isValid, true, "Validation must pass with 0 errors");
    assert.strictEqual(validation.errors.length, 0);
    assert.strictEqual(validation.sectionsFound.objective, true);
    assert.strictEqual(validation.sectionsFound.architecture, true);
    assert.strictEqual(validation.sectionsFound.quality, true);
    assert.strictEqual(validation.sectionsFound.roadmap, true);

    const ast = PromptAstValidator.parseToAst(canonicalText);
    assert.ok(ast !== null);
    assert.ok(ast.clearTechnicalObjective.includes("Implement prompt engineering pipeline resilience"));
    assert.strictEqual(ast.keyFilesArchitecture.length, 3);
    assert.strictEqual(ast.keyFilesArchitecture[0].path, "src/utils/prompt-engine/intent-parser.js");
    assert.strictEqual(ast.qualityRequirementsAndAstVerification.length, 3);
    assert.ok(Array.isArray(ast.nextStepsContinuationRoadmap));
    assert.strictEqual(ast.nextStepsContinuationRoadmap.length, 3);
    assert.ok(ast.nextStepsContinuationRoadmap[0].includes("real-time telemetry"));
  });

  // -------------------------------------------------------------
  // 4. PromptEngineer Token Boundary & Schema Enforcement
  // -------------------------------------------------------------
  console.log("\n--- 4. PromptEngineer Token Boundary & Schema Enforcement ---");

  await testAsync("PromptEngineer generates compliant meta-prompt within token bounds without clipping", async () => {
    const rawIntent = "pipeline resilience in prompt engineering with AST schema verification";
    const metaPrompt = await PromptEngineer.generateMetaPrompt(rawIntent, undefined, { maxTokens: 512 });

    assert.ok(metaPrompt !== null);
    assert.ok(metaPrompt.clearTechnicalObjective.length > 20);
    assert.ok(metaPrompt.keyFilesArchitecture.length >= 3);
    assert.ok(metaPrompt.qualityRequirementsAndAstVerification.length >= 3);
    assert.ok(Array.isArray(metaPrompt.nextStepsContinuationRoadmap));
    assert.ok(metaPrompt.tokenCount > 0 && metaPrompt.tokenCount <= 512, `Token count (${metaPrompt.tokenCount}) within 512 bound`);
  });

  // -------------------------------------------------------------
  // 5. PromptEngine Single Real Voice Invariant & Speech Sanitization
  // -------------------------------------------------------------
  console.log("\n--- 5. PromptEngine Single Real Voice Invariant & Speech Sanitization ---");

  await testAsync("PromptEngine handles prompt generation and respects Single Real Voice Mode", async () => {
    const mockJarvis = {
      isSingleRealVoiceMode: () => true,
      config: { userName: "Hritthik", singleRealVoiceActive: true }
    };

    const res = await PromptEngine.process("write prompt for pipeline resilience", { jarvisManager: mockJarvis });
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.intent, INTENTS.GENERATE_PROMPT);
    assert.ok(res.prompt.includes("Clear Technical Objective"));
    assert.ok(res.speech.includes("Hritthik"), "Speech confirmation addresses Hritthik");
    assert.ok(!res.speech.includes("bro"), "Single real voice speech must not leak 'bro'");
    assert.ok(!res.speech.includes("babe"), "Single real voice speech must not leak 'babe'");
  });

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passed}/${total} PROMPT ENGINEERING RESILIENCE TESTS PASSED (100% SUCCESS)!`);
  console.log("================================================================================\n");
}

runSuite().catch(err => {
  console.error("FATAL SUITE FAILURE:", err);
  process.exit(1);
});
