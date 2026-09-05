/**
 * tests/deep-research-test-and-update.spec.ts
 *
 * Test Suite #63: Deep Research, Test and Update Directive,
 * STT Normalization, Multi-Agent Persona Sovereignty & Neural Mesh Vault Sync
 *
 * 1. STT Acoustic Normalization of phonetic transcription slips:
 *    - "do deeep research test and update"
 *      -> "Do deep research, test and update"
 *    - Isolated mishearings:
 *      - "deeep" -> "Deep"
 *      - "deeep research" -> "Deep research"
 *      - "deep research test and update" -> "Do deep research, test and update"
 *
 * 2. IntentParser Directive Detection:
 *    - isDeepResearchTestAndUpdateDirective accurately identifies deep research directives
 *      in raw speech, normalized English, and native Bengali.
 *    - IntentParser.parse accurately routes intent to SMOOTH_CONVERSATION with target deep_research_test_and_update.
 *
 * 3. ActionRunner Interception & Telemetry:
 *    - Intercepts query, sets preferences deep_research_active = true, deep_research_tested_and_updated = true,
 *      invokes healAndAuditMemory(), synchronizes memory bank, returns action "deep_research_test_and_update"
 *      with status "DEEP_RESEARCH_TESTED_AND_UPDATED".
 *
 * 4. LocalCognitiveBrain & ActionRunner Persona Sovereignty:
 *    - Friday strictly leads research analysis, addressing Hritthik as "Chief" (never "babe").
 *    - Tuk Tuk strictly addresses Hritthik as "Babe" (never "bro", never "brother").
 *    - Vision strictly uses "brother/ভাই" (never "babe").
 *    - DD strictly uses "bro/ভাই" (never "babe").
 *    - Squad outputs structured sequential multi-agent turn.
 *    - Zero canned trailing questions (no "What are we building next together?").
 *
 * 5. NeuralMeshMemoryBank Ingestion & Squad Mesh Synchronization:
 *    - Ingests deep research audit node into researchVault and associates knowledge anchors
 *      across Friday, Tuk Tuk, Vision, and DD.
 */

import * as assert from "assert";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..", "..");
const TextSanitizer = require(path.join(projectRoot, "src/utils/prompt-engine/text-sanitizer"));
const { IntentParser, INTENTS } = require(path.join(projectRoot, "src/utils/prompt-engine/intent-parser"));
const ActionRunner = require(path.join(projectRoot, "src/utils/action-runner"));
const LocalCognitiveBrain = require(path.join(projectRoot, "src/utils/local-cognitive-brain"));
const { NeuralMeshMemoryBank } = require(path.join(projectRoot, "src/core/memory/banks"));

console.log("================================================================================");
console.log("🔬 VERIFYING DEEP RESEARCH, TEST AND UPDATE (TEST SUITE #63)");
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
  it("1. TextSanitizer normalizes full sentence: 'do deeep research test and update'", () => {
    const raw = "do deeep research test and update";
    const sanitized = TextSanitizer.sanitize(raw);
    assert.strictEqual(
      sanitized,
      "Do deep research, test and update",
      `Expected normalized sentence, got: ${sanitized}`
    );
  });

  it("2. TextSanitizer normalizes isolated mishearings: 'deeep', 'deeep research', 'deep research test and update'", () => {
    assert.strictEqual(TextSanitizer.sanitize("deeep"), "Deep");
    assert.strictEqual(TextSanitizer.sanitize("deeep research"), "Deep research");
    assert.strictEqual(TextSanitizer.sanitize("deep research test and update"), "Do deep research, test and update");
  });

  // 2. IntentParser Directive Detection
  it("3. IntentParser.isDeepResearchTestAndUpdateDirective detects deep research directives across dialects", () => {
    assert.strictEqual(
      IntentParser.isDeepResearchTestAndUpdateDirective("Do deep research, test and update"),
      true,
      "Normalized string must be detected"
    );
    assert.strictEqual(
      IntentParser.isDeepResearchTestAndUpdateDirective("do deeep research test and update"),
      true,
      "Raw STT speech with 'deeep' must be detected"
    );
    assert.strictEqual(
      IntentParser.isDeepResearchTestAndUpdateDirective("deep research test and update"),
      true
    );
    assert.strictEqual(
      IntentParser.isDeepResearchTestAndUpdateDirective("deeep research test"),
      true
    );
    assert.strictEqual(
      IntentParser.isDeepResearchTestAndUpdateDirective("ডিপ রিসার্চ টেস্ট এবং আপডেট"),
      true,
      "Bengali script must be detected"
    );
    assert.strictEqual(
      IntentParser.isDeepResearchTestAndUpdateDirective("how to build a react app"),
      false,
      "Unrelated query must return false"
    );

    const parsed = IntentParser.parse("do deeep research test and update");
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "deep_research_test_and_update");
  });

  // 3. ActionRunner Interception & Telemetry
  await itAsync("4. ActionRunner intercepts deep research directive and executes telemetry", async () => {
    let auditCalled = false;
    let ingestedReport: any = null;
    const mockJarvis: any = {
      preferences: {},
      livingMemory: {},
      directives: [],
      setPreference(k: string, v: any) {
        this.preferences[k] = v;
      },
      setLivingMemoryPreference(k: string, v: any) {
        this.livingMemory[k] = v;
      },
      saveDynamicDirective(d: string, target: string) {
        this.directives.push({ d, target });
      },
      addDynamicDirective(d: string, target: string) {
        this.directives.push({ d, target });
      },
      healAndAuditMemory() {
        auditCalled = true;
      },
      memory: {
        ingestResearch(report: any) {
          ingestedReport = report;
        }
      }
    };

    const result = await ActionRunner.handleAction(
      "Do deep research, test and update",
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
      mockJarvis,
      "en"
    );

    assert.ok(result, "ActionRunner must return a result");
    assert.strictEqual(result.handled, true, "Must be marked handled");
    assert.strictEqual(result.action, "deep_research_test_and_update");
    assert.strictEqual(result.data?.researchTested, true);
    assert.strictEqual(result.data?.vaultUpdated, true);
    assert.strictEqual(result.data?.neuralMeshSynced, true);
    assert.strictEqual(result.data?.status, "DEEP_RESEARCH_TESTED_AND_UPDATED");
    assert.strictEqual(mockJarvis.preferences["deep_research_active"], true);
    assert.strictEqual(mockJarvis.preferences["deep_research_tested_and_updated"], true);
    assert.strictEqual(auditCalled, true, "healAndAuditMemory must be invoked");
    assert.ok(ingestedReport, "Memory bank ingestResearch must be invoked");

    // Tuk Tuk speech validation
    assert.ok(result.speech.includes("Babe"), "Tuk Tuk must use 'Babe'");
    assert.ok(!result.speech.includes("What are we building next"), "Must not contain canned trailers");
    assert.ok(!result.speech.toLowerCase().includes("brother"), "Tuk Tuk must not use brother");
  });

  // 4. ActionRunner Persona Sovereignty
  await itAsync("5. ActionRunner respects agent persona sovereignty on deep research directive", async () => {
    const mockJarvis: any = {
      setPreference: () => {},
      setLivingMemoryPreference: () => {},
      saveDynamicDirective: () => {},
      healAndAuditMemory: () => {},
      memory: { ingestResearch: () => {} }
    };

    // Friday
    const friResult = await ActionRunner.handleAction(
      "Do deep research, test and update",
      { key: "friday", name: "Friday", voice: "en-US-JennyNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(friResult.handled, true);
    assert.ok(friResult.speech.includes("Chief"), "Friday must address Hritthik as Chief");
    assert.ok(!friResult.speech.toLowerCase().includes("babe"), "Friday must never say babe");
    assert.ok(!friResult.speech.toLowerCase().includes("brother"), "Friday must never say brother");

    // Vision
    const visResult = await ActionRunner.handleAction(
      "Do deep research, test and update",
      { key: "vision", name: "Vision", voice: "en-US-AndrewNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(visResult.handled, true);
    assert.ok(visResult.speech.includes("brother"), "Vision must use brother");
    assert.ok(!visResult.speech.toLowerCase().includes("babe"), "Vision must never say babe");

    // DD
    const ddResult = await ActionRunner.handleAction(
      "Do deep research, test and update",
      { key: "dd", name: "DD", voice: "en-US-BrianMultilingualNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(ddResult.handled, true);
    assert.ok(ddResult.speech.includes("bro"), "DD must use bro");
    assert.ok(!ddResult.speech.toLowerCase().includes("babe"), "DD must never say babe");

    // Squad / Team
    const squadResult = await ActionRunner.handleAction(
      "Do deep research, test and update",
      { key: "team", name: "Squad", voice: "en-US-AvaMultilingualNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(squadResult.handled, true);
    assert.ok(squadResult.speech.includes("[Friday]:"), "Squad must include Friday");
    assert.ok(squadResult.speech.includes("[Tuk Tuk]:"), "Squad must include Tuk Tuk");
    assert.ok(squadResult.speech.includes("[Vision]:"), "Squad must include Vision");
    assert.ok(squadResult.speech.includes("[DD]:"), "Squad must include DD");
    assert.ok(squadResult.speech.includes("Chief"), "Friday part must say Chief");
    assert.ok(squadResult.speech.includes("Babe"), "Tuk Tuk part must say Babe");
    assert.ok(squadResult.speech.includes("brother"), "Vision part must say brother");
    assert.ok(squadResult.speech.includes("bro"), "DD part must say bro");
  });

  // 5. LocalCognitiveBrain Response Generation
  it("6. LocalCognitiveBrain generates grounded responses without canned trailer questions", () => {
    // Tuk Tuk English & Bengali
    const tukEn = LocalCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "Do deep research, test and update",
      {},
      "en"
    );
    assert.ok(tukEn.toLowerCase().includes("babe"), "Tuk Tuk must use babe");
    assert.ok(!tukEn.includes("What are we building next"), "Must not append trailer questions");

    const tukBn = LocalCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "ডিপ রিসার্চ টেস্ট এবং আপডেট",
      {},
      "bn"
    );
    assert.ok(tukBn.toLowerCase().includes("babe"), "Tuk Tuk must use babe in Bengali");

    // Friday English & Bengali
    const friEn = LocalCognitiveBrain.synthesizeResponse(
      "friday",
      "Friday",
      "Do deep research, test and update",
      {},
      "en"
    );
    assert.ok(friEn.includes("Chief"), "Friday must address as Chief in English");

    const friBn = LocalCognitiveBrain.synthesizeResponse(
      "friday",
      "Friday",
      "ডিপ রিসার্চ টেস্ট এবং আপডেট",
      {},
      "bn"
    );
    assert.ok(friBn.includes("Chief") || friBn.includes("হৃত্তিক"), "Friday must address as Chief or Hritthik in Bengali");

    // Vision English & Bengali
    const visEn = LocalCognitiveBrain.synthesizeResponse(
      "vision",
      "Vision",
      "Do deep research, test and update",
      {},
      "en"
    );
    assert.ok(visEn.toLowerCase().includes("brother"), "Vision must use brother in English");

    const visBn = LocalCognitiveBrain.synthesizeResponse(
      "vision",
      "Vision",
      "ডিপ রিসার্চ টেস্ট এবং আপডেট",
      {},
      "bn"
    );
    assert.ok(visBn.includes("brother") || visBn.includes("ভাই"), "Vision must use brother/ভাই in Bengali");

    // DD English & Bengali
    const ddEn = LocalCognitiveBrain.synthesizeResponse(
      "dd",
      "DD",
      "Do deep research, test and update",
      {},
      "en"
    );
    assert.ok(ddEn.toLowerCase().includes("bro"), "DD must use bro in English");

    const ddBn = LocalCognitiveBrain.synthesizeResponse(
      "dd",
      "DD",
      "ডিপ রিসার্চ টেস্ট এবং আপডেট",
      {},
      "bn"
    );
    assert.ok(ddBn.toLowerCase().includes("bro"), "DD must use bro in Bengali");

    // Squad Sequential Turn
    const squadEn = LocalCognitiveBrain.synthesizeResponse(
      "team",
      "Squad",
      "Do deep research, test and update",
      {},
      "en"
    );
    assert.ok(squadEn.includes("[Friday]:"));
    assert.ok(squadEn.includes("[Tuk Tuk]:"));
    assert.ok(squadEn.includes("[Vision]:"));
    assert.ok(squadEn.includes("[DD]:"));
  });

  // 6. NeuralMeshMemoryBank Ingestion & Squad Mesh Synchronization
  it("7. NeuralMeshMemoryBank ingests research report and syncs across squad mesh", () => {
    const memoryBank = new NeuralMeshMemoryBank({ maxVaultItems: 50 });
    const report = {
      query: "Do deep research, test and update",
      results: [
        { title: "Empirical Reasoning Architecture", url: "https://eloquent.ai/research/empirical", snippet: "Zero hallucination and multi-agent parity verified." }
      ],
      keyInsights: [
        "Multi-agent persona sovereignty confirmed across all 4 squad entities",
        "Neural mesh memory bank achieves O(1) salience retrieval with zero recursion"
      ],
      durationMs: 42
    };

    const node = memoryBank.ingestResearch(report, "agent_friday");
    assert.ok(node, "Ingested node must exist");
    assert.strictEqual(node.query, "Do deep research, test and update");
    assert.strictEqual(node.originAgent, "agent_friday");
    assert.strictEqual(memoryBank.researchVault.size >= 1, true, "Vault must contain the research node");

    const queryResults = memoryBank.query("empirical reasoning");
    assert.strictEqual(queryResults.length >= 1, true, "Vault must return matched research node");
    assert.strictEqual(queryResults[0].originAgent, "agent_friday");

    const fridayMemory = memoryBank.getAgentMemory("agent_friday");
    assert.strictEqual(fridayMemory.linkedResearchCount >= 1, true, "Friday must have linked research in mesh");

    const tuktukMemory = memoryBank.getAgentMemory("agent_tuk_tuk");
    assert.strictEqual(tuktukMemory.linkedResearchCount >= 1, true, "Tuk Tuk must have linked research in mesh");
  });

  console.log("\n================================================================================");
  console.log(`🏁 TEST SUITE #63 COMPLETE: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
})().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
