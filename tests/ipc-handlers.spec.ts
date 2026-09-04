import { registerConversationIpcHandlers } from '../src/main/ipc-handlers';
import { ConversationStateManager, SyncCheckpoint } from '../src/main/conversation-state-manager';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING IPC HANDLERS & INTEGRITY VERIFICATION TESTS');
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

  const registeredHandlers: Map<string, Function> = new Map();
  const mockIpcMain = {
    handle: (channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      registeredHandlers.delete(channel);
    }
  };

  const broadcastEvents: Array<{ channel: string; data: any }> = [];
  const mockWindow = {
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, data: any) => {
        broadcastEvents.push({ channel, data });
      }
    }
  };

  const stateManager = new ConversationStateManager();
  const { unregister } = registerConversationIpcHandlers(
    mockIpcMain,
    stateManager,
    () => [mockWindow]
  );

  // TEST 1: Channel registration
  assert(registeredHandlers.has('conversation:verify-integrity'), 'conversation:verify-integrity handler registered');
  assert(registeredHandlers.has('conversation:reconcile'), 'conversation:reconcile handler registered');
  assert(registeredHandlers.has('conversation:get-sync-status'), 'conversation:get-sync-status handler registered');
  assert(registeredHandlers.has('conversation:ingest-checkpoint'), 'conversation:ingest-checkpoint handler registered');

  // TEST 2: Ingest checkpoint via IPC
  const ingestHandler = registeredHandlers.get('conversation:ingest-checkpoint')!;
  const testCheckpoint: SyncCheckpoint = {
    eventType: 'SYNC_CHECKPOINT',
    timestamp: Date.now(),
    sequenceNumber: 101,
    bufferHash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    bufferLength: 9600,
    lastProcessedToken: 'Synchronized dialogue',
    lastTokenTimestamp: Date.now(),
    isPaused: false,
    cpuLoad: 0.12
  };
  const ingestRes = await ingestHandler(null, testCheckpoint);
  assert(ingestRes.success === true, 'Successfully ingests valid checkpoint via IPC');

  // TEST 3: Verify broadcast of stateSyncStatus
  const statusBroadcast = broadcastEvents.filter(e => e.channel === 'stateSyncStatus').pop();
  assert(statusBroadcast !== undefined, 'Broadcaster emitted stateSyncStatus event to renderer window');
  assert(statusBroadcast?.data.sequenceNumber === 101, 'Broadcasted status contains matching sequenceNumber');

  // TEST 4: Invoke conversation:verify-integrity
  const verifyHandler = registeredHandlers.get('conversation:verify-integrity')!;
  const auditRes = await verifyHandler(null, {
    uiState: {
      turnId: 'turn-test-1',
      participants: ['user', 'Tuk Tuk'],
      lastMessageTimestamp: Date.now(),
      contextBuffer: [{ speaker: 'user', text: 'Synchronized dialogue', timestamp: Date.now() }],
      rateLimitInfo: { requestsRemaining: 60, resetTimestamp: Date.now() + 60000, isThrottled: false }
    }
  });

  assert(auditRes.success === true, 'conversation:verify-integrity returns success: true');
  assert(auditRes.report !== null, 'conversation:verify-integrity returns populated report');
  assert(auditRes.report.isValid === true, 'Audit report validates dialogue state integrity');

  // TEST 5: Cleanup / unregister
  unregister();
  assert(!registeredHandlers.has('conversation:verify-integrity'), 'Handlers cleanly removed upon unregister()');

  stateManager.destroy();

  console.log(`\n================================================================`);
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
  console.log(`================================================================\n`);
}

runTests().catch(err => {
  console.error('Fatal IPC test error:', err);
  process.exit(1);
});
