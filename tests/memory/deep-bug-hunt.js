/**
 * Deep Bug Hunt - Comprehensive Testing for Zero-Copy Memory System
 * 
 * Tests for:
 * - Memory corruption
 * - Race conditions
 * - Buffer overflows
 * - Edge cases
 * - Memory leaks
 * - Deadlocks
 * - Data integrity
 */

const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 DEEP BUG HUNT - ZERO-COPY MEMORY SYSTEM');
console.log('='.repeat(70));
console.log('');

// Compile TypeScript
console.log('🔧 Compiling TypeScript...');
try {
  execSync('npx tsc src/memory/shared-memory-manager.ts src/agents/agent-state-registry.ts src/utils/zero-copy-serializer.ts --outDir dist-ts --skipLibCheck --target ES2022 --module commonjs --lib ES2022', {
    cwd: path.join(__dirname, '../..'),
    stdio: 'pipe'
  });
  console.log('✅ Compilation successful\n');
} catch (error) {
  console.error('❌ Compilation failed');
  process.exit(1);
}

// Import modules
const { SharedMemoryManager, MEMORY_CONSTANTS } = require('../../dist-ts/memory/shared-memory-manager');
const { AgentStateRegistry, AgentId } = require('../../dist-ts/agents/agent-state-registry');
const { ZeroCopySerializer } = require('../../dist-ts/utils/zero-copy-serializer');

let testsPassed = 0;
let testsFailed = 0;
const bugs = [];

function reportBug(testName, description, severity = 'HIGH') {
  bugs.push({ test: testName, description, severity, timestamp: Date.now() });
  console.error(`🐛 BUG FOUND [${severity}]: ${testName}`);
  console.error(`   ${description}\n`);
  testsFailed++;
}

function testPass(testName) {
  console.log(`✅ ${testName}`);
  testsPassed++;
}

function testFail(testName, error) {
  console.error(`❌ ${testName}: ${error}\n`);
  testsFailed++;
}

// Test 1: Memory Boundary Overflow
console.log('📋 Test 1: Memory Boundary Overflow Protection');
try {
  const manager = new SharedMemoryManager();
  
  // Try to write exactly at max size
  const maxState = {
    conversationHistory: [],
    preferences: {},
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
    customData: {},
  };
  
  // Fill to near max
  const largeMessage = 'x'.repeat(MEMORY_CONSTANTS.MAX_AGENT_DATA_SIZE - 1000);
  maxState.conversationHistory.push({
    role: 'user',
    content: largeMessage,
    timestamp: Date.now()
  });
  
  try {
    manager.writeAgentState('boundary_test', maxState);
    testPass('Accepts data near boundary');
  } catch (e) {
    reportBug('Boundary Test', `Rejects valid data near boundary: ${e.message}`, 'MEDIUM');
  }
  
  // Try to overflow
  const overflowState = { ...maxState };
  overflowState.conversationHistory.push({
    role: 'assistant',
    content: 'x'.repeat(100000),
    timestamp: Date.now()
  });
  
  try {
    manager.writeAgentState('overflow_test', overflowState);
    reportBug('Buffer Overflow', 'Allows data exceeding MAX_AGENT_DATA_SIZE - potential memory corruption!', 'CRITICAL');
  } catch (e) {
    testPass('Correctly rejects overflow');
  }
} catch (error) {
  testFail('Memory Boundary Test', error.message);
}

// Test 2: Concurrent Write Race Conditions
console.log('\n📋 Test 2: Concurrent Write Race Conditions');
try {
  const manager = new SharedMemoryManager();
  const agentId = 'race_test';
  
  // Initialize
  manager.writeAgentState(agentId, {
    conversationHistory: [],
    preferences: { counter: 0 },
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
    customData: {},
  });
  
  // Concurrent increments
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(new Promise((resolve) => {
      setTimeout(() => {
        const state = manager.readAgentState(agentId);
        if (state) {
          state.preferences.counter = (state.preferences.counter || 0) + 1;
          manager.writeAgentState(agentId, state);
        }
        resolve();
      }, Math.random() * 10);
    }));
  }
  
  Promise.all(promises).then(() => {
    const finalState = manager.readAgentState(agentId);
    const expectedCounter = 100;
    const actualCounter = finalState?.preferences.counter || 0;
    
    if (actualCounter < expectedCounter) {
      reportBug('Race Condition', `Lost writes: expected ${expectedCounter}, got ${actualCounter} - ${expectedCounter - actualCounter} writes lost!`, 'HIGH');
    } else {
      testPass('No lost writes in concurrent access');
    }
  });
} catch (error) {
  testFail('Race Condition Test', error.message);
}

// Test 3: Lock Timeout Deadlock
console.log('\n📋 Test 3: Lock Timeout and Deadlock Detection');
try {
  const manager = new SharedMemoryManager();
  const agentId = 'deadlock_test';
  
  // Try to cause deadlock by holding lock
  const startTime = Date.now();
  
  // First write
  manager.writeAgentState(agentId, {
    conversationHistory: [],
    preferences: {},
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
    customData: {},
  });
  
  // Rapid successive writes
  let successCount = 0;
  let timeoutCount = 0;
  
  for (let i = 0; i < 20; i++) {
    const result = manager.writeAgentState(agentId, {
      conversationHistory: [{ role: 'user', content: `Message ${i}`, timestamp: Date.now() }],
      preferences: { iteration: i },
      memory: { shortTerm: [], longTerm: [] },
      emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
      customData: {},
    });
    
    if (result) successCount++;
    else timeoutCount++;
  }
  
  if (timeoutCount > 0) {
    reportBug('Lock Timeout', `${timeoutCount} operations timed out - lock mechanism may be too aggressive`, 'MEDIUM');
  } else {
    testPass('All operations completed without timeout');
  }
} catch (error) {
  testFail('Deadlock Test', error.message);
}

// Test 4: Memory Leak Detection
console.log('\n📋 Test 4: Memory Leak Detection');
try {
  const initialMemory = process.memoryUsage().heapUsed;
  
  for (let iteration = 0; iteration < 10; iteration++) {
    const manager = new SharedMemoryManager();
    
    for (let i = 0; i < 100; i++) {
      manager.writeAgentState(`leak_test_${i}`, {
        conversationHistory: Array(10).fill(null).map((_, j) => ({
          role: j % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${j}`,
          timestamp: Date.now()
        })),
        preferences: { id: i },
        memory: { shortTerm: [], longTerm: [] },
        emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
        customData: {},
      });
    }
  }
  
  // Force GC if available
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const leakAmount = finalMemory - initialMemory;
  const leakMB = leakAmount / 1024 / 1024;
  
  if (leakMB > 50) {
    reportBug('Memory Leak', `Potential memory leak detected: ${leakMB.toFixed(2)}MB increase after 1000 operations`, 'HIGH');
  } else {
    testPass(`Memory usage acceptable: ${leakMB.toFixed(2)}MB increase`);
  }
} catch (error) {
  testFail('Memory Leak Test', error.message);
}

// Test 5: Serialization Edge Cases
console.log('\n📋 Test 5: Serialization Edge Cases');
try {
  const serializer = new ZeroCopySerializer();
  let edgeCasesPassed = 0;
  
  // Test circular references (should not crash)
  try {
    const circular = { a: 1 };
    circular.self = circular;
    serializer.serialize(circular);
    reportBug('Circular Reference', 'Does not detect circular references - will cause infinite loop!', 'CRITICAL');
  } catch (e) {
    edgeCasesPassed++;
  }
  
  // Test undefined in object
  const withUndefined = { a: undefined, b: null, c: 1 };
  const buf1 = serializer.serialize(withUndefined);
  const restored1 = serializer.deserialize(buf1);
  if (restored1.a === undefined && restored1.b === null && restored1.c === 1) {
    edgeCasesPassed++;
  } else {
    reportBug('Undefined Handling', 'Undefined values not preserved correctly in objects', 'MEDIUM');
  }
  
  // Test very large numbers
  const largeNum = Number.MAX_SAFE_INTEGER;
  const buf2 = serializer.serialize(largeNum);
  const restored2 = serializer.deserialize(buf2);
  if (restored2 === largeNum) {
    edgeCasesPassed++;
  } else {
    reportBug('Large Number Precision', 'Large numbers lose precision during serialization', 'HIGH');
  }
  
  // Test empty strings
  const emptyStr = '';
  const buf3 = serializer.serialize(emptyStr);
  const restored3 = serializer.deserialize(buf3);
  if (restored3 === '') {
    edgeCasesPassed++;
  } else {
    reportBug('Empty String', 'Empty strings not handled correctly', 'MEDIUM');
  }
  
  // Test Unicode
  const unicode = '你好世界🎉';
  const buf4 = serializer.serialize(unicode);
  const restored4 = serializer.deserialize(buf4);
  if (restored4 === unicode) {
    edgeCasesPassed++;
  } else {
    reportBug('Unicode Support', 'Unicode characters corrupted during serialization', 'HIGH');
  }
  
  testPass(`Serialization edge cases: ${edgeCasesPassed}/5 passed`);
} catch (error) {
  testFail('Serialization Edge Cases', error.message);
}

// Test 6: Agent Slot Exhaustion
console.log('\n📋 Test 6: Agent Slot Exhaustion Handling');
try {
  const manager = new SharedMemoryManager();
  
  // Fill all slots
  for (let i = 0; i < MEMORY_CONSTANTS.MAX_AGENTS; i++) {
    manager.writeAgentState(`agent_${i}`, {
      conversationHistory: [],
      preferences: {},
      memory: { shortTerm: [], longTerm: [] },
      emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
      customData: {},
    });
  }
  
  // Try to add one more
  try {
    manager.writeAgentState('overflow_agent', {
      conversationHistory: [],
      preferences: {},
      memory: { shortTerm: [], longTerm: [] },
      emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
      customData: {},
    });
    reportBug('Slot Overflow', 'Allows more than MAX_AGENTS agents - memory corruption risk!', 'CRITICAL');
  } catch (e) {
    testPass('Correctly rejects agent when slots full');
  }
} catch (error) {
  testFail('Slot Exhaustion Test', error.message);
}

// Test 7: Data Corruption Detection
console.log('\n📋 Test 7: Data Integrity and Corruption Detection');
try {
  const manager = new SharedMemoryManager();
  const testData = {
    conversationHistory: [
      { role: 'user', content: 'Test message with special chars: !@#$%^&*()', timestamp: 1234567890 },
      { role: 'assistant', content: 'Response with unicode: 你好', timestamp: 1234567891 }
    ],
    preferences: { key1: 'value1', key2: 123, key3: true, key4: null },
    memory: {
      shortTerm: [{ topic: 'test', content: 'data', salience: 0.75 }],
      longTerm: [{ topic: 'memory', insight: 'insight', strength: 0.85 }]
    },
    emotionalState: { mood: 'happy', intensity: 0.92, lastInteraction: Date.now() },
    customData: { nested: { deep: { value: 'here' } }, array: [1, 2, 3] }
  };
  
  manager.writeAgentState('integrity_test', testData);
  const retrieved = manager.readAgentState('integrity_test');
  
  // Deep equality check
  const issues = [];
  
  if (retrieved.conversationHistory.length !== testData.conversationHistory.length) {
    issues.push('Conversation history length mismatch');
  }
  
  if (retrieved.conversationHistory[0].content !== testData.conversationHistory[0].content) {
    issues.push('Special characters corrupted');
  }
  
  if (retrieved.conversationHistory[1].content !== testData.conversationHistory[1].content) {
    issues.push('Unicode corrupted');
  }
  
  if (retrieved.preferences.key2 !== testData.preferences.key2) {
    issues.push('Number value corrupted');
  }
  
  if (retrieved.emotionalState.intensity !== testData.emotionalState.intensity) {
    issues.push('Float precision lost');
  }
  
  if (retrieved.customData.nested.deep.value !== testData.customData.nested.deep.value) {
    issues.push('Nested object corrupted');
  }
  
  if (issues.length > 0) {
    reportBug('Data Corruption', `Data integrity violated: ${issues.join(', ')}`, 'CRITICAL');
  } else {
    testPass('Data integrity maintained across write/read');
  }
} catch (error) {
  testFail('Data Integrity Test', error.message);
}

// Test 8: Version Tracking
console.log('\n📋 Test 8: Version Tracking and Stale Reads');
try {
  const manager = new SharedMemoryManager();
  const agentId = 'version_test';
  
  // Initial write
  manager.writeAgentState(agentId, {
    conversationHistory: [],
    preferences: { version: 1 },
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
    customData: {},
  });
  
  const metadata1 = manager.getAgentMetadata(agentId);
  const version1 = metadata1?.version || 0;
  
  // Update
  manager.writeAgentState(agentId, {
    conversationHistory: [],
    preferences: { version: 2 },
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
    customData: {},
  });
  
  const metadata2 = manager.getAgentMetadata(agentId);
  const version2 = metadata2?.version || 0;
  
  if (version2 <= version1) {
    reportBug('Version Tracking', `Version not incremented: v${version1} -> v${version2}`, 'MEDIUM');
  } else {
    testPass(`Version tracking working: v${version1} -> v${version2}`);
  }
} catch (error) {
  testFail('Version Tracking Test', error.message);
}

// Test 9: Registry Event System
console.log('\n📋 Test 9: Event System and Subscriptions');
try {
  const manager = new SharedMemoryManager();
  const registry = new AgentStateRegistry(manager);
  
  let eventsFired = 0;
  let correctEvents = 0;
  
  const unsub = registry.on('state_updated', (event) => {
    eventsFired++;
    if (event.agentId === 'event_test' && event.type === 'state_updated') {
      correctEvents++;
    }
  });
  
  // Trigger events
  registry.initializeAgent('event_test');
  registry.updateAgentState('event_test', {
    conversationHistory: [],
    preferences: {},
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
    customData: {},
  });
  
  // Wait for events
  setTimeout(() => {
    unsub();
    
    if (eventsFired === 0) {
      reportBug('Event System', 'Events not firing at all', 'HIGH');
    } else if (correctEvents !== eventsFired) {
      reportBug('Event System', `Incorrect event data: ${correctEvents}/${eventsFired}`, 'MEDIUM');
    } else {
      testPass(`Event system working: ${eventsFired} events fired correctly`);
    }
  }, 100);
} catch (error) {
  testFail('Event System Test', error.message);
}

// Test 10: Buffer Sharing Corruption
console.log('\n📋 Test 10: SharedArrayBuffer Isolation');
try {
  const manager1 = new SharedMemoryManager();
  const buffer = manager1.getBuffer();
  const manager2 = new SharedMemoryManager(buffer);
  
  // Write from manager1
  manager1.writeAgentState('shared_test', {
    conversationHistory: [{ role: 'user', content: 'From manager1', timestamp: Date.now() }],
    preferences: {},
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
    customData: {},
  });
  
  // Read from manager2
  const state = manager2.readAgentState('shared_test');
  
  if (!state) {
    reportBug('Buffer Sharing', 'SharedArrayBuffer not properly shared between instances', 'HIGH');
  } else if (state.conversationHistory[0].content !== 'From manager1') {
    reportBug('Buffer Sharing', 'Data corrupted when sharing buffer between instances', 'CRITICAL');
  } else {
    testPass('SharedArrayBuffer correctly shared between instances');
  }
} catch (error) {
  testFail('Buffer Sharing Test', error.message);
}

// Wait for async tests
setTimeout(() => {
  console.log('\n' + '='.repeat(70));
  console.log('🏁 DEEP BUG HUNT COMPLETE');
  console.log('='.repeat(70));
  console.log('');
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`🐛 Bugs Found: ${bugs.length}`);
  console.log('');
  
  if (bugs.length > 0) {
    console.log('📋 BUG REPORT:');
    console.log('');
    
    const critical = bugs.filter(b => b.severity === 'CRITICAL');
    const high = bugs.filter(b => b.severity === 'HIGH');
    const medium = bugs.filter(b => b.severity === 'MEDIUM');
    
    if (critical.length > 0) {
      console.log(`🔴 CRITICAL BUGS (${critical.length}):`);
      critical.forEach((bug, i) => {
        console.log(`  ${i + 1}. ${bug.test}: ${bug.description}`);
      });
      console.log('');
    }
    
    if (high.length > 0) {
      console.log(`🟠 HIGH PRIORITY BUGS (${high.length}):`);
      high.forEach((bug, i) => {
        console.log(`  ${i + 1}. ${bug.test}: ${bug.description}`);
      });
      console.log('');
    }
    
    if (medium.length > 0) {
      console.log(`🟡 MEDIUM PRIORITY BUGS (${medium.length}):`);
      medium.forEach((bug, i) => {
        console.log(`  ${i + 1}. ${bug.test}: ${bug.description}`);
      });
      console.log('');
    }
    
    console.log('⚠️  RECOMMENDATION: Fix critical and high priority bugs before production deployment');
  } else {
    console.log('🎉 NO BUGS FOUND! System is production-ready.');
  }
  
  console.log('');
  process.exit(bugs.length > 0 ? 1 : 0);
}, 1000);
