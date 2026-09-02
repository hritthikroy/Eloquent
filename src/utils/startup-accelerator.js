// Startup Accelerator - Ensures ultra-fast app launch with zero blocking

class StartupAccelerator {
  constructor() {
    this.startTime = Date.now();
    this.milestones = [];
    this.deferred = [];
  }

  /**
   * Mark a milestone in the startup process
   * @param {string} name - Milestone name
   */
  milestone(name) {
    const elapsed = Date.now() - this.startTime;
    this.milestones.push({ name, elapsed });
    console.log(`⚡ ${name}: ${elapsed}ms`);
  }

  /**
   * Defer non-critical operations until after app is ready
   * @param {Function} operation - Operation to defer
   * @param {number} delay - Delay in ms (default: 1000)
   */
  defer(operation, delay = 1000) {
    this.deferred.push({ operation, delay });
  }

  /**
   * Execute all deferred operations
   */
  executeDeferredOperations() {
    this.milestone('Executing deferred operations');
    
    this.deferred.forEach(({ operation, delay }) => {
      setTimeout(() => {
        try {
          operation();
        } catch (error) {
          console.error('Deferred operation error:', error);
        }
      }, delay);
    });

    this.deferred = [];
  }

  /**
   * Preload critical resources in parallel
   * @param {Function[]} loaders - Array of async loader functions
   * @returns {Promise<void>}
   */
  async preloadParallel(loaders) {
    const startTime = Date.now();
    
    await Promise.all(
      loaders.map(loader =>
        loader().catch(error => {
          console.warn('Preload error:', error.message);
        })
      )
    );

    const elapsed = Date.now() - startTime;
    console.log(`⚡ Preloaded ${loaders.length} resources in ${elapsed}ms`);
  }

  /**
   * Lazy load resources only when needed
   * @param {Function} loader - Async loader function
   * @returns {Function}
   */
  lazyLoad(loader) {
    let loaded = false;
    let loadPromise = null;
    let result = null;

    return async () => {
      if (loaded) {
        return result;
      }

      if (loadPromise) {
        return loadPromise;
      }

      loadPromise = loader()
        .then(res => {
          result = res;
          loaded = true;
          loadPromise = null;
          return res;
        })
        .catch(error => {
          loadPromise = null;
          throw error;
        });

      return loadPromise;
    };
  }

  /**
   * Get startup performance report
   * @returns {Object}
   */
  getReport() {
    const totalTime = Date.now() - this.startTime;
    return {
      totalTime,
      milestones: this.milestones,
      deferredCount: this.deferred.length
    };
  }

  /**
   * Optimize app based on startup metrics
   * @returns {Object}
   */
  getOptimizationSuggestions() {
    const report = this.getReport();
    const suggestions = [];

    if (report.totalTime > 3000) {
      suggestions.push('⚠️ Startup time > 3 seconds - consider deferring more operations');
    }

    if (this.milestones.length < 5) {
      suggestions.push('💡 Add more milestones to identify bottlenecks');
    }

    if (this.deferred.length > 10) {
      suggestions.push('⚠️ Many deferred operations - consider prioritization');
    }

    return {
      report,
      suggestions,
      grade: report.totalTime < 1000 ? 'A' : 
             report.totalTime < 2000 ? 'B' : 
             report.totalTime < 3000 ? 'C' : 'D'
    };
  }
}

// Singleton instance
const startupAccelerator = new StartupAccelerator();

module.exports = StartupAccelerator;
module.exports.default = startupAccelerator;
module.exports.startupAccelerator = startupAccelerator;
