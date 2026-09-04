/**
 * SyncManager - Non-Blocking Audio/Visual Synchronization Manager
 * 
 * Offloads heavy drift calculations, clock alignment, and backend synchronization
 * to a dedicated WebWorker thread (forceSyncWorker.js). Ensures the main renderer
 * thread executes well within the 16 ms (60 FPS) frame budget.
 * 
 * Resilience & Fault Tolerance:
 * 1. Worker crash detection with automatic restart and health monitoring.
 * 2. Strict queue depth bounds (default max 64) preventing memory exhaustion.
 * 3. Timeout guards (default 3000ms) with seamless fallback to main-thread forceSync.
 * 4. Zero global variable pollution; clean ES6 exports.
 */

import { FORCE_SYNC_REQUEST, FORCE_SYNC_RESPONSE } from '../main/ipcChannels.js';
import { computeDriftMetrics } from './forceSyncWorker.js';

let requestIdCounter = 0;

export class SyncManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.workerPath] - Path to forceSyncWorker.js
   * @param {Object} [options.workerInstance] - Injected Worker instance (for testing/mocking)
   * @param {number} [options.maxQueueDepth=64] - Maximum pending in-flight requests
   * @param {number} [options.timeoutMs=3000] - Request timeout before fallback
   * @param {string} [options.backendUrl] - Go audio backend URL
   * @param {boolean} [options.enableWorker=true] - Whether to use worker or main-thread sync
   * @param {boolean} [options.fallbackOnFailure=true] - Fall back to main thread if worker fails
   */
  constructor(options = {}) {
    this.workerPath = options.workerPath || './forceSyncWorker.js';
    this.maxQueueDepth = options.maxQueueDepth || 64;
    this.timeoutMs = options.timeoutMs || 3000;
    this.backendUrl = options.backendUrl || (typeof process !== 'undefined' && process.env.ELOQUENT_API_URL) || 'http://localhost:3000';
    this.enableWorker = options.enableWorker !== false;
    this.fallbackOnFailure = options.fallbackOnFailure !== false;

    this.worker = null;
    this.pendingRequests = new Map();
    this.isTerminated = false;

    // Telemetry and metrics
    this.metrics = {
      totalRequests: 0,
      workerSuccessCount: 0,
      fallbackCount: 0,
      failureCount: 0,
      queueDepth: 0,
      averageLatencyMs: 0,
      lastSyncTimestamp: 0,
    };

    if (options.workerInstance) {
      this._attachWorker(options.workerInstance);
    } else if (this.enableWorker && typeof Worker !== 'undefined') {
      this._initWorker();
    }
  }

  /**
   * Initializes the dedicated WebWorker thread
   * @private
   */
  _initWorker() {
    try {
      const worker = new Worker(this.workerPath, { type: 'module' });
      this._attachWorker(worker);
    } catch (err) {
      // Worker creation not supported or failed (e.g. Node test environment)
      this.worker = null;
    }
  }

  /**
   * Binds message and error listeners to worker instance
   * @private
   * @param {Worker|Object} worker
   */
  _attachWorker(worker) {
    this.worker = worker;

    const messageHandler = (event) => this._handleWorkerResponse(event);
    const errorHandler = (err) => this._handleWorkerError(err);

    if (typeof this.worker.addEventListener === 'function') {
      this.worker.addEventListener('message', messageHandler);
      this.worker.addEventListener('error', errorHandler);
    } else {
      this.worker.onmessage = messageHandler;
      this.worker.onerror = errorHandler;
    }
  }

  /**
   * Processes response message received from the worker
   * @private
   * @param {MessageEvent|Object} event
   */
  _handleWorkerResponse(event) {
    const data = event && event.data ? event.data : event;
    if (!data || data.type !== FORCE_SYNC_RESPONSE) return;

    const { id, success, driftMetrics, error, durationMs } = data;
    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(id);
    this.metrics.queueDepth = this.pendingRequests.size;

    if (success) {
      this.metrics.workerSuccessCount += 1;
      this.metrics.lastSyncTimestamp = Date.now();
      this._updateLatency(durationMs || (Date.now() - pending.startTime));
      pending.resolve({
        success: true,
        driftMetrics,
        offloadedToWorker: true,
        durationMs: durationMs || (Date.now() - pending.startTime),
      });
    } else if (this.fallbackOnFailure) {
      // Graceful fallback to main-thread sync on worker-side failure
      this.metrics.fallbackCount += 1;
      const fallbackResult = this.forceSync(pending.payload);
      pending.resolve({
        ...fallbackResult,
        fallbackReason: error || 'Worker execution error',
      });
    } else {
      this.metrics.failureCount += 1;
      pending.reject(new Error(error || 'Worker synchronization failed'));
    }
  }

  /**
   * Handles unexpected worker errors or terminations
   * @private
   * @param {ErrorEvent|Error} err
   */
  _handleWorkerError(err) {
    const errorMsg = err && err.message ? err.message : 'Worker error';

    // Drain and resolve pending requests via main-thread fallback if configured
    const pendingList = Array.from(this.pendingRequests.values());
    this.pendingRequests.clear();
    this.metrics.queueDepth = 0;

    pendingList.forEach((pending) => {
      clearTimeout(pending.timer);
      if (this.fallbackOnFailure) {
        this.metrics.fallbackCount += 1;
        const result = this.forceSync(pending.payload);
        pending.resolve({
          ...result,
          fallbackReason: `Worker error: ${errorMsg}`,
        });
      } else {
        this.metrics.failureCount += 1;
        pending.reject(new Error(`Worker terminated or errored: ${errorMsg}`));
      }
    });

    // Auto-restart worker if not explicitly terminated
    if (!this.isTerminated && this.enableWorker && typeof Worker !== 'undefined') {
      try {
        this._initWorker();
      } catch (_) {}
    }
  }

  /**
   * Updates moving-average latency metrics
   * @private
   * @param {number} latencyMs
   */
  _updateLatency(latencyMs) {
    if (this.metrics.averageLatencyMs === 0) {
      this.metrics.averageLatencyMs = latencyMs;
    } else {
      this.metrics.averageLatencyMs = Math.round(
        (this.metrics.averageLatencyMs * 0.85) + (latencyMs * 0.15)
      );
    }
  }

  /**
   * Asynchronously offloads forceSync execution to the dedicated worker thread.
   * Keeps main renderer loop within 16 ms frame budget.
   * 
   * @param {Object} [payload={}] - Clock and buffer synchronization options
   * @returns {Promise<Object>} Resolves with synchronization metrics
   */
  async requestForceSync(payload = {}) {
    this.metrics.totalRequests += 1;

    // 1. Queue overflow boundary check
    if (this.pendingRequests.size >= this.maxQueueDepth) {
      if (this.fallbackOnFailure) {
        this.metrics.fallbackCount += 1;
        return this.forceSync(payload);
      }
      this.metrics.failureCount += 1;
      throw new Error(`SyncManager request queue overflow (depth: ${this.pendingRequests.size} >= max: ${this.maxQueueDepth})`);
    }

    // 2. Direct fallback if worker disabled or unavailable
    if (!this.worker || !this.enableWorker || this.isTerminated) {
      this.metrics.fallbackCount += 1;
      return this.forceSync(payload);
    }

    // 3. Dispatch to worker with unique request id and timeout guard
    requestIdCounter += 1;
    const id = `sync_${Date.now()}_${requestIdCounter}`;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pendingRequests.has(id)) return;
        this.pendingRequests.delete(id);
        this.metrics.queueDepth = this.pendingRequests.size;

        if (this.fallbackOnFailure) {
          this.metrics.fallbackCount += 1;
          const fallbackResult = this.forceSync(payload);
          resolve({
            ...fallbackResult,
            fallbackReason: `Worker timeout after ${this.timeoutMs}ms`,
          });
        } else {
          this.metrics.failureCount += 1;
          reject(new Error(`requestForceSync timed out after ${this.timeoutMs}ms`));
        }
      }, this.timeoutMs);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timer,
        startTime,
        payload,
      });
      this.metrics.queueDepth = this.pendingRequests.size;

      try {
        const message = {
          type: FORCE_SYNC_REQUEST,
          id,
          payload: {
            ...payload,
            backendUrl: this.backendUrl,
          },
          timestamp: Date.now(),
        };

        if (typeof this.worker.postMessage === 'function') {
          this.worker.postMessage(message);
        } else {
          throw new Error('Worker postMessage unavailable');
        }
      } catch (postErr) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        this.metrics.queueDepth = this.pendingRequests.size;

        if (this.fallbackOnFailure) {
          this.metrics.fallbackCount += 1;
          resolve(this.forceSync(payload));
        } else {
          this.metrics.failureCount += 1;
          reject(postErr);
        }
      }
    });
  }

  /**
   * Synchronous / inline fallback forceSync executed on current thread
   * @param {Object} [payload={}]
   * @returns {Object} Synchronization result
   */
  forceSync(payload = {}) {
    const startTime = Date.now();
    const driftMetrics = computeDriftMetrics(payload);
    const durationMs = Date.now() - startTime;

    this.metrics.lastSyncTimestamp = Date.now();
    this._updateLatency(durationMs);

    return {
      success: true,
      driftMetrics,
      offloadedToWorker: false,
      durationMs,
    };
  }

  /**
   * Returns current health, telemetry, and queue metrics
   * @returns {Object}
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueDepth: this.pendingRequests.size,
      isWorkerActive: !!this.worker && !this.isTerminated,
    };
  }

  /**
   * Halts worker, drains pending requests, and frees resources
   */
  terminate() {
    this.isTerminated = true;

    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.reject(new Error('SyncManager terminated'));
    });
    this.pendingRequests.clear();
    this.metrics.queueDepth = 0;

    if (this.worker && typeof this.worker.terminate === 'function') {
      try {
        this.worker.terminate();
      } catch (_) {}
    }
    this.worker = null;
  }
}

export default SyncManager;

// CommonJS compatibility for Node.js test runners
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SyncManager,
    default: SyncManager,
  };
}
