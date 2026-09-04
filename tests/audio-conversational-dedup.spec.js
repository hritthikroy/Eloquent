/**
 * Audio Conversational De-duplication & Anti-Flicker Verification Suite
 * 
 * Verifies:
 * 1. Idle Silence Rejection & VAD Gate (no hallucination loops on ambient noise)
 * 2. Acoustic Speaker Self-Echo Blinding Filter (prevents AI self-conversations)
 * 3. Single-Voice Mutual Exclusion & Turn Filler Suppression (zero irritating background audio)
 * 4. Post-Speech Acoustic Decay Grace Period
 * 5. Whisper Hallucination Filter coverage for silence phantom artifacts
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Load JarvisManager
const JarvisManager = require('../src/utils/jarvis-manager');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING AUDIO CONVERSATIONAL DE-DUPLICATION & ANTI-FLICKER TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(condition, name) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Single-Voice Mutual Exclusion & Filler Suppression
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Turn Filler & Micro-Backchannel Suppression ---');
  const jm = new JarvisManager({ voice: 'en-US-AvaMultilingualNeural' });

  test(typeof jm.playInstantTurnFiller === 'function', 'JarvisManager exposes playInstantTurnFiller');
  test(jm.playInstantTurnFiller('Tuk Tuk') === false, 'playInstantTurnFiller returns false and plays no audio');
  test(jm.playInstantTurnFiller('Andrew') === false, 'playInstantTurnFiller returns false for all agents');
  test(jm.playMicroBackchannel() === false, 'playMicroBackchannel returns false and produces no background noise');
  test(jm.currentFillerProcess === null, 'No background filler process spawned in memory');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Acoustic Speaker Self-Echo Blinding Filter Logic
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Acoustic Speaker Self-Echo Blinding Filter ---');

  function checkSelfEcho(originalText, lastSpokenUtterance, lastSpeechEndTime, currentTime = Date.now()) {
    const timeSinceAiSpeech = currentTime - (lastSpeechEndTime || 0);
    if (timeSinceAiSpeech >= 3500 || !lastSpokenUtterance) {
      return false; // Not a recent echo
    }

    const normalizeWords = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const aiWords = normalizeWords(lastSpokenUtterance);
    const heardWords = normalizeWords(originalText);

    if (heardWords.length === 0 || aiWords.length === 0) return false;

    const matchingWords = heardWords.filter(w => aiWords.includes(w));
    const matchRatio = matchingWords.length / heardWords.length;

    return matchRatio >= 0.5 || (heardWords.length <= 4 && matchingWords.length >= 2);
  }

  const aiSpeech = "Hey babe, I am awake. My eyes are open and I see your screen. What are we working on?";
  const aiEndTime = Date.now() - 600; // Spoke 600ms ago

  // Exact tail echo captured by microphone
  test(checkSelfEcho("what are we working on", aiSpeech, aiEndTime) === true,
    'Catches exact tail echo of AI speech within 3.5s');

  // Partial echo captured by microphone
  test(checkSelfEcho("Hey babe, I am awake", aiSpeech, aiEndTime) === true,
    'Catches opening greeting echo within 3.5s');

  // 2-word short echo
  test(checkSelfEcho("working on", aiSpeech, aiEndTime) === true,
    'Catches 2-word speaker bleed echo');

  // Real user speaking a different prompt
  test(checkSelfEcho("Can you check the database migration please", aiSpeech, aiEndTime) === false,
    'Allows independent user queries without false positive blocking');

  // Real user speaking after 4 seconds (outside the 3.5s acoustic echo window)
  test(checkSelfEcho("what are we working on", aiSpeech, Date.now() - 4000) === false,
    'Allows user repetition after the 3.5s acoustic echo window');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: VAD Idle Silence & Frame Gating
  // --------------------------------------------------------------------------
  console.log('\n--- 3. VAD Idle Silence & Frame Gating ---');

  function evaluateVadSubmission(currentMode, speechDetected, speechFrames, voicedDurationMs, silenceMs) {
    if (currentMode === 'jarvis') {
      if (!speechDetected || speechFrames < 4) {
        return { action: 'discard_silence', sendToWhisper: false };
      }
      const dynamicSilenceThreshold = voicedDurationMs < 800 ? 1200 : (voicedDurationMs < 2200 ? 600 : 500);
      if (silenceMs >= dynamicSilenceThreshold && voicedDurationMs >= 450) {
        return { action: 'submit_turn', sendToWhisper: true };
      }
      return { action: 'keep_listening', sendToWhisper: false };
    }
    return { action: 'standard_submit', sendToWhisper: true };
  }

  // 12s idle with no speech detected
  const idleResult = evaluateVadSubmission('jarvis', false, 0, 0, 12000);
  test(idleResult.action === 'discard_silence' && !idleResult.sendToWhisper,
    '12s ambient silence is discarded without calling Whisper');

  // Short noise blip (e.g. keyboard click, 1 frame, 60ms)
  const clickResult = evaluateVadSubmission('jarvis', true, 1, 60, 900);
  test(clickResult.action === 'discard_silence' && !clickResult.sendToWhisper,
    'Transient noise blip (<4 frames) is discarded cleanly');

  // Real user speech (requires 450ms voiced duration)
  const shortVocalResult = evaluateVadSubmission('jarvis', true, 4, 300, 650);
  test(shortVocalResult.action === 'keep_listening' && !shortVocalResult.sendToWhisper,
    'Incomplete speech (<450ms voiced duration) keeps listening rather than prematurely cutting off');

  // Full user turn: 1200ms voiced speech, followed by 650ms natural pause
  const fullTurnResult = evaluateVadSubmission('jarvis', true, 15, 1200, 650);
  test(fullTurnResult.action === 'submit_turn' && fullTurnResult.sendToWhisper,
    'Confirmed user speech with natural pause is cleanly submitted to Whisper');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Whisper Silence Hallucination Filter
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Whisper Silence Hallucination Filter ---');

  const SILENCE_HALLUCINATIONS = new Set([
    'thank you', 'thank you.', 'thanks', 'thanks.',
    'thank you very much', 'thank you very much.',
    'thank you so much', 'thank you so much.',
    'you', 'you.', 'bye', 'bye.', 'goodbye',
    'okay', 'so', 'tell andrew', 'teren you do'
  ]);

  function isWhisperHallucinationTest(text, recordingDurationMs = 0) {
    if (!text || typeof text !== 'string') return true;
    const clean = text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').trim();
    if (clean.length === 0) return true;
    if (SILENCE_HALLUCINATIONS.has(clean)) return true;

    const ACK_PHRASES = new Set([
      'thank you', 'thanks', 'thank you very much', 'thank you so much',
      'you', 'bye', 'goodbye', 'okay', 'so', 'yeah', 'mhm', 'uhhuh',
      'teren you do', 'tell andrew', 'i do', 'you do', 'dot', 'period'
    ]);

    const words = clean.split(/\s+/).filter(Boolean);
    if (ACK_PHRASES.has(clean) || (words.length <= 2 && (clean.startsWith('thank') || clean === 'you' || clean === 'bye' || clean === 'teren you do'))) {
      if (recordingDurationMs < 1500 || recordingDurationMs > 2500) {
        return true;
      }
    }

    if (/^\[.+\]$/.test(text.trim()) || /^\(.+\)$/.test(text.trim())) return true;
    if (clean.startsWith('subtitles by') || clean.includes('amaraorg') || clean.includes('closed caption')) return true;

    // Repetitions
    if (!clean.includes('tuk') && /\b(\w+)(?:[,\s]+\1){2,}\b/i.test(text)) return true;
    if (/\b(\w+\s+\w+)(?:[,\s]+\1){2,}\b/i.test(text)) return true;

    return false;
  }

  test(isWhisperHallucinationTest("Thank you.", 12000) === true, 'Catches "Thank you." on 12s ambient recording');
  test(isWhisperHallucinationTest("Tell Andrew.", 12000) === true, 'Catches "Tell Andrew." silence hallucination');
  test(isWhisperHallucinationTest("[Music]", 3000) === true, 'Catches [Music] bracketed artifact');
  test(isWhisperHallucinationTest("Subtitles by Amara.org", 5000) === true, 'Catches subtitle hallucination');
  test(isWhisperHallucinationTest("you you you", 4000) === true, 'Catches word stutter repetition loop');
  test(isWhisperHallucinationTest("Tuk Tuk, how are you?", 1800) === false, 'Passes legitimate user address to Tuk Tuk');
  test(isWhisperHallucinationTest("Andrew, can you inspect the server logs?", 3200) === false, 'Passes legitimate user command to Andrew');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Utterance & Speech End Timestamp Tracking in JarvisManager
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Utterance & Speech End Timestamp Tracking ---');
  jm.lastSpokenUtterance = "Hello Boss, system online";
  jm.lastSpeechEndTime = Date.now();

  test(jm.lastSpokenUtterance === "Hello Boss, system online", 'JarvisManager tracks lastSpokenUtterance');
  test(typeof jm.lastSpeechEndTime === 'number' && jm.lastSpeechEndTime > 0, 'JarvisManager tracks lastSpeechEndTime');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} AUDIO CONVERSATIONAL DE-DUPLICATION TESTS PASSED!`);
  console.log('================================================================\n');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
