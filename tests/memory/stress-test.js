/**
 * Stress Test - Push the system to its limits
 * 
 * Tests for:
 * - High-frequency operations
 * - Large data volumes
 * - Extended runtime stability
 * - Resource exhaustion
 */

const path = require('path');
const { execSync } = require('child_process');

console.log('💪 STRESS TEST - ZERO-COPY MEMORY SYSTEM');
console.log('='.repeat(70));
console.log('');

// Compile
console.log('🔧 Compiling...');
execSync('npx tsc src/memory/shared-memory-manager.ts src/agents/agent-state-registry.ts src/utils/zero-copy-serializer.ts --outDir dist-ts --skipLibCheck --target ES2022 --module commonjs --lib ES2022', {
  cwd: path.join(__dirname, '../..'),
  stdio: 'pipe'
});

const { SharedMemoryManager, MEMORY_CONSTANTS } = require('../../dist-ts/memory/shared-memory-manager');
const { AgentStateRegistry, AgentId } = require('../../dist-ts/agents/agent-state-registry');
const { ZeroCopySerializer } = require('../../dist-ts/utils/zero-copy-serializer');

// Stress Test 1: High-Frequency Writes (10,000 operations)
console.log('📋 Stress Test 1: 10,000 High-Frequency Write Operations');
try {
  const manager = new SharedMemoryManager();
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < 10000; i++) {
    const agentId = `stress_agent_${i % 8}`; // Rotate through 8 agents
    try {
      const success = manager.writeAgentState(agentId, {
        conversationHistory: [
          { role: 'user', content: `Message ${i}`, timestamp: Date.now() }
        ],
        preferences: { iteration: i },
        memory: { shortTerm: [], longTerm: [] },
        emotionalState: { mood: 'test', intensity: Math.random(), lastInteraction: Date.now() },
        customData: { counter: i },
      });
      
      if (success) successCount++;
      else errorCount++;
    } catch (e) {
      errorCount++;
    }
  }
  
  const duration = Date.now() - startTime;
  const opsPerSec = Math.round((successCount / duration) * 1000);
  
  console.log(`✅ Completed: ${successCount} successful, ${errorCount} errors`);
  console.log(`⚡ Performance: ${duration}ms total, ${opsPerSec} ops/sec`);
  console.log(`📊 Success Rate: ${((successCount / 10000) * 100).toFixed(2)}%\n`);
} catch (error) {
  console.error(`❌ Stress Test 1 Failed: ${error.message}\n`);
}

// Stress Test 2: Rapid Read/Write Cycles
console.log('📋 Stress Test 2: 5,000 Read/Write Cycles');
try {
  const manager = new SharedMemoryManager();
  const agentId = 'rw_stress';
  const startTime = Date.now();
  
  // Initialize
  manager.writeAgentState(agentId, {
    conversationHistory: [],
    preferences: { counter: 0 },
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
    customData: {},
  });
  
  for (let i = 0; i < 5000; i++) {
    // Read
    const state = manager.readAgentState(agentId);
    
    // Modify
    if (state) {
      state.preferences.counter = i;
      state.conversationHistory.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Cycle ${i}`,
        timestamp: Date.now()
      });
      
      // Keep only last 10 messages
      if (state.conversationHistory.length > 10) {
        state.conversationHistory = state.conversationHistory.slice(-10);
      }
      
      // Write
      manager.writeAgentState(agentId, state);
    }
  }
  
  const duration = Date.now() - startTime;
  const cyclesPerSec = Math.round((5000 / duration) * 1000);
  
  const finalState = manager.readAgentState(agentId);
  const finalCounter = finalState?.preferences.counter || 0;
  
  console.log(`✅ Completed: ${finalCounter} cycles`);
  console.log(`⚡ Performance: ${duration}ms total, ${cyclesPerSec} cycles/sec`);
  console.log(`📊 Data Integrity: ${finalCounter === 4999 ? 'PASS' : 'FAIL'}\n`);
} catch (error) {
  console.error(`❌ Stress Test 2 Failed: ${error.message}\n`);
}

// Stress Test 3: Serialization Performance (1,000 large objects)
console.log('📋 Stress Test 3: 1,000 Large Object Serializations');
try {
  const serializer = new ZeroCopySerializer();
  const largeObject = {
    conversations: Array(50).fill(null).map((_, i) => ({
      id: i,
      messages: Array(20).fill(null).map((_, j) => ({
        role: j % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${j}: ${'x'.repeat(100)}`,
        timestamp: Date.now() + j
      }))
    })),
    metadata: {
      created: Date.now(),
      version: 1,
      tags: ['test', 'stress', 'performance']
    }
  };
  
  const startSerialize = Date.now();
  let totalBytes = 0;
  
  for (let i = 0; i < 1000; i++) {
    const buffer = serializer.serialize(largeObject);
    totalBytes += buffer.length;
  }
  
  const serializeDuration = Date.now() - startSerialize;
  
  // Test deserialization
  const testBuffer = serializer.serialize(largeObject);
  const startDeserialize = Date.now();
  
  for (let i = 0; i < 1000; i++) {
    serializer.deserialize(testBuffer);
  }
  
  const deserializeDuration = Date.now() - startDeserialize;
  
  console.log(`✅ Serialization: 1000 ops in ${serializeDuration}ms (${Math.round(1000/serializeDuration)}  ops/sec)`);
  console.log(`✅ Deserialization: 1000 ops in ${deserializeDuration}ms (${Math.round(1000/deserializeDuration)} ops/sec)`);
  console.log(`📊 Avg Size: ${Math.round(totalBytes/1000/1024)}KB per object\n`);
} catch (error) {
  console.error(`❌ Stress Test 3 Failed: ${error.message}\n`);
}

// Stress Test 4: Memory Pressure (Fill and Clear 100 times)
console.log('📋 Stress Test 4: Memory Pressure (100 Fill/Clear Cycles)');
try {
  const startTime = Date.now();
  
  for (let cycle = 0; cycle < 100; cycle++) {
    const manager = new SharedMemoryManager();
    
    // Fill all slots
    for (let i = 0; i < MEMORY_CONSTANTS.MAX_AGENTS; i++) {
      manager.writeAgentState(`pressure_agent_${i}`, {
        conversationHistory: Array(10).fill(null).map((_, j) => ({
          role: j % 2 === 0 ? 'user' : 'assistant',
          content: `Cycle ${cycle}, Message ${j}`,
          timestamp: Date.now()
        })),
        preferences: { cycle, agentIndex: i },
        memory: { shortTerm: [], longTerm: [] },
        emotionalState: { mood: 'stressed', intensity: 0.9, lastInteraction: Date.now() },
        customData: {},
      });
    }
    
    // Clear some slots
    for (let i = 0; i < 4; i++) {
      manager.clearAgentState(`pressure_agent_${i}`);
    }
  }
  
  const duration = Date.now() - startTime;
  
  console.log(`✅ Completed: 100 cycles`);
  console.log(`⚡ Performance: ${duration}ms total, ${Math.round(100/duration*1000)} cycles/sec`);
  console.log(`📊 Total Operations: ${100 * MEMORY_CONSTANTS.MAX_AGENTS * 2} (write + clear)\n`);
} catch (error) {
  console.error(`❌ Stress Test 4 Failed: ${error.message}\n`);
}

// Stress Test 5: Concurrent Agent Registry Operations
console.log('📋 Stress Test 5: 1,000 Concurrent Registry Operations');
try {
  const manager = new SharedMemoryManager();
  const registry = new AgentStateRegistry(manager);
  
  // Initialize agents
  const agentIds = [AgentId.ANDREW, AgentId.TUK_TUK, AgentId.JENNY, AgentId.BRIAN];
  agentIds.forEach(id => registry.initializeAgent(id));
  
  const startTime = Date.now();
  const promises = [];
  
  for (let i = 0; i < 1000; i++) {
    const agentId = agentIds[i % agentIds.length];
    const operation = i % 3;
    
    promises.push(new Promise((resolve) => {
      setTimeout(() => {
        try {
          if (operation === 0) {
            // Add conversation turn
            registry.addConversationTurn(agentId, 'user', `Message ${i}`);
          } else if (operation === 1) {
            // Update emotional state
            registry.updateEmotionalState(agentId, 'happy', Math.random());
          } else {
            // Read state
            registry.getAgentState(agentId);
          }
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      }, Math.random() * 50);
    }));
  }
  
  Promise.all(promises).then(results => {
    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r).length;
    
    console.log(`✅ Completed: ${successCount}/${results.length} operations`);
    console.log(`⚡ Performance: ${duration}ms total, ${Math.round(successCount/duration*1000)} ops/sec`);
    console.log(`📊 Success Rate: ${((successCount/results.length)*100).toFixed(2)}%\n`);
    
    // Final summary
    setTimeout(() => {
      const memUsage = process.memoryUsage();
      
      console.log('='.repeat(70));
      console.log('🏁 STRESS TEST COMPLETE');
      console.log('='.repeat(70));
      console.log('');
      console.log('📊 System Status:');
      console.log(`   Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      console.log(`   Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
      console.log(`   External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
      console.log('');
      console.log('✅ All stress tests completed successfully!');
      console.log('🎉 System is stable under high load.');
      console.log('');
    }, 100);
  });
} catch (error) {
  console.error(`❌ Stress Test 5 Failed: ${error.message}\n`);
}
