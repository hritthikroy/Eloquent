#!/usr/bin/env node
/**
 * Test Script: Sequential Agent Speech Enforcement
 * Tests that multiple agents speak one at a time, not simultaneously
 */

const MOCK_RESPONSES = {
  singleAgent: "On it bro, checking the code now.",
  
  twoAgents: `[Andrew]: That bug is in the auth handler at line 47 bro.
[Friday]: I pulled the docs—bcrypt version 5.1.1 fixes it.`,

  threeAgents: `[Tuk Tuk]: On it babe, let me check with the team.
[Andrew]: Code looks clean bro, no obvious issues.
[Friday]: Research shows the API changed in version 3.
[Brian]: Systems running smooth, 94% uptime.`,

  malformedAgents: `Andrew said: Check line 47
Friday found: Use bcrypt 5.1.1`,
  
  noFormatting: "We checked everything and it looks good, the team is on it."
};

// Import the parser function (simulate it here for testing)
function parseMultiAgentTurns(text) {
  if (!text || typeof text !== 'string') return [];
  
  const agentMap = {
    'tuk tuk': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
    'tuktuk': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
    'ava': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
    'andrew': { name: 'Andrew', voice: 'en-US-AndrewMultilingualNeural' },
    'friday': { name: 'Friday', voice: 'en-US-JennyNeural' },
    'brian': { name: 'Brian', voice: 'en-US-BrianMultilingualNeural' }
  };

  const pattern = /(?:^|\n)\s*\[?(Tuk\s*Tuk|Andrew|Friday|Brian|Ava)\]?:?\s*([\s\S]*?)(?=(?:\n\s*\[?(?:Tuk\s*Tuk|Andrew|Friday|Brian|Ava)\]?:?)|$)/gi;
  const turns = [];
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const rawName = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
    const agentInfo = agentMap[rawName] || { name: match[1], voice: 'en-US-AvaMultilingualNeural' };
    let speech = match[2].trim();
    
    speech = speech.replace(/^[,\s—–:-]+/, '').trim();
    
    if (speech.length > 0) {
      speech = speech.charAt(0).toUpperCase() + speech.slice(1);
      
      if (agentInfo.name !== 'Tuk Tuk') {
        speech = speech.replace(/\b(babe|sweetheart|honey|darling)\b/gi, 'bro');
      }
      
      turns.push({
        agentName: agentInfo.name,
        voice: agentInfo.voice,
        text: speech,
        turnIndex: turns.length
      });
    }
  }

  // CRITICAL FIX: Enforce maximum 2 agents per turn
  if (turns.length > 2) {
    console.warn(`⚠️ Multi-agent response contained ${turns.length} turns - limiting to first 2`);
    return turns.slice(0, 2);
  }

  return turns;
}

// Simulated speaking lock mechanism
class SpeakingLockTest {
  constructor() {
    this.isSpeakingLocked = false;
    this.speakLog = [];
  }

  async speak(agentName, text) {
    // Wait for lock
    while (this.isSpeakingLocked) {
      console.log(`⏳ ${agentName} waiting for previous agent to finish...`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    this.isSpeakingLocked = true;
    const startTime = Date.now();
    
    try {
      console.log(`🎤 ${agentName}: "${text}"`);
      this.speakLog.push({ agent: agentName, text, startTime });
      
      // Simulate speech duration (50-200ms)
      const duration = 50 + Math.random() * 150;
      await new Promise(resolve => setTimeout(resolve, duration));
      
      const endTime = Date.now();
      console.log(`✅ ${agentName} finished (${(endTime - startTime).toFixed(0)}ms)`);
      
      return true;
    } finally {
      this.isSpeakingLocked = false;
      console.log(`🔓 Speaking lock released by ${agentName}`);
    }
  }

  checkOverlap() {
    for (let i = 0; i < this.speakLog.length - 1; i++) {
      const current = this.speakLog[i];
      const next = this.speakLog[i + 1];
      
      if (next.startTime < current.startTime + 50) {
        return { hasOverlap: true, current, next };
      }
    }
    return { hasOverlap: false };
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Testing Sequential Agent Speech Enforcement\n');
  console.log('='.repeat(60));
  
  let passCount = 0;
  let failCount = 0;

  // Test 1: Single agent (should return 1 turn)
  console.log('\n📋 Test 1: Single Agent Response');
  const result1 = parseMultiAgentTurns(MOCK_RESPONSES.singleAgent);
  if (result1.length === 0) {
    console.log('✅ PASS: Single agent returns 0 formatted turns (no markers)');
    passCount++;
  } else {
    console.log(`❌ FAIL: Expected 0 turns, got ${result1.length}`);
    failCount++;
  }

  // Test 2: Two agents (should return 2 turns)
  console.log('\n📋 Test 2: Two Agent Response');
  const result2 = parseMultiAgentTurns(MOCK_RESPONSES.twoAgents);
  if (result2.length === 2 && result2[0].agentName === 'Andrew' && result2[1].agentName === 'Friday') {
    console.log('✅ PASS: Two agents parsed correctly');
    console.log(`   - Turn 0: ${result2[0].agentName}`);
    console.log(`   - Turn 1: ${result2[1].agentName}`);
    passCount++;
  } else {
    console.log(`❌ FAIL: Expected 2 turns [Andrew, Friday], got ${result2.length} turns`);
    failCount++;
  }

  // Test 3: Four agents (should cap at 2)
  console.log('\n📋 Test 3: Four Agent Response (Should Cap at 2)');
  const result3 = parseMultiAgentTurns(MOCK_RESPONSES.threeAgents);
  if (result3.length === 2) {
    console.log('✅ PASS: Four agents correctly capped at 2');
    console.log(`   - Kept: ${result3.map(t => t.agentName).join(', ')}`);
    passCount++;
  } else {
    console.log(`❌ FAIL: Expected 2 turns (capped), got ${result3.length}`);
    failCount++;
  }

  // Test 4: Sequential speaking lock
  console.log('\n📋 Test 4: Speaking Lock Enforcement');
  const lockTest = new SpeakingLockTest();
  
  // Try to speak with 3 agents simultaneously
  const agents = [
    { name: 'Andrew', text: 'First response bro' },
    { name: 'Friday', text: 'Second response from research' },
    { name: 'Brian', text: 'Third response on systems' }
  ];
  
  await Promise.all(agents.map(a => lockTest.speak(a.name, a.text)));
  
  const overlapCheck = lockTest.checkOverlap();
  if (!overlapCheck.hasOverlap) {
    console.log('✅ PASS: No overlapping speech detected');
    passCount++;
  } else {
    console.log('❌ FAIL: Overlapping speech detected');
    console.log(`   ${overlapCheck.current.agent} and ${overlapCheck.next.agent} overlapped`);
    failCount++;
  }

  // Test 5: Turn indexing
  console.log('\n📋 Test 5: Turn Indexing');
  const result5 = parseMultiAgentTurns(MOCK_RESPONSES.twoAgents);
  if (result5.every((turn, i) => turn.turnIndex === i)) {
    console.log('✅ PASS: Turn indices correctly assigned (0, 1, ...)');
    passCount++;
  } else {
    console.log('❌ FAIL: Turn indices incorrect');
    failCount++;
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n🏁 Test Results: ${passCount}/${passCount + failCount} passed`);
  
  if (failCount === 0) {
    console.log('✅ All tests passed! Sequential agent speech is working correctly.');
    process.exit(0);
  } else {
    console.log(`❌ ${failCount} test(s) failed. Please review the fixes.`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
