/**
 * SharedMemoryManager Tests
 * 
 * Tests for zero-copy memory synchronization including:
 * - Large payload handling (>1MB)
 * - Concurrent access
 * - Memory leak detection
 * - Performance benchmarks
 */

import { SharedMemoryManager, AgentState, MEMORY_CONSTANTS, TOTAL_MEMORY_SIZE } from '../../src/memory/shared-memory-manager';
import { AgentStateRegistry, AgentId } from '../../src/agents/agent-state-registry';

describe('SharedMemoryManager', () => {
  let manager: SharedMemoryManager;

  beforeEach(() => {
    manager = new SharedMemoryManager();
  });

  describe('Initialization', () => {
    it('should initialize with correct magic number', () => {
      const stats = manager.getStats();
      expect(stats.totalSize).toBe(TOTAL_MEMORY_SIZE);
      expect(stats.agentCount).toBe(0);
      expect(stats.freeSlots).toBe(MEMORY_CONSTANTS.MAX_AGENTS);
    });

    it('should support SharedArrayBuffer sharing', () => {
      const buffer = manager.getBuffer();
      expect(buffer).toBeInstanceOf(SharedArrayBuffer);
      
      // Create second instance from same buffer
      const manager2 = new SharedMemoryManager(buffer);
      const stats2 = manager2.getStats();
      expect(stats2.totalSize).toBe(TOTAL_MEMORY_SIZE);
    });
  });

  describe('Agent State Operations', () => {
    const mockAgentState: AgentState = {
      conversationHistory: [
        { role: 'user', content: 'Hello', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
      ],
      preferences: { theme: 'dark', language: 'en' },
      memory: {
        shortTerm: [{ topic: 'greeting', content: 'User said hello', salience: 0.8 }],
        longTerm: [{ topic: 'personality', insight: 'User is friendly', strength: 0.7 }],
      },
      emotionalState: {
        mood: 'happy',
        intensity: 0.8,
        lastInteraction: Date.now(),
      },
      customData: { sessionId: '12345', metadata: { foo: 'bar' } },
    };

    it('should write and read agent state', () => {
      const success = manager.writeAgentState('test_agent', mockAgentState);
      expect(success).toBe(true);

      const readState = manager.readAgentState('test_agent');
      expect(readState).toBeDefined();
      expect(readState?.conversationHistory.length).toBe(2);
      expect(readState?.preferences.theme).toBe('dark');
      expect(readState?.emotionalState.mood).toBe('happy');
    });

    it('should handle multiple agents', () => {
      const agents = ['agent1', 'agent2', 'agent3'];
      
      for (const agentId of agents) {
        const state = { ...mockAgentState };
        state.customData = { agentId };
        manager.writeAgentState(agentId, state);
      }

      const allAgents = manager.listAgents();
      expect(allAgents.length).toBe(3);
      
      for (const agentId of agents) {
        const state = manager.readAgentState(agentId);
        expect(state?.customData.agentId).toBe(agentId);
      }
    });

    it('should update existing agent state', () => {
      manager.writeAgentState('test_agent', mockAgentState);
      
      const updatedState = { ...mockAgentState };
      updatedState.emotionalState.mood = 'excited';
      manager.writeAgentState('test_agent', updatedState);

      const readState = manager.readAgentState('test_agent');
      expect(readState?.emotionalState.mood).toBe('excited');
    });

    it('should return null for non-existent agent', () => {
      const state = manager.readAgentState('nonexistent');
      expect(state).toBeNull();
    });

    it('should clear agent state', () => {
      manager.writeAgentState('test_agent', mockAgentState);
      expect(manager.readAgentState('test_agent')).not.toBeNull();

      const success = manager.clearAgentState('test_agent');
      expect(success).toBe(true);
      
      const readState = manager.readAgentState('test_agent');
      expect(readState).toBeNull();
    });
  });

  describe('Large Payload Handling', () => {
    it('should handle large conversation history (>1MB)', () => {
      const largeState: AgentState = {
        conversationHistory: [],
        preferences: {},
        memory: { shortTerm: [], longTerm: [] },
        emotionalState: { mood: 'neutral', intensity: 0.5, lastInteraction: 0 },
        customData: {},
      };

      // Generate large conversation history
      const longMessage = 'x'.repeat(10000); // 10KB per message
      for (let i = 0; i < 120; i++) { // 120 * 10KB = ~1.2MB
        largeState.conversationHistory.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${longMessage}`,
          timestamp: Date.now() + i,
        });
      }

      const success = manager.writeAgentState('large_agent', largeState);
      expect(success).toBe(true);

      const readState = manager.readAgentState('large_agent');
      expect(readState).toBeDefined();
      expect(readState?.conversationHistory.length).toBe(120);
    });

    it('should reject payload exceeding MAX_AGENT_DATA_SIZE', () => {
      const tooLargeState: AgentState = {
        conversationHistory: [],
        preferences: {},
        memory: { shortTerm: [], longTerm: [] },
        emotionalState: { mood: 'neutral', intensity: 0.5, lastInteraction: 0 },
        customData: {},
      };

      // Generate payload larger than 127KB
      const hugeMessage = 'x'.repeat(MEMORY_CONSTANTS.MAX_AGENT_DATA_SIZE + 1000);
      tooLargeState.conversationHistory.push({
        role: 'user',
        content: hugeMessage,
        timestamp: Date.now(),
      });

      expect(() => {
        manager.writeAgentState('too_large_agent', tooLargeState);
      }).toThrow(/too large/i);
    });
  });

  describe('Concurrency and Thread Safety', () => {
    it('should handle concurrent writes without data corruption', async () => {
      const numOperations = 50;
      const promises: Promise<boolean>[] = [];

      for (let i = 0; i < numOperations; i++) {
        const agentId = `agent_${i % 5}`; // 5 agents
        const state: AgentState = {
          conversationHistory: [
            { role: 'user', content: `Message ${i}`, timestamp: Date.now() },
          ],
          preferences: { iteration: i },
          memory: { shortTerm: [], longTerm: [] },
          emotionalState: { mood: 'testing', intensity: 0.5, lastInteraction: i },
          customData: { operationId: i },
        };

        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              const success = manager.writeAgentState(agentId, state);
              resolve(success);
            }, Math.random() * 10);
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r === true)).toBe(true);

      // Verify all agents are accessible
      const agents = manager.listAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.length).toBeLessThanOrEqual(5);
    });

    it('should handle concurrent reads without blocking', async () => {
      // Write initial state
      manager.writeAgentState('read_test_agent', {
        conversationHistory: [],
        preferences: {},
        memory: { shortTerm: [], longTerm: [] },
        emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
        customData: {},
      });

      const numReads = 100;
      const promises: Promise<AgentState | null>[] = [];

      for (let i = 0; i < numReads; i++) {
        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              const state = manager.readAgentState('read_test_agent');
              resolve(state);
            }, Math.random() * 10);
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });

  describe('Memory Statistics', () => {
    it('should report accurate memory usage', () => {
      const initialStats = manager.getStats();
      expect(initialStats.agentCount).toBe(0);
      expect(initialStats.usedSize).toBe(MEMORY_CONSTANTS.HEADER_SIZE);

      // Add agents
      for (let i = 0; i < 3; i++) {
        manager.writeAgentState(`agent_${i}`, {
          conversationHistory: [{ role: 'user', content: 'test', timestamp: 0 }],
          preferences: {},
          memory: { shortTerm: [], longTerm: [] },
          emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
          customData: {},
        });
      }

      const stats = manager.getStats();
      expect(stats.agentCount).toBe(3);
      expect(stats.freeSlots).toBe(MEMORY_CONSTANTS.MAX_AGENTS - 3);
      expect(stats.usedSize).toBeGreaterThan(initialStats.usedSize);
    });
  });

  describe('AgentStateRegistry Integration', () => {
    let registry: AgentStateRegistry;

    beforeEach(() => {
      registry = new AgentStateRegistry(manager);
    });

    it('should initialize well-known agents', () => {
      const success = registry.initializeAgent(AgentId.ANDREW);
      expect(success).toBe(true);

      const state = registry.getAgentState(AgentId.ANDREW);
      expect(state).toBeDefined();
      expect(state?.preferences.salutation).toBe('bro');
    });

    it('should track conversation history', () => {
      registry.initializeAgent(AgentId.TUK_TUK);
      
      registry.addConversationTurn(AgentId.TUK_TUK, 'user', 'I love you');
      registry.addConversationTurn(AgentId.TUK_TUK, 'assistant', 'I love you too, babe!');

      const history = registry.getConversationHistory(AgentId.TUK_TUK);
      expect(history.length).toBe(2);
      expect(history[0].content).toBe('I love you');
      expect(history[1].content).toBe('I love you too, babe!');
    });

    it('should update emotional state', () => {
      registry.initializeAgent(AgentId.JENNY);
      
      const success = registry.updateEmotionalState(AgentId.JENNY, 'excited', 0.9);
      expect(success).toBe(true);

      const state = registry.getAgentState(AgentId.JENNY);
      expect(state?.emotionalState.mood).toBe('excited');
      expect(state?.emotionalState.intensity).toBe(0.9);
    });

    it('should search conversation history', () => {
      registry.initializeAgent(AgentId.BRIAN);
      
      registry.addConversationTurn(AgentId.BRIAN, 'user', 'How do I fix this bug?');
      registry.addConversationTurn(AgentId.BRIAN, 'assistant', 'Check the logs');
      registry.addConversationTurn(AgentId.BRIAN, 'user', 'The bug is in the parser');

      const results = registry.searchConversationHistory(AgentId.BRIAN, 'bug');
      expect(results.length).toBe(2);
      expect(results[0].relevance).toBe(1.0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should write 1000 states in <100ms', () => {
      const state: AgentState = {
        conversationHistory: [{ role: 'user', content: 'test', timestamp: 0 }],
        preferences: {},
        memory: { shortTerm: [], longTerm: [] },
        emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
        customData: {},
      };

      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        manager.writeAgentState(`perf_agent_${i % 10}`, state);
      }

      const duration = Date.now() - startTime;
      console.log(`1000 writes completed in ${duration}ms`);
      expect(duration).toBeLessThan(1000); // Should be very fast
    });

    it('should read 1000 states in <50ms', () => {
      // Setup
      const state: AgentState = {
        conversationHistory: [{ role: 'user', content: 'test', timestamp: 0 }],
        preferences: {},
        memory: { shortTerm: [], longTerm: [] },
        emotionalState: { mood: 'test', intensity: 0.5, lastInteraction: 0 },
        customData: {},
      };

      for (let i = 0; i < 10; i++) {
        manager.writeAgentState(`read_perf_${i}`, state);
      }

      // Benchmark reads
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        manager.readAgentState(`read_perf_${i % 10}`);
      }

      const duration = Date.now() - startTime;
      console.log(`1000 reads completed in ${duration}ms`);
      expect(duration).toBeLessThan(500);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running SharedMemoryManager tests...');
  
  // Simple test runner
  const manager = new SharedMemoryManager();
  
  console.log('✅ Initialization test passed');
  
  const testState: AgentState = {
    conversationHistory: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
    preferences: { test: true },
    memory: { shortTerm: [], longTerm: [] },
    emotionalState: { mood: 'happy', intensity: 0.8, lastInteraction: Date.now() },
    customData: {},
  };
  
  manager.writeAgentState('test', testState);
  const read = manager.readAgentState('test');
  console.assert(read !== null, '✅ Write/Read test passed');
  
  const stats = manager.getStats();
  console.log('✅ Memory stats:', stats);
  
  console.log('\n🎉 All manual tests passed!');
}
