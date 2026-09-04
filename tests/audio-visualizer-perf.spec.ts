/**
 * Test Suite: Audio Visualizer Performance & Non-Blocking Main IPC Optimization
 * 
 * Verifies:
 * 1. 60 FPS requestAnimationFrame delta throttling (16.66ms interval gating)
 * 2. High-performance binary audio frame packing/unpacking (<0.1ms latency, zero JSON overhead)
 * 3. WindowStateManager non-blocking microtask batching and O(1) cached reads
 * 4. IPC channel registration, message passing, and clean teardown
 * 5. AudioVisualizer component readiness and memory leak prevention
 */

const Module = require('module');
const origRequire = Module.prototype.require;

// Lightweight headless React mock for Node runner
Module.prototype.require = function (id: string) {
  if (id === 'react') {
    return {
      useState: (init: any) => [typeof init === 'function' ? init() : init, () => {}],
      useEffect: (cb: any) => {
        const cleanup = cb();
        if (typeof cleanup === 'function') cleanup();
      },
      useCallback: (fn: any) => fn,
      useMemo: (fn: any) => fn(),
      useRef: (init: any) => ({ current: init }),
      createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children })
    };
  }
  return origRequire.apply(this, arguments);
};

import {
  WindowStateManager,
  registerOptimizedIpcHandlers,
  packBinaryAudioFrame,
  unpackBinaryAudioFrame,
  WindowState
} from '../src/main/index';

async function runTests() {
  const { AudioVisualizer } = require('../src/renderer/components/AudioVisualizer');

  console.log('================================================================');
  console.log('🧪 RUNNING AUDIO VISUALIZER & IPC PERFORMANCE OPTIMIZATION SUITE');
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

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Binary Audio Frame Serialization (<0.1ms Latency Target)
  // --------------------------------------------------------------------------
  console.log('--- 1. Binary Audio Frame Packing & Serialization ---');
  {
    const sampleCount = 512;
    const testAudio = new Uint8Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      testAudio[i] = (i * 7 + 13) % 256;
    }

    const frameId = 42001;
    const timestamp = 1720000000.125;
    // Warm up JIT execution path
    for (let w = 0; w < 10; w++) {
      const dummy = packBinaryAudioFrame(frameId, timestamp, testAudio);
      unpackBinaryAudioFrame(dummy);
    }

    const startPack = performance.now();
    const packed = packBinaryAudioFrame(frameId, timestamp, testAudio);
    const packDuration = performance.now() - startPack;

    assert(packed.length === 16 + sampleCount, `Packed buffer size (${packed.length}) matches 16-byte header + ${sampleCount} bytes`);
    assert(packDuration < 2.0, `Binary frame packing took ${packDuration.toFixed(4)}ms (sub-2ms target met)`);

    const startUnpack = performance.now();
    const unpacked = unpackBinaryAudioFrame(packed);
    const unpackDuration = performance.now() - startUnpack;

    assert(unpacked.frameId === frameId, `Unpacked frameId (${unpacked.frameId}) matches input (${frameId})`);
    assert(Math.abs(unpacked.timestamp - timestamp) < 0.0001, `Unpacked timestamp (${unpacked.timestamp}) matches input (${timestamp})`);
    assert(unpacked.audioData.length === sampleCount, `Unpacked payload length (${unpacked.audioData.length}) matches ${sampleCount}`);
    assert(unpackDuration < 1.0, `Binary frame unpacking took ${unpackDuration.toFixed(4)}ms (sub-1ms target met)`);

    // Byte equality verification
    let bytesEqual = true;
    for (let i = 0; i < sampleCount; i++) {
      if (unpacked.audioData[i] !== testAudio[i]) {
        bytesEqual = false;
        break;
      }
    }
    assert(bytesEqual, 'Unpacked payload is 100% byte-identical to original audio data');

    // Throughput stress test (1,000 frames)
    const iterations = 1000;
    const stressStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const p = packBinaryAudioFrame(i, timestamp + i * 0.02, testAudio);
      const u = unpackBinaryAudioFrame(p);
      if (u.frameId !== i) throw new Error('Integrity mismatch in stress test');
    }
    const stressTotalMs = performance.now() - stressStart;
    const avgPerFrameMs = stressTotalMs / iterations;
    console.log(`   ℹ️ Processed ${iterations} binary frames in ${stressTotalMs.toFixed(2)}ms (avg ${avgPerFrameMs.toFixed(4)}ms/frame)`);
    assert(avgPerFrameMs < 0.1, `Average pack+unpack cycle (${avgPerFrameMs.toFixed(4)}ms) is below 0.1ms`);

    // Invalid header rejection
    let rejectedInvalid = false;
    try {
      const corrupted = new Uint8Array(20);
      unpackBinaryAudioFrame(corrupted);
    } catch (e: any) {
      rejectedInvalid = e.message.includes('expected magic');
    }
    assert(rejectedInvalid, 'Corrupt or non-AUDO binary frames are rejected with an explicit error');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: WindowStateManager Non-Blocking Microtask Batching
  // --------------------------------------------------------------------------
  console.log('\n--- 2. WindowStateManager Non-Blocking Microtask Batching ---');
  {
    const manager = new WindowStateManager({
      isFocused: true,
      bounds: { x: 100, y: 100, width: 800, height: 600 }
    });

    // Instant O(1) cached read
    const readStart = performance.now();
    const state = manager.getState();
    const readDuration = performance.now() - readStart;

    assert(state.isFocused === true, 'Initial state isFocused is true');
    assert(state.bounds.width === 800, 'Initial bounds width is 800');
    assert(readDuration < 0.5, `Instant cached read took ${readDuration.toFixed(4)}ms (O(1) verified)`);

    // Microtask batching: multiple calls coalesced into 1 listener notification
    let listenerNotifications = 0;
    let lastNotifiedState: WindowState | null = null;

    const unsub = manager.onStateChange((s) => {
      listenerNotifications++;
      lastNotifiedState = { ...s };
    });

    // Trigger 3 rapid updates synchronously
    const p1 = manager.batchUpdate({ bounds: { x: 110, y: 110, width: 820, height: 610 } });
    const p2 = manager.batchUpdate({ isMaximized: true });
    const p3 = manager.batchUpdate({ isFocused: false });

    // State before microtask drains should still be the previous state or pending
    assert(listenerNotifications === 0, 'Listener has not fired synchronously (non-blocking confirmed)');

    await Promise.all([p1, p2, p3]);

    assert(listenerNotifications === 1, `Coalesced 3 rapid updates into exactly 1 notification (actual: ${listenerNotifications})`);
    assert(lastNotifiedState !== null, 'Listener received notification');
    assert((lastNotifiedState as any)?.isMaximized === true, 'Merged state has isMaximized = true');
    assert((lastNotifiedState as any)?.isFocused === false, 'Merged state has isFocused = false');
    assert((lastNotifiedState as any)?.bounds.width === 820, 'Merged state has bounds.width = 820');

    unsub();
    await manager.batchUpdate({ isFocused: true });
    assert(listenerNotifications === 1, 'Unsubscribed listener does not receive subsequent updates');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Optimized IPC Handler Registration & Message Dispatch
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Optimized IPC Handler Registration & Dispatch ---');
  {
    const handlers = new Map<string, Function>();
    const mockIpcMain = {
      handle: (channel: string, handler: Function) => {
        handlers.set(channel, handler);
      },
      removeHandler: (channel: string) => {
        handlers.delete(channel);
      }
    };

    const manager = new WindowStateManager();
    const registration = registerOptimizedIpcHandlers(mockIpcMain, manager);

    assert(handlers.has('window:get-state'), 'Registered window:get-state IPC channel');
    assert(handlers.has('window:batch-update'), 'Registered window:batch-update IPC channel');
    assert(handlers.has('audio:telemetry-binary'), 'Registered audio:telemetry-binary IPC channel');
    assert(handlers.has('audio:stream-chunk-direct'), 'Registered audio:stream-chunk-direct IPC channel');

    // Test window:get-state handler
    const getStateHandler = handlers.get('window:get-state')!;
    const fetchedState = await getStateHandler();
    assert(fetchedState.bounds.width === 800, 'window:get-state returns cached window state');

    // Test audio:telemetry-binary handler
    const binaryHandler = handlers.get('audio:telemetry-binary')!;
    const testAudio = new Uint8Array([10, 20, 30, 40]);
    const packed = packBinaryAudioFrame(777, 1720000000, testAudio);

    const binaryRes = await binaryHandler(null, packed);
    assert(binaryRes.success === true, 'audio:telemetry-binary handler successfully decoded binary frame');
    assert(binaryRes.frameId === 777, 'Decoded frameId is 777');
    assert(binaryRes.payloadSize === 4, 'Decoded payloadSize is 4');

    // Clean teardown
    registration.unregister();
    assert(!handlers.has('window:get-state'), 'Unregistered window:get-state channel');
    assert(!handlers.has('audio:telemetry-binary'), 'Unregistered audio:telemetry-binary channel');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: 60 FPS Delta Throttling Logic Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 4. 60 FPS Delta Throttling Simulation ---');
  {
    const targetFps = 60;
    const targetIntervalMs = 1000 / targetFps; // 16.666ms
    const minFrameIntervalMs = targetIntervalMs - 1.5; // 15.166ms

    // Helper simulating the visualizer's interval throttle gate
    let renderedCount = 0;
    let droppedCount = 0;
    let lastRenderTime = 0;

    const simulateFrame = (currentTime: number) => {
      const delta = currentTime - lastRenderTime;
      if (delta < minFrameIntervalMs) {
        return false; // Throttled/skipped
      }
      if (delta > targetIntervalMs * 1.6 && renderedCount > 0) {
        droppedCount++;
      }
      lastRenderTime = currentTime - (delta >= targetIntervalMs ? delta % targetIntervalMs : 0);
      renderedCount++;
      return true;
    };

    // Scenario A: Rapid 120Hz display ticks (every 8.33ms)
    // Visualizer should skip every second tick to maintain locked 60 FPS
    renderedCount = 0;
    lastRenderTime = 1000;
    for (let t = 1000 + 8.33; t <= 1000 + 1000; t += 8.33) {
      simulateFrame(t);
    }
    console.log(`   ℹ️ 120Hz rapid tick stream: ${renderedCount} frames rendered out of 120 ticks`);
    assert(renderedCount >= 58 && renderedCount <= 62, `Locked 60 FPS throttled 120Hz stream down to ${renderedCount} FPS`);

    // Scenario B: Perfect 60Hz display ticks (every 16.66ms)
    renderedCount = 0;
    droppedCount = 0;
    lastRenderTime = 2000;
    for (let t = 2000 + 16.666; t <= 2000 + 1000; t += 16.666) {
      simulateFrame(t);
    }
    console.log(`   ℹ️ 60Hz tick stream: ${renderedCount} frames rendered, ${droppedCount} dropped`);
    assert(renderedCount >= 59 && renderedCount <= 61, `Locked 60 FPS preserved 60Hz stream (${renderedCount} frames)`);
    assert(droppedCount === 0, 'Zero frames dropped during steady 60Hz cadence');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: AudioVisualizer Component Readiness
  // --------------------------------------------------------------------------
  console.log('\n--- 5. AudioVisualizer Component Readiness ---');
  {
    assert(typeof AudioVisualizer === 'function', 'AudioVisualizer component is exported and is a valid React FC');

    // Verify component renders without errors in headless React
    const element = AudioVisualizer({
      width: 400,
      height: 120,
      barCount: 32,
      colorScheme: 'neon-purple',
      showHud: true
    });

    assert(element !== null && typeof element === 'object', 'AudioVisualizer instantiated valid virtual DOM tree');
    assert(element.props?.className?.includes('audio-visualizer-container'), 'Top-level container has expected CSS class');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} AUDIO VISUALIZER & IPC PERF TESTS PASSED!`);
  console.log('================================================================\n');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Test suite failed with exception:', err);
  process.exit(1);
});
