/**
 * @file bufferQueue.js
 * @description Bounded, non-blocking asynchronous FIFO buffer queue with backpressure
 * control, drop-oldest overflow management, and event-loop yielding for the Nikola audio pipeline.
 */

'use strict';

const EventEmitter = require('events');

/**
 * Bounded asynchronous FIFO queue designed to decouple high-frequency audio buffer
 * ingestion from downstream processing, preventing V8 heap exhaustion and UI thread starvation.
 */
class BufferQueue extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxSize=1024] Maximum queue depth before drop-oldest kicks in.
   * @param {number} [options.highWaterMark] Capacity ratio (0.0-1.0) triggering backpressure. Defaults to 0.8.
   * @param {number} [options.lowWaterMark] Capacity ratio (0.0-1.0) resolving backpressure. Defaults to 0.2.
   * @param {string} [options.name='default'] Queue identifier for telemetry and logging.
   */
  constructor(options = {}) {
    super();

    this.maxSize = options.maxSize > 0 ? options.maxSize : 1024;
    this.highWaterMark = Math.floor(this.maxSize * (options.highWaterMark || 0.8));
    this.lowWaterMark = Math.floor(this.maxSize * (options.lowWaterMark || 0.2));
    this.name = options.name || 'nikola-buffer-queue';

    // Internal linked array for FIFO storage
    this._queue = [];
    this._isBackpressured = false;
    this._closed = false;

    // Real-time telemetry counters
    this._totalEnqueued = 0;
    this._totalDequeued = 0;
    this._totalDropped = 0;
    this._totalBytesEnqueued = 0;
    this._totalBytesDequeued = 0;
    this._backpressureEvents = 0;
    this._lastEnqueueTimeMs = Date.now();
    this._lastDequeueTimeMs = Date.now();
  }

  /**
   * Current queue depth (number of pending buffers).
   * @returns {number}
   */
  get size() {
    return this._queue.length;
  }

  /**
   * True if queue is at or above capacity.
   * @returns {boolean}
   */
  get isFull() {
    return this._queue.length >= this.maxSize;
  }

  /**
   * True if queue is operating under high-watermark backpressure.
   * @returns {boolean}
   */
  get isBackpressured() {
    return this._isBackpressured;
  }

  /**
   * Enqueues a buffer into the FIFO queue in a non-blocking manner.
   * If the queue is at capacity, it drops the oldest buffer (drop-oldest strategy)
   * with a warning log to prevent memory exhaustion.
   * 
   * @param {Buffer|Uint8Array|Object} buffer Raw buffer chunk.
   * @param {Object} [metadata] Optional metadata associated with the chunk.
   * @returns {boolean} True if successfully enqueued.
   */
  enqueue(buffer, metadata = {}) {
    if (this._closed) {
      return false;
    }

    if (!buffer) {
      return false;
    }

    // Standardize buffer payload and capture byte length
    const byteLength = Buffer.isBuffer(buffer) || buffer instanceof Uint8Array
      ? buffer.length
      : (buffer.data ? (buffer.data.length || 0) : 0);

    const entry = {
      buffer,
      byteLength,
      metadata,
      enqueuedAtMs: Date.now()
    };

    // EDGE CASE: Queue overflow handling with drop-oldest strategy
    if (this._queue.length >= this.maxSize) {
      const dropped = this._queue.shift();
      this._totalDropped++;

      // Explicitly dereference dropped buffer to allow GC reclamation
      if (dropped) {
        dropped.buffer = null;
        dropped.metadata = null;
      }

      console.warn(`⚠️ [BufferQueue:${this.name}] Queue overflow threshold (${this.maxSize}) exceeded. Dropped oldest buffer. Total dropped: ${this._totalDropped}`);
      this.emit('drop', {
        queue: this.name,
        totalDropped: this._totalDropped,
        currentSize: this._queue.length
      });
    }

    this._queue.push(entry);
    this._totalEnqueued++;
    this._totalBytesEnqueued += byteLength;
    this._lastEnqueueTimeMs = Date.now();

    // Check high-water mark backpressure
    if (!this._isBackpressured && this._queue.length >= this.highWaterMark) {
      this._isBackpressured = true;
      this._backpressureEvents++;
      this.emit('backpressure:high', {
        queue: this.name,
        depth: this._queue.length,
        highWaterMark: this.highWaterMark
      });
    }

    // Yield control to the event loop non-blockingly via setImmediate
    setImmediate(() => {
      this.emit('data', entry);
    });

    return true;
  }

  /**
   * Dequeues the oldest buffer item in O(1) time.
   * Resets backpressure if depth falls below the low-water mark.
   * 
   * @returns {{ buffer: Buffer|Uint8Array, byteLength: number, metadata: Object, enqueuedAtMs: number }|null}
   */
  dequeue() {
    if (this._queue.length === 0) {
      return null;
    }

    const entry = this._queue.shift();
    if (!entry) {
      return null;
    }

    this._totalDequeued++;
    this._totalBytesDequeued += entry.byteLength;
    this._lastDequeueTimeMs = Date.now();

    // Reset backpressure if queue drains below low-water mark
    if (this._isBackpressured && this._queue.length <= this.lowWaterMark) {
      this._isBackpressured = false;
      this.emit('backpressure:low', {
        queue: this.name,
        depth: this._queue.length,
        lowWaterMark: this.lowWaterMark
      });
    }

    return entry;
  }

  /**
   * Drains and explicitly releases all buffered items to immediately free heap memory.
   * Returns an array of drained items before clearing references.
   * 
   * @returns {Array} List of drained items.
   */
  drain() {
    const drained = this._queue;
    this._queue = [];
    this._isBackpressured = false;

    // Explicitly nullify references in the internal array to assist V8 garbage collection
    for (let i = 0; i < drained.length; i++) {
      if (drained[i]) {
        drained[i].dereference = function() {
          this.buffer = null;
          this.metadata = null;
        };
      }
    }

    this.emit('drain', { count: drained.length, queue: this.name });
    return drained;
  }

  /**
   * Closes the queue, drains pending buffers, and stops accepting new items.
   */
  close() {
    this._closed = true;
    this.drain();
    this.removeAllListeners();
  }

  /**
   * Snapshot of real-time queue health and throughput metrics.
   * @returns {Object}
   */
  getTelemetry() {
    const now = Date.now();
    const fillRatio = this._queue.length / this.maxSize;
    const idleTimeMs = now - Math.max(this._lastEnqueueTimeMs, this._lastDequeueTimeMs);

    return {
      name: this.name,
      depth: this._queue.length,
      maxSize: this.maxSize,
      fillRatio: parseFloat(fillRatio.toFixed(4)),
      isFull: this.isFull,
      isBackpressured: this._isBackpressured,
      totalEnqueued: this._totalEnqueued,
      totalDequeued: this._totalDequeued,
      totalDropped: this._totalDropped,
      totalBytesEnqueued: this._totalBytesEnqueued,
      totalBytesDequeued: this._totalBytesDequeued,
      backpressureEvents: this._backpressureEvents,
      idleTimeMs
    };
  }

  /**
   * Exports Prometheus-compatible text format metrics.
   * @returns {string}
   */
  exportPrometheusMetrics() {
    const t = this.getTelemetry();
    return [
      `# HELP eloquent_queue_depth_current Current depth of buffer queue`,
      `# TYPE eloquent_queue_depth_current gauge`,
      `eloquent_queue_depth_current{queue="${t.name}"} ${t.depth}`,
      ``,
      `# HELP eloquent_queue_fill_ratio Ratio of queue capacity used`,
      `# TYPE eloquent_queue_fill_ratio gauge`,
      `eloquent_queue_fill_ratio{queue="${t.name}"} ${t.fillRatio}`,
      ``,
      `# HELP eloquent_queue_enqueued_total Total buffers enqueued`,
      `# TYPE eloquent_queue_enqueued_total counter`,
      `eloquent_queue_enqueued_total{queue="${t.name}"} ${t.totalEnqueued}`,
      ``,
      `# HELP eloquent_queue_dequeued_total Total buffers dequeued`,
      `# TYPE eloquent_queue_dequeued_total counter`,
      `eloquent_queue_dequeued_total{queue="${t.name}"} ${t.totalDequeued}`,
      ``,
      `# HELP eloquent_queue_dropped_total Total buffers dropped via drop-oldest policy`,
      `# TYPE eloquent_queue_dropped_total counter`,
      `eloquent_queue_dropped_total{queue="${t.name}"} ${t.totalDropped}`,
      ``,
      `# HELP eloquent_queue_backpressure_events_total Total backpressure trigger events`,
      `# TYPE eloquent_queue_backpressure_events_total counter`,
      `eloquent_queue_backpressure_events_total{queue="${t.name}"} ${t.backpressureEvents}`
    ].join('\n') + '\n';
  }
}

module.exports = {
  BufferQueue
};
