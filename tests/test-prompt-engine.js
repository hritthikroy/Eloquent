/**
 * Unit & AST Test Suite for Prompt Engineering Engine
 */

const assert = require("assert");
const {
  PromptEngine,
  TextSanitizer,
  IntentParser,
  ContextEnricher,
  PromptAssembler,
  INTENTS
} = require("../src/utils/prompt-engine");

console.log("🧪 Running Prompt Engineering Engine Unit Tests...\n");

// -------------------------------------------------------------
// 1. TextSanitizer Tests
// -------------------------------------------------------------
console.log("▶ Testing TextSanitizer...");
{
  const input1 = "um uh and you write the code on this course";
  const output1 = TextSanitizer.sanitize(input1);
  assert.strictEqual(output1.includes("Andrew"), true, "Should map 'and you' + verb to 'Andrew'");
  assert.strictEqual(output1.includes("on this code"), true, "Should map 'on this course' to 'on this code'");
  assert.strictEqual(output1.includes("um"), false, "Should strip disfluencies");
  console.log("  ✅ TextSanitizer phonetic mishearing & disfluency test passed");

  const input2 = "anti gravity prompt for my next task";
  const output2 = TextSanitizer.sanitize(input2);
  assert.strictEqual(output2.includes("Antigravity"), true, "Should map 'anti gravity' to 'Antigravity'");
  console.log("  ✅ TextSanitizer terminology normalization test passed");
}

// -------------------------------------------------------------
// 2. IntentParser Tests (Zero False Positive Guardrails)
// -------------------------------------------------------------
console.log("\n▶ Testing IntentParser...");
{
  // Test Smooth Conversation Intent
  const resSmooth1 = IntentParser.parse("make our conversation smooth");
  assert.strictEqual(resSmooth1.intent, INTENTS.SMOOTH_CONVERSATION);

  const resSmooth2 = IntentParser.parse("smooth the conversation flow");
  assert.strictEqual(resSmooth2.intent, INTENTS.SMOOTH_CONVERSATION);
  console.log("  ✅ IntentParser smooth conversation intent recognized");

  // Test Generate Prompt Intent
  const resPrompt1 = IntentParser.parse("tell andrew to write the prompt for interview prep");
  assert.strictEqual(resPrompt1.intent, INTENTS.GENERATE_PROMPT);
  assert.strictEqual(resPrompt1.target.includes("interview prep"), true);

  const resPrompt2 = IntentParser.parse("craft a high-context developer prompt for git integration");
  assert.strictEqual(resPrompt2.intent, INTENTS.GENERATE_PROMPT);
  console.log("  ✅ IntentParser prompt generation intent recognized");

  // Test Zero False Positive Guardrails on Standard Queries
  const resQuery1 = IntentParser.parse("how do I write a prompt in python?");
  assert.strictEqual(resQuery1.intent, INTENTS.STANDARD_QUERY, "Informational query should NOT trigger prompt engine");

  const resQuery2 = IntentParser.parse("what is the weather today?");
  assert.strictEqual(resQuery2.intent, INTENTS.STANDARD_QUERY);

  const resQuery3 = IntentParser.parse("explain how electron IPC works");
  assert.strictEqual(resQuery3.intent, INTENTS.STANDARD_QUERY);
  console.log("  ✅ IntentParser zero-false-positive guardrails verified");
}

// -------------------------------------------------------------
// 3. ContextEnricher Tests
// -------------------------------------------------------------
console.log("\n▶ Testing ContextEnricher...");
{
  const mockJarvisManager = {
    getHistory: () => [
      { role: "user", content: "Let's work on screen share" },
      { role: "assistant", content: "Screen share is active bro" }
    ]
  };

  const enriched = ContextEnricher.enrich({
    rawInput: "make conversation smooth",
    jarvisManager: mockJarvisManager
  });

  assert.strictEqual(enriched.dialogueContext.length, 2);
  assert.strictEqual(enriched.contextSummary.includes("USER: Let's work on screen share"), true);
  console.log("  ✅ ContextEnricher multi-turn serialization verified");
}

// -------------------------------------------------------------
// 4. PromptAssembler Structure Tests
// -------------------------------------------------------------
console.log("\n▶ Testing PromptAssembler (Formatting & Structure)...");
(async () => {
  const mockContext = { contextSummary: "Project: Eloquent voice co-pilot" };
  const prompt = await PromptAssembler.assemble({
    sanitizedText: "Fix rate limits and smooth conversation flow",
    enrichedContext: mockContext
  });

  assert.strictEqual(prompt.includes("Clear Technical Objective"), true, "Must include Clear Technical Objective");
  assert.strictEqual(prompt.includes("Key Files / Architecture"), true, "Must include Key Files / Architecture");
  assert.strictEqual(prompt.includes("Quality Requirements & AST Verification"), true, "Must include Quality Requirements");
  assert.strictEqual(/^```/.test(prompt), false, "Must NOT have outer markdown fence");
  assert.strictEqual(/^Sure/i.test(prompt), false, "Must NOT have conversational preamble");
  console.log("  ✅ PromptAssembler format strictness verified");

  // -------------------------------------------------------------
  // 5. Full Pipeline Integration Test
  // -------------------------------------------------------------
  console.log("\n▶ Testing Full PromptEngine Pipeline Integration...");
  const pipelineRes = await PromptEngine.process("Andrew, write the prompt to make our conversation smooth");
  assert.strictEqual(pipelineRes.handled, true);
  assert.strictEqual(typeof pipelineRes.prompt, "string");
  assert.strictEqual(pipelineRes.prompt.includes("Clear Technical Objective"), true);
  console.log("  ✅ Full PromptEngine pipeline integration passed\n");

  console.log("🎉 ALL PROMPT ENGINE UNIT TESTS PASSED WITH 100% SUCCESS!");
})();
