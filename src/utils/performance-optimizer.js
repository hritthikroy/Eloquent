/**
 * Performance Optimizer for Eloquent Electron
 * Provides performance monitoring and optimization utilities
 */

class PerformanceOptimizer {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      renderTimes: [],
      memoryUsage: [],
      apiCalls: []
    };
    
    this.init();
  }

  init() {
    // Monitor performance metrics
    this.startPerformanceMonitoring();
    
    // Apply optimizations
    this.applyOptimizations();
    
    console.log('🚀 Dashboard performance optimizations applied');
  }

  startPerformanceMonitoring() {
    // Track render performance
    if (window.performance && window.performance.mark) {
      window.performance.mark('dashboard-start');
    }

    // Monitor memory usage periodically
    setInterval(() => {
      if (window.performance && window.performance.memory) {
        this.metrics.memoryUsage.push({
          timestamp: Date.now(),
          used: window.performance.memory.usedJSHeapSize,
          total: window.performance.memory.totalJSHeapSize
        });
        
        // Keep only last 50 measurements
        if (this.metrics.memoryUsage.length > 50) {
          this.metrics.memoryUsage.shift();
        }
      }
    }, 30000); // Every 30 seconds
  }

  applyOptimizations() {
    // Debounce scroll events
    this.debounceScrollEvents();
    
    // Optimize image loading
    this.optimizeImageLoading();
    
    // Cache DOM queries
    this.cacheDOMQueries();
  }

  debounceScrollEvents() {
    let scrollTimeout;
    const originalScroll = window.onscroll;
    
    window.onscroll = function(event) {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (originalScroll) originalScroll.call(this, event);
      }, 16); // ~60fps
    };
  }

  optimizeImageLoading() {
    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      });

      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for older browsers
      images.forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  }

  cacheDOMQueries() {
    // Create a cache for frequently accessed DOM elements
    window.domCache = window.domCache || {};
    
    const originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
      if (!window.domCache[id]) {
        window.domCache[id] = originalGetElementById.call(document, id);
      }
      return window.domCache[id];
    };
  }

  measureRenderTime(label) {
    if (window.performance && window.performance.mark) {
      const startMark = `${label}-start`;
      const endMark = `${label}-end`;
      
      window.performance.mark(startMark);
      
      return () => {
        window.performance.mark(endMark);
        window.performance.measure(label, startMark, endMark);
        
        const measure = window.performance.getEntriesByName(label)[0];
        this.metrics.renderTimes.push({
          label,
          duration: measure.duration,
          timestamp: Date.now()
        });
        
        // Clean up marks
        window.performance.clearMarks(startMark);
        window.performance.clearMarks(endMark);
        window.performance.clearMeasures(label);
      };
    }
    
    return () => {}; // No-op fallback
  }

  trackApiCall(url, duration) {
    this.metrics.apiCalls.push({
      url,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only last 100 API calls
    if (this.metrics.apiCalls.length > 100) {
      this.metrics.apiCalls.shift();
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      averageRenderTime: this.metrics.renderTimes.length > 0 
        ? this.metrics.renderTimes.reduce((sum, item) => sum + item.duration, 0) / this.metrics.renderTimes.length
        : 0,
      averageApiTime: this.metrics.apiCalls.length > 0
        ? this.metrics.apiCalls.reduce((sum, item) => sum + item.duration, 0) / this.metrics.apiCalls.length
        : 0
    };
  }

  // Utility function to optimize large lists
  virtualizeList(container, items, renderItem, itemHeight = 50) {
    const containerHeight = container.clientHeight;
    const visibleItems = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
    
    let scrollTop = 0;
    let startIndex = 0;
    
    const render = () => {
      const endIndex = Math.min(startIndex + visibleItems, items.length);
      const visibleData = items.slice(startIndex, endIndex);
      
      container.innerHTML = '';
      container.style.height = `${items.length * itemHeight}px`;
      container.style.paddingTop = `${startIndex * itemHeight}px`;
      
      visibleData.forEach((item, index) => {
        const element = renderItem(item, startIndex + index);
        container.appendChild(element);
      });
    };
    
    container.addEventListener('scroll', () => {
      scrollTop = container.scrollTop;
      startIndex = Math.floor(scrollTop / itemHeight);
      render();
    });
    
    render();
  }
}

// Initialize performance optimizer when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.performanceOptimizer = new PerformanceOptimizer();
  });
} else {
  window.performanceOptimizer = new PerformanceOptimizer();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceOptimizer;
}