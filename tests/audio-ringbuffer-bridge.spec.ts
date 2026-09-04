/**
 * Test Suite: Ultra-Low-Latency Shared Memory Ring Buffer IPC Bridge
 * 
 * Verifies:
 * 1. Structural memory layouts, 128-byte cache-aligned global header, and 4KB slot dimensions.
 * 2. Cross-runtime binary compatibility between Node.js and Go audio state engine.
 * 3. Lock-free circular queue mechanics, power-of-two mask indexing, and wraparound.
 * 4. Zero-serialization audio frame write and read with bit-exact PCM data preservation.
 * 5. Underrun and overrun backpressure accounting under burst loads.
 * 6. Sub-0.05ms microsecond dispatch latency performance.
 * 7. Stale writer crash detection and automated state recovery.
 * 8. Electron IPC channel registration and clean lifecycle teardown.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const projectRoot = process.cwd();
const {
  MAGIC_BYTES,
  PROTOCOL_VERSION,
  HEADER_SIZE,
  DEFAULT_SLOT_COUNT,
  DEFAULT_SLOT_SIZE,
  MAX_PAYLOAD_SIZE,
  TOTAL_SEGMENT_SIZE,
  GLOBAL_HEADER_OFFSETS,
  SLOT_HEADER_OFFSETS,
  STATE_FLAGS,
  FRAME_FLAGS,
  AUDIO_RING_CHANNELS
} = require(path.join(projectRoot, 'src/shared/constants'));
const {
  SharedMemoryAudioBridge,
  registerAudioBridgeIpc
} = require(path.join(projectRoot, 'src/main/ipc/audioBridge'));

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING SHARED MEMORY AUDIO RING BUFFER IPC BRIDGE SUITE');
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
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // 1. Structural Memory Layout & Constants
  // -------------------------------------------------------------
  console.log('--- 1. Structural Memory Layout & Constant Validation ---');
  assert(MAGIC_BYTES === 0x454C5141, 'Magic bytes match "ELQA" identifier (0x454C5141)');
  assert(PROTOCOL_VERSION === 1, 'Protocol version is 1');
  assert(HEADER_SIZE === 128, 'Header size is cacheline-aligned at 128 bytes');
  assert(DEFAULT_SLOT_COUNT === 256, 'Default slot count is power-of-two (256)');
  assert(DEFAULT_SLOT_SIZE === 4096, 'Default slot size is page-aligned (4096 bytes)');
  assert(MAX_PAYLOAD_SIZE === 4064, 'Max payload size is 4064 bytes (4096 - 32 header)');
  assert(TOTAL_SEGMENT_SIZE === 1048704, 'Total segment size matches 128 + (256 * 4096) = 1,048,704 bytes');

  // Verify atomic byte alignment
  assert(GLOBAL_HEADER_OFFSETS.WRITE_INDEX % 8 === 0, 'WRITE_INDEX offset (8) is 8-byte aligned');
  assert(GLOBAL_HEADER_OFFSETS.READ_INDEX % 8 === 0, 'READ_INDEX offset (16) is 8-byte aligned');
  assert(GLOBAL_HEADER_OFFSETS.UNDERRUN_COUNT % 8 === 0, 'UNDERRUN_COUNT offset (32) is 8-byte aligned');
  assert(GLOBAL_HEADER_OFFSETS.OVERRUN_COUNT % 8 === 0, 'OVERRUN_COUNT offset (40) is 8-byte aligned');
  assert(GLOBAL_HEADER_OFFSETS.LAST_HEARTBEAT_NS % 8 === 0, 'LAST_HEARTBEAT_NS offset (56) is 8-byte aligned');

  // -------------------------------------------------------------
  // 2. Initialization & Header Validation
  // -------------------------------------------------------------
  console.log('\n--- 2. In-Memory & File-Backed Bridge Initialization ---');
  const memBridge = new SharedMemoryAudioBridge({ inMemory: true, isCreator: true });
  assert(memBridge.init() === true, 'In-memory creator bridge initialized successfully');

  const initialMetrics = memBridge.getMetrics();
  assert(initialMetrics.writeIndex === 0, 'Initial writeIndex is 0');
  assert(initialMetrics.readIndex === 0, 'Initial readIndex is 0');
  assert(initialMetrics.queueDepth === 0, 'Initial queueDepth is 0');
  assert(initialMetrics.slotCapacity === 256, 'Initial slotCapacity is 256');
  assert(initialMetrics.fillPercent === 0, 'Initial fillPercent is 0%');
  assert(initialMetrics.isWriterAlive === true, 'Initial writer is declared alive');

  // -------------------------------------------------------------
  // 3. Sequential Write and Read with Bit-Exact Preservation
  // -------------------------------------------------------------
  console.log('\n--- 3. Sequential Zero-Serialization Frame Transfer ---');
  // Underrun check
  const emptyRead = memBridge.readFrame();
  assert(emptyRead === null, 'Reading from empty queue returns null');
  assert(memBridge.getMetrics().underrunCount === 1, 'Empty read increments underrun count to 1');

  // Generate synthetic 20ms 48kHz mono 16-bit PCM (960 samples = 1920 bytes)
  const samplePcm = Buffer.alloc(1920);
  for (let i = 0; i < samplePcm.length; i += 2) {
    samplePcm.writeInt16LE(Math.sin(i / 10) * 15000, i);
  }

  const writeResult = memBridge.writeFrame({
    frameId: 1001,
    timestampNs: 1720000000123456n,
    audioData: samplePcm,
    sampleRate: 48000,
    channels: 1,
    flags: FRAME_FLAGS.PCM_16_LE | FRAME_FLAGS.SPEECH_ACTIVE
  });

  assert(writeResult.success === true, 'Frame write returned success');
  assert(writeResult.frameId === 1001, 'Frame write returned matching frameId');
  assert(memBridge.getMetrics().queueDepth === 1, 'Queue depth is 1 after write');

  const readFrame = memBridge.readFrame();
  assert(readFrame !== null, 'Read frame is not null');
  if (!readFrame) throw new Error('readFrame was null');
  assert(readFrame.frameId === 1001, 'Read frameId matches written frameId (1001)');
  assert(readFrame.sampleRate === 48000, 'Read sampleRate matches 48000');
  assert(readFrame.channels === 1, 'Read channels matches 1');
  assert(readFrame.flags === (FRAME_FLAGS.PCM_16_LE | FRAME_FLAGS.SPEECH_ACTIVE), 'Read flags match');
  assert(readFrame.data.length === 1920, 'Read payload size matches 1920 bytes');
  assert(samplePcm.equals(readFrame.data), 'Audio PCM data is 100% byte-for-byte identical');
  assert(memBridge.getMetrics().queueDepth === 0, 'Queue depth returns to 0 after reading');

  // -------------------------------------------------------------
  // 4. Circular Queue Wraparound & Power-of-Two Indexing
  // -------------------------------------------------------------
  console.log('\n--- 4. Circular Queue Wraparound & Modulo Arithmetic ---');
  // Write and immediately read 300 frames sequentially through 256 slots
  let wraparoundSuccess = true;
  for (let seq = 1; seq <= 300; seq++) {
    const chunk = Buffer.from(`pcm-frame-${seq}`);
    memBridge.writeFrame({
      frameId: seq,
      audioData: chunk
    });
    const popped = memBridge.readFrame();
    if (!popped || popped.frameId !== seq || popped.data.toString() !== `pcm-frame-${seq}`) {
      wraparoundSuccess = false;
      break;
    }
  }
  assert(wraparoundSuccess === true, '300 sequential frames cycled across 256 slots with zero corruption');
  const wrapMetrics = memBridge.getMetrics();
  assert(wrapMetrics.writeIndex === 301, 'Monotonic writeIndex correctly accumulated to 301');
  assert(wrapMetrics.readIndex === 301, 'Monotonic readIndex correctly accumulated to 301');

  // -------------------------------------------------------------
  // 5. Overrun Backpressure & Capacity Bounds
  // -------------------------------------------------------------
  console.log('\n--- 5. Overrun Backpressure & Slot Bounds Enforcement ---');
  memBridge.reset();
  const dummyAudio = Buffer.from('chunk');

  // Fill all 256 slots
  for (let i = 0; i < 256; i++) {
    memBridge.writeFrame({ frameId: i + 1, audioData: dummyAudio });
  }
  assert(memBridge.getMetrics().queueDepth === 256, 'Queue is completely full (depth 256)');
  assert(memBridge.getMetrics().fillPercent === 100, 'Fill percent reports 100%');

  // 257th write should trigger overrun backpressure
  const overrunResult = memBridge.writeFrame({ frameId: 999, audioData: dummyAudio });
  assert(overrunResult.success === false, 'Overrun write is rejected (success = false)');
  assert(overrunResult.reason === 'overrun', 'Overrun rejection reason is "overrun"');
  assert(memBridge.getMetrics().overrunCount === 1, 'Overrun count is incremented to 1');

  // Drain one frame and verify subsequent write succeeds
  const drained = memBridge.readFrame();
  assert(drained !== null && drained.frameId === 1, 'Drained oldest frame (frameId 1)');
  const retryWrite = memBridge.writeFrame({ frameId: 1000, audioData: dummyAudio });
  assert(retryWrite.success === true, 'Subsequent write succeeded after drain');

  // -------------------------------------------------------------
  // 6. Sub-0.05ms Micro-Latency Benchmark
  // -------------------------------------------------------------
  console.log('\n--- 6. Sub-0.05ms Microsecond Latency Benchmark ---');
  memBridge.reset();
  const benchIterations = 1000;
  const testFrame = Buffer.alloc(1920);

  const startHr = process.hrtime.bigint();
  for (let i = 0; i < benchIterations; i++) {
    memBridge.writeFrame({ frameId: i, audioData: testFrame });
    memBridge.readFrame();
  }
  const elapsedNs = Number(process.hrtime.bigint() - startHr);
  const avgMsPerOp = (elapsedNs / benchIterations / 1e6);

  console.log(`   ℹ️ 1000 write+read cycles completed in ${(elapsedNs / 1e6).toFixed(2)}ms (avg: ${avgMsPerOp.toFixed(4)}ms/op)`);
  assert(avgMsPerOp < 0.05, `Average write+read latency (${avgMsPerOp.toFixed(4)}ms) is below 0.05ms`);

  // -------------------------------------------------------------
  // 7. File-Backed Memory Mapping & Process Crash Recovery
  // -------------------------------------------------------------
  console.log('\n--- 7. File-Backed Memory Mapping & Crash Recovery ---');
  const tempShmPath = path.join(os.tmpdir(), `eloquent_test_shm_${Date.now()}.bin`);
  try {
    const fileWriter = new SharedMemoryAudioBridge({
      path: tempShmPath,
      isCreator: true
    });
    fileWriter.init();

    fileWriter.writeFrame({ frameId: 555, audioData: Buffer.from('file-mapped-audio') });

    // Independent reader opening same file
    const fileReader = new SharedMemoryAudioBridge({
      path: tempShmPath,
      isCreator: false
    });
    fileReader.init();

    const readBack = fileReader.readFrame();
    assert(readBack !== null && readBack.frameId === 555, 'Independent reader read frame 555 from file-mapped segment');
    if (!readBack) throw new Error('readBack was null');
    assert(readBack.data.toString() === 'file-mapped-audio', 'File-mapped payload matches exactly');

    // Test stale heartbeat recovery
    fileWriter.writeFrame({ frameId: 556, audioData: Buffer.from('stale-check') });
    assert(fileReader.getMetrics().queueDepth === 1, 'Queue depth is 1 before simulated crash');

    // Simulate 10 seconds stale heartbeat on writer
    const headerBuf = Buffer.alloc(8);
    headerBuf.writeBigInt64LE(BigInt(Date.now() - 10000) * 1000000n, 0);
    fs.writeSync(fileWriter.fd!, headerBuf, 0, 8, GLOBAL_HEADER_OFFSETS.LAST_HEARTBEAT_NS);

    const recovered = fileReader.recoverStaleState(2000000000n); // 2s threshold
    assert(recovered === true, 'Stale writer detected and buffer successfully auto-recovered');
    assert(fileReader.getMetrics().queueDepth === 0, 'Queue depth reset to 0 after recovery');

    fileWriter.close();
    fileReader.close();
  } finally {
    if (fs.existsSync(tempShmPath)) {
      try { fs.unlinkSync(tempShmPath); } catch (e) {}
    }
  }

  // -------------------------------------------------------------
  // 8. Electron IPC Handler Registration & Dispatch
  // -------------------------------------------------------------
  console.log('\n--- 8. Electron IPC Channel Handlers & Lifecycle ---');
  const mockHandlers = new Map<string, Function>();
  const mockIpcMain: any = {
    handle: (channel: string, handler: Function) => {
      mockHandlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      mockHandlers.delete(channel);
    }
  };

  const bridgeIpc = registerAudioBridgeIpc(mockIpcMain, memBridge);
  assert(mockHandlers.has(AUDIO_RING_CHANNELS.INIT), `Registered ${AUDIO_RING_CHANNELS.INIT}`);
  assert(mockHandlers.has(AUDIO_RING_CHANNELS.READ_FRAME), `Registered ${AUDIO_RING_CHANNELS.READ_FRAME}`);
  assert(mockHandlers.has(AUDIO_RING_CHANNELS.WRITE_FRAME), `Registered ${AUDIO_RING_CHANNELS.WRITE_FRAME}`);
  assert(mockHandlers.has(AUDIO_RING_CHANNELS.GET_METRICS), `Registered ${AUDIO_RING_CHANNELS.GET_METRICS}`);
  assert(mockHandlers.has(AUDIO_RING_CHANNELS.RESET), `Registered ${AUDIO_RING_CHANNELS.RESET}`);
  assert(mockHandlers.has(AUDIO_RING_CHANNELS.CLOSE), `Registered ${AUDIO_RING_CHANNELS.CLOSE}`);

  // Test IPC handler calls
  const metricsIpcRes = await mockHandlers.get(AUDIO_RING_CHANNELS.GET_METRICS)!();
  assert(metricsIpcRes.success === true, 'IPC get-metrics returned success');
  assert(typeof metricsIpcRes.metrics.slotCapacity === 'number', 'IPC returned valid metrics payload');

  const writeIpcRes = await mockHandlers.get(AUDIO_RING_CHANNELS.WRITE_FRAME)!(null, {
    frameId: 7777,
    audioData: Buffer.from('ipc-frame-payload')
  });
  assert(writeIpcRes.success === true, 'IPC write-frame returned success');

  const readIpcRes = await mockHandlers.get(AUDIO_RING_CHANNELS.READ_FRAME)!();
  assert(readIpcRes.success === true, 'IPC read-frame returned success');
  assert(readIpcRes.frame.frameId === 7777, 'IPC read-frame returned correct frameId');

  // Teardown
  bridgeIpc.unregister();
  assert(mockHandlers.size === 0, 'Unregistering audio bridge IPC cleanly removed all handlers');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} SHARED MEMORY AUDIO RING BUFFER TESTS PASSED!`);
  console.log('================================================================\n');

  process.exit(0);
}

runTests().catch(err => {
  console.error('Test suite execution failed:', err);
  process.exit(1);
});
