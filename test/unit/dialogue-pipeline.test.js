/**
 * test/unit/dialogue-pipeline.test.js
 * 
 * Unit test suite for refactored core dialogue generation pipeline.
 * Validates DialoguePromptEngineer, DialogueContextManager, and ResponseValidator loop detection.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { DialoguePromptEngineer } = require('../../dist-ts/src/core/dialogue/prompt-engineer');
const { DialogueContextManager } = require('../../dist-ts/src/core/dialogue/context-manager');
const { ResponseValidator } = require('../../dist-ts/src/core/dialogue/response-validator');

async function runTests() {
  console.log('🧪 Running Core Dialogue Pipeline Unit Test Suite...\n');

  // Load persona config
  const personaPath = path.join(__dirname, '../../src/config/persona/tuk-tuk.json');
  const personaConfig = JSON.parse(fs.readFileSync(personaPath, 'utf8'));

  // Test 1: DialoguePromptEngineer System Prompt Construction & Token Limits
  {
    console.log('▶ Test 1: DialoguePromptEngineer system prompt construction & token safety');
    const systemPrompt = DialoguePromptEngineer.buildSystemPrompt(personaConfig, {
      activeContext: 'User is asking about system status and low-latency audio capture.'
    });

    assert.ok(systemPrompt.includes('Tuk Tuk'));
    assert.ok(systemPrompt.includes('chill, relaxed, warm, direct'));
    assert.ok(systemPrompt.includes('Do not repeat previous sentences'));
    assert.ok(systemPrompt.includes('Sure'));

    const tokenCount = DialoguePromptEngineer.estimateTokens(systemPrompt);
    console.log(`  📊 Generated system prompt length: ${systemPrompt.length} chars (~${tokenCount} tokens)`);
    assert.ok(tokenCount < 2048, `Expected system prompt tokens < 2048, got ${tokenCount}`);
    console.log('  ✅ Test 1 Passed: System prompt constructed with tone directives, negative constraints & token safety');
  }

  // Test 2: DialogueContextManager History Deduplication
  {
    console.log('▶ Test 2: DialogueContextManager history deduplication');
    const history = [
      { role: 'user', content: 'How is the system performing?' },
      { role: 'assistant', content: 'Everything is running smoothly, babe.' },
      { role: 'user', content: 'how is the system performing?' }, // Duplicate user turn
      { role: 'assistant', content: 'Everything is running smoothly, babe.' }, // Duplicate assistant turn
      { role: 'user', content: 'Let us review the audio pipeline metrics.' } // Distinct turn
    ];

    const deduplicated = DialogueContextManager.deduplicateRecentHistory(history, 5, 0.80);
    assert.strictEqual(deduplicated.length, 3);
    assert.strictEqual(deduplicated[2].content, 'Let us review the audio pipeline metrics.');
    console.log('  ✅ Test 2 Passed: Redundant user-assistant pairs filtered from recent history window');
  }

  // Test 3: ResponseValidator Simulated Loop Detection & Cycle Break within 2 turns
  {
    console.log('▶ Test 3: ResponseValidator loop detection and cycle breaking within 2 turns');
    const conversationHistory = [
      { role: 'user', content: 'Check status' },
      { role: 'assistant', content: 'All systems operational, latency is 20ms and memory usage is clean.' }
    ];

    // Candidate 1: Non-loop response
    const candidate1 = 'Audio pipeline is clear and ready for input.';
    const res1 = ResponseValidator.checkForLooping(candidate1, conversationHistory);
    assert.strictEqual(res1.isLooping, false);
    assert.strictEqual(res1.recommendedAction, 'none');

    // Candidate 2: High-similarity loop response (Turn 1 of loop)
    const candidateLoop1 = 'All systems operational, latency is 20ms and memory usage is clean.';
    const resLoop1 = ResponseValidator.checkForLooping(candidateLoop1, conversationHistory);
    assert.strictEqual(resLoop1.isLooping, true);
    assert.ok(resLoop1.similarityScore > 0.90);
    assert.ok(resLoop1.recommendedAction === 'force_reset' || resLoop1.recommendedAction === 'shift_tone');

    // Simulate system breaking the cycle on turn 2 by shifting tone/prompt
    conversationHistory.push({ role: 'user', content: 'Check status again' });
    conversationHistory.push({ role: 'assistant', content: candidateLoop1 }); // Log loop turn

    const candidateShift = 'Everything is smooth on my end! Audio and memory are good to go.';
    const resShift = ResponseValidator.checkForLooping(candidateShift, conversationHistory);
    assert.strictEqual(resShift.isLooping, false);
    console.log('  ✅ Test 3 Passed: Simulated loop detected and broken within 2 turns');
  }

  console.log('\n🌟 All Core Dialogue Pipeline Unit Tests Passed Successfully! 🚀');
}

runTests().catch(err => {
  console.error('❌ Dialogue pipeline unit tests failed:', err);
  process.exit(1);
});
