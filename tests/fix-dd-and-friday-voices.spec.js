const assert = require("assert");
const path = require("path");

console.log("🧪 Starting Fix DD & Friday Voices Test Suite...");

// 1. Test JarvisManager Voice Resolution & Aliases
const JarvisManager = require("../src/utils/jarvis-manager");
const jarvisManager = new JarvisManager();
const AGENTS = JarvisManager.AGENTS;
const resolveVoice = JarvisManager.resolveVoiceForLanguage;

console.log("  ➡️ Testing JarvisManager.resolveVoiceForLanguage...");
assert.strictEqual(resolveVoice("jenny"), "en-US-JennyNeural", "Failed to resolve 'jenny' to JennyNeural");
assert.strictEqual(resolveVoice("en-US-Jenny"), "en-US-JennyNeural", "Failed to resolve 'en-US-Jenny' to JennyNeural");
assert.strictEqual(resolveVoice("en-US-JennyNeural"), "en-US-JennyNeural", "Failed to resolve 'en-US-JennyNeural' to JennyNeural");
assert.strictEqual(resolveVoice("friday"), "en-US-JennyNeural", "Failed to resolve 'friday' to JennyNeural");
assert.strictEqual(resolveVoice("fryday"), "en-US-JennyNeural", "Failed to resolve 'fryday' to JennyNeural");
assert.strictEqual(resolveVoice("fry day"), "en-US-JennyNeural", "Failed to resolve 'fry day' to JennyNeural");
assert.strictEqual(resolveVoice("fridya"), "en-US-JennyNeural", "Failed to resolve 'fridya' to JennyNeural");
assert.strictEqual(resolveVoice("fridy"), "en-US-JennyNeural", "Failed to resolve 'fridy' to JennyNeural");
assert.strictEqual(resolveVoice("fryda"), "en-US-JennyNeural", "Failed to resolve 'fryda' to JennyNeural");

assert.strictEqual(resolveVoice("dd"), "en-US-BrianMultilingualNeural", "Failed to resolve 'dd' to BrianMultilingualNeural");
assert.strictEqual(resolveVoice("dee dee"), "en-US-BrianMultilingualNeural", "Failed to resolve 'dee dee' to BrianMultilingualNeural");
assert.strictEqual(resolveVoice("deedee"), "en-US-BrianMultilingualNeural", "Failed to resolve 'deedee' to BrianMultilingualNeural");
assert.strictEqual(resolveVoice("brian"), "en-US-BrianMultilingualNeural", "Failed to resolve 'brian' to BrianMultilingualNeural");
assert.strictEqual(resolveVoice("brayn"), "en-US-BrianMultilingualNeural", "Failed to resolve 'brayn' to BrianMultilingualNeural");

assert.strictEqual(resolveVoice("vision"), "en-US-AndrewNeural", "Failed to resolve 'vision' to AndrewNeural");
assert.strictEqual(resolveVoice("andrew"), "en-US-AndrewNeural", "Failed to resolve 'andrew' to AndrewNeural");
assert.strictEqual(resolveVoice("tuktuk"), "en-US-AvaMultilingualNeural", "Failed to resolve 'tuktuk' to AvaMultilingualNeural");
assert.strictEqual(resolveVoice("ava"), "en-US-AvaMultilingualNeural", "Failed to resolve 'ava' to AvaMultilingualNeural");
console.log("  ✅ Voice resolution and aliases verified.");

// 2. Test AGENTS.jenny alias
console.log("  ➡️ Testing AGENTS.jenny alias...");
assert(AGENTS.jenny, "AGENTS.jenny is undefined");
assert.strictEqual(AGENTS.jenny.voice, "en-US-JennyNeural", "AGENTS.jenny voice should be en-US-JennyNeural");
assert.strictEqual(AGENTS.jenny.key, "friday", "AGENTS.jenny key should be friday");
console.log("  ✅ AGENTS.jenny alias verified.");

// 3. Test Phonetic Normalization Protection for Jenny & Andrew
console.log("  ➡️ Testing phonetic normalization for monolingual English voices...");
const phoneticNormalize = JarvisManager.phoneticNormalizeForTTS;
const jennyNorm1 = phoneticNormalize("The data pipeline benchmark is fast and stable.", "en-US-JennyNeural");
assert(!jennyNorm1.includes("paipolain"), `Jenny voice mangled pipeline: "${jennyNorm1}"`);
assert(!jennyNorm1.includes("benchomark"), `Jenny voice mangled benchmark: "${jennyNorm1}"`);
assert(!jennyNorm1.includes("phasto"), `Jenny voice mangled fast: "${jennyNorm1}"`);
assert(jennyNorm1.toLowerCase().includes("pipeline"), `Expected 'pipeline' in Jenny output: "${jennyNorm1}"`);

const andrewNorm1 = phoneticNormalize("The build pipeline runs tests with zero memory leaks.", "en-US-AndrewNeural");
assert(!andrewNorm1.includes("paipolain"), `Andrew voice mangled pipeline: "${andrewNorm1}"`);
assert(andrewNorm1.toLowerCase().includes("pipeline"), `Expected 'pipeline' in Andrew output: "${andrewNorm1}"`);
console.log("  ✅ Monolingual voice phonetic protection verified.");

// 4. Test TextSanitizer for voice commands
console.log("  ➡️ Testing TextSanitizer for voice directives...");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const sanitized1 = TextSanitizer.sanitize("fix dd voice and fryday voices");
assert(sanitized1.includes("Friday"), `Expected 'Friday' in sanitized text, got: "${sanitized1}"`);
assert(sanitized1.includes("DD"), `Expected 'DD' in sanitized text, got: "${sanitized1}"`);

const sanitized2 = TextSanitizer.sanitize("fixed fridayvoice");
assert.strictEqual(sanitized2, "Fix Friday voice", `Expected 'Fix Friday voice', got: "${sanitized2}"`);

const sanitized3 = TextSanitizer.sanitize("fixed ddvoice");
assert.strictEqual(sanitized3, "Fix DD voice", `Expected 'Fix DD voice', got: "${sanitized3}"`);
console.log("  ✅ TextSanitizer voice corrections verified.");

// 5. Test ActionRunner for Voice Directives
console.log("  ➡️ Testing ActionRunner voice directives...");
(async () => {
  const actionRunner = require("../src/utils/action-runner");

  // A. Both DD and Friday voice fix
  const resBoth = await actionRunner.handleAction("fix dd voice and fryday voices", { key: "team", name: "Squad" }, jarvisManager);
  assert(resBoth.handled, "ActionRunner should handle 'fix dd voice and fryday voices'");
  assert(resBoth.speech.includes("[Friday]") && resBoth.speech.includes("[DD]"), "Both Friday and DD must speak");
  assert(resBoth.speech.includes("JennyNeural") || resBoth.speech.includes("Friday"), "Speech must reference Friday/Jenny");
  assert(resBoth.speech.includes("BrianMultilingual") || resBoth.speech.includes("DD"), "Speech must reference DD/Brian");

  // B. DD voice fix
  const resDD = await actionRunner.handleAction("fix dd voice", { key: "dd", name: "DD", voice: "en-US-BrianMultilingualNeural" }, jarvisManager);
  assert(resDD.handled, "ActionRunner should handle 'fix dd voice'");
  assert.strictEqual(resDD.agentName, "DD");
  assert.strictEqual(resDD.agentVoice, "en-US-BrianMultilingualNeural");

  // C. Friday voice fix
  const resFriday = await actionRunner.handleAction("fix friday voice", { key: "friday", name: "Friday", voice: "en-US-JennyNeural" }, jarvisManager);
  assert(resFriday.handled, "ActionRunner should handle 'fix friday voice'");
  assert.strictEqual(resFriday.agentName, "Friday");
  assert.strictEqual(resFriday.agentVoice, "en-US-JennyNeural");

  // D. Bangla voice fix for DD and Friday
  const resBanglaDD = await actionRunner.handleAction("DD voice fix koro", { key: "dd", name: "DD" }, jarvisManager);
  assert(resBanglaDD.handled, "ActionRunner should handle 'DD voice fix koro'");

  const resBanglaFri = await actionRunner.handleAction("Friday voice fix koro", { key: "friday", name: "Friday" }, jarvisManager);
  assert(resBanglaFri.handled, "ActionRunner should handle 'Friday voice fix koro'");

  console.log("  ✅ ActionRunner voice directives verified.");

  // 6. Test LocalCognitiveBrain for Voice Fixes & Critiques
  console.log("  ➡️ Testing LocalCognitiveBrain voice handling...");
  const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

  // Friday voice critique
  const lcbFriday = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", "fix friday voice", { currentLanguageMode: "en" });
  assert(!lcbFriday.includes("Data pipeline is clear"), `Friday returned generic fallback: "${lcbFriday}"`);
  assert(lcbFriday.toLowerCase().includes("voice") || lcbFriday.toLowerCase().includes("jenny") || lcbFriday.toLowerCase().includes("calibrat"), `Expected voice calibration in Friday response, got: "${lcbFriday}"`);

  // DD voice critique
  const lcbDD = LocalCognitiveBrain.synthesizeResponse("dd", "DD", "fix dd voice", { currentLanguageMode: "en" });
  assert(!lcbDD.includes("All systems stable and monitored, bro. What do you need checked?"), `DD returned generic fallback: "${lcbDD}"`);
  assert(lcbDD.toLowerCase().includes("voice") || lcbDD.toLowerCase().includes("brian") || lcbDD.toLowerCase().includes("telemetry") || lcbDD.toLowerCase().includes("calibrat"), `Expected voice/telemetry calibration in DD response, got: "${lcbDD}"`);

  // Team voice critique
  const lcbTeam = LocalCognitiveBrain.synthesizeResponse("team", "Squad", "fix dd voice and fryday voices", { currentLanguageMode: "en" });
  assert(lcbTeam.includes("[Friday]") && lcbTeam.includes("[DD]"), `Expected Friday and DD in team response, got: "${lcbTeam}"`);

  console.log("  ✅ LocalCognitiveBrain voice handling verified.");
  console.log("\n🎉 ALL DD & FRIDAY VOICE TESTS PASSED SUCCESSFULLY!");
})().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
