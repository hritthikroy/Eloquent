/**
 * @file bridge.js
 * @description Electron-to-Go IPC bridge with dynamic backpressure regulation,
 * input burst dampening, and memory overflow protection.
 */

'use strict';

const EventEmitter = require('events');

class IPCBridgeWithBackpressure extends EventEmitter {
  /**
   * @param {Object} options
   * @param {number} [options.highWatermark=256] - Queue size that activates backpressure
   * @param {number} [options.lowWatermark=64] - Queue size that releases backpressure
   * @param {number} [options.maxQueueCapacity=1024] - Absolute queue limit; items dropped above this
   */
  constructor(options = {}) {
    super();
    this.highWatermark = options.highWatermark || 256;
    this.lowWatermark = options.lowWatermark || 64;
    this.maxQueueCapacity = options.maxQueueCapacity || 1024;

    this.queue = [];
    this.isBackpressured = false;
    this.isDraining = false;
    this.targetHandler = null;

    this.stats = {
      enqueuedTotal: 0,
      dispatchedTotal: 0,
      droppedTotal: 0,
      backpressureTripsTotal: 0,
      backpressureReleasesTotal: 0,
    };
  }

  /**
   * Set target dispatch handler (e.g. Go bridge native write or network client)
   * @param {Function} handler - async (item) => boolean
   */
  setTargetHandler(handler) {
    this.targetHandler = handler;
  }

  /**
   * Push an audio buffer or frame payload to the bridge with backpressure check
   * @param {Buffer|Object} item
   * @returns {boolean} true if accepted without backpressure, false if backpressure active or item dropped
   */
  write(item) {
    if (!item) return false;

    // Hard capacity check - drop oldest or reject if saturated
    if (this.queue.length >= this.maxQueueCapacity) {
      this.stats.droppedTotal++;
      this.emit('drop', { reason: 'queue_capacity_exceeded', size: this.queue.length });
      return false;
    }

    this.queue.push(item);
    this.stats.enqueuedTotal++;

    // Evaluate high watermark
    if (!this.isBackpressured && this.queue.length >= this.highWatermark) {
      this.isBackpressured = true;
      this.stats.backpressureTripsTotal++;
      this.emit('pause', { queueLength: this.queue.length });
    }

    this.scheduleDrain();
    return !this.isBackpressured;
  }

  /**
   * Schedule asynchronous queue draining
   */
  scheduleDrain() {
    if (this.isDraining || this.queue.length === 0) return;
    this.isDraining = true;

    setImmediate(async () => {
      await this.drainLoop();
    });
  }

  /**
   * Drain items sequentially to the target handler
   */
  async drainLoop() {
    while (this.queue.length > 0) {
      const item = this.queue[0];
      let ok = true;

      if (this.targetHandler) {
        try {
          ok = await this.targetHandler(item);
        } catch (err) {
          this.emit('error', err);
          ok = false;
        }
      }

      if (ok !== false) {
        this.queue.shift();
        this.stats.dispatchedTotal++;
      } else {
        // Target busy, pause drain briefly to prevent busy loop
        break;
      }

      // Evaluate low watermark for backpressure release
      if (this.isBackpressured && this.queue.length <= this.lowWatermark) {
        this.isBackpressured = false;
        this.stats.backpressureReleasesTotal++;
        this.emit('resume', { queueLength: this.queue.length });
      }
    }

    this.isDraining = false;

    // If items remain after backpressure stall, reschedule
    if (this.queue.length > 0) {
      setTimeout(() => this.scheduleDrain(), 10);
    }
  }

  /**
   * Clear all pending buffers in queue (e.g. during emergency memory flush)
   */
  flush() {
    const droppedCount = this.queue.length;
    this.queue = [];
    this.stats.droppedTotal += droppedCount;

    if (this.isBackpressured) {
      this.isBackpressured = false;
      this.stats.backpressureReleasesTotal++;
      this.emit('resume', { queueLength: 0 });
    }

    return droppedCount;
  }

  /**
   * Get telemetry stats
   */
  getMetrics() {
    return {
      queueLength: this.queue.length,
      isBackpressured: this.isBackpressured,
      isDraining: this.isDraining,
      highWatermark: this.highWatermark,
      lowWatermark: this.lowWatermark,
      maxQueueCapacity: this.maxQueueCapacity,
      ...this.stats,
    };
  }
}

module.exports = { IPCBridgeWithBackpressure };
