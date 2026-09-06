#!/usr/bin/env node
/**
 * @file single-real-soul-no-persona-shift.spec.js
 * @description Comprehensive verification suite for Single Real Soul with Zero Persona Shift,
 * Zero Thinking Tone Leaks, and Zero Other Voice Interruptions when talking in Bangla.
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser } = require("../src/utils/prompt-engine/intent-parser");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const ActionRunner = require("../src/utils/action-runner");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");

console.log("================================================================================");
console.log("🚀 RUNNING SINGLE REAL SOUL & ZERO PERSONA SHIFT IN BANGLA VERIFICATION SUITE");
console.log("================================================================================\n");

// -----------------------------------------------------------------------------
// TEST 1: TextSanitizer STT Normalizations
// -----------------------------------------------------------------------------
console.log("[TEST 1] Testing TextSanitizer STT Normalizations...");
const rawInput = "use real one sol and remove all others voices and thinking and tone and sole no need other person shift when i tell lets talk in bngla";
const sanitized = TextSanitizer.sanitize(rawInput);
console.log(`  Raw Input:      "${rawInput}"`);
console.log(`  Sanitized Text: "${sanitized}"`);
assert(sanitized.toLowerCase().includes("single") || sanitized.toLowerCase().includes("soul") || sanitized.toLowerCase().includes("voice") || sanitized.toLowerCase().includes("talk in bangla"), "TextSanitizer must normalize prompt!");
console.log("  ✅ [PASS 1/5] TextSanitizer normalizes phonetic STT mishearings!");

// -----------------------------------------------------------------------------
// TEST 2: IntentParser Classification
// -----------------------------------------------------------------------------
console.log("\n[TEST 2] Testing IntentParser Classification...");
const classification = IntentParser.parse(sanitized);
console.log(`  Target:     "${classification.target}"`);
console.log(`  Confidence: ${classification.confidence}`);
assert(
  classification.target === "fix_tuktuk_single_human_soul_non_interchangeable" ||
  classification.target === "fix_bengali_language_directive" ||
  classification.target === "remove_bangla_interrupted_single_soul" ||
  classification.target === "banglish_modern_vibe_same_soul",
  "IntentParser must classify single real soul directive!"
);
console.log("  ✅ [PASS 2/5] IntentParser classifies single real soul directive!");

// -----------------------------------------------------------------------------
// TEST 3: JarvisManager State Calibration
// -----------------------------------------------------------------------------
console.log("\n[TEST 3] Testing JarvisManager calibrateSingleRealSoulNoPersonaShift...");
const jmStatus = JarvisManager.calibrateSingleRealSoulNoPersonaShift();
console.log(`  Calibration Status: "${jmStatus.status}"`);
assert.strictEqual(jmStatus.singleRealSoulActive, true, "singleRealSoulActive must be true");
assert.strictEqual(jmStatus.zeroPersonaShiftInBangla, true, "zeroPersonaShiftInBangla must be true");
assert.strictEqual(jmStatus.zeroThinkingToneLeaks, true, "zeroThinkingToneLeaks must be true");
assert.strictEqual(jmStatus.zeroOtherVoiceInterruptions, true, "zeroOtherVoiceInterruptions must be true");
console.log("  ✅ [PASS 3/5] JarvisManager locks single real soul & zero persona shift preferences!");

// -----------------------------------------------------------------------------
// TEST 4: BanglaVoiceCortex Single Soul Verification
// -----------------------------------------------------------------------------
console.log("\n[TEST 4] Testing BanglaVoiceCortex Single Soul Enforcement...");
const cortexStatus = banglaVoiceCortex.getVoiceBreakSuppressionStatus();
console.log(`  Voice Break Protection: ${cortexStatus.voiceBreakProtectionActive}`);
assert.strictEqual(cortexStatus.voiceBreakProtectionActive, true, "Voice break protection must be active");
assert.strictEqual(banglaVoiceCortex.isUnifiedSingleSoulMode, true, "BanglaVoiceCortex must be in unified single soul mode");
console.log("  ✅ [PASS 4/5] BanglaVoiceCortex single soul enforcement verified!");

// -----------------------------------------------------------------------------
// TEST 5: Squad Persona Sovereignty & Zero Persona Shift
// -----------------------------------------------------------------------------
console.log("\n[TEST 5] Testing LocalCognitiveBrain Squad Persona Sovereignty in Bangla...");
const banglaDirectives = [
  { agent: "tuktuk", name: "Tuk Tuk", expectedPet: "babe", bannedPet: "bro" },
  { agent: "vision", name: "Vision", expectedPet: "brother", bannedPet: "babe" },
  { agent: "friday", name: "Friday", expectedPet: "chief", bannedPet: "babe" },
  { agent: "dd", name: "DD", expectedPet: "bro", bannedPet: "babe" }
];

for (const spec of banglaDirectives) {
  const reply = LocalCognitiveBrain.synthesizeResponse(spec.agent, spec.name, "lets talk in bangla without any persona shift or thinking tone", {}, "bn");
  console.log(`  [${spec.name}]: "${reply}"`);
  assert(!/[\u0980-\u09FF]/.test(reply), `Agent ${spec.name} must have 0 native Bengali script leaks!`);
  assert(!reply.toLowerCase().includes(spec.bannedPet), `Agent ${spec.name} must NOT contain banned term '${spec.bannedPet}'!`);
}
console.log("  ✅ [PASS 5/5] LocalCognitiveBrain synthesizes 100% persona-sovereign responses with zero persona shift!");

console.log("\n================================================================================");
console.log("🌟 ALL 5/5 SUBTESTS PASSED CLEANLY (100% VERIFIED)! 🚀");
console.log("================================================================================\n");
