// ULTRA-FAST Performance Optimizer for Eloquent Electron
// This module provides aggressive performance optimizations for frontend rendering

class PerformanceOptimizer {
  constructor() {
    this.isOptimized = false;
    this.rafId = null;
    this.throttledFunctions = new Map();
  }

  // Apply all performance optimizations
  optimize() {
    if (this.isOptimized) return;
    
    console.log('🚀 Applying ultra-fast performance optimizations...');
    
    this.optimizeDOM();
    this.optimizeAnimations();
    this.optimizeScrolling();
    this.optimizeRendering();
    this.optimizeMemory();
    
    this.isOptimized = true;
    console.log('✅ Performance optimizations applied successfully');
  }

  // DOM optimizations
  optimizeDOM() {
    // Disable smooth scrolling globally for speed
    document.documentElement.style.scrollBehavior = 'auto';
    
    // Enable hardware acceleration on body
    document.body.style.transform = 'translateZ(0)';
    document.body.style.backfaceVisibility = 'hidden';
    document.body.style.willChange = 'transform';
    
    // Optimize text rendering
    document.body.style.webkitFontSmoothing = 'antialiased';
    document.body.style.mozOsxFontSmoothing = 'grayscale';
    document.body.style.textRendering = 'optimizeSpeed';
    
    // Force GPU compositing on key elements
    const keyElements = document.querySelectorAll('.sidebar, .content, .overlay, .card');
    keyElements.forEach(el => {
      el.style.transform = 'translateZ(0)';
      el.style.backfaceVisibility = 'hidden';
      el.style.contain = 'layout style paint';
    });
  }

  // Animation optimizations
  optimizeAnimations() {
    // Reduce animation complexity for better performance
    const style = document.createElement('style');
    style.textContent = `
      * {
        animation-duration: 0.2s !important;
        transition-duration: 0.2s !important;
      }
      
      .sidebar-item {
        transition: transform 0.15s ease-out, background-color 0.15s ease-out !important;
      }
      
      .card {
        transition: transform 0.2s ease-out, box-shadow 0.2s ease-out !important;
      }
      
      /* Disable expensive animations on low-end devices */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Scrolling optimizations
  optimizeScrolling() {
    // Enable momentum scrolling on iOS
    document.body.style.webkitOverflowScrolling = 'touch';
    
    // Optimize scroll containers
    const scrollContainers = document.querySelectorAll('.content, .sidebar-content');
    scrollContainers.forEach(container => {
      container.style.webkitOverflowScrolling = 'touch';
      container.style.contain = 'layout style paint';
    });
  }

  // Rendering optimizations
  optimizeRendering() {
    // Enable CSS containment for better performance
    const containers = document.querySelectorAll('.card, .sidebar-item, .history-item');
    containers.forEach(container => {
      container.style.contain = 'layout style paint';
    });
    
    // Optimize image rendering if any
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      img.style.imageRendering = 'optimizeSpeed';
    });
  }

  // Memory optimizations
  optimizeMemory() {
    // Clean up unused event listeners
    this.debounceResize();
    
    // Optimize garbage collection
    if (window.gc && typeof window.gc === 'function') {
      setTimeout(() => window.gc(), 1000);
    }
  }

  // Debounced resize handler
  debounceResize() {
    let resizeTimeout;
    const originalResize = window.onresize;
    
    window.onresize = (event) => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (originalResize) originalResize(event);
      }, 100);
    };
  }

  // Ultra-fast throttle function
  throttle(func, delay = 16) { // 60fps default
    const key = func.toString();
    
    if (this.throttledFunctions.has(key)) {
      return this.throttledFunctions.get(key);
    }
    
    let lastCall = 0;
    const throttled = (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
    
    this.throttledFunctions.set(key, throttled);
    return throttled;
  }

  // Ultra-fast debounce function
  debounce(func, delay = 100) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Optimize canvas rendering
  optimizeCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    
    // Enable hardware acceleration hints
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'low';
    
    // Optimize canvas size for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    ctx.scale(dpr, dpr);
    
    return ctx;
  }

  // Batch DOM updates for better performance
  batchDOMUpdates(updates) {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        updates.forEach(update => update(fragment));
        resolve(fragment);
      });
    });
  }

  // Virtual scrolling for large lists
  createVirtualList(container, items, renderItem, itemHeight = 60) {
    const containerHeight = container.clientHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
    
    let scrollTop = 0;
    let startIndex = 0;
    
    const render = () => {
      const endIndex = Math.min(startIndex + visibleCount, items.length);
      const visibleItems = items.slice(startIndex, endIndex);
      
      container.innerHTML = '';
      container.style.height = items.length * itemHeight + 'px';
      container.style.paddingTop = startIndex * itemHeight + 'px';
      
      visibleItems.forEach((item, index) => {
        const element = renderItem(item, startIndex + index);
        container.appendChild(element);
      });
    };
    
    const onScroll = this.throttle(() => {
      scrollTop = container.scrollTop;
      startIndex = Math.floor(scrollTop / itemHeight);
      render();
    }, 16);
    
    container.addEventListener('scroll', onScroll);
    render();
    
    return { render, destroy: () => container.removeEventListener('scroll', onScroll) };
  }

  // Cleanup function
  cleanup() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.throttledFunctions.clear();
  }
}

// Export singleton instance
const performanceOptimizer = new PerformanceOptimizer();

// Auto-optimize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    performanceOptimizer.optimize();
  });
} else {
  performanceOptimizer.optimize();
}

// Export for manual use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = performanceOptimizer;
} else {
  window.performanceOptimizer = performanceOptimizer;
}