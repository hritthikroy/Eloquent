// Ultra-Fast Performance Optimizer
// Converts blocking operations to non-blocking for zero-delay performance

const fs = require('fs');
const fsPromises = fs.promises;

class PerformanceOptimizer {
  constructor() {
    this.fileCache = new Map();
    this.writeQueue = new Map();
    this.writeTimeout = null;
  }

  /**
   * Read file with caching for ultra-fast access
   * @param {string} filePath - Path to file
   * @param {Object} options - Options (encoding, cache, ttl)
   * @returns {Promise<string|Buffer>}
   */
  async readFileFast(filePath, options = {}) {
    const {
      encoding = 'utf8',
      cache = true,
      ttl = 5000 // 5 second cache by default
    } = options;

    // Check cache first
    if (cache && this.fileCache.has(filePath)) {
      const cached = this.fileCache.get(filePath);
      if (Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
      this.fileCache.delete(filePath);
    }

    try {
      const data = await fsPromises.readFile(filePath, encoding);
      
      if (cache) {
        this.fileCache.set(filePath, {
          data,
          timestamp: Date.now()
        });
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Write file with debouncing to prevent excessive writes
   * @param {string} filePath - Path to file
   * @param {string|Buffer} data - Data to write
   * @param {Object} options - Options (debounce, encoding)
   * @returns {Promise<void>}
   */
  async writeFileFast(filePath, data, options = {}) {
    const {
      debounce = 100, // 100ms debounce by default
      encoding = 'utf8'
    } = options;

    // Add to write queue
    this.writeQueue.set(filePath, { data, encoding, timestamp: Date.now() });

    // Clear existing timeout
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }

    // Set new timeout for batch write
    this.writeTimeout = setTimeout(() => {
      this.flushWriteQueue();
    }, debounce);

    // For immediate writes, return promise
    if (debounce === 0) {
      return fsPromises.writeFile(filePath, data, encoding);
    }
  }

  /**
   * Flush all pending writes immediately
   */
  async flushWriteQueue() {
    const promises = [];

    for (const [filePath, { data, encoding }] of this.writeQueue.entries()) {
      promises.push(
        fsPromises.writeFile(filePath, data, encoding)
          .then(() => {
            // Invalidate cache for this file
            this.fileCache.delete(filePath);
          })
          .catch(error => {
            console.error(`Error writing file ${filePath}:`, error);
          })
      );
    }

    this.writeQueue.clear();

    return Promise.all(promises);
  }

  /**
   * Read JSON file with automatic parsing
   * @param {string} filePath - Path to JSON file
   * @param {*} defaultValue - Default value if file doesn't exist
   * @returns {Promise<any>}
   */
  async readJSON(filePath, defaultValue = {}) {
    try {
      const data = await this.readFileFast(filePath, { cache: true });
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Write JSON file with automatic stringification
   * @param {string} filePath - Path to JSON file
   * @param {*} data - Data to write
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async writeJSON(filePath, data, options = {}) {
    const jsonString = JSON.stringify(data, null, 2);
    return this.writeFileFast(filePath, jsonString, options);
  }

  /**
   * Check if file exists (non-blocking)
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear file cache
   * @param {string} filePath - Optional specific file path, or clear all
   */
  clearCache(filePath = null) {
    if (filePath) {
      this.fileCache.delete(filePath);
    } else {
      this.fileCache.clear();
    }
  }

  /**
   * Preload files into cache for instant access
   * @param {string[]} filePaths - Array of file paths to preload
   * @returns {Promise<void>}
   */
  async preloadFiles(filePaths) {
    const promises = filePaths.map(filePath =>
      this.readFileFast(filePath, { cache: true })
        .catch(error => {
          console.warn(`Could not preload ${filePath}:`, error.message);
        })
    );
    
    return Promise.all(promises);
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    return {
      cacheSize: this.fileCache.size,
      writeQueueSize: this.writeQueue.size,
      cachedFiles: Array.from(this.fileCache.keys())
    };
  }
}

// Singleton instance
const perfOptimizer = new PerformanceOptimizer();

// Export both class and instance
module.exports = PerformanceOptimizer;
module.exports.default = perfOptimizer;
module.exports.perfOptimizer = perfOptimizer;
