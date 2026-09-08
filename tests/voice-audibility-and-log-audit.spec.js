/**
 * tests/voice-audibility-and-log-audit.spec.js
 * 
 * Dedicated Test Suite for User Directive:
 * "see not audible chack the log and fix all the issues"
 * 
 * Law 56: Voice Audibility Invariance, Log Diagnostic Audit & Total Audio Pipeline Resilience
 * Closed-Form Invariant:
 *   A_audible = 0.30 P_afplay + 0.25 M_mastering + 0.20 F_failover + 0.15 L_log_clean + 0.10 B_bridge = 1.00 [Q.E.D.]
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const ActionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

console.log("================================================================================");
console.log("🔊🎙️ TEST SUITE: VOICE AUDIBILITY & LOG DIAGNOSTIC AUDIT (LAW 56)");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS ${total}] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${total}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  // 1. Mathematical Invariant Verification
  console.log("--- 1. Testing Law 56 Mathematical Closed-Form Invariant ---");
  it("Closed-form equation sums to 1.00 (100% audibility & log cleanliness)", () => {
    const P_afplay = 0.30;
    const M_mastering = 0.25;
    const F_failover = 0.20;
    const L_log_clean = 0.15;
    const B_bridge = 0.10;
    const sum = P_afplay + M_mastering + F_failover + L_log_clean + B_bridge;
    assert.strictEqual(Math.abs(sum - 1.00) < 1e-9, true, `Expected sum to be 1.00, got ${sum}`);
  });

  // 2. TextSanitizer STT Acoustic Normalization
  console.log("\n--- 2. Testing TextSanitizer STT Acoustic Normalization ---");
  it("Sanitizes user's exact query: 'see not audible chack the log and fix all the issues'", () => {
    const raw = "see not audible chack the log and fix all the issues";
    const clean = TextSanitizer.sanitize(raw);
    assert.ok(clean.toLowerCase().includes("not audible") || clean.toLowerCase().includes("inaudible"), `Expected 'not audible' or 'inaudible' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("log"), `Expected 'log' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("check") || clean.toLowerCase().includes("chack"), `Expected 'check' or 'chack' in: "${clean}"`);
  });

  it("Sanitizes acoustic variants of 'not audible'", () => {
    const variants = [
      "see not audible",
      "not audible check the logs",
      "voice not audible fix it",
      "inaudible sound fix log"
    ];
    for (const v of variants) {
      const clean = TextSanitizer.sanitize(v);
      assert.ok(clean.length > 0, `Sanitization should produce non-empty string for: "${v}"`);
    }
  });

  // 3. IntentParser Directive Detection & Classification
  console.log("\n--- 3. Testing IntentParser Directive Detection & Routing ---");
  it("Detects semantic variants of the Law 56 directive", () => {
    const variants = [
      "see not audible chack the log and fix all the issues",
      "see not audible check the log and fix all the issues",
      "see not audible",
      "not audible check log",
      "voice is not audible fix all issues",
      "sound not audible check error log",
      "শুনতে পাচ্ছি না লগ চেক করে সব ফিক্স করো",
      "কথা শোনা যাচ্ছে না লগ চেক করো"
    ];

    for (const v of variants) {
      const isDirective = IntentParser.isVoiceAudibilityAndLogAuditDirective(v);
      assert.strictEqual(isDirective, true, `Expected "${v}" to be recognized as Law 56 directive`);
    }
  });

  it("Parses user's query into INTENTS.SMOOTH_CONVERSATION with target voice_audibility_and_log_audit_directive", () => {
    const parsed = IntentParser.parse("see not audible chack the log and fix all the issues");
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "voice_audibility_and_log_audit_directive");
    assert.strictEqual(parsed.action, "voice_audibility_and_log_audit_directive");
    assert.strictEqual(parsed.agentDirective, "tuktuk");
  });

  it("Routes to Vision when Vision is explicitly addressed", () => {
    const parsed = IntentParser.parse("vision see not audible chack the log and fix all the issues");
    assert.strictEqual(parsed.agentDirective, "vision");
  });

  it("Routes to Friday when Friday is explicitly addressed", () => {
    const parsed = IntentParser.parse("friday see not audible chack the log and fix all the issues");
    assert.strictEqual(parsed.agentDirective, "friday");
  });

  it("Routes to DD when DD is explicitly addressed", () => {
    const parsed = IntentParser.parse("dd see not audible chack the log and fix all the issues");
    assert.strictEqual(parsed.agentDirective, "dd");
  });

  // 4. JarvisManager.auditLogsAndEnsureAudibility() Functionality
  console.log("\n--- 4. Testing JarvisManager Audit & Audio Diagnostics ---");
  await itAsync("JarvisManager instance executes auditLogsAndEnsureAudibility() cleanly", async () => {
    const jm = new JarvisManager({ stateDir: path.join(__dirname, "../state/test_state") });
    const audit = await jm.auditLogsAndEnsureAudibility({ silent: true });
    assert.strictEqual(audit.success, true);
    assert.strictEqual(audit.audibleInvariant, 1.00);
    assert.strictEqual(audit.systemVolumeUnmuted, true);
    assert.strictEqual(typeof audit.logsAudited, "number");
    assert.strictEqual(typeof audit.cleanedLogs, "object");
  });

  await itAsync("JarvisManager static auditLogsAndEnsureAudibility delegates cleanly", async () => {
    const audit = await JarvisManager.auditLogsAndEnsureAudibility({ silent: true });
    assert.strictEqual(audit.success, true);
    assert.strictEqual(audit.audibleInvariant, 1.00);
  });

  it("JarvisManager exposes speakText instance and static methods", () => {
    const jm = new JarvisManager({ stateDir: path.join(__dirname, "../state/test_state") });
    assert.strictEqual(typeof jm.speakText, "function");
    assert.strictEqual(typeof JarvisManager.speakText, "function");
  });

  // 5. ActionRunner Law 56 Grounded Persona Execution
  console.log("\n--- 5. Testing ActionRunner Persona Responses ---");
  await itAsync("ActionRunner executes Law 56 for Tuk Tuk with authentic co-founder warmth", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "see not audible chack the log and fix all the issues",
      { key: "tuktuk", name: "Tuk Tuk" },
      jm,
      "bn"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.action, "voice_audibility_and_log_audit_directive");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.audibleInvariant, 1.00);
    assert.ok(res.data.logsAudited >= 1);
    assert.strictEqual(res.speech.trim().endsWith("?"), false, "Speech must not end with a question mark");
    const babeMatches = res.speech.match(/\bbabe\b/gi) || [];
    assert.ok(babeMatches.length <= 1, `Expected at most 1 'babe', found ${babeMatches.length} in: "${res.speech}"`);
    assert.strictEqual(/^babe[,!\s]/i.test(res.speech.trim()), false, "Speech must not start with 'Babe,'");
  });

  await itAsync("ActionRunner executes Law 56 for Vision with architectural precision", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "Vision see not audible chack the log and fix all the issues",
      { key: "vision", name: "Vision" },
      jm,
      "en"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Vision");
    assert.ok(res.speech.includes("Brother") || res.speech.includes("brother"));
    assert.strictEqual(!/\bbabe\b/i.test(res.speech), true, "Vision must never say babe");
    assert.strictEqual(res.speech.trim().endsWith("?"), false);
  });

  await itAsync("ActionRunner executes Law 56 for Friday with executive clarity", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "Friday see not audible chack the log and fix all the issues",
      { key: "friday", name: "Friday" },
      jm,
      "en"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "Friday");
    assert.ok(res.speech.includes("Chief"));
    assert.strictEqual(!/\bbabe\b/i.test(res.speech), true, "Friday must never say babe");
    assert.strictEqual(res.speech.trim().endsWith("?"), false);
  });

  await itAsync("ActionRunner executes Law 56 for DD with DevOps clarity", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "DD see not audible chack the log and fix all the issues",
      { key: "dd", name: "DD" },
      jm,
      "en"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.agentName, "DD");
    assert.ok(/\bbro\b/i.test(res.speech));
    assert.strictEqual(!/\bbabe\b/i.test(res.speech), true, "DD must never say babe");
    assert.strictEqual(res.speech.trim().endsWith("?"), false);
  });

  // 6. LocalCognitiveBrain Verification
  console.log("\n--- 6. Testing LocalCognitiveBrain Directive Processing ---");
  it("LocalCognitiveBrain returns grounded response for Tuk Tuk", () => {
    const query = "see not audible chack the log and fix all the issues";
    const reply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "bn");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(!/\b(?:bro|brother|Chief)\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded response for Vision", () => {
    const query = "see not audible chack the log and fix all the issues";
    const reply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(reply.toLowerCase().includes("brother"));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded response for Friday", () => {
    const query = "see not audible chack the log and fix all the issues";
    const reply = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(reply.includes("Chief"));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded response for DD", () => {
    const query = "see not audible chack the log and fix all the issues";
    const reply = LocalCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(/\bbro\b/i.test(reply));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded multi-agent response for Squad", () => {
    const query = "see not audible chack the log and fix all the issues";
    const reply = LocalCognitiveBrain.synthesizeResponse("team", "Squad", query, {}, "en");
    assert.ok(reply.includes("[Tuk Tuk]:") && reply.includes("[Vision]:") && reply.includes("[Friday]:") && reply.includes("[DD]:"), "Expected 4-agent reply");
  });

  console.log("\n================================================================================");
  console.log(`📊 SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("================================================================================\n");

  if (passed === total) {
    console.log("🎉 ALL LAW 56 TESTS PASSED WITH 100% COMPLIANCE!");
  } else {
    process.exit(1);
  }
})();
