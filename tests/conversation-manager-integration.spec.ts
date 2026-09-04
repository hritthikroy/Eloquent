/**
 * Test Suite: Persistent Conversational State Management & Rate-Limit Mitigation
 * 
 * Verifies:
 * 1. State rehydration across application restarts from persistent disk storage.
 * 2. Exponential backoff calculation and rate-limit retry recovery with mock 429 failures.
 * 3. Concurrent audio and text input serialization and sequence ordering without race conditions.
 * 4. Desktop Electron IPC bridge registration, phase transitions, and status broadcasts.
 * 5. Preload context isolation and window.conversationBridge API exposure.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let rootDir = path.resolve(__dirname, '../..');
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.resolve(__dirname, '..');
}
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = process.cwd();
}

const {
  ConversationManager,
  registerConversationIpc,
  VALID_PHASE_TRANSITIONS
} = require(path.join(rootDir, 'dist-ts/src/main/conversationManager'));

async function runConversationManagerTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PERSISTENT CONVERSATION MANAGER & RATE-LIMIT TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // Temporary test sandbox directory
  const testDir = path.join(os.tmpdir(), `eloquent-conv-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });

  try {
    // -------------------------------------------------------------------------
    // 1. Fault-Tolerant State Rehydration & FSM Initialization
    // -------------------------------------------------------------------------
    console.log('--- 1. Fault-Tolerant State Rehydration & FSM Initialization ---');

    // Seed prior state on disk simulating crash during 'speaking' phase
    const priorState = {
      turnId: 'turn-crashed-session',
      participants: ['user', 'Tuk Tuk', 'Andrew'],
      lastMessageTimestamp: Date.now() - 10000,
      contextBuffer: [
        { speaker: 'user', text: 'Hey Jarvis, help me analyze this architecture', timestamp: Date.now() - 10000 },
        { speaker: 'Andrew', text: 'On it! Deploying the multi-agent squad now.', timestamp: Date.now() - 9000 }
      ],
      currentPhase: 'speaking',
      activeSpeaker: 'Andrew',
      audioStreamState: 'synthesizing',
      turnSequence: 2,
      rateLimitInfo: {
        requestsRemaining: 45,
        resetTimestamp: Date.now() + 30000,
        isThrottled: false,
        backoffMs: 0
      }
    };

    const stateFilePath = path.join(testDir, 'conversation-state.json');
    fs.writeFileSync(stateFilePath, JSON.stringify(priorState, null, 2), 'utf8');

    const manager = new ConversationManager(testDir);
    const rehydrated = manager.getState();

    assert(rehydrated.contextBuffer.length === 2, 'Rehydrated dialogue history turns from disk');
    assert(rehydrated.contextBuffer[0].speaker === 'user', 'First turn speaker preserved');
    assert(rehydrated.contextBuffer[1].speaker === 'Andrew', 'Second turn speaker preserved');
    assert(rehydrated.turnSequence === 2, 'Monotonic turn sequence number preserved across restart');
    assert(rehydrated.currentPhase === 'idle', 'Transient phase safely reset to idle upon reboot');
    assert(rehydrated.audioStreamState === 'inactive', 'Transient audio stream state reset to inactive');
    assert(rehydrated.activeSpeaker === 'user', 'Active speaker floor reset to default user');

    // -------------------------------------------------------------------------
    // 2. Strict FSM Phase Transition Validation
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Strict FSM Phase Transition Validation ---');

    assert(Boolean(VALID_PHASE_TRANSITIONS.idle), 'idle phase defined in FSM matrix');
    assert(Boolean(VALID_PHASE_TRANSITIONS.listening), 'listening phase defined in FSM matrix');
    assert(Boolean(VALID_PHASE_TRANSITIONS.thinking), 'thinking phase defined in FSM matrix');
    assert(Boolean(VALID_PHASE_TRANSITIONS.speaking), 'speaking phase defined in FSM matrix');

    // Legal edge: idle -> listening
    const t1 = manager.transitionPhase('listening');
    assert(t1.success === true && manager.getState().currentPhase === 'listening', 'Legal transition: idle -> listening');

    // Legal edge: listening -> thinking
    const t2 = manager.transitionPhase('thinking');
    assert(t2.success === true && manager.getState().currentPhase === 'thinking', 'Legal transition: listening -> thinking');

    // Legal edge: thinking -> speaking
    const t3 = manager.transitionPhase('speaking');
    assert(t3.success === true && manager.getState().currentPhase === 'speaking', 'Legal transition: thinking -> speaking');

    // Legal edge: speaking -> idle
    const t4 = manager.transitionPhase('idle');
    assert(t4.success === true && manager.getState().currentPhase === 'idle', 'Legal transition: speaking -> idle');

    // Illegal leap: idle -> speaking (must throw)
    let illegalThrew = false;
    try {
      manager.transitionPhase('speaking');
    } catch (err: any) {
      illegalThrew = true;
      assert(err.message.includes('Invalid conversation phase transition'), 'Error indicates illegal FSM transition');
    }
    assert(illegalThrew, 'Illegal transition (idle -> speaking) safely rejected by FSM');

    // Audio stream state updates
    manager.setAudioStreamState('capturing');
    assert(manager.getState().audioStreamState === 'capturing', 'AudioStreamState updated to capturing');
    manager.setAudioStreamState('inactive');
    assert(manager.getState().audioStreamState === 'inactive', 'AudioStreamState updated to inactive');

    // -------------------------------------------------------------------------
    // 3. Concurrent Audio-Text Race Condition Mitigation & Turn Locking
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Concurrent Audio-Text Race Condition Mitigation & Turn Locking ---');

    const concurrency = 12;
    const initialSeq = manager.getState().turnSequence;

    // Dispatch concurrent turn additions without await to stress serialized queue
    const promises: Promise<any>[] = [];
    for (let i = 1; i <= concurrency; i++) {
      promises.push(
        manager.appendTurn({
          speaker: i % 2 === 0 ? 'user' : 'Tuk Tuk',
          text: `Concurrent test turn #${i}`,
          metadata: { index: i }
        })
      );
    }

    const results = await Promise.all(promises);
    assert(results.length === concurrency, 'All concurrent turn submissions resolved');

    const finalState = manager.getState();
    assert(
      finalState.turnSequence === initialSeq + concurrency,
      `Strict monotonic turn sequence maintained (${finalState.turnSequence} === ${initialSeq + concurrency})`
    );

    // Verify all turns were sequentially appended into contextBuffer
    assert(
      finalState.contextBuffer.length >= concurrency,
      'ContextBuffer contains all serialized dialogue turns'
    );

    // Test deduplication window: identical turn within 500ms
    const dedup1 = await manager.appendTurn({ speaker: 'user', text: 'Duplicate turn test' });
    const dedup2 = await manager.appendTurn({ speaker: 'user', text: 'Duplicate turn test' });
    assert(dedup1.deduplicated !== true, 'First turn registered normally');
    assert(dedup2.deduplicated === true, 'Rapid duplicate turn within 500ms deduplicated safely');

    // -------------------------------------------------------------------------
    // 4. Exponential Backoff & Rate-Limit Mitigation
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Exponential Backoff & Rate-Limit Mitigation ---');

    // Test backoff calculation formula: min(maxMs, baseMs * 2^(attempt - 1))
    const b1 = manager.calculateBackoff(1, 500, 30000, false);
    assert(b1 === 500, 'Attempt 1 backoff is 500ms');

    const b2 = manager.calculateBackoff(2, 500, 30000, false);
    assert(b2 === 1000, 'Attempt 2 backoff is 1000ms');

    const b3 = manager.calculateBackoff(3, 500, 30000, false);
    assert(b3 === 2000, 'Attempt 3 backoff is 2000ms');

    const bMax = manager.calculateBackoff(10, 500, 5000, false);
    assert(bMax === 5000, 'Backoff caps strictly at maxBackoffMs');

    // Test reportRateLimit and resetRateLimit
    const info1 = manager.reportRateLimit(1200);
    assert(info1.isThrottled === true, 'reportRateLimit sets isThrottled to true');
    assert(info1.backoffMs === 1200, 'Custom backoffMs recorded in rateLimitInfo');
    assert(manager.getState().rateLimitInfo.isThrottled === true, 'State reflects active throttling');

    const infoReset = manager.resetRateLimit();
    assert(infoReset.isThrottled === false, 'resetRateLimit clears throttling');
    assert(infoReset.backoffMs === 0, 'BackoffMs reset to 0');

    // Test executeWithRateLimitRetry with transient 429 failures
    let attemptsCount = 0;
    const mockOperation = async () => {
      attemptsCount++;
      if (attemptsCount < 3) {
        const error: any = new Error('HTTP 429 Too Many Requests: Rate limit exceeded');
        error.status = 429;
        throw error;
      }
      return { success: true, answer: 'Synthesized voice output' };
    };

    const retryResult = await manager.executeWithRateLimitRetry(mockOperation, {
      maxRetries: 4,
      baseBackoffMs: 20,
      maxBackoffMs: 100,
      jitter: false,
      operationName: 'MockLLM'
    });

    assert(attemptsCount === 3, 'executeWithRateLimitRetry retried twice and succeeded on 3rd attempt');
    assert(retryResult.success === true, 'Operation completed successfully through retry wrapper');
    assert(manager.getState().rateLimitInfo.isThrottled === false, 'Throttling automatically cleared on success');

    // -------------------------------------------------------------------------
    // 5. Desktop Electron IPC Bridge Registration & Broadcasts
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Desktop Electron IPC Bridge Registration & Broadcasts ---');

    const registeredHandlers: Record<string, Function> = {};
    const mockIpcMain = {
      handle: (channel: string, handler: Function) => {
        registeredHandlers[channel] = handler;
      }
    };

    const broadcastEvents: Array<{ channel: string; data: any }> = [];
    const mockBroadcaster = {
      broadcast: (channel: string, data: any) => {
        broadcastEvents.push({ channel, data });
      }
    };

    const bridgeManager = registerConversationIpc(mockIpcMain, {
      userDataDir: testDir,
      broadcaster: mockBroadcaster
    });

    assert(Boolean(bridgeManager), 'registerConversationIpc initialized and returned manager instance');
    assert(typeof registeredHandlers['conversation:get-state'] === 'function', 'Registered conversation:get-state handler');
    assert(typeof registeredHandlers['conversation:append-turn'] === 'function', 'Registered conversation:append-turn handler');
    assert(typeof registeredHandlers['conversation:transition-phase'] === 'function', 'Registered conversation:transition-phase handler');
    assert(typeof registeredHandlers['conversation:report-rate-limit'] === 'function', 'Registered conversation:report-rate-limit handler');
    assert(typeof registeredHandlers['conversation:reset-rate-limit'] === 'function', 'Registered conversation:reset-rate-limit handler');
    assert(typeof registeredHandlers['conversation:rehydrate'] === 'function', 'Registered conversation:rehydrate handler');
    assert(typeof registeredHandlers['conversation:set-audio-state'] === 'function', 'Registered conversation:set-audio-state handler');

    // Test invoking handlers through IPC mock
    const ipcState = await registeredHandlers['conversation:get-state']();
    assert(ipcState.turnId !== '', 'conversation:get-state returns valid conversational state');

    const ipcTurnRes = await registeredHandlers['conversation:append-turn'](null, {
      speaker: 'Andrew',
      text: 'IPC turn registration operational'
    });
    assert(ipcTurnRes.success === true, 'conversation:append-turn successfully processed turn');
    assert(ipcTurnRes.turnSeq > 0, 'Turn sequence returned');

    // Test phase transition handler
    const ipcPhaseRes = await registeredHandlers['conversation:transition-phase'](null, 'listening');
    assert(ipcPhaseRes.success === true, 'conversation:transition-phase successfully processed transition');

    // Check that broadcast events were dispatched
    const channelsBroadcasted = broadcastEvents.map(e => e.channel);
    assert(channelsBroadcasted.includes('conversation:state-changed'), 'Broadcasted conversation:state-changed to renderer');
    assert(channelsBroadcasted.includes('conversation:turn-indicator'), 'Broadcasted conversation:turn-indicator to renderer');
    assert(channelsBroadcasted.includes('conversation:phase-changed'), 'Broadcasted conversation:phase-changed to renderer');

    // -------------------------------------------------------------------------
    // 6. Preload Context Isolation & Bridge Whitelisting
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Preload Context Isolation & Bridge Whitelisting ---');

    const preloadSource = fs.readFileSync(path.join(rootDir, 'src/preload.js'), 'utf8');

    assert(preloadSource.includes("contextBridge.exposeInMainWorld('conversationBridge'"), 'Preload exposes window.conversationBridge');
    assert(preloadSource.includes("'conversation:get-state'"), 'Preload bridges conversation:get-state');
    assert(preloadSource.includes("'conversation:append-turn'"), 'Preload bridges conversation:append-turn');
    assert(preloadSource.includes("'conversation:transition-phase'"), 'Preload bridges conversation:transition-phase');
    assert(preloadSource.includes("'conversation:report-rate-limit'"), 'Preload bridges conversation:report-rate-limit');
    assert(preloadSource.includes("'conversation:reset-rate-limit'"), 'Preload bridges conversation:reset-rate-limit');
    assert(preloadSource.includes("'conversation:rehydrate'"), 'Preload bridges conversation:rehydrate');
    assert(preloadSource.includes("'conversation:set-audio-state'"), 'Preload bridges conversation:set-audio-state');
    assert(preloadSource.includes("'conversation:state-changed'"), 'Preload whitelists conversation:state-changed');
    assert(preloadSource.includes("'conversation:turn-indicator'"), 'Preload whitelists conversation:turn-indicator');
    assert(preloadSource.includes("'conversation:phase-changed'"), 'Preload whitelists conversation:phase-changed');
    assert(preloadSource.includes("'conversation:rate-limit-warning'"), 'Preload whitelists conversation:rate-limit-warning');

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/${total} CONVERSATION MANAGER INTEGRATION TESTS PASSED!`);
    console.log('================================================================\n');

  } finally {
    // Cleanup temporary test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (err) {
      // Cleanup error ignored
    }
  }

  process.exit(0);
}

runConversationManagerTests().catch(err => {
  console.error('Test execution failed with unhandled exception:', err);
  process.exit(1);
});
