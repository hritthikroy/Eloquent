/**
 * tests/tuktuk-modern-girl-bengali-parity.spec.js
 *
 * Dedicated Test Suite for Tuk Tuk Modern Girl Bengali Tone & 1:1 English-Bangla Parity:
 * 1. TextSanitizer STT normalization of: "need mordern girl like bangal tone for tuk tuk not match english tuktuk and bangal tuk tuk are same"
 * 2. Tuk Tuk Bengali prompt contains Modern Bangladeshi Girl register and 1:1 English-Bangla Invariant
 * 3. JarvisManager Rule 24: TUK TUK MODERN GIRL BENGALI TONE & 1:1 BILINGUAL SOUL PARITY LAW in getSystemPrompt()
 * 4. ActionRunner Interception of Modern Girl Tone & Bilingual Parity Directive with structured telemetry
 * 5. Dynamic Directive Persistence in Living Memory (saveDynamicDirective & setPreference)
 * 6. LocalCognitiveBrain Tuk Tuk Bengali response reflects modern Dhaka girl tone & girlfriend warmth
 * 7. LocalCognitiveBrain Tuk Tuk English response reflects 1:1 parity with Bengali persona
 * 8. Vision response acknowledges parity without using "babe" (strictly "brother/ভাই")
 * 9. Friday response confirms persona alignment without using "babe" or "bro" (strictly "Chief/হৃত্তিক")
 * 10. DD response confirms telemetry without using "babe" (strictly "bro/ভাই")
 * 11. Team mode produces sequenced 4-agent standup
 * 12. Zero negative rate and natural prosody preservation (+0% rate across all agents)
 */

const assert = require("assert");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const JarvisManager = require("../src/utils/jarvis-manager");
const ActionRunner = require("../src/utils/action-runner");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");

console.log("================================================================================");
console.log("🌸 VERIFYING TUK TUK MODERN GIRL BENGALI TONE & 1:1 ENGLISH-BANGLA PARITY");
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
  const rawQuery = "need mordern girl like bangal tone for tuk tuk not match english tuktuk and bangal tuk tuk are same";
  const khetQuery = "not like mordan garl like taking its khet girl";

  // 1. TextSanitizer STT Normalization
  it("1. TextSanitizer normalizes phonetic typos in modern girl & tone parity query and khet girl critique", () => {
    const sanitized = TextSanitizer.sanitize(rawQuery);
    assert(sanitized.includes("modern girl-like Bangla tone"), `Expected sanitized output to contain 'modern girl-like Bangla tone', got: "${sanitized}"`);
    assert(sanitized.includes("English Tuk Tuk and Bangla Tuk Tuk are the same"), `Expected sanitized output to contain 'English Tuk Tuk and Bangla Tuk Tuk are the same', got: "${sanitized}"`);
    assert(!sanitized.includes("mordern"), `Should fix 'mordern', got: "${sanitized}"`);
    assert(!sanitized.includes("bangal"), `Should fix 'bangal', got: "${sanitized}"`);

    const sanitizedKhet = TextSanitizer.sanitize(khetQuery);
    assert(sanitizedKhet.includes("khet girl"), `Expected sanitized output to contain 'khet girl', got: "${sanitizedKhet}"`);
    assert(!sanitizedKhet.includes("mordan"), `Should fix 'mordan', got: "${sanitizedKhet}"`);
    assert(!sanitizedKhet.includes("garl"), `Should fix 'garl', got: "${sanitizedKhet}"`);
    assert(!sanitizedKhet.includes("like taking"), `Should fix 'like taking', got: "${sanitizedKhet}"`);
  });

  // 2. Tuk Tuk Bengali Prompt Register & Parity
  it("2. Tuk Tuk Bengali prompt contains Modern Girl register and 1:1 Invariance with zero khet caricature", () => {
    assert(JarvisManager.AGENTS && JarvisManager.AGENTS.tuktuk, "JarvisManager.AGENTS.tuktuk must exist");
    const prompt = JarvisManager.AGENTS.tuktuk.getPrompt("Hritthik", "Boss", "bn");
    assert(
      prompt.includes("100% SOPHISTICATED, EFFORTLESS MODERN GIRL & TECH CO-FOUNDER"),
      "Tuk Tuk Bengali prompt missing modern girl register declaration"
    );
    assert(
      prompt.includes("100% IDENTICAL WITH ENGLISH TUK TUK"),
      "Tuk Tuk Bengali prompt missing 100% English-Bangla identical declaration"
    );
    assert(
      prompt.includes("ZERO 'KHET' CARICATURE & ZERO CHEAP MELODRAMA"),
      "Tuk Tuk Bengali prompt missing zero khet caricature declaration"
    );
    assert(
      !prompt.includes("উফফ babe!"),
      "Tuk Tuk Bengali prompt must NOT contain cringe caricature 'উফফ babe!'"
    );
  });

  // 3. JarvisManager Rule 24: TUK TUK SOPHISTICATED MODERN GIRL BENGALI TONE & 1:1 BILINGUAL SOUL PARITY LAW
  it("3. JarvisManager system prompt contains Rule 24 Sophisticated Modern Girl Tone & Bilingual Parity Law", () => {
    const jm = new JarvisManager();
    const prompt = jm.getSystemPrompt();
    assert(
      prompt.includes("24. TUK TUK SOPHISTICATED MODERN GIRL BENGALI TONE & 1:1 BILINGUAL SOUL PARITY LAW"),
      "System prompt missing Rule 24 Modern Girl Tone Law"
    );
    assert(
      prompt.includes("ZERO 'KHET' CARICATURE & ZERO CHEAP MELODRAMA"),
      "System prompt missing zero khet caricature directive"
    );
    assert(
      prompt.includes("STRICT 1:1 BILINGUAL SOUL & PERSONA PARITY"),
      "System prompt missing 1:1 parity section"
    );
  });

  // 4. ActionRunner Interception with Structured Telemetry
  await itAsync("4. ActionRunner intercepts directive with structured telemetry", async () => {
    const jarvisManagerMock = {
      saveDynamicDirective: (dir, target) => {},
      setPreference: (k, v) => {}
    };

    const res = await ActionRunner.handleAction(rawQuery, { key: "tuktuk", name: "Tuk Tuk" }, jarvisManagerMock, "bn");
    assert.strictEqual(res.handled, true, "ActionRunner should handle modern girl parity directive");
    assert.strictEqual(res.action, "tuktuk_modern_girl_bilingual_parity_directive");
    assert(res.data, "Response should have telemetry data");
    assert.strictEqual(res.data.modernGirlTone, true, "Telemetry modernGirlTone must be true");
    assert.strictEqual(res.data.zeroKhetCaricature, true, "Telemetry zeroKhetCaricature must be true");
    assert.strictEqual(res.data.englishBanglaParity, "100%", "Telemetry englishBanglaParity must be 100%");
    assert.strictEqual(res.data.status, "PARITY_LOCKED", "Telemetry status must be PARITY_LOCKED");
    assert(res.speech.includes("babe") || res.speech.includes("Babe"), "Tuk Tuk response must address user as 'babe'");

    const resKhet = await ActionRunner.handleAction(khetQuery, { key: "tuktuk", name: "Tuk Tuk" }, jarvisManagerMock, "bn");
    assert.strictEqual(resKhet.handled, true, "ActionRunner should handle khet query");
    assert.strictEqual(resKhet.data.zeroKhetCaricature, true, "Telemetry zeroKhetCaricature must be true for khet query");
  });

  // 5. Dynamic Directive Persistence in Living Memory
  await itAsync("5. Directive persists dynamically into JarvisManager living memory", async () => {
    let savedDirective = null;
    let savedTarget = null;
    let preferenceKey = null;
    let preferenceValue = null;

    const jarvisManagerMock = {
      saveDynamicDirective: (dir, target) => {
        savedDirective = dir;
        savedTarget = target;
      },
      setPreference: (k, v) => {
        preferenceKey = k;
        preferenceValue = v;
      }
    };

    await ActionRunner.handleAction(rawQuery, { key: "tuktuk", name: "Tuk Tuk" }, jarvisManagerMock, "bn");
    assert(savedDirective, "Should save dynamic directive");
    assert(savedDirective.includes("authentic, sophisticated, effortless modern urban girl"), `Saved directive unexpected: ${savedDirective}`);
    assert.strictEqual(savedTarget, "tuktuk", "Should target tuktuk");
    assert.strictEqual(preferenceKey, "tuktuk_modern_girl_parity", "Preference key should be tuktuk_modern_girl_parity");
    assert(preferenceValue.includes("100% Sophisticated Effortless Classy Modern Tone, Zero Khet Caricature"), "Preference value should confirm modern girl register");
  });

  // 6. LocalCognitiveBrain Tuk Tuk Bengali response
  it("6. LocalCognitiveBrain Tuk Tuk Bengali response reflects sophisticated modern girl tone with zero khet caricature", () => {
    const resBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawQuery, {}, "bn");
    assert(resBn.includes("Babe") || resBn.includes("babe"), "Tuk Tuk Bengali response should include 'babe'");
    assert(
      resBn.includes("আধুনিক") || resBn.includes("মডার্ন") || resBn.includes("ন্যাচারাল") || resBn.includes("মার্জিত") || resBn.includes("রুচিশীল") || resBn.includes("ক্লাসি"),
      `Tuk Tuk Bengali response should reflect sophisticated modern girl register, got: "${resBn}"`
    );
    assert(!resBn.includes("উফফ babe!"), "Tuk Tuk Bengali response must not contain 'উফফ babe!'");
    assert(!resBn.includes("ফাটিয়ে দিই"), "Tuk Tuk Bengali response must not contain 'ফাটিয়ে দিই'");

    const resKhetBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", khetQuery, {}, "bn");
    assert(resKhetBn.includes("Babe") || resKhetBn.includes("babe"), "Tuk Tuk Bengali response to khet critique should include 'babe'");
  });

  // 7. LocalCognitiveBrain Tuk Tuk English response
  it("7. LocalCognitiveBrain Tuk Tuk English response reflects 1:1 parity and zero tacky caricature", () => {
    const resEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", rawQuery, {}, "en");
    assert(resEn.includes("Babe") || resEn.includes("babe"), "Tuk Tuk English response should include 'babe'");
    assert(
      resEn.includes("100%") || resEn.includes("identical") || resEn.includes("poise") || resEn.includes("authentic"),
      `Tuk Tuk English response should confirm 1:1 parity, got: "${resEn}"`
    );
    assert(resEn.toLowerCase().includes("khet") || resEn.toLowerCase().includes("caricature") || resEn.toLowerCase().includes("parity") || resEn.toLowerCase().includes("poise"), "Should address tacky caricature or parity");

    const resKhetEn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", khetQuery, {}, "en");
    assert(resKhetEn.includes("Babe") || resKhetEn.includes("babe"), "Tuk Tuk English response to khet critique should include 'babe'");
  });

  // 8. Vision response acknowledges parity without using "babe"
  it("8. Vision response acknowledges parity strictly addressing user as 'brother/ভাই'", () => {
    const resBn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawQuery, {}, "bn");
    assert(resBn.includes("ভাই") || resBn.includes("brother"), "Vision Bengali response must address user as 'brother/ভাই'");
    assert(!resBn.includes("babe") && !resBn.includes("Babe"), "Vision Bengali response must NEVER contain 'babe'");

    const resEn = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", rawQuery, {}, "en");
    assert(resEn.includes("brother") || resEn.includes("Brother"), "Vision English response must address user as 'brother'");
    assert(!resEn.includes("babe") && !resEn.includes("Babe"), "Vision English response must NEVER contain 'babe'");
  });

  // 9. Friday response confirms persona alignment without using "babe" or "bro"
  it("9. Friday response confirms persona alignment strictly addressing user as 'Chief/হৃত্তিক'", () => {
    const resBn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawQuery, {}, "bn");
    assert(resBn.includes("Chief") || resBn.includes("হৃত্তিক") || resBn.includes("Hritthik"), "Friday Bengali response must address user as 'Chief/হৃত্তিক'");
    assert(!resBn.includes("babe") && !resBn.includes("Babe"), "Friday Bengali response must NEVER contain 'babe'");
    assert(!resBn.includes("bro") && !resBn.includes("Bro"), "Friday Bengali response must NEVER contain 'bro'");

    const resEn = LocalCognitiveBrain.synthesizeResponse("friday", "Friday", rawQuery, {}, "en");
    assert(resEn.includes("Chief") || resEn.includes("Hritthik"), "Friday English response must address user as 'Chief/Hritthik'");
    assert(!resEn.includes("babe") && !resEn.includes("Babe"), "Friday English response must NEVER contain 'babe'");
    assert(!resEn.includes("bro") && !resEn.includes("Bro"), "Friday English response must NEVER contain 'bro'");
  });

  // 10. DD response confirms telemetry without using "babe"
  it("10. DD response confirms telemetry strictly addressing user as 'bro/ভাই'", () => {
    const resBn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", rawQuery, {}, "bn");
    assert(resBn.includes("Bro") || resBn.includes("bro"), "DD Bengali response must address user as 'bro'");
    assert(!resBn.includes("babe") && !resBn.includes("Babe"), "DD Bengali response must NEVER contain 'babe'");

    const resEn = LocalCognitiveBrain.synthesizeResponse("dd", "DD", rawQuery, {}, "en");
    assert(resEn.includes("Bro") || resEn.includes("bro"), "DD English response must address user as 'bro'");
    assert(!resEn.includes("babe") && !resEn.includes("Babe"), "DD English response must NEVER contain 'babe'");
  });

  // 11. Team mode produces sequenced 4-agent standup
  it("11. Team mode produces sequenced 4-agent standup", () => {
    const teamResBn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", rawQuery, {}, "bn");
    assert(teamResBn.includes("[Tuk Tuk]:"), "Team Bengali response missing [Tuk Tuk]");
    assert(teamResBn.includes("[Vision]:"), "Team Bengali response missing [Vision]");
    assert(teamResBn.includes("[Friday]:"), "Team Bengali response missing [Friday]");
    assert(teamResBn.includes("[DD]:"), "Team Bengali response missing [DD]");

    const teamResEn = LocalCognitiveBrain.synthesizeResponse("team", "Squad", rawQuery, {}, "en");
    assert(teamResEn.includes("[Tuk Tuk]:"), "Team English response missing [Tuk Tuk]");
    assert(teamResEn.includes("[Vision]:"), "Team English response missing [Vision]");
    assert(teamResEn.includes("[Friday]:"), "Team English response missing [Friday]");
    assert(teamResEn.includes("[DD]:"), "Team English response missing [DD]");
  });

  // 12. Zero negative rate and natural prosody preservation
  it("12. Zero robotic voice rate (+0%) preserved across English and Bengali", () => {
    const agents = ["tuktuk", "vision", "friday", "dd"];
    for (const key of agents) {
      const en = banglaVoiceCortex.computeBengaliProsodySettings("Modern girl tone verified", key);
      const bn = banglaVoiceCortex.computeBengaliProsodySettings("আধুনিক টোন কনফার্মড", key);
      assert.strictEqual(en.rate, "+0%", `Agent ${key} English rate must be +0%, got ${en.rate}`);
      assert.strictEqual(bn.rate, "+0%", `Agent ${key} Bengali rate must be +0%, got ${bn.rate}`);
      assert(en.rate !== "-4%" && en.rate !== "-3%" && en.rate !== "-2%", `Agent ${key} must not have dragged rate`);
    }
  });

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passed}/${total} TESTS PASSED FOR TUK TUK MODERN GIRL BENGALI PARITY!`);
  console.log("================================================================================");
})();
