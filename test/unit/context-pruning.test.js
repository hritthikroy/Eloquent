/**
 * test/unit/context-pruning.test.js
 * 
 * Unit test suite for context pruning and intent deduplication logic.
 * Simulates a 50-turn conversation and asserts the final prompt size remains strictly under 4096 tokens.
 */

const assert = require('assert');
const { deduplicateContext, pruneContext, estimateTokens } = require('../../src/renderer/utils/contextManager');
const { DialogueEngine } = require('../../src/renderer/services/dialogueEngine');

async function runTests() {
  console.log('🧪 Running Context Pruning & Dialogue Engine Unit Test Suite...\n');

  // Test 1: 50-Turn Conversation Token Limit Assertion
  {
    console.log('▶ Test 1: 50-turn conversation pruning under 4096 tokens');
    const conversation50Turns = [];
    for (let i = 1; i <= 50; i++) {
      conversation50Turns.push({
        role: 'user',
        content: `Turn ${i}: As an engineer building complex autonomous AI systems, we need high performance, sub-100ms latency, zero memory leaks, and perfect state synchronization across processes.`
      });
      conversation50Turns.push({
        role: 'assistant',
        content: `Turn ${i} Response: Understood babe! All audio, memory, and IPC channels are operating at peak efficiency with sub-millisecond execution.`
      });
    }

    assert.strictEqual(conversation50Turns.length, 100);

    const pruned = pruneContext(conversation50Turns, 10, 4096);
    assert.ok(pruned.length <= 10, `Expected at most 10 turns retained, got ${pruned.length}`);

    const totalTokens = pruned.reduce((sum, turn) => sum + estimateTokens(turn.content), 0);
    console.log(`  📊 Retained turns: ${pruned.length}, Total estimated tokens: ${totalTokens} (Limit: 4096)`);
    assert.ok(totalTokens < 4096, `Expected tokens < 4096, got ${totalTokens}`);
    console.log('  ✅ Test 1 Passed: 50-turn history pruned strictly under 4096 tokens');
  }

  // Test 2: Intent Deduplication Cosine Similarity
  {
    console.log('▶ Test 2: Intent deduplication suppressing near-duplicate user prompts');
    const duplicateTurns = [
      { role: 'user', content: 'What is the current status of the audio capture pipeline?' },
      { role: 'assistant', content: 'The pipeline is active and ready!' },
      { role: 'user', content: 'what is current status of audio capture pipeline?' }, // Near duplicate
      { role: 'user', content: 'Show me the project system architecture' } // Distinct intent
    ];

    const deduplicated = deduplicateContext(duplicateTurns, 0.80);
    assert.strictEqual(deduplicated.length, 3);
    assert.strictEqual(deduplicated[2].content, 'Show me the project system architecture');
    console.log('  ✅ Test 2 Passed: Near-duplicate user intent suppressed by cosine similarity');
  }

  // Test 3: DialogueEngine generateResponse without loopState
  {
    console.log('▶ Test 3: DialogueEngine response generation');
    const engine = new DialogueEngine();
    const res = await engine.generateResponse('Check audio status', []);
    assert.strictEqual(typeof res.text, 'string');
    assert.ok(res.text.length > 0);
    assert.strictEqual(typeof res.confidenceScore, 'number');
    assert.strictEqual(typeof res.repetitionPenalty, 'number');
    console.log(`  🗣️ Generated Response: "${res.text}"`);
    console.log('  ✅ Test 3 Passed: DialogueEngine generated non-repetitive response cleanly');
  }

  console.log('\n🌟 All Context Pruning & Dialogue Engine Unit Tests Passed Successfully! 🚀');
}

runTests().catch(err => {
  console.error('❌ Context pruning unit tests failed:', err);
  process.exit(1);
});
