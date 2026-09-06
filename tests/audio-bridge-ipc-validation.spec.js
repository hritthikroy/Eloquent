/**
 * tests/audio-bridge-ipc-validation.spec.js
 * 
 * Automated Verification Suite for:
 * 1. AudioBridge Buffer Integrity & Checksum Verification:
 *    - Null, empty, and oversized buffer rejection.
 *    - Accurate CRC32 IEEE 802.3 checksum generation and byte validation.
 * 2. Explicit Stream Error Recovery:
 *    - handleStreamError() logs and formats AudioStatus { status: 'error', latency_ms: -1 }.
 * 3. Channel Name Symmetry & Preload API Surface:
 *    - Strict alignment on 'audio:send-chunk' and 'audio:status'.
 *    - Preload electronAPI.audio.sendChunk and electronAPI.audio.onStatus.
 * 4. Go Audio Server (backend/audio_server.go) Integration:
 *    - Compilation verification of audio_server binary.
 *    - Health check endpoint /health.
 *    - Binary audio frame ingestion with checksum validation.
 *    - Structured JSON status responses ({ status: 'ok' | 'error', latency_ms: number }).
 */

const assert = require('assert');
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const {
  AudioBridge,
  AUDIO_IPC_CHANNELS
} = require('../dist-ts/src/main/audio-bridge');

let totalPassed = 0;
let totalFailed = 0;

async function runTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✅ PASSED: ${testName}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${testName}`);
    console.error(`     Error: ${err.message}`);
    totalFailed++;
  }
}

async function runAllTests() {
  console.log("\n🧪 ===========================================================================");
  console.log("   AUDIO BRIDGE IPC & GO AUDIO SERVER VERIFICATION SUITE");
  console.log("===========================================================================\n");

  // -----------------------------------------------------------------------------
  // TEST GROUP 1: Buffer Integrity & Checksum Verification
  // -----------------------------------------------------------------------------
  console.log("📦 1. AudioBridge Buffer Integrity & Checksum Tests:");

  const bridge = new AudioBridge({ port: 9876, maxChunkSizeBytes: 1024 * 1024 });

  await runTest("Rejects null, undefined, or empty audio buffers", () => {
    const r1 = bridge.validateBuffer(null);
    assert.strictEqual(r1.valid, false);
    assert.ok(r1.error.includes("null or undefined"));

    const r2 = bridge.validateBuffer(Buffer.alloc(0));
    assert.strictEqual(r2.valid, false);
    assert.ok(r2.error.includes("empty"));

    const r3 = bridge.validateBuffer(undefined);
    assert.strictEqual(r3.valid, false);
  });

  await runTest("Rejects buffers exceeding maximum chunk size limit", () => {
    const oversized = Buffer.alloc(1024 * 1024 + 1);
    const res = bridge.validateBuffer(oversized);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes("exceeds maximum size"));
  });

  await runTest("Validates valid audio buffer and computes matching CRC32 IEEE checksum", () => {
    const samplePcm = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x55, 0xAA, 0xFF, 0x00]);
    const res = bridge.validateBuffer(samplePcm);

    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.buffer.length, 8);
    const expectedCrc = zlib.crc32(samplePcm).toString(16).padStart(8, '0');
    assert.strictEqual(res.checksum, expectedCrc, "Checksum must match Node zlib.crc32");
  });

  // -----------------------------------------------------------------------------
  // TEST GROUP 2: Stream Error Recovery & Telemetry Formatting
  // -----------------------------------------------------------------------------
  console.log("\n📦 2. Stream Error Handling & State Synchronization Tests:");

  await runTest("handleStreamError() formats structured AudioStatus error with latency_ms: -1", () => {
    const testErr = new Error("Hardware buffer underrun");
    let errorEventEmitted = false;
    let statusEventEmitted = false;

    bridge.once('error', (e) => {
      if (e.message === testErr.message) errorEventEmitted = true;
    });

    bridge.once('status', (s) => {
      if (s.status === 'error' && s.latency_ms === -1) statusEventEmitted = true;
    });

    const status = bridge.handleStreamError(testErr);

    assert.strictEqual(status.status, 'error');
    assert.strictEqual(status.latency_ms, -1);
    assert.strictEqual(status.message, "Hardware buffer underrun");
    assert.strictEqual(errorEventEmitted, true, "Must emit error event");
    assert.strictEqual(statusEventEmitted, true, "Must emit status event");
  });

  // -----------------------------------------------------------------------------
  // TEST GROUP 3: IPC Channel Parity & Preload API Surface
  // -----------------------------------------------------------------------------
  console.log("\n📦 3. IPC Channel Parity & Preload API Surface Tests:");

  await runTest("IPC channel constants match required specification", () => {
    assert.strictEqual(AUDIO_IPC_CHANNELS.SEND_CHUNK, 'audio:send-chunk');
    assert.strictEqual(AUDIO_IPC_CHANNELS.STATUS, 'audio:status');
    assert.strictEqual(AUDIO_IPC_CHANNELS.GET_STATUS, 'audio:get-status');
  });

  await runTest("Preload script exposes window.electronAPI.audio API surface", () => {
    const preloadSource = fs.readFileSync(path.join(__dirname, '../src/preload/index.ts'), 'utf8');
    assert.ok(preloadSource.includes('audio:'), "Preload must define audio object in electronAPI");
    assert.ok(preloadSource.includes('sendChunk:'), "Preload must expose sendChunk method");
    assert.ok(preloadSource.includes('onStatus:'), "Preload must expose onStatus listener");
    assert.ok(preloadSource.includes('AUDIO_IPC_CHANNELS.SEND_CHUNK'), "Preload must bind to SEND_CHUNK channel");
    assert.ok(preloadSource.includes('AUDIO_IPC_CHANNELS.STATUS'), "Preload must bind to STATUS channel");
  });

  // -----------------------------------------------------------------------------
  // TEST GROUP 4: Go Audio Server Integration & Checksum Validation
  // -----------------------------------------------------------------------------
  console.log("\n📦 4. Go Audio Server Backend Execution Tests:");

  const binaryPath = path.join(__dirname, '../audio_server');
  assert.ok(fs.existsSync(binaryPath), `Binary must exist at ${binaryPath}`);

  const testPort = 9888;
  let goProcess = null;

  try {
    // Launch Go server on test port
    goProcess = spawn(binaryPath, ['--port', String(testPort)], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server readiness
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const req = http.get(`http://127.0.0.1:${testPort}/health`, { timeout: 500 }, (res) => {
          if (res.statusCode === 200) {
            clearInterval(interval);
            resolve();
          }
        });
        req.on('error', () => {
          if (attempts >= 25) {
            clearInterval(interval);
            reject(new Error("Go server failed to start within timeout"));
          }
        });
      }, 100);
    });

    await runTest("Go /health endpoint returns structured status ok", async () => {
      const healthData = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${testPort}/health`, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });

      assert.strictEqual(healthData.status, 'ok');
      assert.strictEqual(healthData.ready, true);
      assert.ok(typeof healthData.uptime_ms === 'number');
    });

    await runTest("AudioBridge transmits audio frame to Go server and receives latency telemetry", async () => {
      const liveBridge = new AudioBridge({ port: testPort });
      const frame = Buffer.alloc(1920, 0x7F);

      const status = await liveBridge.sendAudioChunk(frame);

      assert.strictEqual(status.status, 'ok');
      assert.ok(status.latency_ms >= 0, `Latency must be non-negative, got: ${status.latency_ms}`);
      assert.strictEqual(status.bytesReceived, 1920);
      assert.ok(status.message.includes("verified"));
    });

    await runTest("Go server rejects frame with invalid/corrupt checksum", async () => {
      const frame = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const invalidChecksum = "deadbeef";

      const res = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: testPort,
          path: '/audio/chunk',
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': frame.length,
            'X-Audio-Checksum': invalidChecksum
          }
        }, (resp) => {
          let data = '';
          resp.on('data', (c) => { data += c; });
          resp.on('end', () => resolve({ statusCode: resp.statusCode, body: JSON.parse(data) }));
        });
        req.on('error', reject);
        req.write(frame);
        req.end();
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.status, 'error');
      assert.ok(res.body.message.includes("Checksum validation failed"));
    });

    await runTest("Go server rejects empty audio frame", async () => {
      const res = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: testPort,
          path: '/audio/chunk',
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': 0
          }
        }, (resp) => {
          let data = '';
          resp.on('data', (c) => { data += c; });
          resp.on('end', () => resolve({ statusCode: resp.statusCode, body: JSON.parse(data) }));
        });
        req.on('error', reject);
        req.end();
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.status, 'error');
      assert.ok(res.body.message.includes("Empty audio chunk"));
    });

    await runTest("Go /audio/status endpoint reports accurate ingestion counts", async () => {
      const statusData = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${testPort}/audio/status`, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });

      assert.strictEqual(statusData.status, 'ok');
      assert.ok(statusData.frames_ingested >= 1, "Must have ingested at least 1 frame");
      assert.ok(statusData.bytes_ingested >= 1920, "Must have ingested bytes");
    });

  } finally {
    if (goProcess) {
      try {
        goProcess.kill('SIGTERM');
      } catch (_) {}
    }
  }

  console.log("\n===========================================================================");
  console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("===========================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log("🌟 AUDIO BRIDGE IPC & GO AUDIO SERVER 100% VERIFIED!\n");
  }
}

runAllTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
