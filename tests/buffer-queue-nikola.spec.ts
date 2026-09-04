/**
 * @file buffer-queue-nikola.spec.ts
 * @description Comprehensive unit and stress test suite for BufferQueue,
 * NikolaProcessor asynchronous consumer loop, error isolation, circuit breaker,
 * and Electron IPC bridge integration.
 */

import assert from 'assert';
import path from 'path';
import { describe, it } from 'node:test';

const { BufferQueue } = require(path.resolve(__dirname, '../../src/core/bufferQueue'));
const { NikolaProcessor, CircuitState } = require(path.resolve(__dirname, '../../src/services/nikolaProcessor'));
const { ElectronEyeBridge } = require(path.resolve(__dirname, '../../src/main/electronMain'));

describe('BufferQueue & NikolaProcessor Pipeline Integration', () => {

  // --------------------------------------------------------------------------
  // TEST GROUP 1: BufferQueue FIFO & Capacity Management
  // --------------------------------------------------------------------------
  describe('BufferQueue Bounded FIFO & Edge Cases', () => {
    it('maintains strict FIFO ordering under high-frequency injection', () => {
      const queue = new BufferQueue({ maxSize: 1000 });

      for (let i = 0; i < 500; i++) {
        const buf = Buffer.alloc(16);
        buf.writeInt32LE(i, 0);
        queue.enqueue(buf, { index: i });
      }

      assert.strictEqual(queue.size, 500, 'Queue size should be 500');

      for (let i = 0; i < 500; i++) {
        const item = queue.dequeue();
        assert.ok(item, `Item ${i} should be dequeued`);
        assert.strictEqual(item.buffer.readInt32LE(0), i, `FIFO sequence mismatch at ${i}`);
        assert.strictEqual(item.metadata.index, i);
      }

      assert.strictEqual(queue.size, 0, 'Queue should be empty after drain');
    });

    it('enforces drop-oldest strategy on overflow (1024 threshold)', () => {
      const maxSize = 50;
      let dropEmitted = false;
      const queue = new BufferQueue({ maxSize });

      queue.on('drop', (data: any) => {
        dropEmitted = true;
      });

      // Enqueue 75 items into a size 50 queue
      for (let i = 0; i < 75; i++) {
        const buf = Buffer.alloc(8);
        buf.writeInt32LE(i, 0);
        queue.enqueue(buf, { id: i });
      }

      assert.strictEqual(queue.size, 50, 'Queue size should remain capped at 50');
      assert.strictEqual(queue.getTelemetry().totalDropped, 25, '25 items should be dropped');
      assert.strictEqual(dropEmitted, true, 'drop event should have been emitted');

      // The first item should now be id 25 (0 to 24 dropped)
      const oldestRemaining = queue.dequeue();
      assert.ok(oldestRemaining);
      assert.strictEqual(oldestRemaining.buffer.readInt32LE(0), 25, 'Oldest remaining item should be 25');
    });

    it('manages backpressure high and low watermarks', () => {
      let highEmitted = false;
      let lowEmitted = false;

      const queue = new BufferQueue({
        maxSize: 100,
        highWaterMark: 0.8, // 80
        lowWaterMark: 0.2   // 20
      });

      queue.on('backpressure:high', () => { highEmitted = true; });
      queue.on('backpressure:low', () => { lowEmitted = true; });

      // Enqueue up to 85 items to trip high watermark
      for (let i = 0; i < 85; i++) {
        queue.enqueue(Buffer.alloc(4));
      }

      assert.strictEqual(queue.isBackpressured, true, 'Should be in backpressure state');
      assert.strictEqual(highEmitted, true, 'backpressure:high event fired');

      // Drain down to 15 items to trip low watermark
      while (queue.size > 15) {
        queue.dequeue();
      }

      assert.strictEqual(queue.isBackpressured, false, 'Should clear backpressure');
      assert.strictEqual(lowEmitted, true, 'backpressure:low event fired');
    });

    it('drain() releases buffer references for memory reclamation', () => {
      const queue = new BufferQueue({ maxSize: 100 });
      for (let i = 0; i < 20; i++) {
        queue.enqueue(Buffer.alloc(64));
      }

      assert.strictEqual(queue.size, 20);
      const drained = queue.drain();
      assert.strictEqual(drained.length, 20);
      assert.strictEqual(queue.size, 0);

      // Verify Prometheus exporter formatting
      const prom = queue.exportPrometheusMetrics();
      assert.ok(prom.includes('eloquent_queue_depth_current'), 'Prometheus depth metric present');
      assert.ok(prom.includes('eloquent_queue_dropped_total'), 'Prometheus dropped metric present');
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: NikolaProcessor Async Consumer & Error Isolation
  // --------------------------------------------------------------------------
  describe('NikolaProcessor Async Consumer Loop & Isolation', () => {
    it('processes PCM audio chunks asynchronously and computes RMS and peak', async () => {
      const queue = new BufferQueue({ maxSize: 500 });
      const processedFrames: any[] = [];

      const processor = new NikolaProcessor({
        queue,
        onFrame: (frame: any) => {
          processedFrames.push(frame);
        }
      });

      processor.start();

      // Enqueue 20 frames of valid 16-bit PCM audio
      for (let i = 0; i < 20; i++) {
        const buf = Buffer.alloc(960);
        for (let j = 0; j < buf.length - 1; j += 2) {
          buf.writeInt16LE(1500, j); // Steady tone
        }
        queue.enqueue(buf, { frameIdx: i });
      }

      // Allow consumer loop iterations to run
      await new Promise(resolve => setTimeout(resolve, 80));

      processor.stop();

      assert.strictEqual(processedFrames.length, 20, 'All 20 frames should be processed');
      assert.ok(processedFrames[0].rms > 0, 'RMS should be positive');
      assert.strictEqual(processedFrames[0].peak, 1500, 'Peak amplitude should be 1500');
      assert.strictEqual(processedFrames[0].isSpeech, true, 'isSpeech should be true');

      const metrics = processor.getMetrics();
      assert.strictEqual(metrics.processedCount, 20);
      assert.strictEqual(metrics.malformedCount, 0);
    });

    it('isolates malformed chunks without crashing consumer loop', async () => {
      const queue = new BufferQueue({ maxSize: 100 });
      let malformedCount = 0;
      let validCount = 0;

      const processor = new NikolaProcessor({
        queue,
        consecutiveErrorThreshold: 10,
        onFrame: () => { validCount++; }
      });

      processor.on('malformed', () => {
        malformedCount++;
      });

      processor.start();

      // Enqueue a mix of valid, empty, null-like, and corrupt data
      const validBuf = Buffer.alloc(100);
      validBuf.writeInt16LE(500, 0);

      queue.enqueue(validBuf);                   // Valid #1
      queue.enqueue(Buffer.alloc(0));             // Malformed: zero-length
      queue.enqueue(validBuf);                   // Valid #2
      queue.enqueue({ notABuffer: true } as any); // Malformed: invalid payload
      queue.enqueue(validBuf);                   // Valid #3

      await new Promise(resolve => setTimeout(resolve, 60));
      processor.stop();

      assert.strictEqual(validCount, 3, '3 valid chunks should be successfully processed');
      assert.strictEqual(malformedCount, 2, '2 malformed chunks should be trapped and isolated');
      assert.strictEqual(processor.circuitState, CircuitState.CLOSED, 'Circuit should stay closed');
    });

    it('circuit breaker trips on consecutive errors and auto-recovers', async () => {
      const queue = new BufferQueue({ maxSize: 100 });
      let circuitOpened = false;

      const processor = new NikolaProcessor({
        queue,
        consecutiveErrorThreshold: 3,
        circuitCooldownMs: 50
      });

      processor.on('circuit:open', () => {
        circuitOpened = true;
      });

      processor.start();

      // Enqueue 4 malformed packets to trip circuit (threshold is 3)
      for (let i = 0; i < 4; i++) {
        queue.enqueue(Buffer.alloc(0));
      }

      await new Promise(resolve => setTimeout(resolve, 30));

      assert.strictEqual(circuitOpened, true, 'Circuit should have tripped OPEN');
      assert.strictEqual(processor.circuitState, CircuitState.OPEN, 'Circuit state must be OPEN');

      // Now enqueue valid buffers and wait for cooldown
      const validBuf = Buffer.alloc(100);
      validBuf.writeInt16LE(1000, 0);
      for (let i = 0; i < 5; i++) {
        queue.enqueue(validBuf);
      }

      // Wait for circuitCooldownMs (50ms) + recovery probe
      await new Promise(resolve => setTimeout(resolve, 120));

      processor.stop();

      assert.strictEqual(processor.circuitState, CircuitState.CLOSED, 'Circuit should have recovered to CLOSED');
      assert.ok(processor.getMetrics().circuitTripCount >= 1, 'Trip count recorded');
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: ElectronMain IPC Bridge Integration
  // --------------------------------------------------------------------------
  describe('ElectronEyeBridge Asynchronous Queue Integration', () => {
    it('ingestAudioBuffer decouples ingestion from processing', () => {
      const bridge = new ElectronEyeBridge();

      const buf = Buffer.alloc(128);
      const res1 = bridge.ingestAudioBuffer(buf, { channel: 'mic' });

      assert.strictEqual(res1.success, true);
      assert.strictEqual(res1.queued, true);
      assert.strictEqual(res1.queueDepth, 1);

      const telemetry = bridge.getQueueTelemetry();
      assert.ok(telemetry.queue);
      assert.strictEqual(telemetry.queue.depth, 1);

      bridge.unregister();
    });

    it('sendAudioFrameFastPath safely enqueues frame without regression', () => {
      const bridge = new ElectronEyeBridge({ useFastPath: false });

      const frame = {
        frameIndex: 42,
        timestamp: Date.now(),
        data: Buffer.alloc(64)
      };

      // Fast-path bridge is unavailable in test without shared memory, but bufferQueue receives frame
      bridge.sendAudioFrameFastPath(frame);

      assert.strictEqual(bridge.bufferQueue.size, 1, 'BufferQueue should receive frame data');

      const state = bridge.getState();
      assert.strictEqual(state.queueDepth, 1);

      bridge.unregister();
    });
  });
});
