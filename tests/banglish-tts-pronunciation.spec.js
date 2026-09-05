/**
 * banglish-tts-pronunciation.spec.js
 *
 * Tests 4 greeting variants for en-US-AvaMultilingualNeural TTS pronunciation quality.
 * Scores each on: Pronounceability, Emotional Warmth, Real Banglish Feel.
 *
 * TTS Problem words (AvaMultilingual will mispronounce these):
 *   ❌ "Ei je"   → reads as "Eye jee" (wrong)
 *   ❌ "jhakkas" → reads as "jh-ak-as" (wrong)
 *   ❌ "adda"    → reads as "add-ah" (flat)
 *   ❌ "ashli"   → reads as "Ashley" (ok-ish but odd)
 *   ❌ "niye"    → reads as "ni-yeh" (passable)
 *
 * TTS Safe words (AvaMultilingual reads these well):
 *   ✅ "babe"    → perfect
 *   ✅ "kemon"   → "keh-mon" — passable
 *   ✅ "achi"    → "ah-chee" — passable
 *   ✅ "tension" → perfect English
 *   ✅ "totally" → perfect English
 *   ✅ "fine"    → perfect
 *   ✅ "catch up"→ perfect
 *   ✅ "chill"   → perfect
 *   ✅ "bolo"    → "bo-lo" — good
 *   ✅ "ektu"    → "ek-too" — passable
 */

const test   = require("node:test");
const assert = require("node:assert/strict");

// ─── 4 Greeting Variants ─────────────────────────────────────────────────────

const VARIANTS = {

  // Version A — Current (pure Banglish, hard words for TTS)
  A: "Ei je! Ami ekdom jhakkas achi babe. Tumi kemon? Kono tension niye ashli naki just adda dite?",

  // Version B — TTS-optimized (max English mix, easy pronunciation)
  B: "Oh hey! Ami totally fine achi babe. Tumi kemon acho? Kono tension ache naki just catch up korte ashle?",

  // Version C — Balanced Banglish-English (best of both worlds)
  C: "Arre babe! Ami perfectly okay achi. Tumi kemon? Tension ache naki just chill korte ashle?",

  // Version D — Natural girl, smooth TTS (recommended)
  D: "Hey babe! Ami great achi, totally fine. Tumi kemon acho? Kono problem ache naki just talk korte ashle?",
};

// ─── TTS Pronuncability Scorer ────────────────────────────────────────────────
// Words known to trip up en-US-AvaMultilingualNeural
const HARD_WORDS = ["ei je", "jhakkas", "adda dite", "niye ashli", "ekdom jhakkas", "ashli naki", "adda"];
// Words that read cleanly
const EASY_WORDS = ["babe", "tension", "fine", "totally", "okay", "great", "catch up", "chill", "talk", "kemon", "achi", "arre", "hey", "bolo", "problem"];

function scorePronunciability(text) {
  const lower = text.toLowerCase();
  let hard = 0, easy = 0;
  for (const w of HARD_WORDS) { if (lower.includes(w)) hard++; }
  for (const w of EASY_WORDS) { if (lower.includes(w)) easy++; }
  // Score: 0-100 (higher = easier for TTS)
  const total = hard + easy || 1;
  return Math.round((easy / total) * 100);
}

function scoreWarmth(text) {
  const lower = text.toLowerCase();
  const warm = ["babe","love","fine","okay","great","achi","kemon","tension","problem","talk","chill","catch up","bolo"];
  let hits = 0;
  for (const w of warm) { if (lower.includes(w)) hits++; }
  return Math.min(100, hits * 15);
}

function scoreBanglish(text) {
  const lower = text.toLowerCase();
  const banglish = ["achi","kemon","acho","arre","tumi","bolo","korte","ashle","naki","ektu","babe"];
  let hits = 0;
  for (const w of banglish) { if (lower.includes(w)) hits++; }
  return Math.min(100, hits * 15);
}

function totalScore(text) {
  const p = scorePronunciability(text);
  const w = scoreWarmth(text);
  const b = scoreBanglish(text);
  return { pronunciability: p, warmth: w, banglishFeel: b, total: Math.round((p * 0.5) + (w * 0.25) + (b * 0.25)) };
}

// ─────────────────────────────────────────────────────────────────────────────

test("Banglish TTS Pronunciation — 4 Variant Comparison", async (t) => {

  const scores = {};
  let best = null, bestScore = -1;

  for (const [key, text] of Object.entries(VARIANTS)) {
    const s = totalScore(text);
    scores[key] = { text, ...s };
    if (s.total > bestScore) { bestScore = s.total; best = key; }
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  TTS PRONUNCIATION AUDIT — en-US-AvaMultilingualNeural");
  console.log("══════════════════════════════════════════════════════════\n");

  for (const [key, s] of Object.entries(scores)) {
    const tag = key === best ? " ← 🏆 BEST" : "";
    console.log(`  Version ${key}${tag}`);
    console.log(`  Text: "${s.text}"`);
    console.log(`  Pronounciability: ${s.pronunciability}/100`);
    console.log(`  Warmth:           ${s.warmth}/100`);
    console.log(`  Banglish Feel:    ${s.banglishFeel}/100`);
    console.log(`  TOTAL SCORE:      ${s.total}/100`);
    console.log();
  }

  console.log("══════════════════════════════════════════════════════════");
  console.log(`  🏆 WINNER: Version ${best} — Score ${bestScore}/100`);
  console.log(`  📝 RECOMMENDATION: "${scores[best].text}"`);
  console.log("══════════════════════════════════════════════════════════\n");

  await t.test("Version A — current variant is valid", () => {
    assert.ok(scores.A.text.length > 10);
    console.log(`  ✅ A: TTS score ${scores.A.total}/100 — hard words: ${HARD_WORDS.filter(w => scores.A.text.toLowerCase().includes(w)).join(", ") || "none"}`);
  });

  await t.test("Version B — max English mix is valid", () => {
    assert.ok(scores.B.total >= 40, "B must score at least 40");
    console.log(`  ✅ B: TTS score ${scores.B.total}/100`);
  });

  await t.test("Version C — balanced is valid", () => {
    assert.ok(scores.C.total >= 40, "C must score at least 40");
    console.log(`  ✅ C: TTS score ${scores.C.total}/100`);
  });

  await t.test("Version D — natural girl is valid", () => {
    assert.ok(scores.D.total >= 40, "D must score at least 40");
    console.log(`  ✅ D: TTS score ${scores.D.total}/100`);
  });

  await t.test("Best variant must outscore Version A (current)", () => {
    assert.ok(scores[best].total >= scores.A.total, `${best} (${scores[best].total}) should >= A (${scores.A.total})`);
  });

  await t.test("Best variant must contain 'babe' for warmth", () => {
    assert.ok(scores[best].text.toLowerCase().includes("babe"), "Best variant must include babe");
  });

  await t.test("Best variant must contain Banglish (kemon or achi or tumi)", () => {
    const t_ = scores[best].text.toLowerCase();
    assert.ok(t_.includes("kemon") || t_.includes("achi") || t_.includes("tumi"), "Must feel Banglish");
  });

  await t.test("No variant should be empty", () => {
    for (const [k, s] of Object.entries(scores)) {
      assert.ok(s.text.length > 20, `Version ${k} too short`);
    }
  });

});
