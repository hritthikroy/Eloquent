// Bridge service to use Go backend for auth operations
// This replaces the heavy JavaScript crypto and session management with Go
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class AuthBridge {
  constructor() {
    this.baseURL = process.env.ELOQUENT_API_URL || 'http://localhost:3000';
    this.deviceID = this.getDeviceId();
    this.goClientPath = this.getGoClientPath();
    this.isDevelopmentMode = this.isDevMode();
    
    // Cache for performance
    this.sessionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    console.log('🚀 AuthBridge initialized with Go backend acceleration');
    if (this.isDevelopmentMode) {
      console.log('🔧 Development mode detected');
    }
  }

  // High-performance Google sign-in using Go backend
  async signInWithGoogle() {
    if (this.isDevelopmentMode) {
      console.log('🔧 Development mode - simulating Google sign-in');
      return { 
        success: true, 
        url: 'about:blank',
        isDevelopment: true 
      };
    }

    try {
      // Use native fetch for better performance than the JS Supabase client
      const response = await this.makeRequest('GET', '/api/auth/google/url', null, 5000);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get OAuth URL');
      }

      return {
        success: true,
        url: response.url,
        isProduction: !response.url.includes('localhost')
      };
    } catch (error) {
      console.error('Google sign-in error:', error);
      return { 
        success: false, 
        error: this.getErrorMessage(error) 
      };
    }
  }

  // Handle OAuth callback with Go backend processing
  async handleOAuthCallback(session) {
    try {
      const response = await this.makeRequest('POST', '/api/auth/google', {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: session.user,
        deviceId: this.deviceID
      }, 10000);

      if (!response.success) {
        throw new Error(response.error || 'Backend authentication failed');
      }

      // Cache the result for performance
      this.cacheSession('current', response);

      return { 
        success: true, 
        user: response.user, 
        subscription: response.subscription, 
        usage: response.usage 
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return { success: false, error: error.message };
    }
  }

  // Ultra-fast session validation with caching
  async validateSession() {
    // Check cache first
    const cached = this.getCachedSession('current');
    if (cached && this.isCacheValid(cached)) {
      console.log('⚡ Using cached session for ultra-fast validation');
      return {
        valid: true,
        user: cached.user,
        subscription: cached.subscription,
        usage: cached.usage,
        cached: true
      };
    }

    if (this.isDevelopmentMode) {
      const devSession = {
        valid: true,
        user: {
          id: 'dev-user',
          email: 'hritthikin@gmail.com',
          name: 'Development User',
          role: 'admin'
        },
        subscription: { plan: 'enterprise', status: 'active' },
        usage: { currentMonth: 0, totalMinutes: 0, limit: -1 }
      };
      this.cacheSession('current', devSession);
      return devSession;
    }

    try {
      // Use Go backend for validation with retry logic
      const response = await this.makeRequestWithRetry('POST', '/api/auth/validate', {
        deviceId: this.deviceID
      }, 3000, 2);

      if (response.valid) {
        // Cache successful validation
        this.cacheSession('current', response);
      }

      return response;
    } catch (error) {
      console.error('Session validation error:', error);
      
      // Try to use cached session as fallback
      const fallbackCache = this.getCachedSession('current');
      if (fallbackCache) {
        console.log('🔌 Using cached session as offline fallback');
        return {
          valid: true,
          offline: true,
          user: fallbackCache.user,
          subscription: fallbackCache.subscription,
          usage: fallbackCache.usage
        };
      }
      
      return { valid: false, reason: 'Cannot validate session' };
    }
  }

  // Get current user with caching
  getUser() {
    const cached = this.getCachedSession('current');
    return cached ? cached.user : null;
  }

  // Get subscription with admin override
  getSubscription() {
    const cached = this.getCachedSession('current');
    if (cached && cached.user && this.isAdmin(cached.user)) {
      return { plan: 'enterprise', status: 'active' };
    }
    return cached ? cached.subscription : null;
  }

  // Get usage with admin override
  getUsage() {
    const cached = this.getCachedSession('current');
    if (cached && cached.user && this.isAdmin(cached.user)) {
      return { currentMonth: 0, totalMinutes: 0, limit: -1 };
    }
    return cached ? cached.usage : null;
  }

  // Fast authentication check
  isAuthenticated() {
    if (this.isDevelopmentMode) return true;
    
    const cached = this.getCachedSession('current');
    if (cached && this.isCacheValid(cached)) {
      return true;
    }
    
    // Check if admin user (always authenticated)
    if (cached && cached.user && this.isAdmin(cached.user)) {
      return true;
    }
    
    return false;
  }

  // Check admin status
  isAdmin(user = null) {
    const currentUser = user || this.getUser();
    if (!currentUser) return false;
    
    const adminEmails = ['hritthikin@gmail.com'];
    return adminEmails.includes(currentUser.email) || currentUser.role === 'admin';
  }

  // Update settings via Go backend
  async updateSettings(settings) {
    try {
      const response = await this.makeRequest('PUT', '/api/auth/settings', settings, 5000);
      
      if (response.success) {
        // Update cache
        const cached = this.getCachedSession('current');
        if (cached && cached.user) {
          cached.user.settings = response.settings;
          this.cacheSession('current', cached);
        }
      }
      
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Logout with cache cleanup
  async logout() {
    try {
      // Clear cache immediately
      this.clearCache();
      
      // Notify backend (don't wait for response)
      this.makeRequest('POST', '/api/auth/logout', null, 2000).catch(() => {
        // Ignore errors on logout
      });
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: true }; // Always succeed logout
    }
  }

  // Performance optimizations
  cacheSession(key, data) {
    this.sessionCache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  getCachedSession(key) {
    const cached = this.sessionCache.get(key);
    return cached ? cached.data : null;
  }

  isCacheValid(cached) {
    if (!cached) return false;
    const entry = this.sessionCache.get('current');
    if (!entry) return false;
    return (Date.now() - entry.timestamp) < this.cacheTimeout;
  }

  clearCache() {
    this.sessionCache.clear();
  }

  // HTTP utilities with performance optimizations
  async makeRequest(method, endpoint, data, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(this.baseURL + endpoint, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async makeRequestWithRetry(method, endpoint, data, timeout, maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.makeRequest(method, endpoint, data, timeout);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 500)
          );
        }
      }
    }
    
    throw lastError;
  }

  // Utility methods
  getDeviceId() {
    const machineInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'unknown'}`;
    return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 32);
  }

  isDevMode() {
    return process.env.FORCE_DEV_MODE === 'true' ||
           process.env.SUPABASE_URL === 'https://your-project.supabase.co' ||
           process.env.SUPABASE_ANON_KEY === 'your-anon-key' ||
           !process.env.SUPABASE_URL ||
           !process.env.SUPABASE_ANON_KEY;
  }

  getGoClientPath() {
    // Path to compiled Go client binary (if using CGO approach)
    return path.join(__dirname, '../../backend-go/bin/auth-client');
  }

  getErrorMessage(error) {
    const errorMap = {
      'timeout': 'Connection timeout. Please check your internet connection.',
      'fetch': 'Network error. Please check your internet connection.',
      'unauthorized': 'Authentication failed. Please sign in again.',
      'not found': 'Service not available. Please try again later.'
    };

    const message = error.message.toLowerCase();
    for (const [key, friendlyMessage] of Object.entries(errorMap)) {
      if (message.includes(key)) {
        return friendlyMessage;
      }
    }

    return error.message || 'An unexpected error occurred';
  }

  // Feature and usage checks (optimized)
  canUseFeature(feature) {
    const subscription = this.getSubscription();
    if (!subscription) return false;
    
    const limits = this.getUsageLimits(subscription.plan);
    return limits.features.includes(feature) || limits.features.includes('all');
  }

  hasRemainingMinutes(minutesNeeded = 1) {
    const usage = this.getUsage();
    const subscription = this.getSubscription();
    
    if (!usage || !subscription) return false;
    
    const limits = this.getUsageLimits(subscription.plan);
    if (limits.minutes === -1) return true; // Unlimited
    
    return usage.currentMonth + minutesNeeded <= limits.minutes;
  }

  getUsageLimits(plan = 'free') {
    const limits = {
      free: { minutes: 60, features: ['basic_transcription'] },
      starter: { minutes: 180, features: ['basic_transcription', 'ai_rewrite'] },
      pro: { minutes: 600, features: ['basic_transcription', 'ai_rewrite', 'custom_shortcuts', 'priority_support'] },
      unlimited: { minutes: -1, features: ['basic_transcription', 'ai_rewrite', 'custom_shortcuts', 'priority_support', 'api_access'] },
      enterprise: { minutes: -1, features: ['all'] }
    };

    return limits[plan] || limits.free;
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.makeRequest('GET', '/health', null, 3000);
      return response.status === 'ok';
    } catch (error) {
      return false;
    }
  }
}

module.exports = new AuthBridge();