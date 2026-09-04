import assert from 'assert';
import path from 'path';
import { describe, it } from 'node:test';

// Load audio_monitor.js dynamically via absolute path
const monitorPath = path.resolve(__dirname, '../../src/renderer/audio_monitor.js');
const { AudioMonitor, CircularAudioBuffer } = require(monitorPath);

describe('AudioMonitor & Circular Buffer Integration', () => {
  it('CircularAudioBuffer pushes and wraps correctly in O(1)', () => {
    const capacity = 10;
    const circ = new CircularAudioBuffer(capacity);

    for (let i = 0; i < 25; i++) {
      circ.push({ id: i, rms: i * 0.01 });
    }

    assert.strictEqual(circ.size, 10, 'Buffer size should be capped at capacity 10');
    assert.strictEqual(circ.getFillRatio(), 1.0, 'Fill ratio should be 100%');

    const latest = circ.getLatest();
    assert.ok(latest, 'Latest item should exist');
    assert.strictEqual(latest.id, 24, 'Latest item id should be 24');

    const array = circ.toArray();
    assert.strictEqual(array.length, 10, 'Array length should equal capacity');
    assert.strictEqual(array[0].id, 15, 'Oldest item in full ring should be id 15');
    assert.strictEqual(array[9].id, 24, 'Newest item should be id 24');
  });

  it('AudioMonitor handles high-frequency batches with rAF coalescing', async () => {
    let updateCalls = 0;
    let lastStats: any = null;

    const monitor = new AudioMonitor({
      bufferCapacity: 256,
      onUpdate: (stats: any) => {
        updateCalls++;
        lastStats = stats;
      }
    });

    // Simulate 5 rapid bursts of IPC telemetry batches (50 items total)
    for (let b = 0; b < 5; b++) {
      const batch = [];
      for (let i = 0; i < 10; i++) {
        batch.push({
          timestampNs: Date.now() * 1000000,
          rms: 0.05 + (i * 0.005),
          peak: 1200 + i * 50,
          isSpeech: true,
          isSilence: false,
          isUnderflow: false,
          underflowCount: 0
        });
      }
      monitor.handleTelemetryBatch(batch);
    }

    // Wait for the scheduled micro-task / rAF tick to execute
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.ok(updateCalls >= 1, 'onUpdate should have been triggered');
    assert.strictEqual(monitor.stats.totalFramesProcessed, 50, 'All 50 frames should be processed');
    assert.strictEqual(monitor.stats.batchesReceived, 5, '5 batches received');
    assert.ok(lastStats.rms > 0, 'RMS should be recorded');
    assert.strictEqual(lastStats.isSpeech, true, 'isSpeech should be true');

    monitor.destroy();
  });

  it('AudioMonitor tracks underflow gracefully and formats Prometheus metrics', async () => {
    const monitor = new AudioMonitor();

    // Send a batch with silence/underflow injection
    monitor.handleTelemetryBatch([
      {
        timestampNs: Date.now() * 1000000,
        rms: 0,
        peak: 0,
        isSpeech: false,
        isSilence: true,
        isUnderflow: true,
        underflowCount: 3
      }
    ]);

    await new Promise(resolve => setTimeout(resolve, 30));

    assert.strictEqual(monitor.stats.isUnderflow, true, 'Underflow should be flagged');
    assert.ok(monitor.stats.underflowCount >= 3, 'Underflow count should match');

    const prom = monitor.exportPrometheusMetrics();
    assert.ok(prom.includes('eloquent_audio_rms 0.000000'), 'Prometheus RMS metric present');
    assert.ok(prom.includes('eloquent_audio_underflow_total 3'), 'Prometheus underflow counter present');
    assert.ok(prom.includes('eloquent_audio_buffer_fill_ratio'), 'Prometheus fill ratio present');
    assert.ok(prom.includes('eloquent_audio_jitter_milliseconds'), 'Prometheus jitter metric present');

    monitor.destroy();
  });

  it('AudioMonitor renders radial circular canvas visualizer safely', () => {
    const monitor = new AudioMonitor();

    // Populate with 20 frames
    for (let i = 0; i < 20; i++) {
      monitor.circularBuffer.push({
        rms: 0.08,
        isSpeech: true,
        isUnderflow: i % 10 === 0
      });
    }

    // Mock HTML5 Canvas 2D context
    const drawnPaths: string[] = [];
    const mockCtx = {
      clearRect: () => drawnPaths.push('clearRect'),
      beginPath: () => drawnPaths.push('beginPath'),
      arc: () => drawnPaths.push('arc'),
      stroke: () => drawnPaths.push('stroke'),
      moveTo: () => drawnPaths.push('moveTo'),
      lineTo: () => drawnPaths.push('lineTo'),
      fillText: () => drawnPaths.push('fillText'),
      set strokeStyle(_val: any) {},
      set fillStyle(_val: any) {},
      set lineWidth(_val: any) {},
      set font(_val: any) {},
      set textAlign(_val: any) {},
      set textBaseline(_val: any) {},
      set lineCap(_val: any) {}
    };

    const mockCanvas = {
      width: 300,
      height: 300,
      getContext: (type: string) => (type === '2d' ? mockCtx : null)
    };

    monitor.renderCircularVisualizer(mockCanvas as any);

    assert.ok(drawnPaths.includes('clearRect'), 'Canvas should be cleared');
    assert.ok(drawnPaths.includes('arc'), 'Arcs should be drawn for rings');
    assert.ok(drawnPaths.includes('stroke'), 'Strokes should be drawn for bars');
    assert.ok(drawnPaths.includes('fillText'), 'HUD text should be rendered');

    monitor.destroy();
  });
});
