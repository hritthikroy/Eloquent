/**
 * Conec Configuration & Audio Bridge Specification Test Suite
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { DEFAULT_CONEC_CONFIG, validateConecConfig, loadConecConfig, saveConecConfig } = require('../src/main/conec-config');
const { AudioBridge } = require('../src/main/audio-bridge');

console.log('🧪 Starting Conec Configuration & Audio Bridge Test Suite...\n');

// 1. Test Default Configuration & Validation
console.log('--- 1. Testing Configuration Validation ---');
const defaultVal = validateConecConfig(DEFAULT_CONEC_CONFIG);
assert.strictEqual(defaultVal.valid, true, 'Default config must be valid');
assert.strictEqual(defaultVal.errors.length, 0, 'Default config must have 0 errors');
console.log('  ✅ [PASS] Default Conec configuration valid');

const invalidPort = validateConecConfig({ port: 99999 });
assert.strictEqual(invalidPort.valid, false, 'Port 99999 must be rejected');
console.log('  ✅ [PASS] Invalid port rejected properly');

const invalidTimeout = validateConecConfig({ timeoutMs: -50 });
assert.strictEqual(invalidTimeout.valid, false, 'Negative timeout must be rejected');
console.log('  ✅ [PASS] Invalid timeout rejected properly');

// 2. Test File Persistence
console.log('\n--- 2. Testing Configuration Persistence ---');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conec_test_'));
const customConfig = { ...DEFAULT_CONEC_CONFIG, port: 49152, timeoutMs: 3500 };

const saved = saveConecConfig(tempDir, customConfig);
assert.strictEqual(saved, true, 'Config must save successfully');

const loaded = loadConecConfig(tempDir);
assert.strictEqual(loaded.port, 49152, 'Loaded port must match saved custom port');
assert.strictEqual(loaded.timeoutMs, 3500, 'Loaded timeout must match saved custom timeout');
console.log('  ✅ [PASS] Config persisted and reloaded cleanly');
fs.rmSync(tempDir, { recursive: true, force: true });

// 3. Test AudioBridge IPC Handlers Registration
console.log('\n--- 3. Testing AudioBridge IPC Handlers ---');
const bridge = new AudioBridge({ targetTickIntervalMs: 10 });
const handlers = new Map();

const mockIpcMain = {
  handle: (channel, fn) => handlers.set(channel, fn),
  removeHandler: (channel) => handlers.delete(channel)
};

bridge.registerIpcHandlers(mockIpcMain);
assert(handlers.has('conec:get-config'), 'Must register conec:get-config');
assert(handlers.has('conec:update-config'), 'Must register conec:update-config');
assert(handlers.has('conec:get-status'), 'Must register conec:get-status');
assert(handlers.has('conec:ping'), 'Must register conec:ping');
console.log('  ✅ [PASS] All 4 Conec IPC handlers registered');

bridge.unregisterIpcHandlers(mockIpcMain);
assert.strictEqual(handlers.size, 0, 'All handlers must be removed on unregister');
console.log('  ✅ [PASS] All handlers unregistered cleanly with zero leaks');

// 4. Test AudioBridge Loop & Direct Frame Pass-through
console.log('\n--- 4. Testing AudioBridge Execution ---');
bridge.start();
assert.strictEqual(bridge.isRunning, true, 'Bridge must be running after start()');

const metrics = bridge.getMetrics();
assert.strictEqual(metrics.isFlushRemoved, true, 'Flush bottleneck must be eliminated');
bridge.stop();
assert.strictEqual(bridge.isRunning, false, 'Bridge must be stopped after stop()');
console.log('  ✅ [PASS] AudioBridge start/stop lifecycle validated');

console.log('\n🎉 ALL CONEC CONFIG & AUDIO BRIDGE TESTS PASSED (100%)!');
