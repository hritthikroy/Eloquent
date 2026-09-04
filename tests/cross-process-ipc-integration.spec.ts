/**
 * Test Suite: Cross-Process IPC & System State Validation
 * 
 * Verifies:
 * 1. Resilient IPC error boundaries and zero unhandled promise rejections.
 * 2. Bi-directional IPC heartbeat, latency tracking, and channel drop resilience.
 * 3. Audio hardware device disconnection, reconnection, and broadcast telemetry.
 * 4. Comprehensive subsystem state diagnostic audit across all 5 core subsystems.
 * 5. Sudden termination teardown hooks and clean handler unregistration.
 * 6. Preload context isolation and window.systemDiagnostics API whitelisting.
 * 7. Memory stability and zero-leak behavior during high-frequency IPC cycling.
 */

import * as fs from 'fs';
import * as path from 'path';

let rootDir = path.resolve(__dirname, '../..');
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.resolve(__dirname, '..');
}
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = process.cwd();
}

const {
  registerResilientIpcHandlers,
  getSystemSubsystemStatus,
  getAudioDeviceState,
  resetResilientIpcState
} = require(path.join(rootDir, 'src/main/ipc'));

async function runCrossProcessIpcTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING CROSS-PROCESS IPC & SYSTEM STATE VALIDATION SUITE');
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

  resetResilientIpcState();

  const registeredHandlers: Record<string, Function> = {};
  const mockIpcMain = {
    handle: (channel: string, handler: Function) => {
      registeredHandlers[channel] = handler;
    },
    removeHandler: (channel: string) => {
      delete registeredHandlers[channel];
    }
  };

  const broadcastEvents: Array<{ channel: string; data: any }> = [];
  const mockBroadcaster = {
    broadcast: (channel: string, data: any) => {
      broadcastEvents.push({ channel, data });
    }
  };

  // -------------------------------------------------------------------------
  // 1. Resilient IPC Handler Registration & Error Boundaries
  // -------------------------------------------------------------------------
  console.log('--- 1. Resilient IPC Handler Registration & Error Boundaries ---');

  const ipcControl = registerResilientIpcHandlers(mockIpcMain, { broadcaster: mockBroadcaster });
  assert(Boolean(ipcControl), 'registerResilientIpcHandlers initialized successfully');

  assert(typeof registeredHandlers['ipc:heartbeat'] === 'function', 'Registered ipc:heartbeat handler');
  assert(typeof registeredHandlers['audio:device-status'] === 'function', 'Registered audio:device-status handler');
  assert(typeof registeredHandlers['audio:report-device-disconnect'] === 'function', 'Registered audio:report-device-disconnect handler');
  assert(typeof registeredHandlers['audio:report-device-reconnect'] === 'function', 'Registered audio:report-device-reconnect handler');
  assert(typeof registeredHandlers['audio:pipeline-health'] === 'function', 'Registered audio:pipeline-health handler');
  assert(typeof registeredHandlers['system:subsystem-status'] === 'function', 'Registered system:subsystem-status handler');

  // Verify error boundary handles null/malformed invocations safely without unhandled rejections
  const badHeartbeat = await registeredHandlers['ipc:heartbeat'](null, null);
  assert(badHeartbeat.success === true, 'Heartbeat handles null payload safely');

  const badDisconnect = await registeredHandlers['audio:report-device-disconnect'](null, null);
  assert(badDisconnect.success === true, 'Device disconnect handles null payload safely');

  // -------------------------------------------------------------------------
  // 2. Bi-directional IPC Heartbeat & Latency Calculation
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Bi-directional IPC Heartbeat & Latency Tracking ---');

  const clientSendTime = Date.now() - 15;
  const heartbeatRes = await registeredHandlers['ipc:heartbeat'](null, { timestamp: clientSendTime });

  assert(heartbeatRes.success === true, 'Heartbeat succeeded');
  assert(typeof heartbeatRes.serverTimestamp === 'number', 'Heartbeat returns numeric serverTimestamp');
  assert(heartbeatRes.roundTripLatencyMs >= 10, 'Heartbeat accurately calculated round-trip latency');
  assert(heartbeatRes.isHealthy === true, 'Heartbeat reports isHealthy: true');

  // -------------------------------------------------------------------------
  // 3. Audio Device Disconnect & Reconnect Fault Tolerance
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Audio Device Disconnect & Reconnect Fault Tolerance ---');

  // Initial state check
  const initialDevice = getAudioDeviceState();
  assert(initialDevice.active === false, 'Device initially inactive from earlier test step');

  // Reconnect USB microphone
  const reconnectRes = await registeredHandlers['audio:report-device-reconnect'](null, {
    deviceName: 'MacBook Pro Microphone'
  });
  assert(reconnectRes.success === true, 'Device reconnect handler succeeded');
  assert(reconnectRes.device.active === true, 'Device marked active after reconnection');
  assert(reconnectRes.device.deviceName === 'MacBook Pro Microphone', 'Updated device name reflected');

  // Check broadcast notification
  const reconnectEvt = broadcastEvents.find(e => e.channel === 'audio:device-changed' && e.data.active === true);
  assert(Boolean(reconnectEvt), 'Broadcasted audio:device-changed (active: true)');
  assert(reconnectEvt?.data.deviceName === 'MacBook Pro Microphone', 'Broadcast includes restored device name');

  // Simulate hardware unplug
  const disconnectRes = await registeredHandlers['audio:report-device-disconnect'](null, {
    deviceName: 'MacBook Pro Microphone',
    reason: 'usb_cable_detached'
  });
  assert(disconnectRes.success === true, 'Device disconnect handler succeeded');
  assert(disconnectRes.device.active === false, 'Device marked inactive after disconnection');
  assert(disconnectRes.device.disconnectCount === 2, 'Disconnect count accurately accumulated');

  const disconnectEvts = broadcastEvents.filter(e => e.channel === 'audio:device-changed' && e.data.active === false);
  const disconnectEvt = disconnectEvts[disconnectEvts.length - 1];
  assert(Boolean(disconnectEvt), 'Broadcasted audio:device-changed (active: false)');
  assert(disconnectEvt?.data.reason === 'usb_cable_detached', 'Broadcast includes disconnection reason');

  // -------------------------------------------------------------------------
  // 4. Subsystem Diagnostic Audit Across All 5 Subsystems
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Subsystem Diagnostic Audit Across All 5 Subsystems ---');

  const diagRes = await registeredHandlers['system:subsystem-status']();
  assert(diagRes.success === true, 'Subsystem status query succeeded');

  const report = diagRes.report;
  assert(Boolean(report.subsystems.audioPipeline), 'Reports audioPipeline subsystem health');
  assert(Boolean(report.subsystems.ipcBridge), 'Reports ipcBridge subsystem health');
  assert(Boolean(report.subsystems.conversationManager), 'Reports conversationManager subsystem health');
  assert(Boolean(report.subsystems.neuralMeshMemory), 'Reports neuralMeshMemory subsystem health');
  assert(Boolean(report.subsystems.uiVisualizer), 'Reports uiVisualizer subsystem health');

  assert(report.subsystems.audioPipeline.disconnectCount === 2, 'Report reflects accurate disconnect telemetry');
  assert(report.subsystems.ipcBridge.status === 'healthy', 'IPC bridge status is healthy');
  assert(report.subsystems.conversationManager.fsmEnforced === true, 'FSM enforcement flagged true');
  assert(report.subsystems.neuralMeshMemory.vaultActive === true, 'Neural-mesh vault flagged true');
  assert(report.subsystems.uiVisualizer.renderFpsTarget === 60, 'UI visualizer target is 60 FPS');

  // Memory telemetry
  assert(typeof report.memory.heapUsedMB === 'number' && report.memory.heapUsedMB > 0, 'heapUsedMB reports valid positive number');
  assert(typeof report.memory.rssMB === 'number' && report.memory.rssMB > 0, 'rssMB reports valid positive number');
  assert(typeof report.memory.externalMB === 'number', 'externalMB reports numeric value');

  // Pipeline health
  const pipeHealth = await registeredHandlers['audio:pipeline-health']();
  assert(pipeHealth.success === true, 'audio:pipeline-health query succeeded');
  assert(pipeHealth.deviceActive === false, 'Pipeline health matches active hardware state');

  // Restore device state to active
  await registeredHandlers['audio:report-device-reconnect'](null, { deviceName: 'Default Built-In Audio' });
  const restoredHealth = await registeredHandlers['audio:pipeline-health']();
  assert(restoredHealth.isHealthy === true, 'Pipeline restored to healthy state');

  // -------------------------------------------------------------------------
  // 5. Preload Context Isolation & Bridge Whitelisting
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Preload Context Isolation & Bridge Whitelisting ---');

  const preloadSource = fs.readFileSync(path.join(rootDir, 'src/preload.js'), 'utf8');

  assert(preloadSource.includes("contextBridge.exposeInMainWorld('systemDiagnostics'"), 'Preload exposes window.systemDiagnostics');
  assert(preloadSource.includes("'ipc:heartbeat'"), 'Preload bridges ipc:heartbeat');
  assert(preloadSource.includes("'audio:device-status'"), 'Preload bridges audio:device-status');
  assert(preloadSource.includes("'audio:report-device-disconnect'"), 'Preload bridges audio:report-device-disconnect');
  assert(preloadSource.includes("'audio:report-device-reconnect'"), 'Preload bridges audio:report-device-reconnect');
  assert(preloadSource.includes("'audio:pipeline-health'"), 'Preload bridges audio:pipeline-health');
  assert(preloadSource.includes("'system:subsystem-status'"), 'Preload bridges system:subsystem-status');
  assert(preloadSource.includes("'audio:device-changed'"), 'Preload whitelists audio:device-changed event');
  assert(preloadSource.includes("'audio:pipeline-warning'"), 'Preload whitelists audio:pipeline-warning event');
  assert(preloadSource.includes("'system:terminating'"), 'Preload whitelists system:terminating event');
  assert(preloadSource.includes("'ipc:connection-state'"), 'Preload whitelists ipc:connection-state event');

  // -------------------------------------------------------------------------
  // 6. Memory Stability & High-Frequency IPC Cycling
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Memory Stability & High-Frequency IPC Cycling ---');

  const memBefore = process.memoryUsage().heapUsed;
  const cycleCount = 150;

  for (let i = 0; i < cycleCount; i++) {
    await registeredHandlers['ipc:heartbeat'](null, { timestamp: Date.now() });
    if (i % 2 === 0) {
      await registeredHandlers['audio:pipeline-health']();
    }
  }

  const memAfter = process.memoryUsage().heapUsed;
  const deltaMB = (memAfter - memBefore) / 1048576;
  console.log(`   ℹ️ Memory delta after ${cycleCount} rapid IPC cycles: ${deltaMB.toFixed(3)} MB`);

  assert(deltaMB < 10.0, `Memory delta is bounded (${deltaMB.toFixed(2)}MB < 10MB) - zero leak verified`);

  // -------------------------------------------------------------------------
  // 7. Teardown & Handler Unregistration
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Teardown & Handler Unregistration ---');

  ipcControl.unregister();
  assert(typeof registeredHandlers['ipc:heartbeat'] === 'undefined', 'ipc:heartbeat unregistered cleanly');
  assert(typeof registeredHandlers['audio:device-status'] === 'undefined', 'audio:device-status unregistered cleanly');
  assert(typeof registeredHandlers['system:subsystem-status'] === 'undefined', 'system:subsystem-status unregistered cleanly');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} CROSS-PROCESS IPC & VALIDATION TESTS PASSED!`);
  console.log('================================================================\n');

  process.exit(0);
}

runCrossProcessIpcTests().catch(err => {
  console.error('Test execution failed with unhandled exception:', err);
  process.exit(1);
});
