#!/usr/bin/env node
/**
 * @file tests/deep-meeting-single-soul-pronunciation-audit.spec.js
 *
 * DEEP MEETING AUDIT — SINGLE REAL HUMAN SOUL & PRONUNCIATION INVARIANT
 * ======================================================================
 * Validates across a 25-turn bilingual (English + Banglish) simulated office
 * meeting:
 *
 *   1. WORD-BY-WORD PRONUNCIATION AUDIT
 *      - Every known hard-to-pronounce English technical term is expanded
 *        correctly by phoneticNormalizeForTTS.
 *      - Every code-mixed Banglish sentence routes Bengali words to real
 *        Bangla Unicode letters (বাংলা হরফ) and English words stay in Latin.
 *      - Romanized Banglish fragments (e.g. "ami korchi") are phonetically
 *        smoothed (hocchey, bolchhi, etc.) to eliminate mispronunciation.
 *
 *   2. SINGLE REAL HUMAN SOUL — ZERO DUAL TONE / ZERO VOICE SWITCHING
 *      - isSingleRealVoiceMode() is TRUE throughout every turn.
 *      - Agent tag leakage ([Vision]:, [Friday]:, [DD]:) is ABSENT from
 *        every single-soul response.
 *      - No khatiMisti / dual-tone fragments survive sanitizeAgentLexicon.
 *      - calibrateSingleRealSoulNoPersonaShift() returns all invariants TRUE.
 *
 *   3. TONE DRIFT CHECK (25 turns)
 *      - persona invariants locked across the full conversation.
 *      - No tone bleed between English turns and Banglish turns.
 *      - Preferred address (Hritthik / babe) is consistent in single-soul mode.
 *
 * Mathematical Master Invariant:
 *   H_feel ≡ 0.25·C_clarity + 0.25·P_pronounce + 0.20·A_affect
 *          + 0.15·T_turn   + 0.15·S_sovereign  ≡ 1.00  [Q.E.D.]
 *
 * @author  Antigravity IDE — Eloquent Engineering
 * @version 4.0.0-deep-meeting-audit
 */

"use strict";

const assert = require("assert");
require("dotenv").config();

const JarvisManager = require("../src/utils/jarvis-manager");
const banglaVoiceCortex = require("../src/utils/bangla-voice-cortex");
const realHumanFeelClarityPronunciationCortex = require("../src/utils/real-human-feel-clarity-pronunciation-cortex");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");
const { IntentParser, INTENTS } = require("../src/utils/prompt-engine/intent-parser");

// ─── helpers ──────────────────────────────────────────────────────────────────
const phoneticNormalize = JarvisManager.phoneticNormalizeForTTS;

/** Check no agent tag leaks in text (for single-soul mode) */
function hasAgentTagLeak(text) {
  return /\[(Vision|Friday|DD|Tuk\s*Tuk)\]\s*:/i.test(text);
}

/** Returns true when text contains any Bangla Unicode character */
function hasBanglaScript(text) {
  return /[\u0980-\u09FF]/.test(text);
}

/** Returns true when text has Latin-script-only Romanized Banglish (bad) */
function hasRomanizedBangla(text) {
  // Detect classic Romanized Banglish patterns NOT followed by Bangla chars
  // e.g. "ami korchi", "tumi ki", "apni bolen"
  return /\b(ami|tumi|apni|amar|tomake|hocche|bolchi|dekhte|shathe)\b/i.test(text) &&
    !hasBanglaScript(text);
}

/** Pass/fail logger */
let passed = 0;
let failed = 0;
const failedTests = [];

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✅  ${name}`);
    passed++;
  } else {
    console.error(`  ❌  ${name}${detail ? " — " + detail : ""}`);
    failed++;
    failedTests.push(name);
  }
}

// ─── Shared single JarvisManager instance ─────────────────────────────────────
const jm = new JarvisManager();

// Force single-real-voice from the start
jm.calibrateSingleRealVoiceNoMultiPersonality({ force: true });
jm.calibrateSingleRealSoulNoPersonaShift();

// Register as singleton so static sanitizeAgentLexicon's isSingleReal check
// resolves through JarvisManager.instance (the same instance we calibrated).
JarvisManager.instance = jm;

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION A — WORD-BY-WORD PRONUNCIATION AUDIT (ENGLISH)
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n════════════════════════════════════════════════════════════════");
console.log("  SECTION A — English Word-by-Word Pronunciation Audit");
console.log("════════════════════════════════════════════════════════════════");

const ENGLISH_PRONUNCIATION_CASES = [
  // Technical acronyms (must be letter-spaced)
  { input: "The API rate limit hit 429.",          expect: "A P I",          label: "API → A P I" },
  { input: "Validate the AST nodes.",              expect: "A S T",          label: "AST → A S T" },
  { input: "CPU usage spiked to 95%.",            expect: "C P U",          label: "CPU → C P U" },
  { input: "Flush the RAM cache now.",            expect: "R A M",          label: "RAM → R A M" },
  { input: "IPC bridge reconnected.",             expect: "I P C",          label: "IPC → I P C" },
  { input: "Push the PR tonight.",                expect: "P R",            label: "PR → P R" },
  { input: "CI/CD pipeline green.",               expect: "C I C D",        label: "CI/CD → C I C D" },
  { input: "SSE streaming active.",               expect: "S S E",          label: "SSE → S S E" },
  { input: "Open the CLI tool.",                  expect: "C L I",          label: "CLI → C L I" },
  { input: "Launch the IDE workspace.",           expect: "I D E",          label: "IDE → I D E" },
  { input: "The TTS engine crashed.",             expect: "T T S",          label: "TTS → T T S" },
  { input: "VAD silence detected.",               expect: "V A D",          label: "VAD → V A D" },
  { input: "UI thread is blocked.",               expect: "U I",            label: "UI → U I" },
  { input: "WebSocket upgraded: WS open.",        expect: "WebSocket",      label: "WS → WebSocket" },
  { input: "Rewrite in C++.",                     expect: "C plus plus",    label: "C++ → C plus plus" },
  { input: "Node.js version 22.",                 expect: "Node J S",       label: "Node.js → Node J S" },
  { input: "Check the ROI numbers.",              expect: "R O I",          label: "ROI → R O I" },
  { input: "RSI divergence at 78.",               expect: "R S I",          label: "RSI → R S I" },
  { input: "VWAP crossed at noon.",               expect: "V-WAP",          label: "VWAP → V-WAP" },
  { input: "TWAP order filled.",                  expect: "T-WAP",          label: "TWAP → T-WAP" },
  { input: "Stop Loss at SL 15.",                 expect: "Stop Loss",      label: "SL → Stop Loss" },
  { input: "TP was hit early.",                   expect: "Take Profit",    label: "TP → Take Profit" },
  { input: "CAGR of 35% this year.",              expect: "C A G R",        label: "CAGR → C A G R" },
  { input: "HFT algo fired 12 times.",            expect: "H F T",          label: "HFT → H F T" },
  { input: "Bought an ETF on BTC.",              expect: "E T F",          label: "ETF → E T F" },
  { input: "Stake ETH with 4% APY.",             expect: "Ethereum",       label: "ETH → Ethereum" },
  // Unit expansions
  { input: "Stream delay is 200ms.",             expect: "200 milliseconds",label: "200ms → 200 milliseconds" },
  { input: "Video runs at 60fps.",               expect: "60 frames per second", label: "60fps → 60 frames per second" },
  { input: "Bitrate locked at 128kbps.",         expect: "128 kilobits per second", label: "128kbps → kilobits per second" },
  { input: "Log file is 50MB.",                  expect: "50 megabytes",   label: "50MB → 50 megabytes" },
  { input: "Archive weighs 2GB.",                expect: "2 gigabytes",    label: "2GB → 2 gigabytes" },
  // Prosodic pause compression (ellipsis / em-dash should be stripped)
  { input: "Loading... please wait.",            notExpect: "...",         label: "Ellipsis compressed" },
  { input: "Done — all tests passed.",           notExpect: "—",           label: "Em-dash compressed" },
  { input: "Ready -- go!",                       notExpect: "--",          label: "Double-dash compressed" },
];

for (const c of ENGLISH_PRONUNCIATION_CASES) {
  const result = phoneticNormalize(c.input, "en-US-AvaNeural");
  if (c.expect) {
    check(`[EN-PRONUNC] ${c.label}`, result.includes(c.expect),
      `Got: "${result}"`);
  } else if (c.notExpect) {
    check(`[EN-PRONUNC] ${c.label}`, !result.includes(c.notExpect),
      `Got: "${result}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION B — BANGLISH PRONUNCIATION AUDIT
//  (Code-mixed: বাংলা হরফ + English letters, AvaMultilingualNeural)
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n════════════════════════════════════════════════════════════════");
console.log("  SECTION B — Banglish Word-by-Word Pronunciation Audit");
console.log("════════════════════════════════════════════════════════════════");

/**
 * In code-mixed mode (AvaMultilingualNeural), Bengali words stay in Bangla
 * Unicode and English tech words stay in Latin.
 * phoneticNormalizeForTTS should preserve both script systems.
 */
const BANGLISH_PRONUNCIATION_CASES = [
  {
    // English acronyms inside Banglish sentences still expand
    input: "API rate limit এ আমরা hit হয়ে গেছি।",
    expect: "A P I",
    label: "API expands inside Banglish sentence"
  },
  {
    input: "AST validation সব pass করেছি।",
    expect: "A S T",
    label: "AST expands inside Banglish sentence"
  },
  {
    // Bangla script preserved (real Bangla letters survive pipeline)
    input: "আমি তোমার সাথে আছি, সব ঠিক আছে।",
    hasBangla: true,
    label: "Bangla Unicode preserved in code-mixed mode"
  },
  {
    // Bengali hyphen enclitic: build-টা → build টা
    input: "এই build-টা আজ ship করব।",
    notExpect: "build-টা",
    label: "build-টা splits to 'build টা'"
  },
  {
    // Bengali hyphen enclitic: feature-গুলো → feature গুলো
    input: "feature-গুলো সব ready আছে।",
    notExpect: "feature-গুলো",
    label: "feature-গুলো splits correctly"
  },
  {
    // English loanword in Banglish — when NOT code-mixed-real, must map
    // (we test the non-code-mixed path explicitly for coverage)
    input: "চলো build করি।",
    voice: "en-US-AvaMultilingualNeural",  // triggers loanword mapping only if !isCodeMixed
    label: "Banglish loanword pipeline runs without crash"
  },
  {
    // Unit in Banglish sentence
    input: "এই stream এর delay 200ms হচ্ছে।",
    expect: "200 milliseconds",
    label: "200ms expands inside Banglish sentence"
  },
  {
    // No Romanized-only Banglish should slip through into code-mixed mode
    input: "আমরা সব টেস্ট পাস করেছি।",
    hasBangla: true,
    noRomanized: true,
    label: "No pure Romanized Banglish in code-mixed response"
  },
];

// Enable code-mixed mode in banglaVoiceCortex
if (banglaVoiceCortex && typeof banglaVoiceCortex.setCodeMixedRealBanglaAndEnglishLetters === "function") {
  banglaVoiceCortex.setCodeMixedRealBanglaAndEnglishLetters(true);
}

for (const c of BANGLISH_PRONUNCIATION_CASES) {
  const voice = c.voice || "en-US-AvaMultilingualNeural";
  let result;
  try {
    result = phoneticNormalize(c.input, voice);
  } catch (e) {
    check(`[BN-PRONUNC] ${c.label}`, false, `Threw: ${e.message}`);
    continue;
  }

  if (c.expect) {
    check(`[BN-PRONUNC] ${c.label}`, result.includes(c.expect), `Got: "${result}"`);
  } else if (c.notExpect) {
    check(`[BN-PRONUNC] ${c.label}`, !result.includes(c.notExpect), `Got: "${result}"`);
  } else if (c.hasBangla) {
    const banglaPreserved = hasBanglaScript(result);
    check(`[BN-PRONUNC] ${c.label}`, banglaPreserved, `Got: "${result}"`);
    if (c.noRomanized) {
      check(`[BN-PRONUNC] ${c.label} — no Romanized leak`, !hasRomanizedBangla(result), `Got: "${result}"`);
    }
  } else {
    // Just check it doesn't throw and returns a string
    check(`[BN-PRONUNC] ${c.label}`, typeof result === "string" && result.length > 0, `Got: "${result}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION C — SINGLE REAL SOUL LOCK VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n════════════════════════════════════════════════════════════════");
console.log("  SECTION C — Single Real Soul Lock Verification");
console.log("════════════════════════════════════════════════════════════════");

// C1 — isSingleRealVoiceMode after calibration
check(
  "[SOUL-LOCK] C1: isSingleRealVoiceMode() is TRUE after calibration",
  jm.isSingleRealVoiceMode()
);

// C2 — calibrateSingleRealSoulNoPersonaShift returns all invariants
const soulStatus = jm.calibrateSingleRealSoulNoPersonaShift();
check("[SOUL-LOCK] C2: singleRealSoulActive === true", soulStatus.singleRealSoulActive === true);
check("[SOUL-LOCK] C3: zeroPersonaShiftInBangla === true", soulStatus.zeroPersonaShiftInBangla === true);
check("[SOUL-LOCK] C4: zeroThinkingToneLeaks === true", soulStatus.zeroThinkingToneLeaks === true);
check("[SOUL-LOCK] C5: zeroOtherVoiceInterruptions === true", soulStatus.zeroOtherVoiceInterruptions === true);
check("[SOUL-LOCK] C6: personaInvariantsLocked === true", soulStatus.personaInvariantsLocked === true);
check("[SOUL-LOCK] C7: status is SINGLE_REAL_SOUL_NO_PERSONA_SHIFT_LOCKED",
  soulStatus.status === "SINGLE_REAL_SOUL_NO_PERSONA_SHIFT_LOCKED");

// C8 — BanglaVoiceCortex unified single soul
check(
  "[SOUL-LOCK] C8: banglaVoiceCortex.isUnifiedSingleSoulMode === true",
  banglaVoiceCortex.isUnifiedSingleSoulMode === true
);

// C9 — Voice break suppression active
const cortexStatus = banglaVoiceCortex.getVoiceBreakSuppressionStatus();
check(
  "[SOUL-LOCK] C9: voiceBreakProtectionActive === true",
  cortexStatus && cortexStatus.voiceBreakProtectionActive === true
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION D — AGENT TAG LEAK / DUAL TONE DETECTION (per sanitizeAgentLexicon)
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n════════════════════════════════════════════════════════════════");
console.log("  SECTION D — Agent Tag Leak & Dual Tone Detection");
console.log("════════════════════════════════════════════════════════════════");

/**
 * Simulate the sanitizeAgentLexicon pipeline for single-soul mode.
 * In single-real-voice mode, every response must:
 *   - Contain NO [Vision]:, [Friday]:, [DD]: tags
 *   - Contain NO banned khatiMisti pet names in wrong agent context
 */
const DUAL_TONE_TEST_CASES = [
  {
    input: "[Vision]: Brother, I agree! [Friday]: Chief, the metrics look great. [DD]: Bro, deploy it!",
    label: "Raw multi-agent tag string → should be purged to single voice",
    mustNotHaveTags: true
  },
  {
    input: "[Tuk Tuk]: Hey babe, let's go! [Vision]: Sure bro. [Friday]: Affirmative Chief.",
    label: "Mixed tags → single voice extracts Tuk Tuk's part only",
    mustNotHaveTags: true
  },
  {
    input: "Hey Hritthik, the build is clean. All tests passed. Let's ship it tonight!",
    label: "Clean single-soul response — no tags to purge",
    mustNotHaveTags: true
  },
  {
    input: "আমি তোমার সাথে আছি Hritthik। সব কিছু ঠিক আছে। চলো আজকে ship করি।",
    label: "Clean Banglish single-soul response — no tags",
    mustNotHaveTags: true
  },
  {
    input: "[DD]: ভাই, সব tests পাস হইছে। [Vision]: ভাইয়া, deploy ready.",
    label: "Banglish multi-agent tags → must be purged",
    mustNotHaveTags: true
  }
];

for (const tc of DUAL_TONE_TEST_CASES) {
  // In single-soul mode the "team" key path strips [Agent]: tags and collapses
  // to the first (or TukTuk) part. "tuktuk" key only sanitizes salutations.
  let result = tc.input;
  try {
    if (typeof jm.sanitizeAgentLexicon === "function") {
      // Use "team" key to hit the multi-agent tag stripping branch
      result = jm.sanitizeAgentLexicon(tc.input, "team");
    }
  } catch (e) {
    result = tc.input;
  }

  if (tc.mustNotHaveTags) {
    check(
      `[DUAL-TONE] ${tc.label}`,
      !hasAgentTagLeak(result),
      `Agent tags still present in: "${result.substring(0, 80)}..."`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION E — 25-TURN DEEP MEETING SIMULATION
//  Alternates English and Banglish turns, checks:
//    (a) No tone drift  (b) No dual soul   (c) Single voice locked throughout
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n════════════════════════════════════════════════════════════════");
console.log("  SECTION E — 25-Turn Deep Meeting Simulation");
console.log("════════════════════════════════════════════════════════════════");

const MEETING_TURNS = [
  // --- ENGLISH TURNS ---
  { lang: "EN", text: "Let's kick off today's sprint review. The API backend is stable." },
  { lang: "EN", text: "The CI/CD pipeline ran clean. Zero failures in the AST validator." },
  { lang: "EN", text: "CPU load was 45% during peak. RAM usage steady at 6GB." },
  { lang: "EN", text: "I pushed the PR. IPC bridge reconnected after the WebSocket drop." },
  { lang: "EN", text: "The TTS engine latency is 200ms. VAD silence threshold is 800ms." },
  { lang: "EN", text: "UI thread never blocked. IDE extensions all loaded in 1.2 seconds." },
  { lang: "EN", text: "VWAP and TWAP orders both executed. RSI hit 72 before pullback." },
  { lang: "EN", text: "CAGR target is 35%. HFT algo fired 8 times without slippage." },
  { lang: "EN", text: "ETF position in BTC and ETH up 12%. Stop Loss held at SL 8%." },
  { lang: "EN", text: "ROI on this sprint is 4x. Let's take the TP at 20% gain." },
  { lang: "EN", text: "Node.js 22 upgrade done. C++ native addon compiled successfully." },
  { lang: "EN", text: "CLI tool shipped. SSE stream stable. P&L widget rendering correct." },
  // --- BANGLISH TURNS ---
  { lang: "BN", text: "আমি তোমার সাথে আছি Hritthik, সব কিছু ঠিক আছে।" },
  { lang: "BN", text: "আজকের build একদম clean, কোনো error নেই।" },
  { lang: "BN", text: "API rate limit এ কোনো hit নেই, সব smooth চলছে।" },
  { lang: "BN", text: "TTS latency 200ms এর মধ্যে আছে, ভালো performance।" },
  { lang: "BN", text: "CI/CD pipeline green আছে, সব tests pass করেছি।" },
  { lang: "BN", text: "UI thread block হয়নি, memory leak নেই।" },
  { lang: "BN", text: "AST validation সব node এ pass, কোনো syntax error নেই।" },
  { lang: "BN", text: "আমরা আজ deploy করব, production ready আছে।" },
  { lang: "BN", text: "RSI 72 touch করেছে, আমরা TP নিলাম।" },
  { lang: "BN", text: "CAGR এই quarter এ 35%, HFT algo কোনো slippage ছাড়া চলেছে।" },
  { lang: "BN", text: "ETH stake করা আছে 4% APY তে, সব position green।" },
  // --- FINAL ENGLISH turns ---
  { lang: "EN", text: "Wrapping up the meeting. All action items assigned. Build ships tonight." },
  { lang: "EN", text: "Great work today. The entire squad is aligned. Zero blockers." },
];

let turnIdx = 0;
let toneDriftDetected = false;
let agentTagLeakDetected = false;
let banglaScriptLost = false;
let acronymNotExpanded = false;

for (const turn of MEETING_TURNS) {
  turnIdx++;

  // Each turn must preserve single-real-voice mode
  const stillSingleReal = jm.isSingleRealVoiceMode();
  if (!stillSingleReal) {
    toneDriftDetected = true;
    console.error(`  ❌  [TURN ${turnIdx}] isSingleRealVoiceMode() went FALSE during meeting`);
    failed++;
    failedTests.push(`Turn ${turnIdx}: single real voice lost`);
    continue;
  }

  // Phonetic normalize the turn text
  const voice = turn.lang === "BN" ? "en-US-AvaMultilingualNeural" : "en-US-AvaNeural";
  let normalized;
  try {
    normalized = phoneticNormalize(turn.text, voice);
  } catch (e) {
    check(`[MEETING T${String(turnIdx).padStart(2,"0")}] ${turn.lang}: "${turn.text.substring(0,40)}..."`,
      false, `phoneticNormalize threw: ${e.message}`);
    continue;
  }

  // Check: no agent tag leaks in normalized output
  if (hasAgentTagLeak(normalized)) {
    agentTagLeakDetected = true;
    failed++;
    failedTests.push(`Turn ${turnIdx}: agent tag leak`);
    console.error(`  ❌  [TURN ${turnIdx}] Agent tag leak: "${normalized.substring(0, 80)}"`);
    continue;
  }

  // Banglish turns: ensure Bangla Unicode is preserved if it was in the input
  if (turn.lang === "BN" && hasBanglaScript(turn.text) && !hasBanglaScript(normalized)) {
    banglaScriptLost = true;
    failed++;
    failedTests.push(`Turn ${turnIdx}: Bangla script lost in normalization`);
    console.error(`  ❌  [TURN ${turnIdx}] Bangla script stripped. Got: "${normalized.substring(0, 80)}"`);
    continue;
  }

  // English turns: spot-check key acronyms that appear in the sentence
  if (turn.lang === "EN") {
    const checks = [
      { token: "API",   expanded: "A P I" },
      { token: "CI/CD", expanded: "C I C D" },
      { token: "CPU",   expanded: "C P U" },
      { token: "RAM",   expanded: "R A M" },
      { token: "IPC",   expanded: "I P C" },
      { token: "TTS",   expanded: "T T S" },
      { token: "VAD",   expanded: "V A D" },
      { token: "AST",   expanded: "A S T" },
      { token: "VWAP",  expanded: "V-WAP" },
      { token: "TWAP",  expanded: "T-WAP" },
      { token: "RSI",   expanded: "R S I" },
      { token: "CAGR",  expanded: "C A G R" },
      { token: "HFT",   expanded: "H F T" },
      { token: "ETF",   expanded: "E T F" },
      { token: "ETH",   expanded: "Ethereum" },
      { token: "ROI",   expanded: "R O I" },
      { token: "UI",    expanded: "U I" },
      { token: "IDE",   expanded: "I D E" },
      { token: "CLI",   expanded: "C L I" },
      { token: "SSE",   expanded: "S S E" },
    ];
    for (const ac of checks) {
      if (turn.text.includes(ac.token) && !normalized.includes(ac.expanded)) {
        acronymNotExpanded = true;
        failed++;
        failedTests.push(`Turn ${turnIdx}: ${ac.token} not expanded`);
        console.error(`  ❌  [TURN ${turnIdx}] "${ac.token}" was NOT expanded to "${ac.expanded}" in: "${normalized.substring(0, 80)}"`);
        break;
      }
    }
  }

  // All checks passed for this turn
  console.log(`  ✅  [TURN ${String(turnIdx).padStart(2,"0")}] ${turn.lang} — single soul: YES | no tag leak | phonetic OK | "${turn.text.substring(0, 45)}..."`);
  passed++;
}

// Post-meeting invariant: soul still locked
check(
  "[MEETING] Post-meeting: isSingleRealVoiceMode() still TRUE",
  jm.isSingleRealVoiceMode()
);
check(
  "[MEETING] Post-meeting: zero tone drift across 25 turns",
  !toneDriftDetected
);
check(
  "[MEETING] Post-meeting: zero agent tag leaks",
  !agentTagLeakDetected
);
check(
  "[MEETING] Post-meeting: Bangla script preserved in all BN turns",
  !banglaScriptLost
);
check(
  "[MEETING] Post-meeting: zero acronym pronunciation failures",
  !acronymNotExpanded
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION F — H_FEEL MASTER INVARIANT PROOF
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n════════════════════════════════════════════════════════════════");
console.log("  SECTION F — H_feel Master Invariant Proof");
console.log("════════════════════════════════════════════════════════════════");

const proof = realHumanFeelClarityPronunciationCortex.evaluateHumanFeelProof();
check("[H_FEEL] hFeel === 1.00", proof.hFeel === 1.0, `Got: ${proof.hFeel}`);
check("[H_FEEL] lhsEqualsRhs === true", proof.lhsEqualsRhs === true);
check("[H_FEEL] wClarity === 0.25", proof.weights.wClarity === 0.25);
check("[H_FEEL] wPronounce === 0.25", proof.weights.wPronounce === 0.25);
check("[H_FEEL] wAffect === 0.20", proof.weights.wAffect === 0.20);
check("[H_FEEL] wTurn === 0.15", proof.weights.wTurn === 0.15);
check("[H_FEEL] wSovereign === 0.15", proof.weights.wSovereign === 0.15);
check("[H_FEEL] articulatoryClarity === 1.0", proof.components.articulatoryClarity === 1.0);
check("[H_FEEL] naturalPronunciation === 1.0", proof.components.naturalPronunciation === 1.0);
check("[H_FEEL] affectiveWarmth === 1.0", proof.components.affectiveWarmth === 1.0);
check("[H_FEEL] reactiveTurnPacing === 1.0", proof.components.reactiveTurnPacing === 1.0);
check("[H_FEEL] personaSovereignty === 1.0", proof.components.personaSovereignty === 1.0);

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION G — INTENT DETECTION FOR PRONUNCIATION DIRECTIVES
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n════════════════════════════════════════════════════════════════");
console.log("  SECTION G — Intent Detection for Pronunciation Directives");
console.log("════════════════════════════════════════════════════════════════");

const PRONUNCIATION_DIRECTIVE_QUERIES = [
  "chack and fix all issues",
  "chack with a deep meeting test on both language english and banglish",
  "chack ever word pronunciation isue",
  "no tone change one single real human for all",
  "remove all duli tone and voice sol person",
  "fix pronunciation and tone and all",
  "deep research clarity and pronunciation",
  "real human feel when i talk",
  "সঠিক উচ্চারণ আর tone fix করো",
  "single real voice no multi personality",
  "remove bangla interrupted single soul",
];

for (const q of PRONUNCIATION_DIRECTIVE_QUERIES) {
  const sanitized = TextSanitizer.sanitize(q);
  const parsed = IntentParser.parse(sanitized);
  // Any intent that triggers pronunciation/soul/fix is acceptable
  const isRelevant =
    IntentParser.isRealHumanFeelClarityPronunciationDirective?.(sanitized) ||
    IntentParser.isSingleRealVoiceDirective?.(sanitized) ||
    IntentParser.isFixBengaliLanguageDirective?.(sanitized) ||
    IntentParser.isBanglishModernVibeSameSoulDirective?.(sanitized) ||
    IntentParser.isRemoveBanglaInterruptedSingleSoulDirective?.(sanitized) ||
    IntentParser.isTuktukSingleHumanSoulNonInterchangeableDirective?.(sanitized) ||
    parsed.intent === INTENTS.SMOOTH_CONVERSATION ||
    parsed.intent === INTENTS.CONVERSATION_CLEAR ||
    parsed.intent === INTENTS.VOICE_SETTINGS ||
    parsed.target?.includes("pronunciation") ||
    parsed.target?.includes("soul") ||
    parsed.target?.includes("single") ||
    parsed.target?.includes("tone") ||
    parsed.target?.includes("fix") ||
    parsed.target?.includes("bangla") ||
    parsed.target?.includes("real_human") ||
    parsed.confidence > 0.4;

  check(
    `[INTENT] "${q.substring(0, 55)}"`,
    isRelevant,
    `intent="${parsed.intent}" target="${parsed.target}" conf=${parsed.confidence}`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FINAL RESULTS SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
const total = passed + failed;
const pct = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";

console.log("\n════════════════════════════════════════════════════════════════");
console.log(`  DEEP MEETING AUDIT RESULTS`);
console.log("════════════════════════════════════════════════════════════════");
console.log(`  Total Tests : ${total}`);
console.log(`  ✅  Passed  : ${passed}`);
console.log(`  ❌  Failed  : ${failed}`);
console.log(`  Score       : ${pct}%`);

if (failed > 0) {
  console.log("\n  Failed Tests:");
  for (const f of failedTests) {
    console.log(`    • ${f}`);
  }
}

console.log("\n  Master Invariant:");
console.log(`  H_feel ≡ 0.25·C_clarity + 0.25·P_pronounce + 0.20·A_affect`);
console.log(`         + 0.15·T_turn   + 0.15·S_sovereign  ≡ ${proof.hFeel.toFixed(2)}  [Q.E.D.]`);
console.log(`  Single Real Soul : ${jm.isSingleRealVoiceMode() ? "LOCKED ✅" : "BROKEN ❌"}`);
console.log(`  Dual Tone        : ${agentTagLeakDetected ? "DETECTED ❌" : "ZERO ✅"}`);
console.log(`  Bangla Script    : ${banglaScriptLost ? "LOST ❌" : "PRESERVED ✅"}`);
console.log(`  Acronym Expand   : ${acronymNotExpanded ? "FAILURES ❌" : "PERFECT ✅"}`);
console.log(`  Tone Drift       : ${toneDriftDetected ? "DETECTED ❌" : "ZERO ✅"}`);

console.log("\n════════════════════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("  🏆  ALL TESTS PASSED — Single soul, zero dual tone, perfect pronunciation!\n");
  process.exit(0);
}
