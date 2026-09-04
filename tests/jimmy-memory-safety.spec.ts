import assert from 'assert';
import path from 'path';
import { describe, it } from 'node:test';

const { MemoryMonitor } = require(path.resolve(__dirname, '../../src/core/memory_monitor'));
const { IPCBridgeWithBackpressure } = require(path.resolve(__dirname, '../../src/ipc/bridge'));

describe('Jimmy BB Memory Safety & Backpressure Suite', () => {
  it('MemoryMonitor triggers warnings and emergency flush on threshold breach', () => {
    const monitor = new MemoryMonitor({
      warningThresholdMB: 1, // Set intentionally low to trigger
      criticalThresholdMB: 2,
      checkIntervalMs: 50,
      autoGC: false,
    });

    let flushTriggered = false;
    monitor.onCriticalFlush((sample: any) => {
      flushTriggered = true;
      assert.ok(sample.heapUsedMB > 0);
    });

    const sample = monitor.checkMemory();
    assert.ok(sample);
    assert.strictEqual(flushTriggered, true, 'Critical flush should trigger on low threshold');

    const stats = monitor.getStats();
    assert.ok(stats.criticalTotal > 0);
    assert.strictEqual(stats.flushesTriggeredTotal, 1);
  });

  it('IPCBridgeWithBackpressure regulates rapid bursts and pauses/resumes queue', async () => {
    const bridge = new IPCBridgeWithBackpressure({
      highWatermark: 5,
      lowWatermark: 2,
      maxQueueCapacity: 10,
    });

    let paused = false;
    let resumed = false;

    bridge.on('pause', () => {
      paused = true;
    });

    bridge.on('resume', () => {
      resumed = true;
    });

    // Write 6 items to cross high watermark (5)
    for (let i = 0; i < 6; i++) {
      bridge.write(Buffer.alloc(64));
    }

    assert.strictEqual(paused, true, 'Bridge should emit pause when high watermark breached');
    assert.strictEqual(bridge.isBackpressured, true);

    // Provide target drain handler
    let drainedCount = 0;
    bridge.setTargetHandler(async () => {
      drainedCount++;
      return true;
    });

    bridge.scheduleDrain();

    // Wait for drain to pass low watermark
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(resumed, true, 'Bridge should emit resume when queue drops below low watermark');
    assert.strictEqual(bridge.isBackpressured, false);
    assert.ok(drainedCount >= 4);

    // Test emergency flush
    for (let i = 0; i < 4; i++) {
      bridge.write(Buffer.alloc(64));
    }
    const flushed = bridge.flush();
    assert.strictEqual(flushed, 4);
    assert.strictEqual(bridge.queue.length, 0);
  });
});
