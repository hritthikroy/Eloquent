/**
 * Integration Test Suite: Antiquity Proxy & Microservices Layer
 *
 * Tests:
 * 1. Strict JSON Schema validation and rejection of invalid payloads
 * 2. Token authentication enforcement and handshake negotiation
 * 3. Pure stateless microservice execution (legacy-parser, audio-bridge)
 * 4. High-concurrency stress testing
 * 5. Latency overhead verification (< 5ms SLA budget)
 * 6. IPC channel initialization and handshake flow
 */

'use strict';

const assert = require('assert');
const { performance } = require('perf_hooks');
const { AntiquityToolRouter, defaultRouter, validateSchema } = require('../src/proxy/tool-router');
const { initializeAntiquityProxy } = require('../src/main/electron/main');
const legacyParser = require('../services/antiquity-microservices/legacy-parser');
const audioBridge = require('../services/antiquity-microservices/audio-bridge');

async function runTestSuite() {
  console.log('🧪 Starting Antiquity Tooling Layer & Proxy Test Suite...\n');
  let passedTests = 0;
  let totalTests = 0;

  function record(name, passed, detail = '') {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`  ✅ [PASS] ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`  ❌ [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  const testAuthToken = 'eloquent-antiquity-secure-token-2026';
  const router = new AntiquityToolRouter({ tokens: [testAuthToken] });

  // ── TEST 1: Strict JSON Schema Validator ──────────────────────────────────
  console.log('1. Schema Validation Tests');
  {
    // Valid legacy-parser payload
    const validReq = {
      tool: 'legacy-parser',
      authToken: testAuthToken,
      requestId: 'req-valid-001',
      payload: {
        rawContent: '[USER: Hritthik]\n[APP: Eloquent]',
        format: 'v1',
      },
    };
    const res = validateSchema(validReq);
    record('Valid legacy-parser request passes schema check', res.valid);

    // Missing required field "tool"
    const missingTool = {
      authToken: testAuthToken,
      requestId: 'req-002',
      payload: {},
    };
    const resMissing = validateSchema(missingTool);
    record('Missing tool field is rejected by schema validator', !resMissing.valid && resMissing.errors.some((e) => e.includes('tool')));

    // Invalid format enum
    const badFormat = {
      tool: 'legacy-parser',
      authToken: testAuthToken,
      requestId: 'req-003',
      payload: {
        rawContent: 'content',
        format: 'unsupported-format-xyz',
      },
    };
    const resBad = validateSchema(badFormat);
    record('Invalid format enum is rejected by schema validator', !resBad.valid && resBad.errors.some((e) => e.includes('format')));

    // Invalid authToken length (< 16 chars)
    const shortToken = {
      tool: 'legacy-parser',
      authToken: 'short',
      requestId: 'req-004',
      payload: {
        rawContent: 'data',
        format: 'v1',
      },
    };
    const resToken = validateSchema(shortToken);
    record('Short auth token is rejected by schema validator', !resToken.valid && resToken.errors.some((e) => e.includes('authToken')));
  }

  // ── TEST 2: Authentication Security & Token Handshake ─────────────────────
  console.log('\n2. Authentication Security Tests');
  {
    // Unauthorized token
    const unauthReq = {
      tool: 'legacy-parser',
      authToken: 'unauthorized-token-long-enough-123',
      requestId: 'req-unauth-001',
      payload: {
        rawContent: 'test data',
        format: 'v1',
      },
    };
    const unauthRes = await router.routeToolInvocation(unauthReq);
    record('Unauthorized token rejected with AUTHENTICATION_FAILED', !unauthRes.success && unauthRes.error.code === 'AUTHENTICATION_FAILED');

    // Dynamic session handshake
    const sessionToken = router.generateSessionHandshake('test-runner');
    record('Handshake generates valid session token with minimum length', typeof sessionToken === 'string' && sessionToken.length >= 16);

    const authorizedReq = {
      tool: 'legacy-parser',
      authToken: sessionToken,
      requestId: 'req-session-001',
      payload: {
        rawContent: 'test data',
        format: 'custom',
      },
    };
    const authRes = await router.routeToolInvocation(authorizedReq);
    record('Dynamically negotiated session token successfully authorizes invocation', authRes.success);
  }

  // ── TEST 3: Pure Stateless Microservices ──────────────────────────────────
  console.log('\n3. Pure Stateless Microservices Tests');
  {
    // legacy-parser: V1 format
    const v1Res = await legacyParser.execute({
      rawContent: '[SPEAKER: Ava]\n[CONFIDENCE: 0.98]',
      format: 'v1',
    });
    record('legacy-parser correctly extracts v1 key-value pairs', v1Res.parsed && v1Res.output.SPEAKER === 'Ava');

    // legacy-parser: XML format
    const xmlRes = await legacyParser.execute({
      rawContent: '<audio><codec>pcm16</codec><sampleRate>24000</sampleRate></audio>',
      format: 'xml',
    });
    record('legacy-parser correctly parses XML tags into JSON', xmlRes.output.codec === 'pcm16' && xmlRes.output.sampleRate === '24000');

    // legacy-parser: CSV format
    const csvRes = await legacyParser.execute({
      rawContent: 'id,command\n1,transcribe\n2,translate',
      format: 'csv',
    });
    record('legacy-parser correctly parses CSV records', Array.isArray(csvRes.output) && csvRes.output.length === 2 && csvRes.output[0].command === 'transcribe');

    // audio-bridge: Normalization & RMS analysis
    // Synthesize 100 samples of known 16-bit PCM amplitude
    const pcmSamples = new Int16Array(100);
    for (let i = 0; i < 100; i++) pcmSamples[i] = 16000;
    const base64Audio = Buffer.from(pcmSamples.buffer).toString('base64');

    const audioRes = await audioBridge.execute({
      action: 'normalize',
      audioData: base64Audio,
      sampleRate: 24000,
      channels: 1,
    });
    record('audio-bridge computes normalization and RMS amplitude', audioRes.success && audioRes.result.normalized && audioRes.result.stats.peak > 0);

    // audio-bridge: Stream metadata calculation
    const metaRes = await audioBridge.execute({
      action: 'stream_metadata',
      audioData: base64Audio,
      sampleRate: 24000,
      channels: 1,
    });
    record('audio-bridge computes accurate stream metadata', metaRes.result.sampleRate === 24000 && metaRes.result.totalSamples === 100);
  }

  // ── TEST 4: IPC Channel Registration & Mock Transport ────────────────────
  console.log('\n4. IPC Architecture Tests');
  {
    const mockHandlers = new Map();
    const mockIpc = {
      handle: (channel, handler) => {
        mockHandlers.set(channel, handler);
      },
    };

    const initResult = initializeAntiquityProxy(mockIpc, router);
    record('initializeAntiquityProxy registers all 4 expected channels', initResult.channels.length === 4 && mockHandlers.has('antiquity:invoke'));

    // Test IPC handshake invocation
    const handshakeHandler = mockHandlers.get('antiquity:handshake');
    const handshakeRes = await handshakeHandler(null, { clientId: 'renderer-test' });
    record('IPC antiquity:handshake returns valid authToken and tools list', handshakeRes.ok && handshakeRes.authToken && handshakeRes.registeredTools.length > 0);

    // Test IPC invoke via negotiated token
    const invokeHandler = mockHandlers.get('antiquity:invoke');
    const invokeRes = await invokeHandler(null, {
      tool: 'legacy-parser',
      authToken: handshakeRes.authToken,
      requestId: 'ipc-req-001',
      payload: {
        rawContent: 'NAME=Eloquent',
        format: 'v1',
      },
    });
    record('IPC antiquity:invoke processes tool request successfully', invokeRes.success && invokeRes.data.parsed);
  }

  // ── TEST 5: High-Concurrency Stress & Latency SLA Verification ────────────
  console.log('\n5. High Concurrency Stress & Latency Overhead SLA (< 5ms)');
  {
    const CONCURRENCY_COUNT = 150;
    const concurrentSessionToken = router.generateSessionHandshake('stress-runner');

    const tasks = [];
    const t0 = performance.now();

    for (let i = 0; i < CONCURRENCY_COUNT; i++) {
      const isParser = i % 2 === 0;
      const req = isParser
        ? {
            tool: 'legacy-parser',
            authToken: concurrentSessionToken,
            requestId: `req-stress-${i}`,
            payload: {
              rawContent: `item_${i}=value_${i}\nstatus=ok`,
              format: 'v1',
            },
          }
        : {
            tool: 'audio-bridge',
            authToken: concurrentSessionToken,
            requestId: `req-stress-${i}`,
            payload: {
              action: 'stream_metadata',
              audioData: Buffer.from(new Int16Array(50).fill(1000).buffer).toString('base64'),
              sampleRate: 24000,
              channels: 1,
            },
          };

      tasks.push(router.routeToolInvocation(req));
    }

    const results = await Promise.all(tasks);
    const totalWallDurationMs = performance.now() - t0;

    const allPassed = results.every((r) => r.success === true);
    record(`150 concurrent requests all processed with zero failures`, allPassed, `Total batch wall time: ${Math.round(totalWallDurationMs)}ms`);

    // Verify proxy overhead metrics
    const health = router.getHealthStatus();
    const avgOverhead = health.metrics.avgProxyOverheadMs;
    const maxOverhead = health.metrics.maxProxyOverheadMs;

    record(`Average proxy overhead is under 5.0ms SLA budget`, avgOverhead < 5.0, `Observed avg overhead: ${avgOverhead}ms`);
    record(`Peak proxy overhead is recorded and within acceptable bounds`, maxOverhead < 50.0, `Observed peak: ${maxOverhead}ms`);
    record(`Telemetry accurately tracks total throughput`, health.metrics.totalRequests >= 150);
  }

  console.log(`\n🎉 All ${passedTests}/${totalTests} Antiquity Tooling Layer tests completed successfully!`);
}

runTestSuite().catch((err) => {
  console.error('\n❌ Unhandled test failure:', err);
  process.exit(1);
});
