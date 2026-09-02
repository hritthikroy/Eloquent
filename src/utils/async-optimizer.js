// Async Optimizer - Ensures zero blocking operations
// Converts all sync operations to async for ultra-fast performance

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class AsyncOptimizer {
  /**
   * Check if command exists (async, non-blocking)
   * @param {string} command - Command to check
   * @returns {Promise<boolean>}
   */
  static async commandExists(command) {
    try {
      const { stdout } = await execAsync(`which ${command}`, { 
        timeout: 1000,
        windowsHide: true 
      });
      return !!stdout.trim();
    } catch {
      return false;
    }
  }

  /**
   * Execute command with timeout and non-blocking
   * @param {string} command - Command to execute
   * @param {Object} options - Options
   * @returns {Promise<string>}
   */
  static async execCommand(command, options = {}) {
    const {
      timeout = 5000,
      ignoreErrors = false
    } = options;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        windowsHide: true,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      return stdout || stderr;
    } catch (error) {
      if (ignoreErrors) {
        return '';
      }
      throw error;
    }
  }

  /**
   * Debounce function calls for performance
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function}
   */
  static debounce(func, wait = 100) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function calls for performance
   * @param {Function} func - Function to throttle
   * @param {number} limit - Limit in ms
   * @returns {Function}
   */
  static throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Batch multiple async operations
   * @param {Function[]} operations - Array of async operations
   * @param {number} batchSize - Batch size
   * @returns {Promise<any[]>}
   */
  static async batchOperations(operations, batchSize = 5) {
    const results = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(op => op().catch(err => ({ error: err })))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Run operation with timeout
   * @param {Promise} promise - Promise to run
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<any>}
   */
  static async withTimeout(promise, timeout = 5000) {
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Retry operation with exponential backoff
   * @param {Function} operation - Async operation to retry
   * @param {Object} options - Options
   * @returns {Promise<any>}
   */
  static async retryWithBackoff(operation, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 100,
      maxDelay = 5000,
      factor = 2
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * factor, maxDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Create async queue for sequential operations
   * @param {number} concurrency - Concurrent operations allowed
   * @returns {Object}
   */
  static createQueue(concurrency = 1) {
    const queue = [];
    let running = 0;

    const processNext = () => {
      if (running >= concurrency || queue.length === 0) {
        return;
      }

      const { operation, resolve, reject } = queue.shift();
      running++;

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          running--;
          processNext();
        });
    };

    return {
      add: (operation) => {
        return new Promise((resolve, reject) => {
          queue.push({ operation, resolve, reject });
          processNext();
        });
      },
      size: () => queue.length,
      running: () => running
    };
  }

  /**
   * Memoize async function results
   * @param {Function} func - Async function to memoize
   * @param {Object} options - Options
   * @returns {Function}
   */
  static memoize(func, options = {}) {
    const {
      ttl = 5000, // Cache for 5 seconds by default
      keyGenerator = (...args) => JSON.stringify(args)
    } = options;

    const cache = new Map();

    return async function(...args) {
      const key = keyGenerator(...args);
      const cached = cache.get(key);

      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.value;
      }

      const value = await func.apply(this, args);
      cache.set(key, { value, timestamp: Date.now() });

      // Clean up old cache entries
      setTimeout(() => cache.delete(key), ttl);

      return value;
    };
  }
}

module.exports = AsyncOptimizer;
