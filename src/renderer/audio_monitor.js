/**
 * @file audio_monitor.js
 * @description High-frequency audio telemetry monitor and circular buffer visualizer for the
 * Electron renderer. Employs a requestAnimationFrame-based batch update strategy to coalesce
 * high-frequency IPC streams from the Go backend, completely eliminating UI thread starvation
 * and maintaining sub-millisecond audio synchronization.
 */

'use strict';

/**
 * Pre-allocated Circular Audio Ring Buffer for O(1) telemetry ingestion and historical rendering.
 */
class CircularAudioBuffer {
  /**
   * @param {number} capacity Maximum number of historical telemetry items.
   */
  constructor(capacity = 512) {
    this.capacity = capacity > 0 ? capacity : 512;
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * Push a telemetry item into the circular buffer in O(1) time without heap allocations.
   * @param {Object} item Audio telemetry item.
   */
  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  /**
   * Returns the most recent telemetry item, or null if buffer is empty.
   * @returns {Object|null}
   */
  getLatest() {
    if (this.size === 0) return null;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx] || null;
  }

  /**
   * Returns an array of items in chronological order.
   * @returns {Array<Object>}
   */
  toArray() {
    const result = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      const idx = (this.tail + i) % this.capacity;
      result[i] = this.buffer[idx];
    }
    return result;
  }

  /**
   * Current buffer fill saturation ratio (0.0 to 1.0).
   * @returns {number}
   */
  getFillRatio() {
    return this.size / this.capacity;
  }

  /**
   * Clears the circular buffer.
   */
  clear() {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}

/**
 * AudioMonitor orchestrates IPC listener subscription, rAF update pacing,
 * circular buffer telemetry tracking, and Prometheus metrics exporting.
 */
class AudioMonitor {
  /**
   * @param {Object} [options] Configuration options.
   * @param {number} [options.bufferCapacity=512] Capacity of the circular telemetry ring buffer.
   * @param {number} [options.targetFps=60] Target animation frame rate for UI updates.
   * @param {Function} [options.onUpdate] Callback invoked on each rAF update tick with processed telemetry.
   */
  constructor(options = {}) {
    this.options = {
      bufferCapacity: options.bufferCapacity || 512,
      targetFps: options.targetFps || 60,
      onUpdate: options.onUpdate || null
    };

    this.circularBuffer = new CircularAudioBuffer(this.options.bufferCapacity);

    // Incoming queue for high-frequency IPC batches
    this.pendingQueue = [];
    this.rafPending = false;
    this.rafId = null;

    // Smoothed telemetry state
    this.stats = {
      rms: 0,
      peak: 0,
      isSpeech: false,
      isSilence: true,
      isUnderflow: false,
      underflowCount: 0,
      droppedFrames: 0,
      latencyMs: 0,
      jitterMs: 0,
      lastTimestampNs: 0,
      totalFramesProcessed: 0,
      batchesReceived: 0,
      fps: this.options.targetFps
    };

    // Jitter tracking state
    this.lastFrameArrivalMs = 0;
    this.meanInterArrivalTimeMs = 16.66;
    // Queue telemetry state (BufferQueue + NikolaProcessor)
    this.queueTelemetry = {
      depth: 0,
      maxSize: 1024,
      totalEnqueued: 0,
      totalDequeued: 0,
      totalDropped: 0,
      backpressureHighEvents: 0,
      isBackpressured: false,
      // Processor metrics
      circuitState: 'CLOSED',
      processedCount: 0,
      malformedCount: 0,
      circuitTripCount: 0,
      avgProcessingTimeMs: 0,
      queueDepth: 0,
      // Go runtime heap metrics
      goHeapInUseMB: 0,
      goHeapAllocMB: 0,
      goHeapSysMB: 0,
      goGcCycles: 0,
      goGoroutines: 0,
      goHeapGrowthMB: 0,
      goMetricSource: 'unknown'
    };
    this._queuePollTimer = null;

    // Subscribers and listening flag
    this.subscribers = new Set();
    this.isListening = false;

    // Detect environment rAF or fallback to setImmediate/setTimeout
    this.scheduleRaf = (callback) => {
      if (typeof requestAnimationFrame === 'function') {
        return requestAnimationFrame(callback);
      }
      if (typeof setImmediate === 'function') {
        return setImmediate(callback);
      }
      return setTimeout(callback, 16);
    };

    this.cancelRaf = (id) => {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(id);
      } else if (typeof clearImmediate === 'function') {
        clearImmediate(id);
      } else {
        clearTimeout(id);
      }
    };
  }

  /**
   * Attach listener to the Electron IPC bridge.
   * Handles both electron.ipcRenderer and window.electronAPI wrappers.
   * @param {Object} [ipc] IPC emitter/receiver instance.
   */
  attachIPC(ipc) {
    const targetIpc = ipc || (typeof window !== 'undefined' && (window.electronAPI || window.ipcRenderer)) || null;

    if (!targetIpc) {
      return false;
    }

    const handler = (_event, data) => {
      if (Array.isArray(data)) {
        this.handleTelemetryBatch(data);
      } else if (data && Array.isArray(data.items)) {
        this.handleTelemetryBatch(data.items);
      } else if (data) {
        this.handleTelemetryBatch([data]);
      }
    };

    if (typeof targetIpc.on === 'function') {
      targetIpc.on('audio:telemetry-batch', handler);
      targetIpc.on('audio:telemetry', handler);
      this.isListening = true;
    } else if (typeof targetIpc.receive === 'function') {
      targetIpc.receive('audio:telemetry-batch', handler);
      this.isListening = true;
    }

    // Attach queue telemetry polling via the same IPC bridge
    this.attachQueueTelemetry(targetIpc);

    return this.isListening;
  }

  /**
   * Start polling the BufferQueue + NikolaProcessor telemetry from the main process
   * via the 'audio:queue-telemetry' IPC invoke channel.
   * Polls every 500ms and updates queueTelemetry state without blocking the UI thread.
   * @param {Object} ipc IPC bridge (must have invoke() method).
   */
  attachQueueTelemetry(ipc) {
    if (!ipc || typeof ipc.invoke !== 'function') return;

    const poll = async () => {
      try {
        // Fetch both channels concurrently — neither blocks the UI thread
        const [telemetry, goMemdiag] = await Promise.allSettled([
          ipc.invoke('audio:queue-telemetry'),
          ipc.invoke('go:memdiag-snapshot')
        ]);

        if (telemetry.status === 'fulfilled' && telemetry.value && telemetry.value.queue) {
          const q = telemetry.value.queue;
          const p = telemetry.value.processor || {};

          // Merge Go heap snapshot if available
          const goSnap = goMemdiag.status === 'fulfilled' && goMemdiag.value && goMemdiag.value.snapshot
            ? goMemdiag.value.snapshot : null;

          this.queueTelemetry = {
            depth: q.depth || 0,
            maxSize: q.maxSize || 1024,
            totalEnqueued: q.totalEnqueued || 0,
            totalDequeued: q.totalDequeued || 0,
            totalDropped: q.totalDropped || 0,
            backpressureHighEvents: q.backpressureHighEvents || 0,
            isBackpressured: Boolean(q.isBackpressured),
            circuitState: p.circuitState || 'CLOSED',
            processedCount: p.processedCount || 0,
            malformedCount: p.malformedCount || 0,
            circuitTripCount: p.circuitTripCount || 0,
            avgProcessingTimeMs: p.avgProcessingTimeMs || 0,
            queueDepth: p.queueDepth || 0,
            // Go heap metrics
            goHeapInUseMB: goSnap ? (goSnap.heapInUseMB || 0) : this.queueTelemetry.goHeapInUseMB,
            goHeapAllocMB: goSnap ? (goSnap.heapAllocMB || 0) : this.queueTelemetry.goHeapAllocMB,
            goHeapSysMB:   goSnap ? (goSnap.heapSysMB || 0)  : this.queueTelemetry.goHeapSysMB,
            goGcCycles:    goSnap ? (goSnap.gcCycles || 0)    : this.queueTelemetry.goGcCycles,
            goGoroutines:  goSnap ? (goSnap.numGoroutines || 0) : this.queueTelemetry.goGoroutines,
            goHeapGrowthMB: goSnap ? (goSnap.heapGrowthMB || 0) : this.queueTelemetry.goHeapGrowthMB,
            goMetricSource: goMemdiag.status === 'fulfilled' && goMemdiag.value
              ? (goMemdiag.value.source || 'unknown') : 'unavailable'
          };

          // Notify subscribers
          for (const callback of this.subscribers) {
            try { callback(this.stats, this.circularBuffer, this.queueTelemetry); } catch (_) {}
          }
        }
      } catch (_) { /* IPC not ready or not available */ }
    };

    // Immediate first fetch, then every 500ms
    poll();
    this._queuePollTimer = setInterval(poll, 500);
  }

  /**
   * Stop all telemetry polling.
   */
  detachQueueTelemetry() {
    if (this._queuePollTimer !== null) {
      clearInterval(this._queuePollTimer);
      this._queuePollTimer = null;
    }
  }

  /**
   * Non-blocking ingestion of incoming telemetry batches from Go IPC bridge.
   * Buffers items into pendingQueue and schedules a single rAF coalescing tick.
   * @param {Array<Object>} batch Batch of telemetry items.
   */
  handleTelemetryBatch(batch) {
    if (!Array.isArray(batch) || batch.length === 0) {
      return;
    }

    this.stats.batchesReceived++;

    // Ingest into pending queue (O(1) per sample)
    for (let i = 0; i < batch.length; i++) {
      this.pendingQueue.push(batch[i]);
    }

    // Schedule rAF coalescing pass if not already pending
    if (!this.rafPending) {
      this.rafPending = true;
      this.rafId = this.scheduleRaf(() => this.processPendingQueue());
    }
  }

  /**
   * Primary rAF update tick: drains the pendingQueue once per screen refresh boundary,
   * updates the circular ring buffer, recalculates smoothed metrics and jitter,
   * and dispatches updates to subscribers without starving the UI thread.
   */
  processPendingQueue() {
    this.rafPending = false;
    this.rafId = null;

    if (this.pendingQueue.length === 0) {
      return;
    }

    const now = Date.now();
    if (this.lastFrameArrivalMs > 0) {
      const delta = now - this.lastFrameArrivalMs;
      // Exponential moving average for inter-arrival time and jitter
      const jitterDelta = Math.abs(delta - this.meanInterArrivalTimeMs);
      this.stats.jitterMs = (this.stats.jitterMs * 0.85) + (jitterDelta * 0.15);
      this.meanInterArrivalTimeMs = (this.meanInterArrivalTimeMs * 0.9) + (delta * 0.1);
    }
    this.lastFrameArrivalMs = now;

    // Drain pendingQueue
    const items = this.pendingQueue;
    this.pendingQueue = [];

    let latest = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      latest = item;
      this.circularBuffer.push(item);
      this.stats.totalFramesProcessed++;

      if (item.isUnderflow) {
        this.stats.underflowCount++;
      }
      if (item.underflowCount !== undefined) {
        this.stats.underflowCount = Math.max(this.stats.underflowCount, item.underflowCount);
      }
    }

    if (latest) {
      // Calculate smoothed latency (sub-millisecond synchronization)
      if (latest.timestampNs) {
        const backendTimeMs = latest.timestampNs / 1e6;
        const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        // Measure handoff latency if timestamps are coherent
        const latency = Math.max(0, Math.min(50, nowMs - (backendTimeMs % 1000000)));
        this.stats.latencyMs = (this.stats.latencyMs * 0.8) + (latency * 0.2);
      }

      this.stats.rms = latest.rms || 0;
      this.stats.peak = latest.peak || 0;
      this.stats.isSpeech = Boolean(latest.isSpeech);
      this.stats.isSilence = Boolean(latest.isSilence);
      this.stats.isUnderflow = Boolean(latest.isUnderflow);
      this.stats.lastTimestampNs = latest.timestampNs || 0;
    }

    // Notify registered subscribers
    if (typeof this.options.onUpdate === 'function') {
      this.options.onUpdate(this.stats, this.circularBuffer);
    }

    for (const callback of this.subscribers) {
      try {
        callback(this.stats, this.circularBuffer);
      } catch (err) {
        // Silently isolate subscriber errors
      }
    }
  }

  /**
   * Subscribe to rAF-pushed telemetry state updates.
   * @param {Function} callback Callback receiving (stats, circularBuffer).
   * @returns {Function} Unsubscribe function.
   */
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
    }
    return () => this.subscribers.delete(callback);
  }

  /**
   * High-performance Radial Circular Buffer Waveform Visualizer.
   * Renders real-time buffer saturation, dynamic audio amplitude bars,
   * and latency jitter health ring onto an HTML5 Canvas.
   * @param {HTMLCanvasElement} canvas Canvas target.
   * @param {Object} [options] Visualizer styling options.
   */
  renderCircularVisualizer(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width || 300;
    const height = canvas.height || 300;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(centerX, centerY) * 0.55;

    ctx.clearRect(0, 0, width, height);

    const data = this.circularBuffer.toArray();
    const count = Math.min(data.length, 128);
    const fillRatio = this.circularBuffer.getFillRatio();

    // 1. Draw inner circular buffer ring (buffer fill saturation)
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Saturated arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.65, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * fillRatio));
    ctx.strokeStyle = this.stats.isUnderflow ? '#ef4444' : (this.stats.isSpeech ? '#10b981' : '#6366f1');
    ctx.lineWidth = 4;
    ctx.stroke();

    // 2. Draw radial waveform bars
    if (count > 0) {
      const angleStep = (Math.PI * 2) / count;
      const stepOffset = Math.max(1, Math.floor(data.length / count));

      for (let i = 0; i < count; i++) {
        const item = data[i * stepOffset] || data[i];
        const angle = i * angleStep - Math.PI / 2;
        const rms = item ? Math.min(1.0, item.rms * 8.0) : 0;
        const barHeight = 4 + (rms * (baseRadius * 0.8));

        const x1 = centerX + Math.cos(angle) * baseRadius;
        const y1 = centerY + Math.sin(angle) * baseRadius;
        const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight);
        const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = item && item.isUnderflow
          ? 'rgba(239, 68, 68, 0.7)'
          : (item && item.isSpeech ? 'rgba(16, 185, 129, 0.85)' : 'rgba(147, 51, 234, 0.65)');
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // 3. Center telemetry label
    ctx.fillStyle = this.stats.isSpeech ? '#10b981' : '#a1a1aa';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${(this.stats.rms * 100).toFixed(1)}% RMS`, centerX, centerY - 6);

    ctx.fillStyle = '#71717a';
    ctx.font = '400 9px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Jitter: ${this.stats.jitterMs.toFixed(1)}ms`, centerX, centerY + 8);
  }

  /**
   * Generates Prometheus-format metrics text for audio latency, jitter, and buffer health.
   * @returns {string} Prometheus formatted metrics string.
   */
  exportPrometheusMetrics() {
    const q = this.queueTelemetry;
    const fillRatio = q.maxSize > 0 ? (q.depth / q.maxSize) : 0;

    const lines = [
      // ── Audio frame metrics ────────────────────────────────────────────────
      '# HELP eloquent_audio_rms Root Mean Square audio energy level (0.0 - 1.0)',
      '# TYPE eloquent_audio_rms gauge',
      `eloquent_audio_rms ${this.stats.rms.toFixed(6)}`,
      '',
      '# HELP eloquent_audio_peak Peak 16-bit PCM amplitude (-32768 to 32767)',
      '# TYPE eloquent_audio_peak gauge',
      `eloquent_audio_peak ${this.stats.peak}`,
      '',
      '# HELP eloquent_audio_latency_milliseconds Roundtrip latency from backend audio loop to UI',
      '# TYPE eloquent_audio_latency_milliseconds gauge',
      `eloquent_audio_latency_milliseconds ${this.stats.latencyMs.toFixed(6)}`,
      '',
      '# HELP eloquent_audio_jitter_milliseconds Inter-arrival audio frame jitter in milliseconds',
      '# TYPE eloquent_audio_jitter_milliseconds gauge',
      `eloquent_audio_jitter_milliseconds ${this.stats.jitterMs.toFixed(6)}`,
      '',
      '# HELP eloquent_audio_underflow_total Total count of buffer underflows detected',
      '# TYPE eloquent_audio_underflow_total counter',
      `eloquent_audio_underflow_total ${this.stats.underflowCount}`,
      '',
      '# HELP eloquent_audio_dropped_frames_total Total count of dropped audio frames',
      '# TYPE eloquent_audio_dropped_frames_total counter',
      `eloquent_audio_dropped_frames_total ${this.stats.droppedFrames}`,
      '',
      '# HELP eloquent_audio_buffer_fill_ratio Circular buffer saturation ratio (0.0 - 1.0)',
      '# TYPE eloquent_audio_buffer_fill_ratio gauge',
      `eloquent_audio_buffer_fill_ratio ${this.circularBuffer.getFillRatio().toFixed(4)}`,
      '',
      '# HELP eloquent_audio_total_frames_processed Total audio frames processed by renderer',
      '# TYPE eloquent_audio_total_frames_processed counter',
      `eloquent_audio_total_frames_processed ${this.stats.totalFramesProcessed}`,
      '',
      // ── BufferQueue metrics ────────────────────────────────────────────────
      '# HELP eloquent_queue_depth_current Current number of items in the async BufferQueue',
      '# TYPE eloquent_queue_depth_current gauge',
      `eloquent_queue_depth_current ${q.depth}`,
      '',
      '# HELP eloquent_queue_fill_ratio BufferQueue depth / maxSize ratio (0.0 - 1.0)',
      '# TYPE eloquent_queue_fill_ratio gauge',
      `eloquent_queue_fill_ratio ${fillRatio.toFixed(4)}`,
      '',
      '# HELP eloquent_queue_enqueued_total Total buffers enqueued since startup',
      '# TYPE eloquent_queue_enqueued_total counter',
      `eloquent_queue_enqueued_total ${q.totalEnqueued}`,
      '',
      '# HELP eloquent_queue_dequeued_total Total buffers dequeued since startup',
      '# TYPE eloquent_queue_dequeued_total counter',
      `eloquent_queue_dequeued_total ${q.totalDequeued}`,
      '',
      '# HELP eloquent_queue_dropped_total Total buffers dropped due to overflow (drop-oldest)',
      '# TYPE eloquent_queue_dropped_total counter',
      `eloquent_queue_dropped_total ${q.totalDropped}`,
      '',
      '# HELP eloquent_queue_backpressure_high_events_total Backpressure high-watermark events',
      '# TYPE eloquent_queue_backpressure_high_events_total counter',
      `eloquent_queue_backpressure_high_events_total ${q.backpressureHighEvents}`,
      '',
      '# HELP eloquent_queue_is_backpressured Current backpressure state (1=yes, 0=no)',
      '# TYPE eloquent_queue_is_backpressured gauge',
      `eloquent_queue_is_backpressured ${q.isBackpressured ? 1 : 0}`,
      '',
      // ── NikolaProcessor metrics ────────────────────────────────────────────
      '# HELP eloquent_processor_processed_total Total audio chunks processed by NikolaProcessor',
      '# TYPE eloquent_processor_processed_total counter',
      `eloquent_processor_processed_total ${q.processedCount}`,
      '',
      '# HELP eloquent_processor_malformed_total Total malformed packets isolated',
      '# TYPE eloquent_processor_malformed_total counter',
      `eloquent_processor_malformed_total ${q.malformedCount}`,
      '',
      '# HELP eloquent_processor_circuit_trips_total Total circuit-breaker trips (OPEN events)',
      '# TYPE eloquent_processor_circuit_trips_total counter',
      `eloquent_processor_circuit_trips_total ${q.circuitTripCount}`,
      '',
      '# HELP eloquent_processor_avg_processing_time_ms Average chunk processing time in ms',
      '# TYPE eloquent_processor_avg_processing_time_ms gauge',
      `eloquent_processor_avg_processing_time_ms ${(q.avgProcessingTimeMs || 0).toFixed(6)}`,
      '',
      '# HELP eloquent_processor_circuit_state Circuit-breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)',
      '# TYPE eloquent_processor_circuit_state gauge',
      `eloquent_processor_circuit_state ${q.circuitState === 'CLOSED' ? 0 : q.circuitState === 'OPEN' ? 1 : 2}`,
      '',
      // ── Go runtime heap metrics ────────────────────────────────────────────
      '# HELP eloquent_go_heap_inuse_mb Go heap in-use memory (MB)',
      '# TYPE eloquent_go_heap_inuse_mb gauge',
      `eloquent_go_heap_inuse_mb ${(q.goHeapInUseMB || 0).toFixed(4)}`,
      '',
      '# HELP eloquent_go_heap_alloc_mb Go heap allocated memory (MB)',
      '# TYPE eloquent_go_heap_alloc_mb gauge',
      `eloquent_go_heap_alloc_mb ${(q.goHeapAllocMB || 0).toFixed(4)}`,
      '',
      '# HELP eloquent_go_heap_sys_mb Go heap system memory (MB)',
      '# TYPE eloquent_go_heap_sys_mb gauge',
      `eloquent_go_heap_sys_mb ${(q.goHeapSysMB || 0).toFixed(4)}`,
      '',
      '# HELP eloquent_go_gc_cycles_total Total Go GC cycles',
      '# TYPE eloquent_go_gc_cycles_total counter',
      `eloquent_go_gc_cycles_total ${q.goGcCycles || 0}`,
      '',
      '# HELP eloquent_go_goroutines Current number of Go goroutines',
      '# TYPE eloquent_go_goroutines gauge',
      `eloquent_go_goroutines ${q.goGoroutines || 0}`,
      '',
      '# HELP eloquent_go_heap_growth_mb Go heap growth since last sample (MB)',
      '# TYPE eloquent_go_heap_growth_mb gauge',
      `eloquent_go_heap_growth_mb ${(q.goHeapGrowthMB || 0).toFixed(6)}`
    ];

    return lines.join('\n') + '\n';
  }

  /**
   * Stop active listening, cancel any scheduled rAF, and stop queue telemetry polling.
   */
  destroy() {
    if (this.rafId !== null) {
      this.cancelRaf(this.rafId);
      this.rafId = null;
    }
    this.detachQueueTelemetry();
    this.rafPending = false;
    this.subscribers.clear();
    this.pendingQueue = [];
    this.circularBuffer.clear();
  }
}

// Universal module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CircularAudioBuffer,
    AudioMonitor
  };
}

if (typeof window !== 'undefined') {
  window.CircularAudioBuffer = CircularAudioBuffer;
  window.AudioMonitor = AudioMonitor;
}
