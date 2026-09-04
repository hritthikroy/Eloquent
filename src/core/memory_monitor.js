/**
 * @file memory_monitor.js
 * @description Heap usage threshold monitor and garbage collection / buffer flushing triggers
 * to prevent stack limits and heap exhaustion during rapid audio stream bursts.
 */

'use strict';

const EventEmitter = require('events');

class MemoryMonitor extends EventEmitter {
  /**
   * @param {Object} options
   * @param {number} [options.warningThresholdMB=250] - Threshold to emit warning event
   * @param {number} [options.criticalThresholdMB=400] - Threshold to trigger emergency flush & GC
   * @param {number} [options.checkIntervalMs=1000] - Interval between heap checks
   * @param {boolean} [options.autoGC=true] - Trigger global.gc() if available when critical
   */
  constructor(options = {}) {
    super();
    this.warningThresholdMB = options.warningThresholdMB || 250;
    this.criticalThresholdMB = options.criticalThresholdMB || 400;
    this.checkIntervalMs = options.checkIntervalMs || 1000;
    this.autoGC = options.autoGC ?? true;

    this.timer = null;
    this.isMonitoring = false;
    this.history = [];
    this.maxHistory = 60;

    this.flushCallbacks = new Set();
    this.stats = {
      checksTotal: 0,
      warningsTotal: 0,
      criticalTotal: 0,
      gcTriggeredTotal: 0,
      flushesTriggeredTotal: 0,
      lastHeapUsedMB: 0,
    };
  }

  /**
   * Register a callback to be called when critical memory threshold is breached
   * @param {Function} callback
   */
  onCriticalFlush(callback) {
    if (typeof callback === 'function') {
      this.flushCallbacks.add(callback);
    }
  }

  /**
   * Remove a previously registered flush callback
   * @param {Function} callback
   */
  removeCriticalFlush(callback) {
    this.flushCallbacks.delete(callback);
  }

  /**
   * Start periodic memory monitoring
   */
  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    this.timer = setInterval(() => {
      this.checkMemory();
    }, this.checkIntervalMs);

    // Initial check
    this.checkMemory();
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Evaluate heap usage against thresholds and trigger actions
   */
  checkMemory() {
    this.stats.checksTotal++;
    const mem = process.memoryUsage();
    const heapUsedMB = mem.heapUsed / (1024 * 1024);
    const heapTotalMB = mem.heapTotal / (1024 * 1024);
    const rssMB = mem.rss / (1024 * 1024);

    this.stats.lastHeapUsedMB = heapUsedMB;

    const sample = {
      timestamp: Date.now(),
      heapUsedMB,
      heapTotalMB,
      rssMB,
    };

    this.history.push(sample);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (heapUsedMB >= this.criticalThresholdMB) {
      this.stats.criticalTotal++;
      this.emit('critical', sample);
      this.executeEmergencyMitigation(sample);
    } else if (heapUsedMB >= this.warningThresholdMB) {
      this.stats.warningsTotal++;
      this.emit('warning', sample);
    }

    return sample;
  }

  /**
   * Execute emergency buffer flushing and optional V8 garbage collection
   */
  executeEmergencyMitigation(sample) {
    this.stats.flushesTriggeredTotal++;

    // Execute registered buffer flushing callbacks
    for (const flush of this.flushCallbacks) {
      try {
        flush(sample);
      } catch (err) {
        this.emit('error', err);
      }
    }

    // Trigger GC if --expose-gc flag was passed to Node
    if (this.autoGC && typeof global.gc === 'function') {
      try {
        global.gc();
        this.stats.gcTriggeredTotal++;
        this.emit('gc', { timestamp: Date.now(), heapBeforeMB: sample.heapUsedMB });
      } catch (err) {
        this.emit('error', err);
      }
    }
  }

  /**
   * Get monitoring statistics and history
   */
  getStats() {
    return {
      ...this.stats,
      isMonitoring: this.isMonitoring,
      warningThresholdMB: this.warningThresholdMB,
      criticalThresholdMB: this.criticalThresholdMB,
      historyLength: this.history.length,
    };
  }
}

module.exports = { MemoryMonitor };
