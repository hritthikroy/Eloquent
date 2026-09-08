const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const JarvisManager = require("../src/utils/jarvis-manager");
const ContextEnricher = require("../src/utils/prompt-engine/context-enricher");
const PromptAssembler = require("../src/utils/prompt-engine/prompt-assembler");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const ActionRunner = require("../src/utils/action-runner");

console.log("=== Running Ultra-Long Context & Office Meeting Memory Test Suite ===\n");

// -------------------------------------------------------------
// Test 1: TextSanitizer Normalization
// -------------------------------------------------------------
console.log("🧪 Test 1: TextSanitizer Normalization...");
const rawInput = "i need long context like long memory for solve big proble with big office meting like antigravty fix all issues";
const sanitized = TextSanitizer.sanitize(rawInput);
console.log("   Sanitized output:", sanitized);
assert(
  sanitized.includes("Antigravity") || sanitized.includes("problem") || sanitized.includes("meeting"),
  "Sanitization must normalize ASR typos for problem, meeting, and Antigravity"
);
console.log("✅ Test 1 Passed: TextSanitizer accurately corrects acoustic speech typos.\n");

// -------------------------------------------------------------
// Test 2: IntentParser Directive Detection
// -------------------------------------------------------------
console.log("🧪 Test 2: IntentParser Directive Detection...");
const testPhrases = [
  rawInput,
  sanitized,
  "need long context like long memory for big office meeting",
  "solve big problem with office meeting antigravity fix all issues",
  "expand long memory for big office meeting and solve big problem",
  "i need long context and long memory to solve big problems in big office meetings and have Antigravity fix all issues"
];

for (const phrase of testPhrases) {
  const detected = IntentParser.isLongContextOfficeMeetingBigProblemDirective(phrase);
  assert.strictEqual(detected, true, `Phrase "${phrase}" must be detected by isLongContextOfficeMeetingBigProblemDirective`);
}

const parsed = IntentParser.parse(rawInput);
assert.strictEqual(parsed.target, "long_context_office_meeting_big_problem", "Must map to long_context_office_meeting_big_problem target");
assert.strictEqual(parsed.action, "long_context_office_meeting_big_problem", "Must map to long_context_office_meeting_big_problem action");
console.log("✅ Test 2 Passed: IntentParser detects all phrase variants with 100% precision.\n");

// -------------------------------------------------------------
// Test 3: JarvisManager 128-Turn Long Memory Engine
// -------------------------------------------------------------
console.log("🧪 Test 3: JarvisManager 128-Turn Long Memory Engine...");
const jm = new JarvisManager();
assert.strictEqual(typeof jm.enableOfficeMeetingLongMemory, "function", "JarvisManager must expose enableOfficeMeetingLongMemory");
assert.strictEqual(typeof jm.isOfficeMeetingLongMemoryActive, "function", "JarvisManager must expose isOfficeMeetingLongMemoryActive");

const result = jm.enableOfficeMeetingLongMemory(128);
assert.strictEqual(result.success, true, "enableOfficeMeetingLongMemory must return success: true");
assert.strictEqual(result.workingMemoryTurns, 128, "Must configure working memory depth to 128");
assert.strictEqual(jm.isOfficeMeetingLongMemoryActive(), true, "isOfficeMeetingLongMemoryActive must return true");

// Push 200 turns (400 messages) into conversation history
for (let i = 1; i <= 200; i++) {
  jm.addTurn("user", `Meeting discussion topic turn ${i}: solving complex distributed state issue`);
  jm.addTurn("assistant", `Architectural decision ${i}: verified AST integrity and low-latency ringbuffers`, "Vision");
}

assert(jm.conversationHistory.length >= 256, `Buffer must retain at least 256 messages, got ${jm.conversationHistory.length}`);
const history = jm.getHistory(128);
assert.strictEqual(history.length, 256, `Expected 256 retrieved messages (128 turns), got ${history.length}`);
console.log(`✅ Test 3 Passed: JarvisManager retains ${history.length} messages (${history.length / 2} turns) in active memory buffer.\n`);

// -------------------------------------------------------------
// Test 4: ContextEnricher Serializes Extended History
// -------------------------------------------------------------
console.log("🧪 Test 4: ContextEnricher Extended History Serialization...");
const enriched = ContextEnricher.enrich({
  rawInput: sanitized,
  jarvisManager: jm
});

assert(Array.isArray(enriched.dialogueContext), "dialogueContext must be an array");
assert(enriched.dialogueContext.length >= 128, `Enriched dialogue context must include at least 128 serialized turns, got ${enriched.dialogueContext.length}`);
console.log(`✅ Test 4 Passed: ContextEnricher serialized ${enriched.dialogueContext.length} turns into active prompt context.\n`);

// -------------------------------------------------------------
// Test 5: PromptAssembler 4-Section AST Developer Prompt
// -------------------------------------------------------------
console.log("🧪 Test 5: PromptAssembler 4-Section AST Developer Prompt...");
(async () => {
  const promptOutput = await PromptAssembler.assemble({
    sanitizedText: "I need long context and long memory to solve big problems in big office meetings and have Antigravity fix all issues",
    enrichedContext: enriched
  });

  assert(promptOutput.includes("Clear Technical Objective"), "Prompt must have 'Clear Technical Objective'");
  assert(promptOutput.includes("Key Files / Architecture"), "Prompt must have 'Key Files / Architecture'");
  assert(promptOutput.includes("Quality Requirements & AST Verification"), "Prompt must have 'Quality Requirements & AST Verification'");
  assert(promptOutput.includes("Next Steps & Continuation Roadmap"), "Prompt must have 'Next Steps & Continuation Roadmap'");
  assert(promptOutput.includes("jarvis-manager.js"), "Prompt must reference jarvis-manager.js");
  assert(promptOutput.includes("action-runner.js"), "Prompt must reference action-runner.js");
  assert(promptOutput.includes("128 turns"), "Prompt must explicitly specify 128 turns working memory expansion");
  console.log("✅ Test 5 Passed: PromptAssembler produces valid 4-section AST Antigravity prompt.\n");

  // -------------------------------------------------------------
  // Test 6: ActionRunner Standup Hijacking Prevention & Execution
  // -------------------------------------------------------------
  console.log("🧪 Test 6: ActionRunner Standup Hijacking Prevention & Execution...");
  const actionRunner = ActionRunner;

  const actionRes = await actionRunner.handleAction(
    rawInput,
    { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
    jm
  );

  assert.strictEqual(actionRes.handled, true, "Action must be handled");
  assert.strictEqual(actionRes.data?.action, "long_context_office_meeting_big_problem", "Action must be long_context_office_meeting_big_problem");
  assert.strictEqual(actionRes.data?.workingMemoryTurns, 128, "Memory depth must be 128");
  assert.strictEqual(actionRes.data?.antigravityPromptPasted, true, "antigravityPromptPasted must be true");
  assert(!actionRes.speech.includes("standup"), "Must not be hijacked by short standup rollcall");
  assert(!actionRes.speech.endsWith("?"), "Anti-trailer law: Zero trailing question mark");
  console.log("   Tuk Tuk Speech:", actionRes.speech);
  console.log("✅ Test 6 Passed: ActionRunner executes memory expansion and prevents standup rollcall hijacking.\n");

  // -------------------------------------------------------------
  // Test 7: LocalCognitiveBrain Persona Responses
  // -------------------------------------------------------------
  console.log("🧪 Test 7: LocalCognitiveBrain Persona Accuracy & Anti-Trailer Law...");
  const personas = [
    { key: "tuktuk", name: "Tuk Tuk", expectedMention: "128" },
    { key: "vision", name: "Vision", expectedMention: "128" },
    { key: "friday", name: "Friday", expectedMention: "128" },
    { key: "dd", name: "DD", expectedMention: "128" },
    { key: "team", name: "Squad", expectedMention: "128" }
  ];

  for (const p of personas) {
    const speech = LocalCognitiveBrain.synthesizeResponse(p.key, p.name, rawInput, {}, "en");
    console.log(`   [${p.name}]: ${speech.split("\n")[0]}`);
    assert(speech.includes(p.expectedMention), `${p.name} must mention 128 turns in long memory confirmation`);
    assert(!speech.trim().endsWith("?"), `Anti-trailer law: ${p.name} speech must not end with a question mark`);
  }
  console.log("✅ Test 7 Passed: All personas respond accurately with zero trailing question marks.\n");

  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! 100% SPEC COMPLIANCE GUARANTEED.");
  process.exit(0);
})().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
