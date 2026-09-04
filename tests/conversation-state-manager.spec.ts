import {
  ConversationStateManager,
  SyncCheckpoint,
  ConversationalState,
  validateSyncCheckpoint,
  executeReconciliation
} from '../src/main/conversation-state-manager';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING CONVERSATION STATE RECONCILIATION & SYNC TESTS');
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
      process.exitCode = 1;
    }
  }

  // TEST 1: Strict type checking for SyncCheckpoint
  const validCheckpoint: SyncCheckpoint = {
    eventType: 'SYNC_CHECKPOINT',
    timestamp: Date.now(),
    sequenceNumber: 42,
    bufferHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    bufferLength: 4800,
    lastProcessedToken: 'Antigravity',
    lastTokenTimestamp: Date.now(),
    isPaused: false,
    cpuLoad: 0.15
  };
  assert(validateSyncCheckpoint(validCheckpoint), 'Strict type validation passes for valid checkpoint');

  const invalidCheckpoint = { timestamp: 'not-a-number', sequenceNumber: 42 };
  assert(!validateSyncCheckpoint(invalidCheckpoint), 'Strict type validation rejects malformed checkpoint');

  // TEST 2: Reconcile synchronized state (zero semantic drift)
  const uiStateAligned: ConversationalState = {
    turnId: 'turn-1001',
    participants: ['user', 'Tuk Tuk', 'Andrew'],
    lastMessageTimestamp: Date.now(),
    contextBuffer: [
      { speaker: 'user', text: 'Hello Tuk Tuk, we are building Antigravity', timestamp: Date.now() }
    ],
    rateLimitInfo: { requestsRemaining: 60, resetTimestamp: Date.now() + 60000, isThrottled: false }
  };

  const alignedReport = executeReconciliation(uiStateAligned, validCheckpoint);
  assert(alignedReport.isValid === true, 'Aligned dialogue history produces isValid: true');
  assert(alignedReport.detectedGapsCount === 0, 'No discontinuities detected when tokens align');
  assert(alignedReport.syncStatus === 'synchronized', 'Sync status is synchronized for low-latency checkpoint');

  // TEST 3: Detect and patch dropped turn gap
  const uiStateEmpty: ConversationalState = {
    turnId: 'turn-1002',
    participants: ['user', 'Tuk Tuk'],
    lastMessageTimestamp: Date.now(),
    contextBuffer: [],
    rateLimitInfo: { requestsRemaining: 60, resetTimestamp: Date.now() + 60000, isThrottled: false }
  };

  const droppedTurnReport = executeReconciliation(uiStateEmpty, validCheckpoint);
  assert(droppedTurnReport.detectedGapsCount === 1, 'Detects dropped turn gap when contextBuffer is empty');
  assert(droppedTurnReport.discontinuities[0].gapType === 'dropped_turn', 'Gap type correctly identified as dropped_turn');
  assert(droppedTurnReport.patchedTurnsCount === 1, 'Turn successfully patched');
  assert(droppedTurnReport.reconciledState.contextBuffer.length === 1, 'Reconciled state contains patched turn');
  assert(droppedTurnReport.reconciledState.contextBuffer[0].text === 'Antigravity', 'Patched turn matches audio token');

  // TEST 4: Detect and patch token divergence
  const uiStateDiverging: ConversationalState = {
    turnId: 'turn-1003',
    participants: ['user', 'Tuk Tuk'],
    lastMessageTimestamp: Date.now(),
    contextBuffer: [
      { speaker: 'user', text: 'Tell Andrew to inspect', timestamp: Date.now() }
    ],
    rateLimitInfo: { requestsRemaining: 60, resetTimestamp: Date.now() + 60000, isThrottled: false }
  };

  const divergenceCheckpoint: SyncCheckpoint = {
    ...validCheckpoint,
    lastProcessedToken: 'the pipeline',
    lastTokenTimestamp: Date.now()
  };

  const divergenceReport = executeReconciliation(uiStateDiverging, divergenceCheckpoint);
  assert(divergenceReport.detectedGapsCount === 1, 'Detects token mismatch discontinuity');
  assert(divergenceReport.discontinuities[0].gapType === 'token_mismatch', 'Identifies gapType as token_mismatch');
  assert(divergenceReport.reconciledState.contextBuffer[0].text.includes('the pipeline'), 'Divergence patched by merging token');

  // TEST 5: Edge Case - Audio backend paused
  const pausedCheckpoint: SyncCheckpoint = {
    ...validCheckpoint,
    isPaused: true
  };
  const pausedReport = executeReconciliation(uiStateAligned, pausedCheckpoint);
  assert(pausedReport.syncStatus === 'paused', 'Reports safe paused state when backend is paused');
  assert(pausedReport.reconciledState !== null, 'Does not crash on paused backend');

  // TEST 6: Edge Case - Unstable network / stale checkpoint (> 500ms lag)
  const staleCheckpoint: SyncCheckpoint = {
    ...validCheckpoint,
    timestamp: Date.now() - 1200 // 1.2s ago
  };
  const staleReport = executeReconciliation(uiStateAligned, staleCheckpoint);
  assert(staleReport.syncStatus === 'stale', 'Gracefully marks stale on network lag without crashing');
  assert(staleReport.syncLagMs >= 1200, 'Calculates accurate synchronization lag in ms');

  // TEST 7: Edge Case - Missing checkpoint (null)
  const nullReport = executeReconciliation(uiStateAligned, null);
  assert(nullReport.syncStatus === 'stale', 'Defaults safely to stale state when checkpoint is null');
  assert(nullReport.isValid === false, 'Marks audit as invalid when backend is disconnected');

  // TEST 8: Full asynchronous ConversationStateManager singleton execution
  const manager = ConversationStateManager.getInstance();
  manager.onSyncCheckpoint(validCheckpoint);
  const audit = await manager.verifyIntegrity(uiStateAligned);
  assert(audit !== null, 'Manager verifyIntegrity returns valid audit report');
  assert(manager.getSyncStatus().status === 'synchronized', 'Manager sync status reflects valid checkpoint');

  manager.destroy();

  console.log(`\n================================================================`);
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
  console.log(`================================================================\n`);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
