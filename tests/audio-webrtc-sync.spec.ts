/**
 * Test Suite: WebRTC Audio Stream Chunk Synchronization & Poetry Viewer
 * 
 * Verifies:
 * 1. Monotonic chunk ingestion & stream clock alignment
 * 2. Adaptive jitter buffer handling of out-of-order packets
 * 3. Network packet drop detection and error recovery
 * 4. Frame-accurate poetry verse and word marker dispatch
 * 5. PoetryStreamViewer telemetry and component readiness
 */

// Set up lightweight headless React mock for Node testing environment
const Module = require('module');
const origRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === 'react') {
    return {
      useState: (init: any) => [typeof init === 'function' ? init() : init, () => {}],
      useEffect: () => {},
      useCallback: (fn: any) => fn,
      useMemo: (fn: any) => fn(),
      useRef: (init: any) => ({ current: init }),
      createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children })
    };
  }
  return origRequire.apply(this, arguments);
};

import {
  AudioSyncService,
  AudioChunkMetadata,
  StreamMarker,
  SyncTelemetry,
  TypographyUpdate,
  PoemVerse
} from '../src/services/audioSyncService';

async function runTests() {
  // Dynamically load PoetryStreamViewer after mock React registration
  const { PoetryStreamViewer } = require('../src/renderer/components/PoetryStreamViewer');

  console.log('================================================================');
  console.log('🧪 RUNNING WEBRTC AUDIO SYNC & POETRY RENDERING TEST SUITE');
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

  // Helper to generate a realistic WebRTC chunk
  function createChunk(
    seq: number,
    timestampOffsetMs: number = 0,
    durationMs: number = 20,
    marker?: StreamMarker
  ): AudioChunkMetadata {
    const baseTime = 1700000000000;
    return {
      chunkId: `chunk-${seq}`,
      sequenceNumber: seq,
      timestampMs: baseTime + timestampOffsetMs,
      sampleRate: 48000,
      channels: 1,
      byteLength: 960,
      durationMs,
      checksum: `sha256-mock-${seq}`,
      marker,
      jitterStats: {
        packetDelayMs: 15,
        jitterVarianceMs: 2.5,
        packetsLost: 0,
        outOfOrderCount: 0,
        bufferDepth: 1,
        bufferUnderruns: 0
      }
    };
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Sequential Ingestion & Stream Clock Alignment
  // --------------------------------------------------------------------------
  console.log('--- 1. Monotonic Chunk Sequencing & Stream Clock ---');
  const service = new AudioSyncService('test-session-01', {
    desyncThresholdMs: 40,
    maxJitterWindow: 20
  });

  const c1 = createChunk(1, 0, 20);
  const c2 = createChunk(2, 20, 20);
  const c3 = createChunk(3, 40, 20);

  service.ingestChunk(c1);
  service.ingestChunk(c2);
  service.ingestChunk(c3);

  const telem1 = service.getTelemetry();
  assert(telem1.totalChunksReceived === 3, 'Service tracks 3 chunks received');
  assert(telem1.streamClockMs === 60, 'Stream clock advanced accurately by 60ms');
  assert(telem1.packetsLost === 0, 'Zero packet loss under sequential transmission');
  assert(telem1.outOfOrderCount === 0, 'Zero out-of-order packets under sequential transmission');
  assert(telem1.syncState === 'synchronized', 'State is SYNCHRONIZED');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Jitter Buffer & Out-of-Order Recovery
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Jitter Buffer & Out-of-Order Packet Handling ---');
  // Chunks arrive out of order: 5 arrives before 4
  const c5 = createChunk(5, 80, 20);
  const c4 = createChunk(4, 60, 20);

  service.ingestChunk(c5); // Seq 5 arrives (gap of 4 detected initially)
  const telemAfter5 = service.getTelemetry();
  assert(telemAfter5.packetsLost === 1, 'Initial missing sequence 4 flagged as gap');

  service.ingestChunk(c4); // Seq 4 arrives out-of-order
  const telemAfter4 = service.getTelemetry();
  assert(telemAfter4.outOfOrderCount === 1, 'Out-of-order packet counted accurately');
  assert(telemAfter4.packetsLost === 0, 'Packet loss decremented once out-of-order chunk arrives');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Network Packet Drop Detection & Recovery
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Network Packet Drop Detection & Recovery ---');
  let desyncAlertFired = false;
  let desyncReason = '';

  const unsubDesync = service.onDesyncAlert((deltaMs, reason) => {
    desyncAlertFired = true;
    desyncReason = reason;
  });

  // Chunks 6 and 7 dropped, sequence jumps from 5 to 8
  const c8 = createChunk(8, 140, 20);
  service.ingestChunk(c8);

  assert(desyncAlertFired, 'Desync alert fired upon packet drop gap');
  assert(desyncReason.includes('dropped'), 'Desync reason identifies dropped packets');
  const telemAfterDrop = service.getTelemetry();
  assert(telemAfterDrop.packetsLost === 2, 'Accurately reports 2 lost packets');
  unsubDesync();

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Frame-Accurate Poetic Typography Updates
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Poetic Typography & Frame-Locked Markers ---');
  const poemVerses: PoemVerse[] = [
    {
      verseIndex: 0,
      text: 'Silent circuits dreaming in the deep',
      words: [
        { word: 'Silent', offset: 0 },
        { word: 'circuits', offset: 1 },
        { word: 'dreaming', offset: 2 },
        { word: 'in', offset: 3 },
        { word: 'the', offset: 4 },
        { word: 'deep', offset: 5 }
      ]
    },
    {
      verseIndex: 1,
      text: 'Echoes of a voice that never sleeps',
      words: [
        { word: 'Echoes', offset: 0 },
        { word: 'of', offset: 1 },
        { word: 'a', offset: 2 },
        { word: 'voice', offset: 3 },
        { word: 'that', offset: 4 },
        { word: 'never', offset: 5 },
        { word: 'sleeps', offset: 6 }
      ]
    }
  ];

  let lastMarkerReceived: StreamMarker | null = null;
  let lastTypographyUpdate: TypographyUpdate | null = null;

  service.onMarkerReached(m => {
    lastMarkerReceived = m;
  });

  service.onTypographyUpdate(u => {
    lastTypographyUpdate = u;
  });

  // Chunk with marker for Verse 0, Word 2: "dreaming"
  const marker1: StreamMarker = {
    markerId: 'marker-v0-w2',
    verseIndex: 0,
    wordOffset: 2,
    targetTimestampMs: 1700000000160,
    durationMs: 20,
    text: poemVerses[0].text
  };

  const c9 = createChunk(9, 160, 20, marker1);
  service.ingestChunk(c9);

  assert(lastMarkerReceived !== null, 'Marker listener triggered');
  const receivedMarker = lastMarkerReceived as StreamMarker | null;
  assert(receivedMarker?.markerId === 'marker-v0-w2', 'Correct marker ID delivered');

  // Allow microtask / scheduled animation frame to execute
  await new Promise(r => setTimeout(r, 20));

  assert(lastTypographyUpdate !== null, 'Typography update listener triggered');
  const receivedTypography = lastTypographyUpdate as TypographyUpdate | null;
  assert(receivedTypography?.verseIndex === 0, 'Typography verse index matches');
  assert(receivedTypography?.activeWord === 'dreaming', 'Typography active word is "dreaming"');
  assert(receivedTypography?.wordOffset === 2, 'Typography word offset is 2');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Component Export and Readiness Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 5. PoetryStreamViewer Component Readiness ---');
  assert(typeof PoetryStreamViewer === 'function', 'PoetryStreamViewer component is exported and callable');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} WEBRTC AUDIO SYNC & POETRY TESTS PASSED!`);
  console.log('================================================================\n');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Test suite failed with exception:', err);
  process.exit(1);
});
