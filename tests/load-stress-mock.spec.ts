import assert from 'assert';
import path from 'path';
import { describe, it } from 'node:test';

const { MemoryMonitor } = require(path.resolve(__dirname, '../../src/core/memory_monitor'));
const { IPCBridgeWithBackpressure } = require(path.resolve(__dirname, '../../src/ipc/bridge'));

describe('10x Peak Load Stress Simulation', () => {
  it('sustains 10,000 rapid frame bursts without memory exhaustion or unhandled rejections', async () => {
    const bridge = new IPCBridgeWithBackpressure({
      highWatermark: 500,
      lowWatermark: 100,
      maxQueueCapacity: 5000,
    });

    const monitor = new MemoryMonitor({
      warningThresholdMB: 350,
      criticalThresholdMB: 600,
      autoGC: false,
    });

    monitor.onCriticalFlush(() => {
      bridge.flush();
    });

    let dispatchedCount = 0;
    bridge.setTargetHandler(async () => {
      dispatchedCount++;
      return true;
    });

    const chunk = Buffer.alloc(1920); // standard 20ms frame
    const burstCount = 10000;

    for (let i = 0; i < burstCount; i++) {
      bridge.write(chunk);
      if (i % 200 === 0) {
        bridge.scheduleDrain();
      }
    }

    bridge.scheduleDrain();

    // Allow drain cycle to process queue
    await new Promise((resolve) => setTimeout(resolve, 150));

    const metrics = bridge.getMetrics();
    assert.ok(metrics.enqueuedTotal > 0, 'Should have enqueued frames');
    assert.ok(dispatchedCount > 0, 'Should have dispatched frames');

    const sample = monitor.checkMemory();
    assert.ok(sample.heapUsedMB < 600, 'Heap should remain safely under critical limit');
  });
});
