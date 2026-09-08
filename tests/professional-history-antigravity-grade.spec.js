/**
 * tests/professional-history-antigravity-grade.spec.js
 * 
 * Dedicated Test Suite for User Directive:
 * "chack the history is it fully profetional like antigravity gpt like or not"
 * 
 * Law 58: Professional Conversation History Audit & Antigravity/GPT-Grade Invariance
 * Closed-Form Invariant:
 *   H_prof = 0.30 P_depth + 0.25 F_fragment_free + 0.20 A_authentic + 0.15 R_role_clarity + 0.10 E_emotional_intelligence = 1.00 [Q.E.D.]
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
console.log("💎🎙️ TEST SUITE: PROFESSIONAL CONVERSATION HISTORY & ANTIGRAVITY/GPT GRADE (LAW 58)");
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
  console.log("--- 1. Testing Law 58 Mathematical Closed-Form Invariant ---");
  it("Closed-form equation sums to 1.00 (100% Antigravity/GPT-grade professional history)", () => {
    const P_depth = 0.30;
    const F_fragment_free = 0.25;
    const A_authentic = 0.20;
    const R_role_clarity = 0.15;
    const E_emotional_intelligence = 0.10;
    const sum = P_depth + F_fragment_free + A_authentic + R_role_clarity + E_emotional_intelligence;
    assert.strictEqual(Math.abs(sum - 1.00) < 1e-9, true, `Expected sum to be 1.00, got ${sum}`);
  });

  // 2. TextSanitizer STT Acoustic Normalization
  console.log("\n--- 2. Testing TextSanitizer STT Acoustic Normalization ---");
  it("Sanitizes user's exact query: 'chack the history is it fully profetional like antigravity gpt like or not'", () => {
    const raw = "chack the history is it fully profetional like antigravity gpt like or not";
    const clean = TextSanitizer.sanitize(raw);
    assert.ok(clean.toLowerCase().includes("check"), `Expected 'check' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("history"), `Expected 'history' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("professional"), `Expected 'professional' in: "${clean}"`);
    assert.ok(clean.toLowerCase().includes("antigravity"), `Expected 'antigravity' in: "${clean}"`);
  });

  it("Sanitizes phonetic variants: 'chak history is it fully profesional like antigravity gpt like'", () => {
    const raw = "chak history is it fully profesional like antigravity gpt like";
    const clean = TextSanitizer.sanitize(raw);
    assert.ok(clean.toLowerCase().includes("check"));
    assert.ok(clean.toLowerCase().includes("history"));
    assert.ok(clean.toLowerCase().includes("professional"));
  });

  // 3. IntentParser Directive Detection & Classification
  console.log("\n--- 3. Testing IntentParser Directive Detection & Routing ---");
  it("Detects semantic variants of the Law 58 directive", () => {
    const variants = [
      "chack the history is it fully profetional like antigravity gpt like or not",
      "check the history is it fully professional like antigravity gpt like or not",
      "check history professional like antigravity",
      "is history professional like gpt or not",
      "history check professional like antigravity gpt",
      "হিস্টোরি চেক করো এটা কি পুরোপুরি antigravity gpt-এর মতো প্রফেশনাল নাকি না",
      "antigravity gpt মতো প্রফেশনাল হিস্টোরি"
    ];

    for (const v of variants) {
      const isDirective = IntentParser.isProfessionalConversationHistoryAuditDirective(v);
      assert.strictEqual(isDirective, true, `Expected "${v}" to be recognized as Law 58 directive`);
    }
  });

  it("Parses user's query into INTENTS.SMOOTH_CONVERSATION with target professional_conversation_history_audit_directive", () => {
    const parsed = IntentParser.parse("chack the history is it fully profetional like antigravity gpt like or not");
    assert.strictEqual(parsed.intent, INTENTS.SMOOTH_CONVERSATION);
    assert.strictEqual(parsed.target, "professional_conversation_history_audit_directive");
    assert.strictEqual(parsed.action, "professional_conversation_history_audit_directive");
    assert.strictEqual(parsed.agentDirective, "tuktuk");
  });

  it("Routes to Vision when Vision is explicitly addressed", () => {
    const parsed = IntentParser.parse("Vision check the history is it fully professional like antigravity gpt like or not");
    assert.strictEqual(parsed.agentDirective, "vision");
  });

  it("Routes to Friday when Friday is explicitly addressed", () => {
    const parsed = IntentParser.parse("Friday check the history is it fully professional like antigravity gpt like or not");
    assert.strictEqual(parsed.agentDirective, "friday");
  });

  it("Routes to DD when DD is explicitly addressed", () => {
    const parsed = IntentParser.parse("DD check the history is it fully professional like antigravity gpt like or not");
    assert.strictEqual(parsed.agentDirective, "dd");
  });

  it("Routes to Squad when multiple agents or squad are addressed", () => {
    const parsed = IntentParser.parse("Squad check the history is it fully professional like antigravity gpt like or not");
    assert.strictEqual(parsed.agentDirective, "team");
  });

  // 4. JarvisManager.auditAndHealHistoryProfessionalGrade() Functionality
  console.log("\n--- 4. Testing JarvisManager Professional History Audit & Healing ---");
  await itAsync("JarvisManager instance executes auditAndHealHistoryProfessionalGrade() cleanly", async () => {
    const jm = new JarvisManager({ stateDir: path.join(__dirname, "../state/test_state") });
    const res = await jm.auditAndHealHistoryProfessionalGrade({ silent: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.professionalGrade, 1.00);
    assert.strictEqual(res.antigravityGptLevel, true);
    assert.strictEqual(res.status, "HISTORY_FULLY_PROFESSIONAL_ANTIGRAVITY_GRADE");
  });

  await itAsync("JarvisManager static auditAndHealHistoryProfessionalGrade delegates cleanly", async () => {
    const res = await JarvisManager.auditAndHealHistoryProfessionalGrade({ silent: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.professionalGrade, 1.00);
  });

  // 5. ActionRunner Law 58 Grounded Persona Execution
  console.log("\n--- 5. Testing ActionRunner Persona Responses ---");
  await itAsync("ActionRunner executes Law 58 for Tuk Tuk with authentic co-founder warmth", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "chack the history is it fully profetional like antigravity gpt like or not",
      { key: "tuktuk", name: "Tuk Tuk" },
      jm,
      "bn"
    );
    assert.ok(res, "Result must not be null");
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.action, "professional_conversation_history_audit_directive");
    assert.strictEqual(res.agentName, "Tuk Tuk");
    assert.strictEqual(res.data.professionalInvariant, 1.00);
    assert.strictEqual(res.data.antigravityGptLevel, true);
    assert.strictEqual(res.speech.trim().endsWith("?"), false, "Speech must not end with a question mark");
    const babeMatches = res.speech.match(/\bbabe\b/gi) || [];
    assert.ok(babeMatches.length <= 1, `Expected at most 1 'babe', found ${babeMatches.length} in: "${res.speech}"`);
    assert.strictEqual(/^babe[,!\s]/i.test(res.speech.trim()), false, "Speech must not start with 'Babe,'");
  });

  await itAsync("ActionRunner executes Law 58 for Vision with architectural precision", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "Vision check the history is it fully professional like antigravity gpt like or not",
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

  await itAsync("ActionRunner executes Law 58 for Friday with executive clarity", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "Friday check the history is it fully professional like antigravity gpt like or not",
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

  await itAsync("ActionRunner executes Law 58 for DD with DevOps clarity", async () => {
    const jm = new JarvisManager();
    const res = await ActionRunner.handleAction(
      "DD check the history is it fully professional like antigravity gpt like or not",
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
    const query = "chack the history is it fully profetional like antigravity gpt like or not";
    const reply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", query, {}, "bn");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(!/\b(?:brother|Chief)\b/i.test(reply));
    const babeMatches = reply.match(/\bbabe\b/gi) || [];
    assert.ok(babeMatches.length <= 1, `Expected at most 1 'babe', found ${babeMatches.length}`);
    assert.strictEqual(/^babe[,!\s]/i.test(reply.trim()), false, "Speech must not start with 'Babe,'");
  });

  it("LocalCognitiveBrain returns grounded response for Vision", () => {
    const query = "chack the history is it fully profetional like antigravity gpt like or not";
    const reply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(reply.toLowerCase().includes("brother"));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded response for Friday", () => {
    const query = "chack the history is it fully profetional like antigravity gpt like or not";
    const reply = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(reply.includes("Chief"));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded response for DD", () => {
    const query = "chack the history is it fully profetional like antigravity gpt like or not";
    const reply = LocalCognitiveBrain.synthesizeResponse("dd", "DD", query, {}, "en");
    assert.ok(typeof reply === "string" && reply.length > 0, "Expected non-empty reply");
    assert.ok(!reply.endsWith("?"), "No trailing questions allowed");
    assert.ok(/\bbro\b/i.test(reply));
    assert.ok(!/\bbabe\b/i.test(reply));
  });

  it("LocalCognitiveBrain returns grounded multi-agent response for Squad", () => {
    const query = "chack the history is it fully profetional like antigravity gpt like or not";
    const reply = LocalCognitiveBrain.synthesizeResponse("team", "Squad", query, {}, "en");
    assert.ok(reply.includes("[Tuk Tuk]:") && reply.includes("[Vision]:") && reply.includes("[Friday]:") && reply.includes("[DD]:"), "Expected 4-agent reply");
  });

  console.log("\n================================================================================");
  console.log(`📊 SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("================================================================================\n");

  if (passed === total) {
    console.log("🎉 ALL LAW 58 TESTS PASSED WITH 100% COMPLIANCE!");
  } else {
    process.exit(1);
  }
})();
