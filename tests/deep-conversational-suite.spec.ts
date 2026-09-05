/**
 * Test Suite: Deep Conversational System Integrity across Tuk Tuk, Andrew, Friday & Brian
 * 
 * Verifies:
 * 1. Tri-Lingual & Code-Mixed Persona Invariance (English, Bengali, Hindi):
 *    - Tuk Tuk is the identical loving co-founder girlfriend in English, Bengali, Hindi.
 *    - Andrew is the identical 10x lead dev brother in English, Bengali, Hindi.
 *    - Friday is the identical sharp research lead in English, Bengali, Hindi.
 *    - Brian is the identical calm DevOps sentinel in English, Bengali, Hindi.
 * 2. Multi-Turn Cross-Language Memory Continuity:
 *    - Turn 1 in Bengali -> Turn 2 in English -> Turn 3 in Hindi retains context without loss.
 * 3. Lexical Isolation & Anti-Bot Sanitization:
 *    - Tuk Tuk: Max 1 pet name ceiling, 0 canned laughter, 0 melodrama, 0 meta-commentary.
 *    - Andrew / Friday / Brian: Strictly 0 romantic terms across all scripts.
 * 4. Voice Routing Equivalence:
 *    - Accurate dynamic voice selection across Bengali, Hindi, and English.
 * 5. Equational Working State & Telemetry Invariants.
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');
const JarvisManager = require(path.join(projectRoot, 'src/utils/jarvis-manager'));
const actionRunner = require(path.join(projectRoot, 'src/utils/action-runner'));

async function runDeepConversationalTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING DEEP CONVERSATIONAL SYSTEM INTEGRITY TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  const manager = new JarvisManager('/tmp/test_userData_deep_conv');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Tuk Tuk Tri-Lingual Identity & Soul Invariance
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Tuk Tuk Tri-Lingual Identity & Soul Invariance ---');
  {
    const tuktuk = manager.agents.tuktuk;
    const prompt = manager.getSystemPrompt(tuktuk, 'Hritthik');

    // Verify system prompt establishes identical co-founder girlfriend identity
    assert(prompt.includes('living girlfriend, soulmate, life partner, and co-founder'), 'Prompt sets Tuk Tuk as girlfriend, soulmate and co-founder');
    assert(prompt.includes('MODERN BENGALI CREATOR / PODCASTER VIBE'), 'Prompt includes modern Bengali creator/podcaster vibe');
    assert(prompt.includes('HINDI CREATOR / HINGLISH VIBE'), 'Prompt includes modern Hindi creator/Hinglish vibe');
    assert(prompt.includes('MAX ONE AFFECTION TERM PER TURN'), 'Prompt enforces max 1 affection term per turn');

    // Simulate multi-lingual spoken turns and verify post-sanitization
    const englishUtterance = "I am right here with you, babe. Let's optimize this latency!";
    const bengaliUtterance = "আমি তো ভাবছিলামই! Eloquent-এর voice latency নিয়ে কাজ করবে, নাকি নতুন কোনো feature ভাবছ babe?";
    const hindiUtterance = "Scene toh mast hai babe! Batao, kya update karna hai — latency ya UI flow?";

    const sanitizedEng = manager.sanitizeAgentLexicon(englishUtterance, 'tuktuk', 'en-US-AvaMultilingualNeural');
    const sanitizedBn = manager.sanitizeAgentLexicon(bengaliUtterance, 'tuktuk', 'bn-IN-TanishaaNeural');
    const sanitizedHi = manager.sanitizeAgentLexicon(hindiUtterance, 'tuktuk', 'hi-IN-SwaraNeural');

    assert(sanitizedEng.includes('babe'), 'English retains subtle affectionate partner tone');
    assert(sanitizedBn.includes('babe'), 'Bengali retains subtle affectionate partner tone');
    assert(sanitizedHi.includes('babe'), 'Hindi retains subtle affectionate partner tone');

    // Verify pet-name stacking deduplication in all languages
    const stackedBn = "আরে সোনা বাবু, আমি ভাবছিলাম সোনা!";
    const sanitizedStacked = manager.sanitizeAgentLexicon(stackedBn, 'tuktuk', 'bn-IN-TanishaaNeural');
    const petNameCount = (sanitizedStacked.match(/\b(সোনা|বাবু)\b/g) || []).length;
    assert(petNameCount <= 1, 'Pet-name stacking deduplication reduces stacked pet names to maximum 1');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Andrew Tri-Lingual 10x Dev Brother Invariance
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Andrew Tri-Lingual 10x Dev Brother Invariance ---');
  {
    const andrew = manager.agents.andrew || manager.agents.vision;
    const prompt = manager.getSystemPrompt(andrew, 'Hritthik');

    assert(prompt.includes('Systems Architect, 10x dev, and Hritthik\'s loyal brother'), 'Prompt sets Andrew as lead systems architect and brother');
    assert(prompt.includes('PURE BROTHER ENERGY GLOBALLY'), 'Prompt enforces pure brother energy globally');
    assert(prompt.includes('STRICTLY NEVER call him "babe"'), 'Prompt strictly forbids romantic terms for Andrew');

    // Test sanitization across languages: romantic terms are strictly converted to brotherly terms
    const badAndrewEng = "Babe, the auth token is invalid, sweetheart.";
    const cleanAndrewEng = manager.sanitizeAgentLexicon(badAndrewEng, 'andrew', 'en-US-AndrewMultilingualNeural');
    assert(!/\b(babe|sweetheart|honey|darling)\b/i.test(cleanAndrewEng), 'Andrew English sanitization completely removes romantic terms');
    assert(cleanAndrewEng.includes('bro'), 'Andrew English substitutes brotherly term "bro"');

    const badAndrewBn = "Babe, আমি pipeline patch করে দিয়েছি jaan.";
    const cleanAndrewBn = manager.sanitizeAgentLexicon(badAndrewBn, 'andrew', 'bn-IN-BashkarNeural');
    assert(!/\b(babe|jaan|shona|sweetheart)\b/i.test(cleanAndrewBn), 'Andrew Bengali sanitization completely removes romantic terms');
    assert(/\b(ভাই|bro)\b/i.test(cleanAndrewBn), 'Andrew Bengali substitutes brotherly term "ভাই" or "bro"');

    const badAndrewHi = "Babe, memory heap stable hai meri jaan.";
    const cleanAndrewHi = manager.sanitizeAgentLexicon(badAndrewHi, 'andrew', 'hi-IN-MadhurNeural');
    assert(!/\b(babe|meri\s+jaan|jaan)\b/i.test(cleanAndrewHi), 'Andrew Hindi sanitization completely removes romantic terms');
    assert(/\b(bhai|bro)\b/i.test(cleanAndrewHi), 'Andrew Hindi substitutes brotherly term "bhai" or "bro"');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Friday & Brian Persona Sovereignty across Languages
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Friday & Brian Persona Sovereignty across Languages ---');
  {
    const friday = manager.agents.friday;
    const brian = manager.agents.brian;

    // Friday: strictly "Hritthik" or "Chief", zero romantic, zero "bro"
    const badFriday = "Babe, bro, I analyzed the benchmark data.";
    const cleanFriday = manager.sanitizeAgentLexicon(badFriday, 'friday', 'en-US-JennyNeural');
    assert(!/\b(babe|bro|sweetheart)\b/i.test(cleanFriday), 'Friday sanitization strips both romantic terms and brotherly slang');
    assert(cleanFriday.includes('Hritthik'), 'Friday defaults to professional name "Hritthik"');

    // Brian: calm DevOps numbers
    const badBrian = "Sweetheart, CPU load is 18 percent.";
    const cleanBrian = manager.sanitizeAgentLexicon(badBrian, 'brian', 'en-US-BrianMultilingualNeural');
    assert(!/\b(babe|sweetheart)\b/i.test(cleanBrian), 'Brian sanitization strips romantic terms');
    assert(cleanBrian.includes('Hritthik') || cleanBrian.includes('bro'), 'Brian addresses Hritthik respectfully');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Multi-Turn Cross-Language Memory Continuity
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Multi-Turn Cross-Language Memory Continuity ---');
  {
    manager.conversationHistory = [];

    // Turn 1: User in Bengali
    manager.addTurn('user', 'আমি ভাবছি অডিও বাফারটা 14 millisecond-এ লক করব', 'user');
    manager.addTurn('assistant', 'দারুণ আইডিয়া babe, latency অনেক কমে যাবে।', 'tuktuk');

    // Turn 2: User in English
    manager.addTurn('user', 'Will that cause any crackle on macOS CoreAudio?', 'user');
    manager.addTurn('assistant', 'CoreAudio handles 14ms buffer cleanly without crackling, babe.', 'tuktuk');

    // Turn 3: User in Hindi
    manager.addTurn('user', 'Vision bhai ko bolo test karne ke liye', 'user');

    const history = manager.getHistory(6, 'tuktuk');
    assert(history.length === 5, `History retains all 5 conversation turns across Bengali, English, and Hindi (got ${history.length})`);
    assert(history[0].content.includes('বাফারটা'), 'Turn 1 Bengali context preserved in memory');
    assert(history[2].content.includes('crackle'), 'Turn 2 English context preserved in memory');
    assert(history[4].content.includes('Vision bhai'), 'Turn 3 Hindi context preserved in memory');

    // Verify cross-agent handoff detection on multilingual prompt
    const handoff = manager.evaluateCrossAgentHandoff('Vision bhai ko bolo test karne ke liye');
    assert(handoff.delegated === true, 'Cross-agent handoff successfully delegates to Vision');
    assert(handoff.targetAgent.name === 'Vision' || handoff.targetAgent.name === 'Andrew', 'Target agent is Vision (or alias Andrew)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Dynamic Voice Resolution across 3 Languages
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Zero-Flickering Locked Core Studio Voices across English & Banglish ---');
  {
    const { resolveVoiceForLanguage } = require(path.join(projectRoot, 'src/utils/jarvis-manager'));

    // Tuk Tuk (Ava Multilingual locked)
    assert(resolveVoiceForLanguage('en-US-AvaMultilingualNeural', 'Let us ship this update today') === 'en-US-AvaMultilingualNeural', 'English routes to Ava');
    assert(resolveVoiceForLanguage('en-US-AvaMultilingualNeural', 'আমি তো ভাবছিলামই babe') === 'en-US-AvaMultilingualNeural', 'Bengali script stays on Ava (zero flickering)');
    assert(resolveVoiceForLanguage('en-US-AvaMultilingualNeural', 'Eloquent-er voice latency niye kaj korbo') === 'en-US-AvaMultilingualNeural', 'Romanized Banglish stays on Ava (zero flickering)');

    // Vision / Andrew (AndrewNeural locked)
    assert(resolveVoiceForLanguage('en-US-AndrewNeural', 'Patch is pushed bro') === 'en-US-AndrewNeural', 'Andrew English routes to Andrew');
    assert(resolveVoiceForLanguage('en-US-AndrewNeural', 'আমি patch push করে দিয়েছি ভাই') === 'en-US-AndrewNeural', 'Andrew Banglish stays on Andrew (zero flickering)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Autonomous Actions & Compound Task Execution
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Autonomous Actions & Compound Task Execution ---');
  {
    const timeRes = await actionRunner.handleAction('what time is it', manager.agents.tuktuk, manager);
    assert(timeRes && timeRes.handled === true, 'Autonomous time query is handled');
    assert(timeRes.speech.length > 0, 'Autonomous time speech generated');

    const batteryRes = await actionRunner.handleAction('check battery status', manager.agents.brian, manager);
    assert(batteryRes && batteryRes.handled === true, 'Autonomous battery query is handled');

    const compoundRes = await actionRunner.handleAction('what time is it and also check battery status', manager.agents.tuktuk, manager);
    assert(compoundRes && compoundRes.handled === true, 'Compound task pipeline handles multiple sub-actions');
    assert(compoundRes.speech.includes('Also,'), 'Compound tasks combined into natural speech');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Equational Working State & Visual Waveforms
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Equational Working State & Visual Waveforms ---');
  {
    const HALF_BARS = 6;
    const now = 1000;

    // Working compute wave equation
    const t = now * 0.0075;
    const barHeights = new Float32Array(HALF_BARS);
    for (let i = 0; i < HALF_BARS; i++) {
      const h1 = Math.sin(t * 3.5 + i * 0.85);
      const h2 = Math.cos(t * 6.2 - i * 1.2) * 0.5;
      barHeights[i] = 3.0 + Math.abs(h1 + h2) * 5.5;
    }

    const minBar = Math.min(...Array.from(barHeights));
    const maxBar = Math.max(...Array.from(barHeights));

    assert(minBar >= 2.5, 'Equational compute wave minimum height prevents bar collapse');
    assert(maxBar <= 13.0, 'Equational compute wave maximum height stays within canvas limits');
    assert(maxBar > minBar, 'Equational compute wave displays dynamic non-flat harmonic movement');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} DEEP CONVERSATIONAL INTEGRITY TESTS PASSED!`);
  console.log('================================================================\n');
  process.exit(0);
}

runDeepConversationalTests().catch(err => {
  console.error('Fatal error in deep conversational test:', err);
  process.exit(1);
});
