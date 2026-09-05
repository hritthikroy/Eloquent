/**
 * Test Suite: Conversational Filler Resolution & Multi-Agent Prompt Engine
 * Validates that meta-speech phrases like "So, I am going to write the prompt"
 * or "write the next prompt" are parsed with zero awkward filler generation,
 * context-driven target resolution, and strict 4-section AST compliance.
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

console.log("================================================================================");
console.log("🧪 RUNNING CONVERSATIONAL FILLER & MULTI-AGENT PROMPT RESOLUTION TEST SUITE");
console.log("================================================================================\n");

(async () => {
  // -----------------------------------------------------------------------------
  // TEST 1: IntentParser parses "So, I am going to write the prompt" cleanly
  // -----------------------------------------------------------------------------
  console.log("▶ [TEST 1] Conversational filler target stripping");
  const raw1 = "So, I am going to write the prompt.";
  const parsed1 = IntentParser.parse(raw1);

  assert.strictEqual(parsed1.intent, INTENTS.GENERATE_PROMPT, "Must detect GENERATE_PROMPT");
  assert.strictEqual(parsed1.target, "", "Target must not contain 'So, I am going' filler");
  assert.strictEqual(parsed1.useConversationContext, true, "Must flag useConversationContext");
  console.log("   ✅ Test 1 Passed: 'So, I am going' filler rejected and conversation context flagged\n");

  // -----------------------------------------------------------------------------
  // TEST 2: "Write the next prompt" intent and flags
  // -----------------------------------------------------------------------------
  console.log("▶ [TEST 2] 'Write the next prompt' directive parsing");
  const raw2 = "Write the next prompt";
  const parsed2 = IntentParser.parse(raw2);

  assert.strictEqual(parsed2.intent, INTENTS.GENERATE_PROMPT, "Must detect GENERATE_PROMPT");
  assert.strictEqual(parsed2.isNextTask, true, "Must be flagged as isNextTask");
  assert.strictEqual(parsed2.useConversationContext, true, "Must flag useConversationContext");
  assert.strictEqual(parsed2.target, "", "Target must be empty for next prompt");
  console.log("   ✅ Test 2 Passed: 'Write the next prompt' correctly sets isNextTask and useConversationContext\n");

  // -----------------------------------------------------------------------------
  // TEST 3: Multi-agent persona directives and speech confirmations
  // -----------------------------------------------------------------------------
  console.log("▶ [TEST 3] Multi-agent persona directives and confirmation speech");
  const ttParsed = IntentParser.parse("Tuk Tuk, write the prompt for Bengali voice calibration");
  assert.strictEqual(ttParsed.agentDirective, "tuktuk");
  assert.ok(ttParsed.target.includes("Bengali voice calibration"));

  const fridayParsed = IntentParser.parse("Friday, assemble the prompt for benchmark metrics");
  assert.strictEqual(fridayParsed.agentDirective, "friday");
  assert.ok(fridayParsed.target.includes("benchmark metrics"));

  const ddParsed = IntentParser.parse("Tell DD to craft the prompt for server telemetry");
  assert.strictEqual(ddParsed.agentDirective, "dd");
  assert.ok(ddParsed.target.includes("server telemetry"));

  const visionParsed = IntentParser.parse("Tell andrew to craft the prompt for visualizer aura");
  assert.strictEqual(visionParsed.agentDirective, "vision");
  assert.ok(visionParsed.target.includes("visualizer aura"));
  console.log("   ✅ Test 3 Passed: Multi-agent directives accurately parsed across Tuk Tuk, Friday, DD, and Vision\n");

  // -----------------------------------------------------------------------------
  // TEST 4: PromptAssembler context-driven resolution (Zero "So, I am going" output)
  // -----------------------------------------------------------------------------
  console.log("▶ [TEST 4] Context-driven prompt assembly with zero filler");
  const mockContext = {
    dialogueContext: [
      "USER: Bangla talk is like a robot, need original thinker tone and voice parity across all squad agents",
      "ASSISTANT: Symmetrical parity verified green, brother. LHS = RHS across all pipelines."
    ],
    contextSummary: "Recent Conversation: Bangla voice tone parity and original thinker calibration",
    workspaceContext: "Eloquent (Node.js, Electron, Go audio backend)"
  };

  const assembledPrompt = await PromptAssembler.assemble({
    sanitizedText: "So, I am going",
    enrichedContext: mockContext
  });

  // Verify strict rejection of "So, I am going" in objective
  assert.ok(!assembledPrompt.includes("Implement So, I am going"), "Must NEVER generate 'Implement So, I am going'");
  assert.ok(!assembledPrompt.includes("So, I am going,"), "Must not include filler fragment");
  assert.ok(assembledPrompt.includes("Clear Technical Objective"), "Must contain Clear Technical Objective");
  assert.ok(assembledPrompt.includes("Key Files / Architecture"), "Must contain Key Files / Architecture");
  assert.ok(assembledPrompt.includes("Quality Requirements & AST Verification"), "Must contain Quality Requirements");
  assert.ok(assembledPrompt.includes("Next Steps & Continuation Roadmap"), "Must contain Next Steps");
  assert.ok(assembledPrompt.includes("Bangla original thinker tone"), "Must infer Bangla tone objective from context");
  console.log("   ✅ Test 4 Passed: Inferred objective from dialogue context and rejected 'So, I am going'\n");

  // -----------------------------------------------------------------------------
  // TEST 5: Full PromptEngine pipeline with Tuk Tuk persona response
  // -----------------------------------------------------------------------------
  console.log("▶ [TEST 5] Full PromptEngine pipeline end-to-end execution");
  const mockJarvis = {
    getHistory: () => [
      { role: "user", content: "Optimize Go audio backend ring buffer" },
      { role: "assistant", content: "Audio telemetry green bro" }
    ]
  };

  const engineRes = await PromptEngine.process("Tuk Tuk, write the next prompt", {
    jarvisManager: mockJarvis
  });

  assert.strictEqual(engineRes.handled, true, "Pipeline must handle request");
  assert.strictEqual(engineRes.intent, INTENTS.GENERATE_PROMPT);
  assert.ok(engineRes.speech.includes("babe"), "Tuk Tuk confirmation must address user as 'babe'");
  assert.ok(!engineRes.prompt.includes("Implement So, I am going"));
  assert.ok(engineRes.prompt.includes("Go audio backend streaming"));
  console.log("   ✅ Test 5 Passed: Full pipeline handles next prompt with Tuk Tuk persona confirmation\n");

  // -----------------------------------------------------------------------------
  // TEST 6: PromptEngineer 100% AST schema validation on filler intent
  // -----------------------------------------------------------------------------
  console.log("▶ [TEST 6] PromptEngineer AST schema validation on filler intent");
  const metaPrompt = await PromptEngineer.generateMetaPrompt("So, I am going to");
  assert.ok(!metaPrompt.clearTechnicalObjective.includes("So, I am going"));
  assert.ok(metaPrompt.clearTechnicalObjective.length > 20);
  assert.ok(metaPrompt.keyFilesArchitecture.length >= 2);
  assert.ok(metaPrompt.qualityRequirementsAndAstVerification.length >= 2);

  const validation = PromptAstValidator.validate(metaPrompt.rawText);
  assert.strictEqual(validation.isValid, true, "Generated prompt must pass AST validation");
  assert.strictEqual(validation.errors.length, 0);
  console.log("   ✅ Test 6 Passed: PromptEngineer synthesized 100% compliant AST prompt\n");

  console.log("================================================================================");
  console.log("🎉 ALL CONVERSATIONAL FILLER & PROMPT ENGINE TESTS PASSED (100% SUCCESS)!");
  console.log("================================================================================\n");
})().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
