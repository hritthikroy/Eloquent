// ULTRA-FAST Startup Optimizer for Eloquent Electron
// This module optimizes the startup sequence for maximum speed

class FastStartup {
  constructor() {
    this.startTime = Date.now();
    this.milestones = [];
  }

  // Mark a milestone in the startup process
  milestone(name) {
    const time = Date.now() - this.startTime;
    this.milestones.push({ name, time });
    console.log(`🚀 ${name}: ${time}ms`);
  }

  // Preload critical resources
  preloadResources() {
    this.milestone('Starting resource preload');
    
    // Preload critical CSS
    const criticalCSS = `
      body { 
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        transform: translateZ(0);
        backface-visibility: hidden;
      }
      .overlay { 
        transform: translateZ(0);
        will-change: transform;
      }
    `;
    
    const style = document.createElement('style');
    style.textContent = criticalCSS;
    document.head.appendChild(style);
    
    this.milestone('Critical CSS loaded');
  }

  // Optimize DOM ready state
  optimizeDOMReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.milestone('DOM ready');
        this.applyFastOptimizations();
      });
    } else {
      this.milestone('DOM already ready');
      this.applyFastOptimizations();
    }
  }

  // Apply immediate optimizations
  applyFastOptimizations() {
    // Disable smooth scrolling immediately
    document.documentElement.style.scrollBehavior = 'auto';
    
    // Enable hardware acceleration on body
    document.body.style.transform = 'translateZ(0)';
    document.body.style.backfaceVisibility = 'hidden';
    
    // Optimize text rendering
    document.body.style.webkitFontSmoothing = 'antialiased';
    document.body.style.textRendering = 'optimizeSpeed';
    
    this.milestone('Fast optimizations applied');
  }

  // Defer non-critical operations
  deferNonCritical(callback, delay = 0) {
    if (delay === 0) {
      setImmediate(callback);
    } else {
      setTimeout(callback, delay);
    }
  }

  // Batch DOM operations
  batchDOM(operations) {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        operations.forEach(op => op());
        resolve();
      });
    });
  }

  // Get startup performance report
  getReport() {
    const totalTime = Date.now() - this.startTime;
    return {
      totalTime,
      milestones: this.milestones,
      performance: totalTime < 500 ? 'Excellent' : totalTime < 1000 ? 'Good' : 'Needs Optimization'
    };
  }

  // Log performance report
  logReport() {
    const report = this.getReport();
    console.log(`🏁 Startup complete: ${report.totalTime}ms (${report.performance})`);
    console.log('📊 Milestones:', report.milestones);
  }
}

// Export for use in main process and renderers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FastStartup;
} else {
  window.FastStartup = FastStartup;
}