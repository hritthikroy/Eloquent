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
    
    // Store access token for API calls
    this.accessToken = null;
    this.refreshToken = null;
    
    console.log('🚀 AuthBridge initialized with Go backend acceleration');
    if (this.isDevelopmentMode) {
      console.log('🔧 Development mode detected');
    }
  }

  // Initialize method (called by main.js)
  init() {
    console.log('🔐 AuthBridge init() called');
    // Initialization is already done in constructor
    // This method exists for compatibility with main.js
    return this;
  }

  // High-performance Google sign-in using Go backend
  async signInWithGoogle() {
    console.log('🔐 AuthBridge.signInWithGoogle called');
    console.log('🔐 Environment check:');
    console.log('   FORCE_DEV_MODE:', process.env.FORCE_DEV_MODE);
    console.log('   FORCE_QUICK_SIGNIN:', process.env.FORCE_QUICK_SIGNIN);
    console.log('   isDevelopmentMode:', this.isDevelopmentMode);
    
    // Use quick sign-in if in development mode OR if quick sign-in is forced
    const useQuickSignIn = this.isDevelopmentMode || process.env.FORCE_QUICK_SIGNIN === 'true';
    
    if (useQuickSignIn) {
      console.log('🔧 Using quick sign-in mode');
      // Quick sign-in: simulate successful sign-in directly without opening a URL
      const devResult = await this.handleOAuthCallback({ 
        access_token: 'quick-signin-token',
        refresh_token: 'quick-signin-refresh-token'
      });
      
      if (devResult.success) {
        console.log('✅ Quick sign-in successful');
        return { 
          success: true, 
          isDevelopment: true,
          skipBrowserOpen: true,
          user: devResult.user,
          subscription: devResult.subscription
        };
      } else {
        console.error('❌ Quick sign-in failed:', devResult.error);
        return { success: false, error: devResult.error };
      }
    }

    try {
      // For production, we need to create the Supabase OAuth URL directly
      // since our Go backend doesn't have a /google/url endpoint
      const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
      
      console.log('🔐 Production mode - checking Supabase credentials...');
      console.log('   SUPABASE_URL:', supabaseUrl ? 'set' : 'not set');
      console.log('   SUPABASE_ANON_KEY:', supabaseAnonKey ? 'set (length: ' + supabaseAnonKey.length + ')' : 'not set');
      
      // Check if we have valid Supabase credentials
      if (supabaseUrl.includes('your-project.supabase.co') || supabaseAnonKey === 'your-anon-key' || !supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Invalid Supabase credentials in production mode');
        return { 
          success: false, 
          error: 'Supabase credentials not configured properly' 
        };
      }

      // Create Supabase OAuth URL with forced account selection
      const redirectUrl = process.env.OAUTH_REDIRECT_URL || 'https://agile-basin-06335-9109082620ce.herokuapp.com/auth/success';
      
      // Use prompt=consent to force account picker and re-consent every time
      // This ensures users can switch accounts properly
      const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}&prompt=consent`;
      
      console.log('🌐 Generated OAuth URL:', oauthUrl);
      console.log('🔄 Redirect URL:', redirectUrl);

      return {
        success: true,
        url: oauthUrl,
        isProduction: !redirectUrl.includes('localhost')
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
      console.log('🔐 handleOAuthCallback called');
      console.log('🔐 Session data:', session);
      console.log('🔐 isDevelopmentMode:', this.isDevelopmentMode);
      console.log('🔐 FORCE_QUICK_SIGNIN:', process.env.FORCE_QUICK_SIGNIN);
      
      // Use quick sign-in if in development mode OR if quick sign-in is forced
      const useQuickSignIn = this.isDevelopmentMode || process.env.FORCE_QUICK_SIGNIN === 'true';
      
      if (useQuickSignIn) {
        console.log('🔧 Quick sign-in mode - creating admin session');
        // Store tokens
        this.accessToken = session.access_token || 'quick-signin-token';
        this.refreshToken = session.refresh_token || 'quick-signin-refresh-token';
        
        const adminResult = {
          success: true,
          user: {
            id: 'quick-signin-user',
            email: process.env.ADMIN_EMAIL || 'hritthikin@gmail.com',
            name: 'Admin User',
            role: 'admin'
          },
          subscription: { plan: 'enterprise', status: 'active' },
          usage: { currentMonth: 0, totalMinutes: 0, limit: -1 }
        };
        
        console.log('💾 Caching admin session:', adminResult);
        this.cacheSession('current', adminResult);
        console.log('✅ Admin session cached successfully');
        return adminResult;
      }

      // For production, we need to get user data from Supabase first
      // then send it to our Go backend
      let userData = session.user;
      
      // If we don't have user data, we need to fetch it from Supabase
      if (!userData && session.access_token) {
        try {
          const supabaseUrl = process.env.SUPABASE_URL;
          const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': process.env.SUPABASE_ANON_KEY
            }
          });
          
          if (userResponse.ok) {
            userData = await userResponse.json();
          }
        } catch (err) {
          console.warn('Could not fetch user data from Supabase:', err);
        }
      }

      // Store tokens for API calls
      this.accessToken = session.access_token;
      this.refreshToken = session.refresh_token;

      // Send to our Go backend
      const response = await this.makeRequest('POST', '/api/auth/google', {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: userData,
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

    // Check if we have an access token
    if (!this.accessToken) {
      // Try to use cached session as fallback
      const fallbackCache = this.getCachedSession('current');
      if (fallbackCache) {
        return {
          valid: true,
          offline: true,
          user: fallbackCache.user,
          subscription: fallbackCache.subscription,
          usage: fallbackCache.usage
        };
      }
      
      return { valid: false, reason: 'No access token' };
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
    if (this.isDevelopmentMode) {
      return true;
    }
    
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

  // Get access token for API calls
  getAccessToken() {
    return this.accessToken;
  }

  // Get refresh token
  getRefreshToken() {
    return this.refreshToken;
  }

  // Logout with cache cleanup
  async logout() {
    try {
      // Clear cache immediately
      this.clearCache();
      
      // Clear tokens
      this.accessToken = null;
      this.refreshToken = null;
      
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

      // Add Authorization header if we have an access token
      if (this.accessToken) {
        options.headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

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
    // First check if development mode is explicitly forced
    if (process.env.FORCE_DEV_MODE === 'true') {
      console.log('🔧 Development mode forced via FORCE_DEV_MODE=true');
      return true;
    }
    
    // Check if quick sign-in is forced (acts like dev mode)
    if (process.env.FORCE_QUICK_SIGNIN === 'true') {
      console.log('🔧 Quick sign-in mode forced via FORCE_QUICK_SIGNIN=true');
      return true;
    }
    
    // Then check if Supabase credentials are missing or invalid
    const hasInvalidSupabase = process.env.SUPABASE_URL === 'https://your-project.supabase.co' ||
                               process.env.SUPABASE_ANON_KEY === 'your-anon-key' ||
                               !process.env.SUPABASE_URL ||
                               !process.env.SUPABASE_ANON_KEY;
    
    if (hasInvalidSupabase) {
      console.log('🔧 Development mode activated due to invalid/missing Supabase credentials');
      return true;
    }
    
    console.log('🏭 Production mode - valid Supabase credentials found');
    return false;
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