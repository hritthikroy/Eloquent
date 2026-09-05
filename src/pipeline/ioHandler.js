/**
 * Antigravity Input-Output Pipeline Handler (IOHandler) - JavaScript Build
 * 
 * Provides a non-blocking queue for student distance selection events,
 * ensuring high throughput and zero event loop stalls during state evaluation.
 * 
 * Includes automatic graceful degradation to single-threaded mode if
 * critical collision loops are detected.
 */

const { VehicleState, STATES } = require('../core/stateMachine');

class IOHandler {
  constructor(vehicleStateInstance = null) {
    this.queue = [];
    this.isDraining = false;
    this.vehicleState = vehicleStateInstance || new VehicleState();
    this.mode = 'concurrent_queue';
    this.fallbackCount = 0;
    this.totalProcessed = 0;
    this.totalLatencyMs = 0;
    this.maxBatchSize = 128;

    if (this.vehicleState && typeof this.vehicleState.on === 'function') {
      this.vehicleState.on('collisionPrevented', (event) => {
        this.handleCollisionAlert(event);
      });
    }
  }

  /**
   * Non-blocking distance selection.
   * Enqueues distance evaluation and returns a Promise without blocking the main event loop.
   * @param {number} distance
   * @param {Object} [options]
   * @returns {Promise<any>}
   */
  chooseDistance(distance, options = {}) {
    return new Promise((resolve, reject) => {
      const event = {
        id: `dist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        distance: typeof distance === 'number' && !Number.isNaN(distance) ? distance : 0,
        options,
        timestamp: Date.now(),
        resolve,
        reject
      };

      this.queue.push(event);

      if (this.mode === 'single_threaded') {
        this.drainSingleThreaded();
      } else {
        if (!this.isDraining) {
          this.isDraining = true;
          setImmediate(() => this.drainQueue());
        }
      }
    });
  }

  drainQueue() {
    let processedThisTick = 0;

    while (this.queue.length > 0 && processedThisTick < this.maxBatchSize) {
      const item = this.queue.shift();
      if (!item) break;

      const evalStart = Date.now();
      try {
        const result = this.vehicleState.chooseDistance(item.distance, item.options);
        const latency = Date.now() - evalStart;
        this.totalLatencyMs += latency;
        this.totalProcessed++;
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
      processedThisTick++;
    }

    if (this.queue.length > 0) {
      setImmediate(() => this.drainQueue());
    } else {
      this.isDraining = false;
    }
  }

  drainSingleThreaded() {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        const result = this.vehicleState.chooseDistance(item.distance, item.options);
        this.totalProcessed++;
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
    }
  }

  handleCollisionAlert(event) {
    this.fallbackCount++;
    this.mode = 'single_threaded';
    console.warn('⚠️ [IOHandler] Critical collision loop detected - gracefully degraded to single-threaded mode:', event);

    setTimeout(() => {
      this.mode = 'concurrent_queue';
    }, 2000);
  }

  getVehicleState() {
    return this.vehicleState;
  }

  getMetrics() {
    return {
      totalProcessed: this.totalProcessed,
      queueLength: this.queue.length,
      averageLatencyMs: this.totalProcessed > 0 ? this.totalLatencyMs / this.totalProcessed : 0,
      fallbackCount: this.fallbackCount,
      mode: this.mode
    };
  }

  reset() {
    this.queue = [];
    this.isDraining = false;
    this.mode = 'concurrent_queue';
    this.fallbackCount = 0;
    this.totalProcessed = 0;
    this.totalLatencyMs = 0;
    if (this.vehicleState && typeof this.vehicleState.reset === 'function') {
      this.vehicleState.reset();
    }
  }
}

const ioHandler = new IOHandler();
const chooseDistance = (distance, options) => ioHandler.chooseDistance(distance, options);

module.exports = {
  IOHandler,
  ioHandler,
  chooseDistance
};
