/**
 * tests/remove-other-versions-and-sorts.spec.js
 * 
 * Unit Verification Suite for:
 * Remove All Other Versions & Other Sorts Engine (Unified Version 2.1.0 Pipeline)
 * 
 * Verifies:
 * 1. TextSanitizer STT normalization of phonetic mishearings:
 *    "remove all your other version and other sorts"
 * 2. IntentParser recognition of target "remove_other_versions_and_sorts"
 * 3. JarvisManager version purge & preference updates (active_app_version: "2.1.0")
 * 4. AST syntax validation of modified core files (src/main.js, jarvis-manager.js, action-runner.js)
 * 5. ActionRunner action handling and 100% persona sovereignty across all 5 agent configurations
 */

const assert = require("assert");
const { execSync } = require("child_process");
const textSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");
const JarvisManager = require("../src/utils/jarvis-manager");
const ActionRunner = require("../src/utils/action-runner");

console.log("================================================================================");
console.log("🚀 RUNNING REMOVE OTHER VERSIONS & SORTS VERIFICATION SUITE");
console.log("================================================================================");

let passedCount = 0;
const totalCount = 5;

async function runTests() {
  try {
    // ---------------------------------------------------------------------------
    // TEST 1: TextSanitizer Normalizes Phonetic STT Mishearings
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 1] Testing TextSanitizer STT Normalizations...");
    const rawInput = "remove all your other version and other sorts";
    const sanitized = textSanitizer.sanitize(rawInput);
    console.log(`  Raw Input:      "${rawInput}"`);
    console.log(`  Sanitized Text: "${sanitized}"`);

    assert.ok(
      /Remove all other versions and other sorts/i.test(sanitized),
      "TextSanitizer should normalize STT mishearings for remove all other versions and sorts"
    );
    console.log("  ✅ [PASS 1/5] TextSanitizer normalizes phonetic STT mishearings!");
    passedCount++;

    // ---------------------------------------------------------------------------
    // TEST 2: IntentParser Classifies remove_other_versions_and_sorts Target
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 2] Testing IntentParser Classification...");
    const parsed = IntentParser.parse(sanitized);
    console.log(`  Target:     "${parsed.target}"`);
    console.log(`  Confidence: ${parsed.confidence}`);

    assert.strictEqual(parsed.target, "remove_other_versions_and_sorts", "Target must be remove_other_versions_and_sorts");
    assert.strictEqual(parsed.confidence, 0.99, "Confidence must be 0.99");
    console.log("  ✅ [PASS 2/5] IntentParser classifies remove_other_versions_and_sorts target!");
    passedCount++;

    // ---------------------------------------------------------------------------
    // TEST 3: JarvisManager Version Purge & Preference Updates
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing JarvisManager Version Purge...");
    const purgeRes = JarvisManager.purgeLegacyVersionsAndSorts();
    console.log(`  Purge Status: "${purgeRes.status}"`);
    console.log(`  Active Version: "${purgeRes.version}"`);

    assert.strictEqual(purgeRes.version, "2.1.0", "Active version must be 2.1.0");
    assert.strictEqual(purgeRes.singleUnifiedVersionActive, true, "singleUnifiedVersionActive must be true");
    assert.strictEqual(purgeRes.legacyVersionsPurged, true, "legacyVersionsPurged must be true");
    assert.strictEqual(purgeRes.otherSortsRemoved, true, "otherSortsRemoved must be true");
    console.log("  ✅ [PASS 3/5] JarvisManager purges legacy versions and locks Version 2.1.0!");
    passedCount++;

    // ---------------------------------------------------------------------------
    // TEST 4: AST Syntax Validation of Core Main & Utility Files
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing AST Syntax Validation...");
    const astCmd = "node -c src/main.js src/utils/jarvis-manager.js src/utils/action-runner.js src/utils/prompt-engine/intent-parser.js src/utils/prompt-engine/text-sanitizer.js";
    execSync(astCmd, { cwd: `${__dirname}/..` });
    console.log(`  AST Check Command: "${astCmd}"`);
    console.log("  ✅ [PASS 4/5] Core JavaScript files passed AST syntax validation cleanly!");
    passedCount++;

    // ---------------------------------------------------------------------------
    // TEST 5: ActionRunner Handling & Persona Sovereignty
    // ---------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing ActionRunner Persona Output Sovereignty...");

    const prompts = [
      { name: "Tuk Tuk", prompt: "Tuk Tuk remove all your other version and other sorts" },
      { name: "Vision", prompt: "Vision remove all other versions and other sorts" },
      { name: "Friday", prompt: "Friday remove all other versions and other sorts" },
      { name: "DD", prompt: "DD remove all other versions and other sorts" },
      { name: "Squad", prompt: "Squad remove all other versions and other sorts" }
    ];

    const pureBengaliPattern = /[\u0980-\u09FF]/;

    for (const p of prompts) {
      const res = await ActionRunner.handleAction(p.prompt);
      console.log(`  [${p.name}]: "${res.speech.substring(0, 100)}..."`);
      assert.strictEqual(res.handled, true, `${p.name} prompt must be handled by ActionRunner`);
      assert.strictEqual(res.data.singleVersionActive, true, `${p.name} singleVersionActive must be true`);
      assert.strictEqual(pureBengaliPattern.test(res.speech), false, `${p.name} response must contain zero pure Bengali script`);
    }

    console.log("  ✅ [PASS 5/5] ActionRunner handles remove_other_versions_and_sorts action with 100% persona sovereignty!");
    passedCount++;

    console.log("\n================================================================================");
    console.log(`🌟 ALL ${passedCount}/${totalCount} SUBTESTS PASSED CLEANLY (100% VERIFIED)! 🚀`);
    console.log("================================================================================\n");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ [FAIL] Verification Test Failed:");
    console.error(err);
    process.exit(1);
  }
}

runTests();
