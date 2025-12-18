// Authentication Service for Eloquent with Supabase
const { createClient } = require('@supabase/supabase-js');
const { app, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

class AuthService {
  constructor() {
    // Configure your backend URL here - NOW USING GO BACKEND
    this.baseURL = process.env.ELOQUENT_API_URL || 'http://localhost:3000';
    this.supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
    
    this.currentUser = null;
    this.subscription = null;
    this.usage = null;
    this.supabaseSession = null;
    this.isInitialized = false;
    
    // Check if we're in development mode with placeholder credentials
    this.isDevelopmentMode = this.supabaseUrl.includes('your-project.supabase.co') || 
                            this.supabaseAnonKey === 'your-anon-key' ||
                            this.supabaseUrl.includes('localhost') ||
                            !this.supabaseUrl.startsWith('https://') ||
                            this.supabaseUrl === 'https://your-project.supabase.co';
    
    if (this.isDevelopmentMode) {
      console.log('🔧 Development mode detected - using mock authentication');
      console.log('💡 Supabase URL:', this.supabaseUrl);
      console.log('💡 To enable production mode:');
      console.log('   1. Run: ./setup-production.sh');
      console.log('   2. Or manually edit .env with real Supabase credentials');
      
      // Set up mock user for development
      this.currentUser = {
        id: 'dev-user',
        email: 'hritthikin@gmail.com', // Use admin email for development
        name: 'Development User',
        role: 'admin' // Grant admin access in development mode
      };
      this.subscription = {
        plan: 'pro',
        status: 'active'
      };
      this.usage = {
        currentMonth: 0,
        totalMinutes: 0,
        limit: -1 // Unlimited in dev mode
      };
    } else {
      // Production mode - initialize Supabase client with real credentials
      console.log('🚀 Production mode detected - using real Google OAuth');
      console.log('💡 Supabase URL:', this.supabaseUrl);
      this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
    }
  }

  // Initialize paths after app is ready
  init() {
    if (this.isInitialized) return;
    this.licenseFile = path.join(app.getPath('userData'), 'session.enc');
    this.isInitialized = true;
  }

  // Get unique device identifier
  getDeviceId() {
    const machineInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'unknown'}`;
    return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 32);
  }

  // Google Sign-In with Supabase
  async signInWithGoogle() {
    // In development mode, simulate successful sign-in
    if (this.isDevelopmentMode) {
      console.log('🔧 Development mode - simulating Google sign-in');
      console.log('💡 To enable real Google sign-in, configure Supabase credentials in .env');
      return { 
        success: true, 
        url: 'about:blank',
        isDevelopment: true 
      };
    }
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase connection timeout - check your internet connection')), 10000)
      );
      
      // Use web-based redirect for production
      const redirectUrl = process.env.OAUTH_REDIRECT_URL || 'http://localhost:3000/auth/callback';
      console.log('🔗 OAuth redirect URL:', redirectUrl);
      
      const authPromise = this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      const { data, error } = await Promise.race([authPromise, timeoutPromise]);

      if (error) throw error;
      return { success: true, url: data.url, isProduction: !redirectUrl.includes('localhost') };
    } catch (error) {
      console.error('Google sign-in error:', error);
      console.log('💡 Tip: Use "Continue in Development Mode" to bypass OAuth');
      
      // Provide more helpful error messages
      let userFriendlyError = error.message;
      if (error.message.includes('timeout')) {
        userFriendlyError = 'Connection timeout. Please check your internet connection and try again.';
      } else if (error.message.includes('Invalid API key') || error.message.includes('unauthorized')) {
        userFriendlyError = 'Invalid Supabase configuration. Please check your API keys.';
      } else if (error.message.includes('fetch')) {
        userFriendlyError = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('your-project.supabase.co')) {
        userFriendlyError = 'Google Sign-in not configured. Please set up Supabase credentials or use Development Mode.';
      }
      
      return { success: false, error: userFriendlyError };
    }
  }

  // Handle OAuth callback (called from Electron after redirect)
  async handleOAuthCallback(session) {
    try {
      // Set the session in Supabase
      const { data, error } = await this.supabase.auth.setSession(session);
      
      if (error) throw error;

      this.supabaseSession = data.session;
      
      // Send user data to our backend
      const response = await fetch(`${this.baseURL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user: data.user,
          deviceId: this.getDeviceId()
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Backend authentication failed');
      }

      this.currentUser = result.user;
      this.subscription = result.subscription;
      this.usage = result.usage;
      
      // Store encrypted session
      this.storeSession({
        supabaseSession: data.session,
        user: result.user,
        subscription: result.subscription,
        usage: result.usage
      });
      
      return { success: true, user: result.user, subscription: result.subscription, usage: result.usage };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return { success: false, error: error.message };
    }
  }

  // Validate stored session
  async validateSession() {
    this.init();
    
    // In development mode, always return valid session
    if (this.isDevelopmentMode) {
      console.log('🔧 Development mode - using mock session');
      return { 
        valid: true, 
        user: this.currentUser,
        subscription: this.subscription,
        usage: this.usage
      };
    }
    
    try {
      const sessionData = this.loadSession();
      if (!sessionData || !sessionData.supabaseSession) {
        return { valid: false, reason: 'No session found' };
      }

      // Set session in Supabase
      const { data, error } = await this.supabase.auth.setSession(sessionData.supabaseSession);
      
      if (error) throw error;

      // Validate with our backend (with retry logic)
      let response;
      let lastError;
      
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout per attempt
          
          response = await fetch(`${this.baseURL}/api/auth/validate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.session.access_token}`
            },
            body: JSON.stringify({
              deviceId: this.getDeviceId()
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          break; // Success, exit retry loop
          
        } catch (error) {
          lastError = error;
          console.log(`⚠️ Backend validation attempt ${attempt} failed:`, error.message);
          
          if (attempt < 2) {
            console.log('🔄 Retrying backend validation...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        }
      }
      
      // If all attempts failed, throw the last error
      if (!response) {
        throw lastError || new Error('Failed to connect to backend after retries');
      }

      // Check if response has content before parsing JSON
      const responseText = await response.text();
      let result;
      
      if (responseText.trim()) {
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response JSON:', parseError);
          throw new Error('Invalid JSON response from server');
        }
      } else {
        throw new Error('Empty response from server');
      }
      
      if (!response.ok) {
        throw new Error(result.error || 'Session validation failed');
      }

      this.supabaseSession = data.session;
      this.currentUser = result.user;
      this.subscription = result.subscription;
      this.usage = result.usage;
      
      // Update stored session with fresh data
      this.storeSession({
        supabaseSession: data.session,
        user: result.user,
        subscription: result.subscription,
        usage: result.usage
      });
      
      return { valid: true, user: result.user, subscription: result.subscription, usage: result.usage };
    } catch (error) {
      console.error('Session validation error:', error);
      
      // Try offline mode with cached data
      const sessionData = this.loadSession();
      if (sessionData && sessionData.user) {
        console.log('🔌 Offline mode - using cached session');
        this.currentUser = sessionData.user;
        this.subscription = sessionData.subscription;
        this.usage = sessionData.usage;
        return { 
          valid: true, 
          offline: true, 
          user: sessionData.user,
          subscription: sessionData.subscription,
          usage: sessionData.usage
        };
      }
      
      return { valid: false, reason: 'Cannot validate session' };
    }
  }

  // Get usage limits based on plan
  getUsageLimits() {
    const plan = this.subscription?.plan || 'free';
    
    const limits = {
      free: { minutes: 150, features: ['basic_transcription'] }, // 5 min/day * 30 days
      starter: { minutes: 450, features: ['basic_transcription', 'basic_ai_enhancement'], overage: 0.05 }, // 15 min/day * 30 days
      pro: { minutes: 1800, features: ['basic_transcription', 'advanced_ai_enhancement', 'priority_processing', 'all_languages'], overage: 0.03 }, // 60 min/day * 30 days
      enterprise: { minutes: -1, features: ['all'], overage: 0 } // Unlimited
    };

    return limits[plan] || limits.free;
  }

  // Check if user can use a feature
  canUseFeature(feature) {
    const limits = this.getUsageLimits();
    return limits.features.includes(feature) || limits.features.includes('all');
  }

  // Check if user has remaining minutes
  hasRemainingMinutes(minutesNeeded = 1) {
    const limits = this.getUsageLimits();
    if (limits.minutes === -1) return true; // Unlimited
    
    const used = this.usage?.currentMonth || 0;
    return used + minutesNeeded <= limits.minutes;
  }

  // Get current user info
  getUser() {
    return this.currentUser;
  }

  // Get subscription info
  getSubscription() {
    return this.subscription;
  }

  // Get usage info
  getUsage() {
    return this.usage;
  }

  // Check if user is authenticated
  isAuthenticated() {
    if (this.isDevelopmentMode) {
      return true;
    }
    return !!this.supabaseSession && !!this.currentUser;
  }

  // Check if user is on free plan
  isFreePlan() {
    return !this.subscription || this.subscription.plan === 'free';
  }

  // Check if user is admin
  isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  // Open upgrade page
  openUpgradePage() {
    shell.openExternal(`${this.baseURL.replace('/api', '')}/upgrade`);
  }

  // Update user settings
  async updateSettings(settings) {
    if (!this.supabaseSession) return { success: false };

    try {
      const response = await fetch(`${this.baseURL}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseSession.access_token}`
        },
        body: JSON.stringify(settings)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Settings update failed');
      }
      
      if (this.currentUser) {
        this.currentUser.settings = result.settings;
      }
      
      return { success: true, settings: result.settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Logout
  async logout() {
    this.init();
    
    try {
      // Sign out from Supabase (only if not in development mode)
      if (!this.isDevelopmentMode && this.supabase) {
        await this.supabase.auth.signOut();
      }
    } catch (error) {
      console.error('Supabase logout error:', error);
    }

    // Clear local data
    if (fs.existsSync(this.licenseFile)) {
      fs.unlinkSync(this.licenseFile);
    }
    
    this.currentUser = null;
    this.supabaseSession = null;
    this.subscription = null;
    this.usage = null;
  }

  // Encryption helpers
  storeSession(data) {
    this.init();
    try {
      const encrypted = this.encrypt(JSON.stringify(data));
      fs.writeFileSync(this.licenseFile, encrypted);
    } catch (error) {
      console.error('Failed to store session:', error.message);
    }
  }

  loadSession() {
    this.init();
    try {
      if (!fs.existsSync(this.licenseFile)) return null;
      const encrypted = fs.readFileSync(this.licenseFile, 'utf8');
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to load session:', error.message);
      return null;
    }
  }

  encrypt(text) {
    try {
      const key = crypto.scryptSync(this.getDeviceId(), 'eloquent-salt-v2', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error.message);
      return '';
    }
  }

  decrypt(encryptedData) {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      const key = crypto.scryptSync(this.getDeviceId(), 'eloquent-salt-v2', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      return '';
    }
  }
}

module.exports = new AuthService();