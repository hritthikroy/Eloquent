/**
 * test/unit/audio-config-ipc.test.js
 *
 * Unit & Integration Test Suite for Audio Backend Configuration & IPC Handlers
 * Validates schema validation, get-audio-config & set-audio-config channels,
 * default fallbacks, and real-time parameter propagation.
 */

const assert = require('assert');
const { AudioConfigManager, DEFAULT_AUDIO_CONFIG } = require('../../dist-ts/src/main/audio-config-manager');
const { registerConversationIpcHandlers } = require('../../dist-ts/src/main/ipc-handlers');
const { IpcChannels } = require('../../dist-ts/src/shared/types');

async function runTests() {
  console.log('🧪 Running Audio Configuration IPC Unit & Integration Test Suite...\n');

  const manager = AudioConfigManager.getInstance();

  // Test 1: Default Audio Configuration Fallback
  {
    console.log('▶ Test 1: Default Audio Configuration Fallback');
    const cfg = manager.getConfig();
    assert.strictEqual(typeof cfg.sampleRate, 'number');
    assert.strictEqual(typeof cfg.bufferSize, 'number');
    assert.strictEqual(typeof cfg.outputDevice, 'string');
    assert.ok([16000, 44100, 48000, 96000].includes(cfg.sampleRate));
    assert.ok(cfg.bufferSize >= 64 && cfg.bufferSize <= 8192);
    console.log('  ✅ Test 1 Passed: Returns safe default audio configuration parameters');
  }

  // Test 2: Schema Validation (Valid & Malformed Payloads)
  {
    console.log('▶ Test 2: JSON Schema Payload Validation');
    
    // Valid config
    const validRes = manager.validateConfig({
      sampleRate: 44100,
      bufferSize: 512,
      outputDevice: 'Headphones'
    });
    assert.strictEqual(validRes.valid, true);

    // Invalid Sample Rate
    const invalidSR = manager.validateConfig({
      sampleRate: 12345,
      bufferSize: 512,
      outputDevice: 'Headphones'
    });
    assert.strictEqual(invalidSR.valid, false);
    assert.ok(invalidSR.error.includes('Invalid sampleRate'));

    // Invalid Buffer Size
    const invalidBuf = manager.validateConfig({
      sampleRate: 48000,
      bufferSize: 10,
      outputDevice: 'Headphones'
    });
    assert.strictEqual(invalidBuf.valid, false);
    assert.ok(invalidBuf.error.includes('Invalid bufferSize'));

    // Empty Output Device
    const invalidDev = manager.validateConfig({
      sampleRate: 48000,
      bufferSize: 1024,
      outputDevice: ''
    });
    assert.strictEqual(invalidDev.valid, false);
    assert.ok(invalidDev.error.includes('Output device must be a non-empty string'));

    console.log('  ✅ Test 2 Passed: JSON Schema correctly accepts valid payloads and rejects malformed ones');
  }

  // Test 3: Set & Persist Audio Configuration
  {
    console.log('▶ Test 3: Set and Persist Valid Audio Configuration');
    const newConfig = {
      sampleRate: 96000,
      bufferSize: 2048,
      outputDevice: 'Speakers'
    };

    const res = await manager.setConfig(newConfig);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.config.sampleRate, 96000);
    assert.strictEqual(res.config.bufferSize, 2048);
    assert.strictEqual(res.config.outputDevice, 'Speakers');

    const updated = manager.getConfig();
    assert.strictEqual(updated.sampleRate, 96000);
    assert.strictEqual(updated.bufferSize, 2048);
    assert.strictEqual(updated.outputDevice, 'Speakers');

    console.log('  ✅ Test 3 Passed: Configuration updated and persisted cleanly');
  }

  // Test 4: Rejection of Malformed Set Payload
  {
    console.log('▶ Test 4: Rejection of Malformed Set Payload');
    const badConfig = {
      sampleRate: 99999,
      bufferSize: 2,
      outputDevice: ''
    };

    const res = await manager.setConfig(badConfig);
    assert.strictEqual(res.success, false);
    assert.ok(res.error);
    console.log('  ✅ Test 4 Passed: Malformed set payload rejected with clear error log');
  }

  // Test 5: Reset to Defaults
  {
    console.log('▶ Test 5: Reset Audio Configuration to Defaults');
    const res = await manager.resetToDefaults();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.config.sampleRate, DEFAULT_AUDIO_CONFIG.sampleRate);
    assert.strictEqual(res.config.bufferSize, DEFAULT_AUDIO_CONFIG.bufferSize);
    assert.strictEqual(res.config.outputDevice, DEFAULT_AUDIO_CONFIG.outputDevice);
    console.log('  ✅ Test 5 Passed: Configuration reset to safe defaults');
  }

  // Test 6: Mock IPC Handler Integration (get-audio-config & set-audio-config)
  {
    console.log('▶ Test 6: IPC Handlers Integration');
    const handlers = {};
    const mockIpcMain = {
      handle: (channel, fn) => {
        handlers[channel] = fn;
      },
      removeHandler: (channel) => {
        delete handlers[channel];
      }
    };

    const registration = registerConversationIpcHandlers(mockIpcMain);
    assert.strictEqual(typeof handlers[IpcChannels.GET_AUDIO_CONFIG], 'function');
    assert.strictEqual(typeof handlers[IpcChannels.SET_AUDIO_CONFIG], 'function');

    // Test GET handler
    const getRes = await handlers[IpcChannels.GET_AUDIO_CONFIG]();
    assert.strictEqual(getRes.success, true);
    assert.ok(getRes.config);

    // Test SET handler
    const setRes = await handlers[IpcChannels.SET_AUDIO_CONFIG](null, {
      config: {
        sampleRate: 44100,
        bufferSize: 512,
        outputDevice: 'Headphones'
      }
    });
    assert.strictEqual(setRes.success, true);
    assert.strictEqual(setRes.config.sampleRate, 44100);

    registration.unregister();
    console.log('  ✅ Test 6 Passed: get-audio-config and set-audio-config IPC handlers verified');
  }

  console.log('\n🌟 All Audio Configuration IPC Unit & Integration Tests Passed Successfully! 🚀');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Audio Configuration IPC unit tests failed:', err);
  process.exit(1);
});
