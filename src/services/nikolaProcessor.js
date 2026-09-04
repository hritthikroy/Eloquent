/**
 * @file nikolaProcessor.js
 * @description High-throughput, non-blocking asynchronous audio processor for the Nikola module.
 * Consumes chunks from a BufferQueue in isolation, implements a circuit breaker to prevent
 * cascading lag, and strictly manages memory to eliminate heap leaks in Electron.
 */

'use strict';

const EventEmitter = require('events');

/**
 * Circuit breaker states for managing processing pipeline health.
 */
const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation: processing all incoming buffers
  OPEN: 'OPEN',           // Tripped: pipeline lag or consecutive errors exceeded threshold; consumption paused
  HALF_OPEN: 'HALF_OPEN'  // Recovery probe: testing limited buffers to verify pipeline health
};

/**
 * NikolaProcessor decouples high-frequency audio buffer consumption from synchronous execution.
 * It processes audio frames in complete isolation with zero blocking calls, shielding the
 * pipeline against malformed packets and UI thread starvation.
 */
class NikolaProcessor extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {import('../core/bufferQueue').BufferQueue} [options.queue] BufferQueue instance.
   * @param {number} [options.maxLagMs=100] Maximum allowable processing lag before circuit breaker trips.
   * @param {number} [options.consecutiveErrorThreshold=5] Errors allowed before opening circuit.
   * @param {number} [options.circuitCooldownMs=200] Time to remain in OPEN state before testing HALF_OPEN.
   * @param {number} [options.batchSize=16] Maximum buffers to process before yielding to event loop.
   * @param {Function} [options.onFrame] Callback for processed audio frames.
   */
  constructor(options = {}) {
    super();

    this.queue = options.queue || null;
    this.maxLagMs = options.maxLagMs || 100;
    this.consecutiveErrorThreshold = options.consecutiveErrorThreshold || 5;
    this.circuitCooldownMs = options.circuitCooldownMs || 200;
    this.batchSize = options.batchSize || 16;
    this.onFrameCallback = options.onFrame || null;

    // Consumer loop lifecycle
    this._isRunning = false;
    this._consumerTimer = null;
    this._isProcessing = false;

    // Circuit breaker state
    this.circuitState = CircuitState.CLOSED;
    this._consecutiveErrors = 0;
    this._lastCircuitTripMs = 0;
    this._halfOpenSuccesses = 0;

    // Telemetry & metrics
    this.processedCount = 0;
    this.malformedCount = 0;
    this.circuitTripCount = 0;
    this.totalProcessingTimeMs = 0;
    this.lastProcessedTimeMs = Date.now();
  }

  /**
   * Connects the processor to a BufferQueue instance.
   * @param {import('../core/bufferQueue').BufferQueue} queue
   */
  attachQueue(queue) {
    this.queue = queue;
  }

  /**
   * Starts the asynchronous consumer loop.
   */
  start() {
    if (this._isRunning) {
      return;
    }

    if (!this.queue) {
      throw new Error('Cannot start NikolaProcessor without an attached BufferQueue');
    }

    this._isRunning = true;
    this._scheduleNextLoop();
    this.emit('start');
  }

  /**
   * Gracefully stops the consumer loop.
   */
  stop() {
    this._isRunning = false;
    if (this._consumerTimer) {
      clearImmediate(this._consumerTimer);
      this._consumerTimer = null;
    }
    this.emit('stop');
  }

  /**
   * Registers a frame output handler.
   * @param {Function} handler Callback receiving (processedFrame).
   */
  registerOutputHandler(handler) {
    if (typeof handler === 'function') {
      this.onFrameCallback = handler;
    }
  }

  /**
   * Schedules the next iteration of the consumer loop via setImmediate,
   * yielding control to the Node.js event loop and preventing UI thread starvation.
   * @private
   */
  _scheduleNextLoop() {
    if (!this._isRunning) {
      return;
    }

    this._consumerTimer = setImmediate(() => {
      this._consumerLoop();
    });
  }

  /**
   * Main asynchronous consumer loop. Processes batches of buffers in isolation
   * and enforces circuit breaker gating.
   * @private
   */
  async _consumerLoop() {
    if (!this._isRunning || this._isProcessing) {
      return;
    }

    this._isProcessing = true;

    try {
      // 1. Check Circuit Breaker status
      if (this.circuitState === CircuitState.OPEN) {
        const timeInOpen = Date.now() - this._lastCircuitTripMs;
        if (timeInOpen >= this.circuitCooldownMs) {
          this.circuitState = CircuitState.HALF_OPEN;
          this._halfOpenSuccesses = 0;
          this.emit('circuit:half-open');
        } else {
          // Still in cooldown: yield and wait for next tick
          this._isProcessing = false;
          this._scheduleNextLoop();
          return;
        }
      }

      // 2. Consume batch of items from queue
      let processedInBatch = 0;
      const limit = this.circuitState === CircuitState.HALF_OPEN ? 1 : this.batchSize;

      while (processedInBatch < limit && this.queue && this.queue.size > 0) {
        const item = this.queue.dequeue();
        if (!item) {
          break;
        }

        const startMs = Date.now();
        const lagMs = startMs - item.enqueuedAtMs;

        // Check if lag exceeds threshold
        if (lagMs > this.maxLagMs) {
          this._tripCircuitBreaker(`Processing lag exceeded limit: ${lagMs}ms > ${this.maxLagMs}ms`);
          // Continue to process current item, but stop batch
          this._processSingleChunkIsolated(item);
          break;
        }

        // Process chunk with full error isolation
        const success = this._processSingleChunkIsolated(item);

        const durationMs = Date.now() - startMs;
        this.totalProcessingTimeMs += durationMs;
        this.lastProcessedTimeMs = Date.now();

        if (success) {
          if (this.circuitState === CircuitState.HALF_OPEN) {
            this._halfOpenSuccesses++;
            if (this._halfOpenSuccesses >= 3) {
              this._resetCircuitBreaker();
            }
          }
          this._consecutiveErrors = 0;
        } else {
          this._consecutiveErrors++;
          if (this._consecutiveErrors >= this.consecutiveErrorThreshold) {
            this._tripCircuitBreaker(`Consecutive error threshold (${this.consecutiveErrorThreshold}) exceeded`);
            break;
          }
        }

        processedInBatch++;
      }
    } catch (unexpectedLoopError) {
      // Shield the main loop against unexpected errors
      console.error('❌ [NikolaProcessor] Unexpected error in consumer loop:', unexpectedLoopError);
    } finally {
      this._isProcessing = false;
      this._scheduleNextLoop();
    }
  }

  /**
   * Processes a single chunk in complete isolation.
   * If a packet is malformed, corrupt, or invalid, it handles the error cleanly
   * without crashing the consumer loop.
   * 
   * @param {Object} item Dequeued item from BufferQueue.
   * @returns {boolean} True if processed successfully, false if malformed.
   * @private
   */
  _processSingleChunkIsolated(item) {
    if (!item) {
      return false;
    }

    try {
      const rawBuf = item.buffer;

      // 1. Validation & sanitization: guard against null, undefined, or empty payload
      if (!rawBuf) {
        this.malformedCount++;
        this.emit('malformed', { reason: 'Null or undefined buffer payload', item });
        return false;
      }

      let buf;
      if (Buffer.isBuffer(rawBuf)) {
        buf = rawBuf;
      } else if (rawBuf instanceof Uint8Array) {
        buf = Buffer.from(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength);
      } else if (rawBuf.data && (Buffer.isBuffer(rawBuf.data) || rawBuf.data instanceof Uint8Array)) {
        buf = Buffer.isBuffer(rawBuf.data)
          ? rawBuf.data
          : Buffer.from(rawBuf.data.buffer, rawBuf.data.byteOffset, rawBuf.data.byteLength);
      } else {
        this.malformedCount++;
        this.emit('malformed', { reason: 'Unrecognized buffer payload type', item });
        return false;
      }

      if (buf.length === 0) {
        this.malformedCount++;
        this.emit('malformed', { reason: 'Zero-length buffer payload', item });
        return false;
      }

      // 2. Sample analysis: 16-bit PCM RMS and Peak calculation (constant O(1) per sample)
      let sumSq = 0;
      let peak = 0;
      const sampleCount = Math.floor(buf.length / 2);

      for (let i = 0; i < buf.length - 1; i += 2) {
        const sample = buf.readInt16LE(i);
        const absSample = Math.abs(sample);
        if (absSample > peak) {
          peak = absSample;
        }
        const normalized = sample / 32768.0;
        sumSq += normalized * normalized;
      }

      const rms = sampleCount > 0 ? Math.sqrt(sumSq / sampleCount) : 0;
      const decibels = rms > 0 ? Math.max(-96, 20 * Math.log10(rms)) : -96;

      const processedFrame = {
        size: buf.length,
        sampleCount,
        rms: parseFloat(rms.toFixed(5)),
        peak,
        decibels: parseFloat(decibels.toFixed(2)),
        isSpeech: rms >= 0.003,
        isSilence: rms < 0.0001,
        enqueuedAtMs: item.enqueuedAtMs,
        processedAtMs: Date.now(),
        metadata: item.metadata || {}
      };

      this.processedCount++;

      // Dispatch to registered handler or emit event
      if (typeof this.onFrameCallback === 'function') {
        try {
          this.onFrameCallback(processedFrame);
        } catch (cbErr) {
          console.warn('⚠️ [NikolaProcessor] Error in onFrameCallback:', cbErr.message);
        }
      }

      this.emit('frame', processedFrame);

      // 3. STRICT MEMORY MANAGEMENT: Explicitly dereference buffers to enable fast V8 GC
      item.buffer = null;
      item.metadata = null;
      buf = null;

      return true;
    } catch (err) {
      this.malformedCount++;
      this.emit('malformed', { reason: err.message, item });
      // Ensure dereference on failure as well
      item.buffer = null;
      return false;
    }
  }

  /**
   * Trips the circuit breaker to OPEN state.
   * @param {string} reason
   * @private
   */
  _tripCircuitBreaker(reason) {
    if (this.circuitState !== CircuitState.OPEN) {
      this.circuitState = CircuitState.OPEN;
      this._lastCircuitTripMs = Date.now();
      this.circuitTripCount++;
      console.warn(`⚡ [NikolaProcessor] Circuit breaker TRIPPED (OPEN): ${reason}`);
      this.emit('circuit:open', { reason, tripCount: this.circuitTripCount });
    }
  }

  /**
   * Resets the circuit breaker to CLOSED state.
   * @private
   */
  _resetCircuitBreaker() {
    this.circuitState = CircuitState.CLOSED;
    this._consecutiveErrors = 0;
    this._halfOpenSuccesses = 0;
    console.log('✅ [NikolaProcessor] Circuit breaker RESET (CLOSED). Normal operation restored.');
    this.emit('circuit:closed');
  }

  /**
   * Snapshot of processor performance metrics.
   * @returns {Object}
   */
  getMetrics() {
    const avgProcessingTimeMs = this.processedCount > 0
      ? parseFloat((this.totalProcessingTimeMs / this.processedCount).toFixed(3))
      : 0;

    return {
      circuitState: this.circuitState,
      isRunning: this._isRunning,
      processedCount: this.processedCount,
      malformedCount: this.malformedCount,
      circuitTripCount: this.circuitTripCount,
      avgProcessingTimeMs,
      consecutiveErrors: this._consecutiveErrors,
      lastProcessedTimeMs: this.lastProcessedTimeMs,
      queueDepth: this.queue ? this.queue.size : 0
    };
  }
}

module.exports = {
  NikolaProcessor,
  CircuitState
};
