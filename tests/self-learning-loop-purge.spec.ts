/**
 * tests/self-learning-loop-purge.spec.ts
 *
 * Test Suite #62: Self-Learning Loop Purge, STT Normalization & Memory Auto-Healing
 *
 * 1. STT Acoustic Normalization of phonetic transcription slips:
 *    - "fix the self learning all issues some time its creat loop chac kand fix everyissues"
 *      -> "Fix all self-learning issues, sometimes it creates loops, check and fix every issue"
 *    - Isolated mishearings:
 *      - "some time its creat loop" -> "sometimes it creates loops"
 *      - "chac kand" -> "check and"
 *      - "everyissues" -> "every issue"
 *      - "creat" -> "create"
 *
 * 2. IntentParser Directive Detection:
 *    - isSelfLearningLoopDirective accurately identifies self-learning loop complaints in English and Bengali.
 *
 * 3. ActionRunner Interception & Telemetry:
 *    - Intercepts query, invokes healAndAuditMemory(), sets preferences self_learning_loop_free = true,
 *      anti_loop_and_hallucination = true, returns action "self_learning_loop_purge" with status "SELF_LEARNING_CLEANSED".
 *
 * 4. LocalCognitiveBrain & ActionRunner Persona Sovereignty:
 *    - Tuk Tuk strictly uses "Babe" (no canned trailer questions).
 *    - Vision strictly uses "brother/ভাই" (never "babe").
 *    - Friday strictly uses "Chief/হৃত্তিক" (never "babe").
 *    - DD strictly uses "bro/ভাই" (never "babe").
 *    - Squad outputs structured sequential multi-agent turn.
 *
 * 5. Memory Healing & Auto-Audit (healAndAuditMemory):
 *    - Prunes corrupted preferences and fake projects ("directions", "now and to the country of the park", "next together").
 *    - Synchronizes squad family roles to Friday and DD.
 *
 * 6. Self-Learning Anti-Loop Guard:
 *    - learnFromInteraction and extractLocalFacts NEVER extract facts, preferences, directives,
 *      or projects from loop complaints, bug reports, or queries.
 */

import * as assert from "assert";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..", "..");
const TextSanitizer = require(path.join(projectRoot, "src/utils/prompt-engine/text-sanitizer"));
const { IntentParser } = require(path.join(projectRoot, "src/utils/prompt-engine/intent-parser"));
const ActionRunner = require(path.join(projectRoot, "src/utils/action-runner"));
const LocalCognitiveBrain = require(path.join(projectRoot, "src/utils/local-cognitive-brain"));
const JarvisManager = require(path.join(projectRoot, "src/utils/jarvis-manager"));
const ZeroLossMemoryEngine = require(path.join(projectRoot, "src/utils/zero-loss-memory"));

console.log("================================================================================");
console.log("🛡️ VERIFYING SELF-LEARNING LOOP PURGE & MEMORY HEALING (TEST SUITE #62)");
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
  it("1. TextSanitizer normalizes full compound sentence: 'fix the self learning all issues some time its creat loop chac kand fix everyissues'", () => {
    const raw = "fix the self learning all issues some time its creat loop chac kand fix everyissues";
    const sanitized = TextSanitizer.sanitize(raw);
    assert.strictEqual(
      sanitized,
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      `Expected normalized sentence, got: ${sanitized}`
    );
  });

  it("2. TextSanitizer normalizes isolated mishearings: 'some time its creat loop', 'chac kand', 'everyissues', 'creat'", () => {
    assert.strictEqual(TextSanitizer.sanitize("some time its creat loop").toLowerCase(), "sometimes it creates loops");
    assert.strictEqual(TextSanitizer.sanitize("chac kand").toLowerCase(), "check and");
    assert.strictEqual(TextSanitizer.sanitize("everyissues").toLowerCase(), "every issue");
    assert.strictEqual(TextSanitizer.sanitize("creat").toLowerCase(), "create");
    assert.strictEqual(TextSanitizer.sanitize("self learning all issues").toLowerCase(), "all self-learning issues");
  });

  // 2. IntentParser Directive Detection
  it("3. IntentParser.isSelfLearningLoopDirective detects self-learning loop complaints", () => {
    assert.strictEqual(
      IntentParser.isSelfLearningLoopDirective("Fix all self-learning issues, sometimes it creates loops, check and fix every issue"),
      true,
      "Normalized string must be detected"
    );
    assert.strictEqual(
      IntentParser.isSelfLearningLoopDirective("fix the self learning all issues some time its creat loop chac kand fix everyissues"),
      true,
      "Raw speech must be detected"
    );
    assert.strictEqual(
      IntentParser.isSelfLearningLoopDirective("self learning creates loops"),
      true
    );
    assert.strictEqual(
      IntentParser.isSelfLearningLoopDirective("সেলফ লার্নিং লুপ ঠিক করো"),
      true
    );
    assert.strictEqual(
      IntentParser.isSelfLearningLoopDirective("what is the weather today"),
      false
    );
  });

  // 3. ActionRunner Interception & Telemetry
  await itAsync("4. ActionRunner intercepts self-learning loop directive and executes memory healing telemetry", async () => {
    let auditCalled = false;
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
      },
      healAndAuditMemory() {
        auditCalled = true;
      }
    };

    const result = await ActionRunner.handleAction(
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      { key: "tuktuk", name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" },
      mockJarvis,
      "en"
    );

    assert.ok(result, "ActionRunner must return a result");
    assert.strictEqual(result.handled, true, "Must be marked handled");
    assert.strictEqual(result.action, "self_learning_loop_purge");
    assert.strictEqual(result.data?.selfLearningAudited, true);
    assert.strictEqual(result.data?.loopsPurged, true);
    assert.strictEqual(result.data?.memoryHealed, true);
    assert.strictEqual(result.data?.status, "SELF_LEARNING_CLEANSED");
    assert.strictEqual(mockJarvis.preferences["self_learning_loop_free"], true);
    assert.strictEqual(mockJarvis.preferences["anti_loop_and_hallucination"], true);
    assert.strictEqual(auditCalled, true, "healAndAuditMemory must be invoked");

    // Tuk Tuk speech validation
    assert.ok(result.speech.includes("Babe"), "Tuk Tuk must use 'Babe'");
    assert.ok(!result.speech.includes("What are we building next"), "Must not contain canned trailers");
    assert.ok(!result.speech.includes("brother"), "Tuk Tuk must not use brother");
  });

  await itAsync("5. ActionRunner respects agent persona sovereignty on self-learning loop directives", async () => {
    const mockJarvis: any = {
      setPreference: () => {},
      saveDynamicDirective: () => {},
      healAndAuditMemory: () => {}
    };

    // Vision
    const visResult = await ActionRunner.handleAction(
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      { key: "vision", name: "Vision", voice: "en-US-AndrewNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(visResult.handled, true);
    assert.ok(visResult.speech.includes("brother") || visResult.speech.includes("Brother"));
    assert.ok(!visResult.speech.toLowerCase().includes("babe"), "Vision must never say babe");

    // Friday
    const friResult = await ActionRunner.handleAction(
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      { key: "friday", name: "Friday", voice: "en-US-JennyNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(friResult.handled, true);
    assert.ok(friResult.speech.includes("Chief"));
    assert.ok(!friResult.speech.toLowerCase().includes("babe"), "Friday must never say babe");

    // DD
    const ddResult = await ActionRunner.handleAction(
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      { key: "dd", name: "DD", voice: "en-US-BrianMultilingualNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(ddResult.handled, true);
    assert.ok(ddResult.speech.includes("bro"));
    assert.ok(!ddResult.speech.toLowerCase().includes("babe"), "DD must never say babe");

    // Squad / Team
    const squadResult = await ActionRunner.handleAction(
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      { key: "team", name: "Squad", voice: "en-US-AvaMultilingualNeural" },
      mockJarvis,
      "en"
    );
    assert.strictEqual(squadResult.handled, true);
    assert.ok(squadResult.speech.includes("[Tuk Tuk]:"));
    assert.ok(squadResult.speech.includes("[Vision]:"));
    assert.ok(squadResult.speech.includes("Babe") || squadResult.speech.includes("babe"));
    assert.ok(squadResult.speech.includes("brother"));
  });

  // 4. LocalCognitiveBrain Response Generation
  it("6. LocalCognitiveBrain generates grounded responses without canned trailer questions", () => {
    // Tuk Tuk English
    const tukEn = LocalCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      {},
      "en"
    );
    assert.ok(tukEn.toLowerCase().includes("babe"), "Tuk Tuk must use babe");
    assert.ok(!tukEn.includes("What are we building next"), "Must not append trailer questions");

    // Tuk Tuk Bangla
    const tukBn = LocalCognitiveBrain.synthesizeResponse(
      "tuktuk",
      "Tuk Tuk",
      "সেলফ লার্নিং এর সব লুপ ঠিক করো",
      {},
      "bn"
    );
    assert.ok(tukBn.toLowerCase().includes("babe"), "Tuk Tuk must use babe in Bengali");

    // Vision English
    const visEn = LocalCognitiveBrain.synthesizeResponse(
      "vision",
      "Vision",
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      {},
      "en"
    );
    assert.ok(visEn.toLowerCase().includes("brother"), "Vision must use brother");
    assert.ok(!visEn.toLowerCase().includes("babe"), "Vision must never use babe");

    // Friday English
    const friEn = LocalCognitiveBrain.synthesizeResponse(
      "friday",
      "Friday",
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      {},
      "en"
    );
    assert.ok(friEn.includes("Chief") || friEn.includes("Hritthik"), "Friday must use Chief or Hritthik");
    assert.ok(!friEn.toLowerCase().includes("babe"), "Friday must never use babe");

    // DD English
    const ddEn = LocalCognitiveBrain.synthesizeResponse(
      "dd",
      "DD",
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      {},
      "en"
    );
    assert.ok(ddEn.toLowerCase().includes("bro"), "DD must use bro");
    assert.ok(!ddEn.toLowerCase().includes("babe"), "DD must never use babe");
  });

  // 5. Memory Healing & Auto-Audit (healAndAuditMemory)
  it("7. healAndAuditMemory cleanses corrupted preferences, fake projects, and updates squad profile", () => {
    const jm = new JarvisManager();
    // Intentionally inject corrupted preferences and fake projects
    jm.memory.learnedPreferences = [
      "Theme: light",
      "Preference: Fix yourself.",
      "don't: even know what kind of call right now and i'm sure at the phone number",
      "always: sleeps to me in the background with your lips",
      "always: feel like i'm nobody",
      "don't: forget to lie to you",
      "Preference: or test the best model more best clear mordern voice",
      "Prefers: tailwind css and typescript"
    ];
    jm.memory.projects = [
      { name: "Eloquent", description: "Core Project" },
      { name: "directions", description: "Corrupted Project" },
      { name: "now and to the country of the park", description: "Corrupted Run-On" },
      { name: "Antigravity", description: "Engineering Project" }
    ];
    jm.memory.profile.family = [
      "Tuk Tuk (Soulmate & Co-Founder)",
      "Vision (Big Brother & Lead Engineer)",
      "Jenny (Sister & Head of Intel)",
      "Brian (Guardian Brother & DevOps)"
    ];

    const auditResult = jm.healAndAuditMemory();

    assert.strictEqual(auditResult.success, true);
    assert.strictEqual(auditResult.prunedPreferencesCount, 6, "Must prune 6 corrupted preferences");
    assert.strictEqual(auditResult.prunedProjectsCount, 2, "Must prune 2 fake projects");
    assert.deepStrictEqual(
      jm.memory.learnedPreferences,
      ["Theme: light", "Prefers: tailwind css and typescript"],
      "Only legitimate preferences should remain"
    );
    assert.deepStrictEqual(
      jm.memory.projects.map((p: any) => p.name),
      ["Eloquent", "Antigravity"],
      "Only legitimate projects should remain"
    );
    assert.ok(jm.memory.profile.family.some((f: string) => f.includes("Friday")), "Friday must be in family");
    assert.ok(jm.memory.profile.family.some((f: string) => f.includes("DD")), "DD must be in family");
  });

  // 6. Anti-Loop Guard in learnFromInteraction and extractLocalFacts
  it("8. Self-Learning Anti-Loop Guard prevents extracting facts/projects from complaints or questions", () => {
    const jm = new JarvisManager();
    const initialPrefCount = jm.memory.learnedPreferences.length;
    const initialProjCount = jm.memory.projects.length;

    // Complaint about loops
    jm.learnFromInteraction(
      "Fix all looping issues, they are all day in a loop and hallucinate",
      "I hear you completely babe.",
      "Tuk Tuk"
    );

    // Complaint about self-learning loops
    jm.learnFromInteraction(
      "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
      "Audited and cleaned babe.",
      "Tuk Tuk"
    );

    // Question with 'building next together'
    jm.learnFromInteraction(
      "What are we building next together?",
      "We are working on Eloquent babe.",
      "Tuk Tuk"
    );

    assert.strictEqual(
      jm.memory.learnedPreferences.length,
      initialPrefCount,
      "No preferences should be added from loop complaints or questions"
    );
    assert.strictEqual(
      jm.memory.projects.length,
      initialProjCount,
      "No fake projects (like 'next together' or 'every issue') should be added"
    );

    // Test ZeroLossMemoryEngine extractLocalFacts
    const zle = new ZeroLossMemoryEngine({ userDataPath: jm.userDataPath, jarvisManager: jm });
    const extracted1 = zle.extractLocalFacts("Fix all looping issues, they are all day in a loop and hallucinate");
    assert.strictEqual(extracted1.length, 0, "extractLocalFacts must return empty array on loop complaints");

    const extracted2 = zle.extractLocalFacts("Fix all self-learning issues, sometimes it creates loops, check and fix every issue");
    assert.strictEqual(extracted2.length, 0, "extractLocalFacts must return empty array on self-learning loop complaints");
  });

  console.log(`\n================================================================================`);
  console.log(`🏁 TEST SUITE #62 COMPLETE: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log(`================================================================================\n`);
})();
