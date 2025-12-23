// ELOQUENT ELECTRON - VOICE DICTATION APP

// Suppress Electron security warnings in development
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Load environment variables
require('dotenv').config();

let app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog, Notification, screen, shell;

try {
  ({ app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog, Notification, screen, shell } = require('electron'));
} catch (e) {
  // During build process, electron might not be available
  console.log('Electron not available during build process');
  module.exports = {};
}
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const AI_PROMPTS = require('./utils/ai-prompts');
const performanceMonitor = require('./services/performance-monitor');
const authService = require('./services/auth-bridge');
const { isAdminUser } = require('./utils/admin-check');
const FastStartup = require('./utils/fast-startup');

// Initialize fast startup optimizer
const fastStartup = new FastStartup();

// Exit early if electron is not available (during build)
if (!app) {
  process.exit(0);
}

// Suppress security warnings in development - multiple methods for reliability
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('disable-web-security-warnings');

// Set environment variable to suppress warnings
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Register protocol handler BEFORE app ready (CRITICAL for OAuth)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('eloquent', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('eloquent');
}

// Handle protocol URLs from first instance launch
if (process.argv.length >= 2) {
  const protocolUrl = process.argv.find(arg => arg.startsWith('eloquent://'));
  if (protocolUrl) {
    // Store for processing after app is ready
    global.pendingProtocolUrl = protocolUrl;
  }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Handle second instance (for protocol URLs on Windows/Linux)
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (dashboardWindow) {
      if (dashboardWindow.isMinimized()) dashboardWindow.restore();
      dashboardWindow.focus();
    }
    
    // Check if there's a protocol URL in the command line
    const protocolUrl = commandLine.find(arg => arg.startsWith('eloquent://'));
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl);
    }
  });
}

let overlayWindow = null;
let dashboardWindow = null;
let adminWindow = null;
let userManagementWindow = null;
let loginWindow = null;
let subscriptionWindow = null;
let manualOAuthWindow = null;

let tray = null;
let recording = null;
let audioFile = null;
let recordingProcess = null;
let currentMode = 'standard';
let isAuthenticated = false;
let processingOAuth = false; // Flag to prevent duplicate OAuth processing
let lastProcessedOAuthUrl = null; // Track last processed URL

// Reset OAuth flags at startup
console.log('🔄 Initializing OAuth processing flags');
processingOAuth = false;
lastProcessedOAuthUrl = null;

// Application configuration
const CONFIG = {
  apiKeys: [
    process.env.GROQ_API_KEY_1 || '', // API Key 1 - Load from environment
    process.env.GROQ_API_KEY_2 || '', // API Key 2 (optional)
    process.env.GROQ_API_KEY_3 || '', // API Key 3 (optional)
    process.env.GROQ_API_KEY_4 || '', // API Key 4 (optional)
    process.env.GROQ_API_KEY_5 || ''  // API Key 5 (optional)
  ],
  language: process.env.LANGUAGE || 'en',
  customDictionary: '',
  aiMode: process.env.AI_MODE || 'auto',
  preserveClipboard: process.env.PRESERVE_CLIPBOARD === 'true',
  autoGrammarFix: process.env.AUTO_GRAMMAR_FIX !== 'false',
  autoPasteMode: 'direct'
};

// Admin configuration
const ADMIN_CONFIG = {
  masterApiKey: process.env.GROQ_API_KEY || '',
  dailyLimit: 1000,
  rateLimitPerUser: 100,
  users: [],
  apiRequests: []
};

// Recording state
let isRecording = false;
let isProcessing = false;
let isCreatingOverlay = false;
let overlayCreationLock = false;
let lastOverlayCreationTime = 0;
let recordingStartTime = 0;

// Get active API key based on usage
function getActiveAPIKey() {
  const validKeys = CONFIG.apiKeys.filter(key => key && key.trim() !== '');
  if (validKeys.length === 0) {
    throw new Error('No API keys configured');
  }

  // Get usage data from file
  const today = new Date().toISOString().split('T')[0];
  const usageFile = path.join(app.getPath('userData'), 'api-usage.json');

  let usageData = { date: '', keys: [] };
  if (fs.existsSync(usageFile)) {
    try {
      usageData = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    } catch (error) {
      console.error('Error reading usage file:', error);
    }
  }

  // Reset if new day or no data
  if (usageData.date !== today) {
    const newUsage = {
      date: today,
      keys: validKeys.map(key => ({ key, timeUsed: 0 }))
    };
    fs.writeFileSync(usageFile, JSON.stringify(newUsage, null, 2));
    return validKeys[0];
  }

  // Find key with least usage (under 40 minutes)
  const MAX_TIME_PER_KEY = 40 * 60; // 40 minutes in seconds
  for (const keyData of usageData.keys || []) {
    if (validKeys.includes(keyData.key) && keyData.timeUsed < MAX_TIME_PER_KEY) {
      return keyData.key;
    }
  }

  // If all keys exhausted, return first key (will show error to user)
  return validKeys[0];
}

// Track API usage time
function trackAPIUsage(duration) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const usageFile = path.join(app.getPath('userData'), 'api-usage.json');

    let usageData = { date: today, keys: [] };
    if (fs.existsSync(usageFile)) {
      usageData = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    }

    // Reset if new day
    if (usageData.date !== today) {
      const validKeys = CONFIG.apiKeys.filter(key => key && key.trim() !== '');
      usageData = {
        date: today,
        keys: validKeys.map(key => ({ key, timeUsed: 0 }))
      };
    }

    // Update usage for current key (only if we have API keys)
    const currentKey = getActiveAPIKey();
    if (currentKey) {
      const keyIndex = usageData.keys.findIndex(k => k.key === currentKey);
      if (keyIndex !== -1) {
        usageData.keys[keyIndex].timeUsed += duration;
      } else {
        usageData.keys.push({ key: currentKey, timeUsed: duration });
      }
    }

    fs.writeFileSync(usageFile, JSON.stringify(usageData, null, 2));

    // Notify dashboard of usage update
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('usage-updated', usageData);
    }
  } catch (error) {
    console.error('Error tracking API usage:', error);
  }
}

// Report usage to backend for authenticated users
async function reportUsageToBackend(durationSeconds, mode, language) {
  try {
    // Get auth token from store
    const Store = require('electron-store');
    const store = new Store();
    const token = store.get('authToken');
    
    if (!token) {
      console.log('📊 No auth token, skipping backend usage report');
      return;
    }
    
    // Use the same production API URL as dashboard
    const apiUrl = 'https://agile-basin-06335-9109082620ce.herokuapp.com';
    
    console.log(`📊 Reporting usage to backend: ${durationSeconds}s, mode: ${mode}`);
    
    const response = await axios.post(
      `${apiUrl}/api/usage/report`,
      {
        duration_seconds: durationSeconds,
        mode: mode || 'standard',
        language: language || CONFIG.language
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 5000
      }
    );
    
    if (response.status === 200) {
      console.log('✅ Usage reported to backend:', response.data);
      
      // Notify dashboard to refresh usage display
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('usage-reported', response.data);
      }
    }
  } catch (error) {
    // Don't fail silently but also don't block the user
    console.error('⚠️ Failed to report usage to backend:', error.message);
  }
}

// Hide dock icon (menu bar app)
if (app.dock) {
  app.dock.hide();
}

// Request microphone permission
async function requestMicrophonePermission() {
  if (process.platform !== 'darwin') return true;

  try {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    console.log('Microphone permission status:', micStatus);

    // If already granted, return immediately
    if (micStatus === 'granted') {
      console.log('✅ Microphone permission already granted');
      return true;
    }

    // If denied or not determined, only ask once
    if (micStatus === 'not-determined') {
      console.log('Requesting microphone permission...');
      const granted = await systemPreferences.askForMediaAccess('microphone');

      if (granted) {
        console.log('✅ Microphone permission granted');
        return true;
      }
    }

    // Permission denied or restricted - show instructions
    console.warn('⚠️ Microphone permission not granted');

    // Show helpful dialog only once
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Microphone Permission Required',
      message: 'Eloquent needs microphone access to record your voice.',
      detail: 'Please grant microphone permission in System Settings.\n\nGo to: System Settings > Privacy & Security > Microphone\n\nThen enable "Electron" or "Eloquent".\n\nAfter granting permission, restart the app.',
      buttons: ['Open System Settings', 'Quit App'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      // Open System Settings to Microphone
      exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
    }

    // Quit app if permission not granted
    app.quit();
    return false;

  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
}

// Check accessibility permission (non-blocking)
function checkAccessibilityPermission() {
  if (process.platform !== 'darwin') return;

  // Try to get accessibility permission status
  let isTrusted = false;
  try {
    isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
  } catch (error) {
    console.log('⚠️ Could not check accessibility permission:', error.message);
  }

  if (!isTrusted) {
    console.warn('⚠️  Accessibility permission not detected');
    console.log('💡 Auto-paste will try multiple methods');
    console.log('💡 Text will always be copied to clipboard as backup');
    console.log('🔧 If auto-paste fails: System Settings > Privacy & Security > Accessibility');
    console.log('🎯 Enhanced auto-paste will attempt to work regardless');
  } else {
    console.log('✅ Accessibility permission confirmed - auto-paste fully enabled');
  }
}

// Function to prompt user to enable accessibility
function promptAccessibilityPermission() {
  const result = dialog.showMessageBoxSync({
    type: 'info',
    title: '🎯 Enable Auto-Paste Feature',
    message: 'Make Eloquent paste text automatically at your cursor?',
    detail: '🎯 AUTO-PASTE BENEFITS:\n• Text appears instantly where you\'re typing\n• No need to press Cmd+V\n• Seamless workflow\n\n🔧 SETUP STEPS:\n1. Click "Open Settings" below\n2. Find "Electron" or "Eloquent" in the list\n3. Toggle it ON ✅\n4. Restart Eloquent\n\n📋 BACKUP: Text is always copied to clipboard regardless\n\n⚠️ SECURITY: Only allows pasting transcribed text, nothing else',
    buttons: ['Open Settings', 'Maybe Later', 'Keep Clipboard Only'],
    defaultId: 0,
    cancelId: 1
  });

  if (result === 0) {
    // Open System Settings to Accessibility
    exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');

    // Show follow-up notification
    setTimeout(() => {
      showNotification('🔧 Setup Instructions', 'Find "Electron" or "Eloquent" in the list and toggle it ON. Then restart Eloquent.');
    }, 2000);
  } else if (result === 1) {
    showNotification('📋 Clipboard Mode', 'Text will be copied to clipboard. Press Cmd+V to paste. You can enable auto-paste anytime from the menu.');
  }

  return result;
}

// Suppress all unhandled errors and rejections to prevent system dialogs
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
});

app.whenReady().then(async () => {
  fastStartup.milestone('App ready');
  console.log('🚀 App is ready, starting ULTRA-FAST initialization...');

  // CRITICAL: Process pending protocol URL from first instance launch
  if (global.pendingProtocolUrl) {
    console.log('📱 Processing pending protocol URL from startup:', global.pendingProtocolUrl);
    setTimeout(() => {
      handleProtocolUrl(global.pendingProtocolUrl);
      global.pendingProtocolUrl = null;
    }, 1000); // Small delay to ensure everything is initialized
  }

  // PERFORMANCE BOOST: Parallel initialization
  const initTasks = [
    // Register protocol (fast) - REMOVED: Already done before app.whenReady
    () => {
      console.log('✅ Protocol handler already registered during startup');
    },
    
    // Initialize auth service (async)
    async () => {
      console.log('🔐 Initializing authentication...');
      authService.init();
      
      // IMMEDIATE DEV MODE CHECK: Set authentication immediately if in dev mode
      if (authService.isAuthenticated()) {
        console.log('🔧 Development mode - authentication enabled immediately');
        isAuthenticated = true;
        
        // In development mode, get the dev session directly without network calls
        if (authService.isDevelopmentMode) {
          console.log('🔧 Development mode - using mock session data');
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
          
          // Cache the dev session
          authService.cacheSession('current', devSession);
          
          console.log('✅ Development user authenticated:', devSession.user.email);
          return; // Skip network validation in dev mode
        }
      }
      
      // Only validate session if not already authenticated in dev mode
      if (!isAuthenticated) {
        try {
          // Add timeout to prevent hanging
          const authResult = await Promise.race([
            authService.validateSession(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Auth validation timeout')), 3000)
            )
          ]);
          
          if (authResult.valid) {
            console.log('✅ User authenticated:', authResult.user?.email || 'cached');
            isAuthenticated = true;

            // Update CONFIG with user settings if available
            if (authResult.user?.settings) {
              CONFIG.language = authResult.user.settings.language || CONFIG.language;
              CONFIG.aiMode = authResult.user.settings.aiMode || CONFIG.aiMode;
              CONFIG.autoGrammarFix = authResult.user.settings.autoGrammarFix ?? CONFIG.autoGrammarFix;
            }
          } else {
            isAuthenticated = false;
          }
        } catch (error) {
          console.log('⚠️ Auth validation failed:', error.message);
          console.log('📝 Continuing without authentication');
          isAuthenticated = false;
        }
      }
      
      // FINAL CHECK: Ensure development mode is properly detected
      if (!isAuthenticated && authService.isAuthenticated()) {
        console.log('🔧 Final check - development mode detected, enabling authentication');
        isAuthenticated = true;
      }
    },
    
    // Check permissions (async, non-blocking)
    async () => {
      console.log('🔐 Checking permissions...');
      // Run permission checks in parallel
      const [micResult] = await Promise.allSettled([
        requestMicrophonePermission(),
        Promise.resolve(checkAccessibilityPermission()) // Make it a promise for consistency
      ]);
      
      if (micResult.status === 'rejected') {
        console.warn('⚠️ Microphone permission check failed:', micResult.reason);
      }
    }
  ];

  // PERFORMANCE BOOST: Execute initialization tasks in parallel
  await Promise.allSettled(initTasks.map(task => 
    typeof task === 'function' ? Promise.resolve(task()) : task
  ));

  // PERFORMANCE BOOST: Create UI components immediately after auth
  console.log('🎛️ Creating tray...');
  createTray();

  console.log('⌨️ Registering shortcuts...');
  registerShortcuts();

  // PERFORMANCE BOOST: Pre-cache overlay HTML for instant window creation
  preCacheOverlayHTML();

  fastStartup.milestone('UI components created');
  
  console.log('✅ Eloquent is ready! Look for the microphone icon in your menu bar.');
  console.log('🎤 Press Alt+Space to start recording, ESC to stop');
  
  // Log startup performance
  fastStartup.logReport();

  // PERFORMANCE BOOST: Defer login window creation to avoid blocking startup
  if (!isAuthenticated) {
    console.log('🔒 Sign-in required - will show login window');
    // Create login window directly instead of using setImmediate
    try {
      console.log('🔑 Creating login window immediately...');
      createLoginWindow();
      console.log('✅ Login window creation initiated');
    } catch (error) {
      console.error('❌ Error creating login window:', error);
      // Fallback: try again after a short delay
      setTimeout(() => {
        try {
          console.log('🔄 Retrying login window creation...');
          createLoginWindow();
        } catch (retryError) {
          console.error('❌ Login window retry failed:', retryError);
        }
      }, 1000);
    }
  } else {
    const subscription = authService.getSubscription();
    const usage = authService.getUsage();
    console.log(`👤 Logged in as: ${authService.getUser()?.email}`);
    console.log(`📊 Plan: ${subscription?.plan || 'free'}`);
    if (usage) {
      console.log(`⏱️ Usage: ${usage.currentMonth}/${usage.limit === -1 ? '∞' : usage.limit} minutes`);
    }
  }

});

function createTray() {
  // Prevent unnecessary tray recreations
  const currentAuthStatus = isAuthenticated;
  if (tray && tray.lastAuthStatus === currentAuthStatus) {
    console.log('🎛️ Tray already up to date, skipping recreation');
    return;
  }
  
  // Destroy existing tray if it exists
  if (tray) {
    tray.destroy();
    tray = null;
  }
  
  console.log('🎛️ Creating system tray icon...');

  // Create a 32x32 microphone icon using raw RGBA pixel data
  // This creates a smooth, anti-aliased microphone shape
  const size = 32;
  const canvas = Buffer.alloc(size * size * 4);

  // Helper function to draw anti-aliased pixels
  const setPixel = (x, y, alpha) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const idx = (y * size + x) * 4;
      canvas[idx] = 0;       // R
      canvas[idx + 1] = 0;   // G
      canvas[idx + 2] = 0;   // B
      canvas[idx + 3] = Math.min(255, Math.max(0, Math.round(alpha))); // A
    }
  };

  // Draw filled circle (for microphone head)
  const fillCircle = (cx, cy, r) => {
    for (let y = cy - r - 1; y <= cy + r + 1; y++) {
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= r) {
          setPixel(Math.round(x), Math.round(y), 255);
        } else if (dist <= r + 1) {
          setPixel(Math.round(x), Math.round(y), 255 * (r + 1 - dist));
        }
      }
    }
  };

  // Draw filled rounded rectangle
  const fillRoundedRect = (x1, y1, x2, y2, r) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        let inside = false;
        if (y >= y1 + r && y <= y2 - r) inside = true;
        else if (x >= x1 + r && x <= x2 - r) inside = true;
        else {
          const corners = [
            [x1 + r, y1 + r], [x2 - r, y1 + r],
            [x1 + r, y2 - r], [x2 - r, y2 - r]
          ];
          for (const [cx, cy] of corners) {
            if (Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) <= r) {
              inside = true;
              break;
            }
          }
        }
        if (inside) setPixel(x, y, 255);
      }
    }
  };

  // Draw line with thickness
  const drawLine = (x1, y1, x2, y2, thickness) => {
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      fillCircle(cx, cy, thickness / 2);
    }
  };

  // Draw arc
  const drawArc = (cx, cy, r, startAngle, endAngle, thickness) => {
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / steps);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      fillCircle(x, y, thickness / 2);
    }
  };

  // Draw microphone
  const centerX = 16;

  // Microphone head (rounded rectangle / capsule)
  fillRoundedRect(10, 4, 22, 16, 6);

  // Microphone arc (U-shape holder)
  drawArc(centerX, 14, 9, 0, Math.PI, 2);

  // Microphone stand (vertical line)
  drawLine(centerX, 23, centerX, 27, 2.5);

  // Microphone base (horizontal line)
  drawLine(10, 27, 22, 27, 2.5);

  let icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  icon = icon.resize({ width: 18, height: 18, quality: 'best' });
  icon.setTemplateImage(true);
  
  try {
    tray = new Tray(icon);
    console.log('✅ Tray icon created successfully');
  } catch (error) {
    console.error('❌ Failed to create tray icon:', error);
    return;
  }

  // Build dynamic menu based on auth state
  const user = authService.getUser();
  let subscription = authService.getSubscription();
  let usage = authService.getUsage();
  let plan = subscription?.plan || 'free';

  // ADMIN OVERRIDE: If user is admin but doesn't have enterprise plan, override it
  if (user && isAdminUser(user)) {
    console.log('🔧 Admin user detected:', user.email);
    
    // Force admin users to have enterprise plan and unlimited usage
    if (plan !== 'enterprise') {
      console.log('⚡ Overriding plan for admin user: free → enterprise');
      subscription = { plan: 'enterprise', status: 'active' };
      plan = 'enterprise';
    }
    
    if (!usage || usage.limit !== -1) {
      console.log('⚡ Overriding usage for admin user: limited → unlimited');
      usage = { currentMonth: 0, totalMinutes: 0, limit: -1 };
    }
    
    console.log('📊 Final Subscription:', subscription);
    console.log('⏱️ Final Usage:', usage);
    console.log('📋 Final Plan:', plan);
  }

  const menuTemplate = [
    { label: '🎤 Eloquent Voice Dictation', enabled: false },
    { type: 'separator' },
  ];

  // Auth section - production mode authentication
  if (isAuthenticated && user) {
    menuTemplate.push(
      { label: `👤 ${user.email}`, enabled: false }
    );
    
    // Plan and usage info
    const planLabel = plan === 'enterprise' ? 'Enterprise' : plan.charAt(0).toUpperCase() + plan.slice(1);
    menuTemplate.push({ label: `📊 Plan: ${planLabel}`, enabled: false });
    
    if (usage) {
      if (usage.limit === -1) {
        menuTemplate.push({ label: `⏱️ Unlimited minutes`, enabled: false });
      } else {
        const currentMonth = usage.currentMonth || 0;
        const remaining = usage.limit - currentMonth;
        if (!isNaN(remaining) && remaining >= 0) {
          menuTemplate.push({ label: `⏱️ ${remaining} min remaining`, enabled: false });
        }
      }
    }
    
    menuTemplate.push({ type: 'separator' });

    // Main actions
    menuTemplate.push({ label: 'Open Dashboard', click: () => createDashboard() });

    // Only show admin panel for admin users
    const shouldShowAdmin = isAdminUser(user);
    if (shouldShowAdmin) {
      menuTemplate.push({ label: '🔧 Admin Panel', click: () => createAdminPanel() });
    }

    // Subscription management removed from tray menu
  } else {
    menuTemplate.push({ label: '🔑 Sign In / Sign Up', click: () => createLoginWindow() });
  }

  menuTemplate.push({ type: 'separator' });

  // Recording actions
  menuTemplate.push(
    {
      label: 'Start AI Rewrite (Alt+Shift+Space)',
      click: () => {
        if (!overlayWindow && !isCreatingOverlay) {
          playSound('start');
          createOverlay('rewrite');
        }
      }
    },
    {
      label: 'Start Standard (Alt+Space)',
      click: () => {
        if (!overlayWindow && !isCreatingOverlay) {
          playSound('start');
          createOverlay('standard');
        }
      }
    }
  );

  // Auto-paste status (only show if not enabled)
  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    menuTemplate.push(
      { type: 'separator' },
      {
        label: '🔧 Enable Auto-Paste',
        click: () => promptAccessibilityPermission()
      }
    );
  }

  menuTemplate.push({ type: 'separator' });

  // Settings and logout
  if (isAuthenticated) {
    menuTemplate.push({ label: 'Settings', click: () => createDashboard() });
    menuTemplate.push({
      label: '🚪 Sign Out',
      click: () => {
        authService.logout();
        isAuthenticated = false;
        
        // Refresh tray menu
        createTray();
        
        // INSTANT FRONTEND UPDATE: Notify dashboard immediately
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
          dashboardWindow.webContents.send('auth-updated', {
            isAuthenticated: false,
            user: null,
            subscription: null,
            usage: null
          });
        }
      }
    });
  }

  menuTemplate.push(
    { type: 'separator' },
    { label: 'Quit Eloquent', click: () => app.quit() }
  );

  const contextMenu = Menu.buildFromTemplate(menuTemplate);

  if (tray) {
    tray.setToolTip('Eloquent - Voice to Text');
    tray.setContextMenu(contextMenu);
    console.log('✅ Tray menu configured');
    console.log('🔍 Look for the microphone icon in your menu bar (top-right corner)');

    // Add click handler for tray icon
    tray.on('click', () => {
      console.log('🖱️ Tray icon clicked');
      createDashboard();
    });

    tray.on('right-click', () => {
      console.log('🖱️ Tray icon right-clicked');
      tray.popUpContextMenu();
    });
    
    // Track auth status to prevent unnecessary recreations
    tray.lastAuthStatus = isAuthenticated;
  } else {
    console.error('❌ Tray not created - icon will not be visible');
  }
}

// Enhanced sound system with better audio feedback
function playSound(type) {
  // Skip sound on non-macOS platforms
  if (process.platform !== 'darwin') {
    console.log(`🔊 Sound: ${type} (skipped on ${process.platform})`);
    return;
  }

  const sounds = {
    start: '/System/Library/Sounds/Tink.aiff',
    success: '/System/Library/Sounds/Glass.aiff',
    error: '/System/Library/Sounds/Basso.aiff',
    cancel: '/System/Library/Sounds/Funk.aiff',
    notification: '/System/Library/Sounds/Ping.aiff'
  };

  const soundFile = sounds[type] || sounds.notification;

  // Adjust volume based on sound type for better UX
  let volume = 0.7; // Default volume
  if (type === 'success') {
    volume = 0.6; // Slightly softer for success to match closing animation
  } else if (type === 'error') {
    volume = 0.8; // Slightly louder for errors to get attention
  }

  // Play sound with volume control
  exec(`afplay "${soundFile}" -v ${volume}`, (error) => {
    if (error) {
      console.error(`Sound playback error (${type}):`, error.message);
    }
  });
}

// Shortcut system
let lastShortcutTime = 0;
const SHORTCUT_DEBOUNCE = 25;
let shortcutLock = false;

function handleShortcut(action, mode = 'standard') {
  const now = Date.now();

  if (shortcutLock || (now - lastShortcutTime < SHORTCUT_DEBOUNCE)) {
    return;
  }

  lastShortcutTime = now;
  shortcutLock = true;

  setTimeout(() => {
    shortcutLock = false;
  }, SHORTCUT_DEBOUNCE);
  
  if (action === 'start') {
    if (!overlayWindow && !isCreatingOverlay) {
      setImmediate(() => playSound('start'));
      createOverlayUltraFast(mode);
    } else if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.focus();
      overlayWindow.show();
    }
  } else if (action === 'stop') {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      stopRecording();
    }
  }
}

function registerShortcuts() {
  // Unregister all existing shortcuts first to prevent duplicates
  globalShortcut.unregisterAll();
  
  console.log('🔧 Registering keyboard shortcuts...');
  
  // ULTRA-FAST shortcut registration - optimized for instant response
  const rewriteRegistered = globalShortcut.register('Alt+Shift+Space', () => {
    handleShortcut('start', 'rewrite');
  });

  const standardRegistered = globalShortcut.register('Alt+Space', () => {
    handleShortcut('start', 'standard');
  });

  // INSTANT ESC response - critical for fast stopping
  const escRegistered = globalShortcut.register('Escape', () => {
    handleShortcut('stop');
  });

  // Backup shortcuts for reliability
  const escBackup = globalShortcut.register('Cmd+Escape', () => {
    handleShortcut('stop');
  });

  // Cmd+Shift+A - Open Admin Panel (fallback if tray not visible)
  const adminRegistered = globalShortcut.register('Cmd+Shift+A', () => {
    console.log('🔧 Cmd+Shift+A pressed - opening admin panel');
    createAdminPanel();
  });

  // Cmd+Shift+U - Open User Management (fallback if tray not visible)
  const userMgmtRegistered = globalShortcut.register('Cmd+Shift+U', () => {
    console.log('👥 Cmd+Shift+U pressed - opening user management');
    createUserManagement();
  });
  
  // Cmd+Shift+R - Refresh tray menu (for debugging)
  const refreshRegistered = globalShortcut.register('Cmd+Shift+R', () => {
    console.log('🔄 Cmd+Shift+R pressed - refreshing tray menu');
    console.log('Current auth state:', { 
      isAuthenticated, 
      user: authService.getUser()?.email,
      isAdmin: authService.isAdmin()
    });
    createTray();
  });

  // Cmd+Shift+D - Open Dashboard (fallback if tray not visible)
  const dashboardRegistered = globalShortcut.register('Cmd+Shift+D', () => {
    console.log('📊 Cmd+Shift+D pressed - opening dashboard');
    createDashboard();
  });

  console.log('✅ Shortcuts registered:');
  console.log(`   Alt+Shift+Space (AI Rewrite): ${rewriteRegistered ? 'OK' : 'FAILED'}`);
  console.log(`   Alt+Space (Standard): ${standardRegistered ? 'OK' : 'FAILED'}`);
  console.log(`   ESC (Stop): ${escRegistered ? 'OK' : 'FAILED'}`);
  
  if (!rewriteRegistered || !standardRegistered || !escRegistered) {
    console.error('❌ Some core shortcuts failed to register');
  }
}



// Cached overlay HTML content for instant loading
let cachedOverlayHTML = null;

// Pre-cache overlay HTML on startup for faster window creation
function preCacheOverlayHTML() {
  try {
    const overlayPath = path.join(__dirname, 'ui', 'overlay.html');
    if (fs.existsSync(overlayPath)) {
      cachedOverlayHTML = fs.readFileSync(overlayPath, 'utf8');
      console.log('✅ Overlay HTML pre-cached for instant loading');
    }
  } catch (err) {
    console.log('⚠️ Could not pre-cache overlay HTML:', err.message);
  }
}

// ULTRA-FAST Overlay creation with aggressive optimizations
function createOverlayUltraFast(mode = 'standard') {
  currentMode = mode;

  if (!isAuthenticated && !authService.isAuthenticated()) {
    showNotification('Sign In Required', 'Please sign in with Google to use Eloquent');
    createLoginWindow();
    return;
  }

  if (isCreatingOverlay) {
    return;
  }
  
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    overlayWindow.show();
    return;
  }
  
  if (recordingProcess) {
    recordingProcess.kill();
    recordingProcess = null;
  }

  isCreatingOverlay = true;
  lastOverlayCreationTime = Date.now();
  
  // PERFORMANCE BOOST: Pre-calculate position before window creation
  const cursorPosition = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPosition);
  const screenBounds = display.workArea;
  
  const windowWidth = 280;
  const windowHeight = 50;
  const x = cursorPosition.x - (windowWidth / 2);
  const y = cursorPosition.y - windowHeight - 20;
  
  const finalX = Math.max(screenBounds.x, Math.min(x, screenBounds.x + screenBounds.width - windowWidth));
  const finalY = Math.max(screenBounds.y, Math.min(y, screenBounds.y + screenBounds.height - windowHeight));
  
  overlayWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round(finalX),
    y: Math.round(finalY),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    acceptFirstMouse: false,
    show: false,
    paintWhenInitiallyHidden: false,
    // PERFORMANCE BOOST: Optimized webPreferences for speed
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      offscreen: false,
      preload: false,
      enableRemoteModule: false,
      experimentalFeatures: false,
      // Security settings
      webSecurity: true,
      allowRunningInsecureContent: false,
      disableBlinkFeatures: 'Auxclick',
      // NEW: Hardware acceleration
      hardwareAcceleration: true,
      // NEW: Faster rendering
      enableWebSQL: false,
      enablePreferredSizeMode: false
    }
  });
  
  overlayWindow.recordingStartTime = Date.now();
  
  // PERFORMANCE BOOST: Set properties before loading
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'floating', 1);

  // PERFORMANCE BOOST: Always load from file to ensure latest code is used
  // Note: Cached HTML was causing issues with relative script paths
  overlayWindow.loadFile('src/ui/overlay.html');

  // PERFORMANCE BOOST: Start recording immediately, don't wait for full load
  overlayWindow.webContents.once('dom-ready', () => {
    // Send mode immediately on DOM ready (faster than did-finish-load)
    overlayWindow.webContents.send('set-mode', mode);
    overlayWindow.show();
    
    // Start recording immediately - don't wait
    startRecording();
    isCreatingOverlay = false;
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    isCreatingOverlay = false;
  });
}







// Alias for backward compatibility
const createOverlay = createOverlayUltraFast;

function createDashboard() {
  if (dashboardWindow) {
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    // PERFORMANCE BOOST: Optimized webPreferences for dashboard
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
      // Performance optimizations
      backgroundThrottling: false,
      hardwareAcceleration: true,
      // Security settings - required for current IPC implementation
      webSecurity: false,
      allowRunningInsecureContent: false,
      // Faster rendering
      enableWebSQL: false,
      enablePreferredSizeMode: false,
      // Disable unnecessary features
      disableBlinkFeatures: 'Auxclick'
    }
  });

  // PERFORMANCE BOOST: Preload optimizations
  dashboardWindow.webContents.once('dom-ready', () => {
    // Inject performance optimizations
    dashboardWindow.webContents.executeJavaScript(`
      // Disable smooth scrolling for faster rendering
      document.documentElement.style.scrollBehavior = 'auto';
      
      // Enable hardware acceleration hints
      document.body.style.transform = 'translateZ(0)';
      document.body.style.backfaceVisibility = 'hidden';
      
      // Optimize animations
      document.body.style.willChange = 'transform';
      
      console.log('🚀 Dashboard performance optimizations applied');
    `);
  });

  dashboardWindow.loadFile('src/ui/dashboard.html');

  // Send authentication status immediately when dashboard loads
  dashboardWindow.webContents.once('did-finish-load', () => {
    console.log('📊 Dashboard loaded, sending immediate auth status...');
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const user = authService.getUser();
      const authenticated = authService.isAuthenticated();
      const subscription = authService.getSubscription();
      const usage = authService.getUsage();
      
      console.log('📤 Sending auth data:', {
        authenticated,
        userEmail: user?.email,
        plan: subscription?.plan
      });
      
      dashboardWindow.webContents.send('auth-status', {
        isAuthenticated: authenticated,
        user: user,
        subscription: subscription,
        usage: usage
      });
    }, 100);
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}



function createAdminPanel() {
  console.log('🔧 createAdminPanel called');
  
  // Check if user is authenticated and has admin role
  if (!isAuthenticated) {
    console.log('🚫 Admin panel access denied: User not authenticated');
    console.log('   isAuthenticated:', isAuthenticated);
    console.log('   authService.isAuthenticated():', authService.isAuthenticated());
    
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Access Denied',
      message: 'You must be logged in to access the admin panel.',
      buttons: ['OK']
    });
    return;
  }

  // Check admin access
  const currentUser = authService.getUser();
  console.log('🔧 Checking admin access for user:', currentUser?.email);
  
  if (!isAdminUser(currentUser)) {
    console.log('🚫 Admin panel access denied: User is not admin');
    console.log('   User email:', currentUser?.email);
    console.log('   User role:', currentUser?.role);
    
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Access Denied',
      message: 'You do not have permission to access the admin panel.',
      buttons: ['OK']
    });
    return;
  }

  if (adminWindow) {
    console.log('ℹ️ Admin panel already open, focusing...');
    adminWindow.focus();
    return;
  }

  console.log('✅ Admin panel access granted for:', authService.getUser()?.email);

  try {
    adminWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    adminWindow.loadFile('src/ui/admin.html');
    console.log('✅ Admin panel window created successfully');

    // Suppress autofill errors in dev tools
    adminWindow.webContents.once('did-finish-load', () => {
      adminWindow.webContents.executeJavaScript(`
        // Suppress autofill console errors
        const originalConsoleError = console.error;
        console.error = function(...args) {
          const message = args.join(' ');
          if (message.includes('Autofill.enable') || message.includes('Autofill.setAddresses')) {
            return; // Suppress autofill errors
          }
          originalConsoleError.apply(console, args);
        };
      `);
    });

    adminWindow.on('closed', () => {
      console.log('ℹ️ Admin panel window closed');
      adminWindow = null;
    });
  } catch (error) {
    console.error('❌ Error creating admin panel window:', error);
    throw error;
  }
}

function createUserManagement() {
  // Check if user is authenticated and has admin role
  if (!isAuthenticated) {
    console.log('🚫 User management access denied: User not authenticated');
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Access Denied',
      message: 'You must be logged in to access user management.',
      buttons: ['OK']
    });
    return;
  }

  // Check admin access
  const currentUser = authService.getUser();
  
  if (!isAdminUser(currentUser)) {
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Access Denied',
      message: 'You do not have permission to access user management.',
      buttons: ['OK']
    });
    return;
  }

  if (userManagementWindow) {
    userManagementWindow.focus();
    return;
  }

  console.log('✅ User management access granted for:', authService.getUser()?.email);

  userManagementWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    title: 'User Management - Eloquent Admin',
    icon: path.join(__dirname, '../assets/logo.png')
  });

  userManagementWindow.loadFile('src/ui/user-management.html');

  // Suppress autofill errors in dev tools
  userManagementWindow.webContents.once('did-finish-load', () => {
    userManagementWindow.webContents.executeJavaScript(`
      // Suppress autofill console errors
      const originalConsoleError = console.error;
      console.error = function(...args) {
        const message = args.join(' ');
        if (message.includes('Autofill.enable') || message.includes('Autofill.setAddresses')) {
          return; // Suppress autofill errors
        }
        originalConsoleError.apply(console, args);
      };
    `);
  });

  userManagementWindow.on('closed', () => {
    userManagementWindow = null;
  });
}



function startRecording() {
  // Prevent duplicate recording processes
  if (recordingProcess) {
    console.log('⚠️ Recording already in progress - skipping');
    return;
  }

  performanceMonitor.startRecording();

  audioFile = path.join(app.getPath('temp'), `eloquent-${Date.now()}.wav`);
  recordingStartTime = Date.now();

  // Send the recording start time to the overlay for accurate timer
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('recording-started', recordingStartTime);
  }

  playSound('start');
  performanceMonitor.measureRecordingLatency();
  // Simple recording - no effects that block output
  // Effects like norm, silence, compand require full file read and block streaming
  recordingProcess = spawn('rec', [
    '-r', '16000',        // 16kHz - optimal for Whisper
    '-c', '1',            // Mono
    '-b', '16',           // 16-bit depth
    '-t', 'wav',
    audioFile
    // No effects - they cause Out:0 issue on macOS CoreAudio
  ]);

  // Add better logging for the recording process
  recordingProcess.stdout.on('data', (data) => {
    console.log('📊 Sox stdout:', data.toString());
  });

  recordingProcess.stderr.on('data', (data) => {
    console.log('📊 Sox stderr:', data.toString());
  });

  let amplitudeInterval = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const baseAmplitude = Math.random() * 0.3 + 0.1;
      const voiceBoost = Math.random() > 0.7 ? Math.random() * 0.4 : 0;
      const amplitude = Math.min(baseAmplitude + voiceBoost, 1.0);
      const hasVoiceActivity = amplitude > 0.25;
      
      overlayWindow.webContents.send('amplitude', amplitude);
      overlayWindow.webContents.send('voice-activity', hasVoiceActivity);
    } else {
      clearInterval(amplitudeInterval);
    }
  }, 50);

  recordingProcess.on('close', () => {
    clearInterval(amplitudeInterval);
  });

  recordingProcess.on('error', (err) => {
    console.error('Recording process error:', err);
    clearInterval(amplitudeInterval);
    isProcessing = false;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('error', 'Recording failed. Please install sox: brew install sox');
    }
  });

  recordingProcess.on('exit', (code, signal) => {
    console.log(`Recording process exited with code ${code}, signal ${signal}`);
    clearInterval(amplitudeInterval);
  });
}

// OPTIMIZED: Fast and reliable stopRecording function
async function stopRecording() {
  if (isProcessing) {
    console.log('⚠️ Already processing recording');
    return;
  }

  isProcessing = true;
  console.log('🛑 Stopping recording...');
  
  // Calculate recording duration
  const recordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;

  // Stop recording process immediately
  if (recordingProcess) {
    recordingProcess.kill('SIGINT');
    recordingProcess = null;
  }

  // PERFORMANCE BOOST: Reduced wait time from 200ms to 100ms
  // Sox writes the file quickly, we just need a brief moment
  await new Promise(r => setTimeout(r, 100));

  try {
    // Validate audio file
    if (!audioFile) {
      throw new Error('No audio file path - recording may have been cancelled');
    }
    
    if (!fs.existsSync(audioFile)) {
      throw new Error('Audio file not created. Please install sox: brew install sox');
    }

    const stats = fs.statSync(audioFile);
    console.log(`📊 Audio file: ${Math.round(stats.size/1000)}KB`);
    
    if (stats.size < 5000) {
      throw new Error('Recording too short. Please speak for at least 1 second.');
    }

    const recordingDuration = Math.max(1, Math.round((stats.size - 44) / 32000));
    const apiKey = getActiveAPIKey();

    let finalText;
    let originalText = '';

    // Require API key for transcription
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key not configured. Please add your Groq API key in Settings.');
    }

    // PERFORMANCE BOOST: Close overlay with sound synchronization and animation
    // Play success sound and trigger fade-out animation
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      playSound('success'); // Play sound when closing starts
      
      // Trigger fade-out animation in overlay
      overlayWindow.webContents.send('close-with-animation');
      
      // Close window after animation completes
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.close();
          overlayWindow = null;
        }
      }, 200); // Match animation duration
    }

    console.log('🎤 Transcribing...');
    originalText = await transcribe(audioFile);
    
    if (currentMode === 'rewrite') {
      console.log('🤖 AI rewriting...');
      finalText = await rewrite(originalText);
    } else {
      finalText = originalText;
      if (CONFIG.autoGrammarFix) {
        try {
          finalText = await applyGrammarFixes(originalText);
        } catch (error) {
          console.warn('Grammar fix failed:', error.message);
          finalText = originalText;
        }
      }
    }

    if (!finalText || finalText.trim().length === 0) {
      throw new Error('No speech detected. Please try again.');
    }

    console.log(`✅ Final text: "${finalText.substring(0, 100)}..."`);

    // Save to history
    const historyEntry = {
      id: Date.now(),
      text: finalText,
      originalText: originalText,
      mode: currentMode,
      timestamp: new Date().toISOString(),
      duration: recordingDuration
    };
    
    saveToHistory(historyEntry);

    // Update dashboard
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('recording-complete', {
        duration: recordingDuration,
        mode: currentMode,
        history: historyEntry
      });
    }

    // PERFORMANCE BOOST: Paste immediately - overlay is already closed
    // Reduced delay from 200ms to 50ms since overlay is already gone
    setTimeout(() => {
      pasteTextRobust(finalText);
      // Sound already played when window closed, no need to play again
    }, 50);

    // Track API usage locally
    if (apiKey && apiKey.trim() !== '') {
      trackAPIUsage(recordingDuration);
    }
    
    // Report usage to backend for authenticated users
    reportUsageToBackend(recordingDuration, currentMode, CONFIG.language);

  } catch (error) {
    console.error('❌ Recording failed:', error.message);

    // Play error sound and close overlay with animation
    playSound('error');
    
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      // Show error in overlay briefly, then close
      overlayWindow.webContents.send('error', error.message);
      
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.close();
          overlayWindow = null;
        }
      }, 2000); // Show error for 2 seconds
    }
    
    // Show error notification
    showNotification('Recording Error', error.message);
  } finally {
    // Cleanup
    isProcessing = false;
    const fileToCleanup = audioFile; // Store reference before nulling
    audioFile = null;
    
    // Clean up audio file safely
    if (fileToCleanup && fs.existsSync(fileToCleanup)) {
      fs.unlink(fileToCleanup, (err) => {
        if (err) console.log('⚠️ Cleanup warning:', err.message);
      });
    }
  }
}

// OPTIMIZED: Transcription function with faster processing
async function transcribe(filePath) {
  const transcriptionStart = Date.now();
  
  if (!fs.existsSync(filePath)) {
    logApiRequest('whisper', 'error', Date.now() - transcriptionStart, null, 'Audio file not found');
    throw new Error('Audio file not found');
  }

  const stats = fs.statSync(filePath);
  if (stats.size < 5000) {
    logApiRequest('whisper', 'error', Date.now() - transcriptionStart, null, 'Recording too short');
    throw new Error('Recording too short. Please speak for at least 1 second.');
  }

  const FormData = require('form-data');
  const form = new FormData();
  
  form.append('file', fs.createReadStream(filePath), {
    filename: 'recording.wav',
    contentType: 'audio/wav'
  });
  
  // Optimized for English transcription with Whisper
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'en'); // Force English for best accuracy
  form.append('response_format', 'json');
  form.append('temperature', '0'); // Zero temperature for English = most accurate
  
  // Add prompt to improve accuracy for conversational English
  form.append('prompt', 'This is a voice dictation in clear English. Transcribe accurately with proper punctuation.');

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${getActiveAPIKey()}`
        },
        // PERFORMANCE BOOST: Reduced timeout - Groq is fast, 15s should be plenty
        timeout: 15000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: function (status) {
          return status < 500;
        }
      }
    );

    const transcriptionTime = Date.now() - transcriptionStart;
    console.log(`⚡ Transcription completed in ${transcriptionTime}ms`);

    // Check for API errors
    if (response.status !== 200) {
      const errorMsg = response.data?.error?.message || `API error: ${response.status}`;
      logApiRequest('whisper', 'error', transcriptionTime, null, errorMsg);
      throw new Error(errorMsg);
    }

    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('api-request', 'whisper');
    }
    
    logApiRequest('whisper', 'success', transcriptionTime);

    let text = response.data;
    if (typeof text !== 'string') {
      // Handle verbose_json response format
      text = text.text || '';
    }

    // PERFORMANCE BOOST: Only run post-processing if text is non-empty
    text = text.trim();
    if (text) {
      text = postProcessTranscription(text);
    }
    
    if (!text) {
      throw new Error('No speech detected. Please try again.');
    }

    console.log(`✅ Transcribed: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    return text;
  } catch (error) {
    const transcriptionTime = Date.now() - transcriptionStart;
    logApiRequest('whisper', 'error', transcriptionTime, null, error.message);
    throw error;
  }
}

async function rewrite(text) {
  const startTime = Date.now();
  
  // Get the appropriate AI prompt based on mode
  const aiPrompt = AI_PROMPTS[CONFIG.aiMode] || AI_PROMPTS.auto;
  
  // Adjust temperature based on mode
  const creativeTemp = CONFIG.aiMode === 'auto' ? 0.4 : 0.3;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: aiPrompt
          },
          { role: 'user', content: `Rewrite this: ${text}` }
        ],
        temperature: creativeTemp,
        max_tokens: 1500
      },
    {
      headers: { 'Authorization': `Bearer ${getActiveAPIKey()}` },
      // PERFORMANCE BOOST: Reduced timeout - Groq is fast
      timeout: 20000,
      validateStatus: function (status) {
        return status < 500;
      }
    }
    );

    const rewriteTime = Date.now() - startTime;
    console.log(`⚡ AI rewrite completed in ${rewriteTime}ms`);

    // Check for API errors
    if (response.status !== 200) {
      const errorMsg = response.data?.error?.message || `API error: ${response.status}`;
      logApiRequest('llama-rewrite', 'error', rewriteTime, null, errorMsg);
      throw new Error(errorMsg);
    }

    // Track API usage
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('api-request', 'llama');
    }
    
    // Log API request for admin panel
    logApiRequest('llama-rewrite', 'success', rewriteTime, response.data.usage?.total_tokens);

    return response.data.choices[0].message.content;
  } catch (error) {
    const rewriteTime = Date.now() - startTime;
    logApiRequest('llama-rewrite', 'error', rewriteTime, null, error.message);
    throw error;
  }
}

// Post-process transcription to fix common recognition errors
function postProcessTranscription(text) {
  if (!text || typeof text !== 'string') return text;

  text = text.trim().replace(/\s+/g, ' ');

  const corrections = {
    'recognigar': 'recognizer',
    'recognage': 'recognize',
    'parfectly': 'perfectly',
    'smouther': 'smoother',
    'sentance': 'sentence',
    'vary': 'very',
    'tha ': 'the ',
    'approch': 'approach',
    'ifferent': 'different',
    'recognise': 'recognize',
    'recogniser': 'recognizer',
    'recognation': 'recognition',
    'profesional': 'professional',
    'professionaly': 'professionally',
    'profesionally': 'professionally',
    'dictashun': 'dictation',
    'dictatation': 'dictation',
    'vocie': 'voice',
    'voyce': 'voice',
    'proparly': 'properly',
    'properley': 'properly',
    'sentense': 'sentence',
    'sentances': 'sentences',
    'diferent': 'different',
    'diference': 'difference',
    'smoth': 'smooth',
    'smoothe': 'smooth',
    'writting': 'writing',
    'writeing': 'writing',
    'texting': 'text',
    'pased': 'pasted',
    'pasteing': 'pasting',
    ' there ': ' their ',
    ' your ': ' you\'re ',
    ' its ': ' it\'s ',
    ' cant ': ' can\'t ',
    ' wont ': ' won\'t ',
    ' dont ': ' don\'t ',
    ' im ': ' I\'m ',
    ' ive ': ' I\'ve ',
    ' youre ': ' you\'re ',
    ' theyre ': ' they\'re ',
    ' were ': ' we\'re ',
    ' ,': ',',
    ' .': '.',
    ' ?': '?',
    ' !': '!',
    ' ;': ';',
    ' :': ':',
    '( ': '(',
    ' )': ')',
  };

  // Apply corrections (case-insensitive for most, case-sensitive for some)
  for (const [wrong, right] of Object.entries(corrections)) {
    // Escape special regex characters in the search string
    const escapedWrong = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Use case-insensitive for word corrections
    if (wrong.includes(' ')) {
      // For phrases with spaces, use case-sensitive to avoid over-correction
      text = text.replace(new RegExp(escapedWrong, 'g'), right);
    } else {
      // For single words, use case-insensitive
      const regex = new RegExp('\\b' + escapedWrong + '\\b', 'gi');
      text = text.replace(regex, right);
    }
  }

  // Ensure first letter is capitalized
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Capitalize after sentence endings
  text = text.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());

  // Fix multiple spaces
  text = text.replace(/\s+/g, ' ');

  // Ensure proper ending punctuation if missing
  if (text.length > 0 && !/[.!?]$/.test(text)) {
    text += '.';
  }

  return text;
}

// Auto grammar fix - Enhanced corrections for perfect output
async function applyGrammarFixes(text) {
  const startTime = Date.now();
  
  const grammarPrompt = `You are an advanced grammar and transcription correction AI. Your job is to fix voice-to-text transcription errors and make the text perfect.

CRITICAL RULES:
1. Fix ALL spelling mistakes and typos
2. Add proper punctuation (periods, commas, question marks, exclamation points)
3. Capitalize sentences, names, and proper nouns correctly
4. Fix grammar errors (subject-verb agreement, tense, etc.)
5. Complete incomplete sentences if the meaning is clear
6. Fix word recognition errors (e.g., "recognigar" → "recognizer", "parfectly" → "perfectly")
7. Add missing words that make sentences complete
8. Keep the EXACT same meaning and intent
9. Maintain the speaker's tone and style
10. Return ONLY the corrected text, no explanations

EXAMPLES:
Input: "can you make this recognigar vary smouther and recognage voice parfectly if has some sentance missing fix properly"
Output: "Can you make this recognizer very smooth and recognize voice perfectly? If it has some sentences missing, fix it properly."

Input: "hey can you send me that file i need it for the meeting tomorrow"
Output: "Hey, can you send me that file? I need it for the meeting tomorrow."

Input: "i want to add voice shortcut when i say hey queen it start recording"
Output: "I want to add a voice shortcut. When I say 'Hey Queen', it starts recording."

Now fix this text:`;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: grammarPrompt
          },
          { role: 'user', content: text }
        ],
        temperature: 0.2,  // Slightly higher for better sentence completion
        max_tokens: 2000   // More tokens for longer corrections
      },
      {
        headers: { 'Authorization': `Bearer ${getActiveAPIKey()}` },
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500; // Resolve only if the status code is less than 500
        }
      }
    );

    // Check for API errors
    if (response.status !== 200) {
      const errorMsg = response.data?.error?.message || `API error: ${response.status}`;
      logApiRequest('llama-grammar', 'error', Date.now() - startTime, null, errorMsg);
      throw new Error(errorMsg);
    }

    // Track API usage
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('api-request', 'llama');
    }
    
    // Log API request for admin panel
    logApiRequest('llama-grammar', 'success', Date.now() - startTime, response.data.usage?.total_tokens);

    return response.data.choices[0].message.content;
  } catch (error) {
    logApiRequest('llama-grammar', 'error', Date.now() - startTime, null, error.message);
    throw error;
  }
}



// ENHANCED: Smart auto-paste system with multiple fallback methods
function pasteTextRobust(text) {
  console.log(`📋 Pasting text: ${text.length} characters`);

  // Always copy to clipboard first (guaranteed fallback)
  clipboard.writeText(text);
  console.log('✅ Text copied to clipboard');

  // Check auto paste mode setting
  if (CONFIG.autoPasteMode === 'clipboard') {
    console.log('📋 Clipboard mode - manual paste required');
    showNotification('📋 Text Ready', 'Press Cmd+V to paste');
    return;
  }

  // Check if we have Accessibility permission FIRST (with error handling)
  let hasAccessibility = false;
  try {
    hasAccessibility = systemPreferences.isTrustedAccessibilityClient(false);
  } catch (error) {
    console.log('⚠️ Could not check accessibility permission:', error.message);
    hasAccessibility = false;
  }
  
  if (!hasAccessibility) {
    console.log('⚠️ No Accessibility permission - cannot auto-paste');
    console.log('📋 Text is in clipboard - press Cmd+V to paste');
    
    // Show notification with instructions
    showNotification('📋 Press Cmd+V to Paste', 'Enable Accessibility for auto-paste');
    
    // Prompt user to enable accessibility (only once per session)
    if (!global.accessibilityPromptShown) {
      global.accessibilityPromptShown = true;
      setTimeout(() => {
        promptAccessibilityPermission();
      }, 500);
    }
    return;
  }

  // We have Accessibility permission - try auto-paste
  console.log('🎯 Attempting auto-paste (Accessibility enabled)...');
  
  // Use AppleScript with Cmd+V (most reliable when we have permission)
  const pasteScript = `
    tell application "System Events"
      keystroke "v" using command down
    end tell
  `;
  
  setTimeout(() => {
    exec(`osascript -e '${pasteScript}'`, (error) => {
      if (error) {
        console.log('⚠️ AppleScript paste failed:', error.message);
        
        // Try cliclick as backup
        exec('cliclick kd:cmd t:v ku:cmd', (cliclickError) => {
          if (cliclickError) {
            console.log('⚠️ cliclick also failed:', cliclickError.message);
            showNotification('📋 Press Cmd+V', 'Auto-paste failed, text in clipboard');
          } else {
            console.log('✅ Auto-paste successful (cliclick)');
            showNotification('✅ Text Pasted', 'Text inserted automatically');
          }
        });
      } else {
        console.log('✅ Auto-paste successful (AppleScript)');
        showNotification('✅ Text Pasted', 'Text inserted automatically');
      }
    });
  }, 100); // Small delay to ensure focus is on target app

  // Restore clipboard if needed
  if (CONFIG.preserveClipboard) {
    const oldClipboard = clipboard.readText();
    if (oldClipboard !== text) {
      setTimeout(() => {
        clipboard.writeText(oldClipboard);
        console.log('✅ Original clipboard restored');
      }, 4000);
    }
  }
}

// Show system notification with better UX
function showNotification(title, body) {
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: title,
        body: body,
        silent: false, // Allow sound for better UX
        timeoutType: 'default',
        urgency: 'normal'
      });
      
      notification.show();
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      console.log(`🔔 Notification shown: ${title}`);
    } else {
      console.log('📢 Notifications not supported, using console message');
      console.log(`🔔 ${title}: ${body}`);
    }
  } catch (error) {
    console.log('Notification error:', error.message);
    console.log(`🔔 ${title}: ${body}`);
  }
}


// Configuration persistence
function saveConfigToFile() {
  try {
    const configFile = path.join(app.getPath('userData'), 'config.json');
    console.log('💾 Saving config to:', configFile);
    
    const configToSave = {
      apiKeys: CONFIG.apiKeys,
      language: CONFIG.language,
      aiMode: CONFIG.aiMode,
      preserveClipboard: CONFIG.preserveClipboard,
      autoGrammarFix: CONFIG.autoGrammarFix,

      customDictionary: CONFIG.customDictionary
    };
    
    fs.writeFileSync(configFile, JSON.stringify(configToSave, null, 2));
    console.log('✅ Configuration saved to file');
  } catch (error) {
    console.error('❌ Error saving config:', error);
  }
}

// Admin configuration persistence
function saveAdminConfigToFile() {
  try {
    const adminConfigFile = path.join(app.getPath('userData'), 'admin-config.json');
    console.log('💾 Saving admin config to:', adminConfigFile);
    
    fs.writeFileSync(adminConfigFile, JSON.stringify(ADMIN_CONFIG, null, 2));
    console.log('✅ Admin configuration saved to file');
  } catch (error) {
    console.error('❌ Error saving admin config:', error);
  }
}

function loadAdminConfigFromFile() {
  try {
    const adminConfigFile = path.join(app.getPath('userData'), 'admin-config.json');
    console.log('📁 Loading admin config from:', adminConfigFile);
    
    if (fs.existsSync(adminConfigFile)) {
      const savedAdminConfig = JSON.parse(fs.readFileSync(adminConfigFile, 'utf8'));
      console.log('📋 Loaded saved admin configuration');
      
      // Merge saved config with defaults
      if (savedAdminConfig.masterApiKey) ADMIN_CONFIG.masterApiKey = savedAdminConfig.masterApiKey;
      if (savedAdminConfig.dailyLimit) ADMIN_CONFIG.dailyLimit = savedAdminConfig.dailyLimit;
      if (savedAdminConfig.rateLimitPerUser) ADMIN_CONFIG.rateLimitPerUser = savedAdminConfig.rateLimitPerUser;
      if (savedAdminConfig.users) ADMIN_CONFIG.users = savedAdminConfig.users;
      if (savedAdminConfig.apiRequests) ADMIN_CONFIG.apiRequests = savedAdminConfig.apiRequests;
      
      // Update main CONFIG with master API key
      if (ADMIN_CONFIG.masterApiKey) {
        CONFIG.apiKeys[0] = ADMIN_CONFIG.masterApiKey;
      }
      
      console.log(`🔑 Loaded admin config with ${ADMIN_CONFIG.users.length} users`);
    } else {
      console.log('📋 No saved admin config found, using defaults');
    }
  } catch (error) {
    console.error('❌ Error loading admin config:', error);
    console.log('📋 Using default admin configuration');
  }
}

function loadConfigFromFile() {
  try {
    const configFile = path.join(app.getPath('userData'), 'config.json');
    console.log('📁 Loading config from:', configFile);
    
    if (fs.existsSync(configFile)) {
      const savedConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      console.log('📋 Loaded saved configuration');
      
      // Merge saved config with current config (preserving environment variables)
      // Only override if saved config has valid values
      if (savedConfig.apiKeys && savedConfig.apiKeys.some(key => key && key.trim())) {
        CONFIG.apiKeys = savedConfig.apiKeys;
      }
      if (savedConfig.language) CONFIG.language = savedConfig.language;
      if (savedConfig.aiMode) CONFIG.aiMode = savedConfig.aiMode;
      if (savedConfig.preserveClipboard !== undefined) CONFIG.preserveClipboard = savedConfig.preserveClipboard;
      if (savedConfig.autoGrammarFix !== undefined) CONFIG.autoGrammarFix = savedConfig.autoGrammarFix;
      if (savedConfig.customDictionary) CONFIG.customDictionary = savedConfig.customDictionary;
      
      const validKeys = CONFIG.apiKeys.filter(k => k && k.trim()).length;
      console.log(`🔑 Loaded ${validKeys} API keys from saved config`);
    } else {
      console.log('📋 No saved config found, using defaults (environment variables preserved)');
      const validKeys = CONFIG.apiKeys.filter(k => k && k.trim()).length;
      console.log(`🔑 Using ${validKeys} API keys from environment variables`);
    }
  } catch (error) {
    console.error('❌ Error loading config:', error);
    console.log('📋 Using default configuration (environment variables preserved)');
  }
}

// Load configuration on startup
loadConfigFromFile();
loadAdminConfigFromFile();

// FIXED: Simplified and reliable history management
function saveToHistory(entry) {
  console.log('💾 Saving history entry:', entry.id);
  
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    
    // Ensure entry has required fields
    if (!entry.text || !entry.id) {
      console.error('❌ Invalid history entry - missing text or id');
      return;
    }
    
    let history = [];

    // Load existing history safely
    if (fs.existsSync(historyFile)) {
      try {
        const data = fs.readFileSync(historyFile, 'utf8');
        history = JSON.parse(data) || [];
      } catch (parseError) {
        console.warn('⚠️ History file corrupted, starting fresh');
        history = [];
      }
    }

    // Add new entry at the beginning
    history.unshift(entry);

    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    // Save atomically with backup
    const tempFile = historyFile + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(history, null, 2));
    fs.renameSync(tempFile, historyFile);
    
    console.log(`✅ History saved: ${history.length} total items`);
    
    // Notify dashboard immediately
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('history-updated', history);
      dashboardWindow.webContents.send('history-data', history);
    }
    
  } catch (error) {
    console.error('❌ History save failed:', error.message);
  }
}

function getHistory() {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    console.log('📁 History file path:', historyFile);

    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf8');
      const history = JSON.parse(data);
      console.log(`📋 Loaded ${history.length} history items`);
      return history;
    } else {
      console.log('📋 No history file found, returning empty array');
      return [];
    }
  } catch (error) {
    console.error('Error loading history:', error);
    return [];
  }
}

function clearHistory() {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
    }

    // Notify dashboard that history was cleared with empty array
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('history-data', []);
      dashboardWindow.webContents.send('history-updated', []); // Consistent event
    }

    console.log('✅ History cleared');
  } catch (error) {
    console.error('Error clearing history:', error);
  }
}

// IPC handlers
ipcMain.on('stop-recording', () => stopRecording());
ipcMain.on('cancel-recording', () => {
  if (recordingProcess) {
    recordingProcess.kill();
    recordingProcess = null;
  }
  if (overlayWindow) {
    playSound('cancel'); // Play cancel sound when canceling
    overlayWindow.close();
    overlayWindow = null;
  }
  if (audioFile) {
    fs.unlink(audioFile, () => { });
  }
  // Reset the creation flag
  isCreatingOverlay = false;
});

ipcMain.on('hide-overlay', () => {
  if (overlayWindow) {
    overlayWindow.hide();
  }
});

ipcMain.on('get-config', (event) => {
  event.reply('config', CONFIG);
});

// ============================================
// AUTHENTICATION IPC HANDLERS
// ============================================

// Global OAuth resolver for protocol URL handling
let globalOAuthResolver = null;

// Supabase Google OAuth handler
ipcMain.handle('auth-google', async () => {
  try {
    // Get OAuth URL from Supabase
    const authResult = await authService.signInWithGoogle();
    
    if (!authResult.success) {
      return authResult;
    }

    // Handle development mode directly
    if (authResult.isDevelopment) {
      console.log('🔧 Development mode - simulating successful authentication');
      
      // Simulate successful authentication
      const devResult = await authService.handleOAuthCallback({
        access_token: 'dev-token',
        refresh_token: 'dev-refresh-token'
      });
      
      if (devResult.success) {
        isAuthenticated = true;
        if (devResult.user?.settings) {
          CONFIG.language = devResult.user.settings.language || CONFIG.language;
          CONFIG.aiMode = devResult.user.settings.aiMode || CONFIG.aiMode;
          CONFIG.autoGrammarFix = devResult.user.settings.autoGrammarFix ?? CONFIG.autoGrammarFix;
        }
      }
      
      return devResult;
    }

    return new Promise((resolve) => {
      let resolved = false;
      let authWindow = null;
      
      // Store resolver globally so protocol handler can use it
      globalOAuthResolver = (result) => {
        if (!resolved) {
          resolved = true;
          globalOAuthResolver = null;
          resolve(result);
        }
      };

      authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          // CRITICAL: Allow navigation to enable OAuth redirects
          webSecurity: false
        },
        title: 'Sign in to Eloquent'
      });

      authWindow.loadURL(authResult.url);

      // Listen for successful authentication
      authWindow.webContents.on('will-redirect', async (event, url) => {
        if (resolved) return;
        
        // Check if this is the callback with session data
        if ((url.includes('/auth/callback') || url.includes('/auth/success')) && (url.includes('access_token') || url.includes('code'))) {
          resolved = true;
          event.preventDefault();
          
          try {
            let accessToken, refreshToken;
            
            // Parse URL for tokens - handle both fragment and query parameters
            const urlObj = new URL(url);
            
            // Try fragment first (Supabase implicit flow)
            if (urlObj.hash) {
              const fragment = urlObj.hash.substring(1);
              const fragmentParams = new URLSearchParams(fragment);
              accessToken = fragmentParams.get('access_token');
              refreshToken = fragmentParams.get('refresh_token');
            }
            
            // Try query parameters (production callback)
            if (!accessToken && urlObj.searchParams) {
              accessToken = urlObj.searchParams.get('access_token');
              refreshToken = urlObj.searchParams.get('refresh_token');
            }
            
            if (accessToken) {
              // Show loading state
              authWindow.loadURL(`data:text/html,
                <html>
                  <head>
                    <style>
                      body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #1e293b, #0f172a); color: white; }
                      .container { text-align: center; }
                      h1 { font-size: 24px; margin-bottom: 10px; }
                      p { color: rgba(255,255,255,0.7); }
                      .spinner { width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
                      @keyframes spin { to { transform: rotate(360deg); } }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="spinner"></div>
                      <h1>Signing you in...</h1>
                      <p>Please wait</p>
                    </div>
                  </body>
                </html>
              `);

              // Handle the OAuth callback
              const result = await authService.handleOAuthCallback({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (result.success) {
                isAuthenticated = true;
                if (result.user?.settings) {
                  CONFIG.language = result.user.settings.language || CONFIG.language;
                  CONFIG.aiMode = result.user.settings.aiMode || CONFIG.aiMode;
                  CONFIG.autoGrammarFix = result.user.settings.autoGrammarFix ?? CONFIG.autoGrammarFix;
                }
              }

              setTimeout(() => {
                if (!authWindow.isDestroyed()) authWindow.close();
              }, 500);
              
              resolve(result);
            } else {
              if (!authWindow.isDestroyed()) authWindow.close();
              resolve({ success: false, error: 'No access token received' });
            }
          } catch (err) {
            if (!authWindow.isDestroyed()) authWindow.close();
            resolve({ success: false, error: err.message });
          }
        }
      });

      // Listen for messages from the callback page (production)
      authWindow.webContents.on('did-finish-load', () => {
        if (resolved) return;
        
        // Inject script to listen for auth results from the callback page
        authWindow.webContents.executeJavaScript(`
          // Listen for auth data from the callback page
          if (window.location.href.includes('/auth/callback')) {
            // Try to extract auth data from the page
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
              if (script.textContent.includes('authData')) {
                try {
                  // Extract the auth data from the script
                  const match = script.textContent.match(/authData\\s*=\\s*({[^}]+})/);
                  if (match) {
                    const authData = JSON.parse(match[1]);
                    if (authData.success && authData.access_token) {
                      window.electronAPI = { authResult: (data) => console.log('Auth result:', data) };
                      return authData;
                    }
                  }
                } catch (e) {
                  console.error('Error parsing auth data:', e);
                }
              }
            }
          }
          return null;
        `).then(authData => {
          if (authData && authData.success && !resolved) {
            resolved = true;
            
            // Show loading state
            authWindow.loadURL('data:text/html,' + encodeURIComponent(`
              <html>
                <head>
                  <style>
                    body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #1e293b, #0f172a); color: white; }
                    .container { text-align: center; }
                    h1 { font-size: 24px; margin-bottom: 10px; }
                    p { color: rgba(255,255,255,0.7); }
                    .spinner { width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="spinner"></div>
                    <h1>Signing you in...</h1>
                    <p>Please wait</p>
                  </div>
                </body>
              </html>
            `));

            // Handle the OAuth callback
            authService.handleOAuthCallback({
              access_token: authData.access_token,
              refresh_token: authData.refresh_token
            }).then(result => {
              if (result.success) {
                isAuthenticated = true;
                if (result.user?.settings) {
                  CONFIG.language = result.user.settings.language || CONFIG.language;
                  CONFIG.aiMode = result.user.settings.aiMode || CONFIG.aiMode;
                  CONFIG.autoGrammarFix = result.user.settings.autoGrammarFix ?? CONFIG.autoGrammarFix;
                }
              }

              setTimeout(() => {
                if (!authWindow.isDestroyed()) authWindow.close();
              }, 500);
              
              resolve(result);
            }).catch(err => {
              if (!authWindow.isDestroyed()) authWindow.close();
              resolve({ success: false, error: err.message });
            });
          }
        }).catch(err => {
          console.log('No auth data found in page');
        });
      });

      // Handle window close
      authWindow.on('closed', () => {
        if (!resolved) {
          // Give a small delay to allow protocol URL processing
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve({ success: false, error: 'Sign-in window was closed' });
            }
          }, 1000); // 1 second delay
        }
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Auth complete - close login window
ipcMain.on('auth-complete', (event, result) => {
  isAuthenticated = true;
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
    loginWindow = null;
  }
  
  // Wait a moment for auth service to fully process the data
  setTimeout(() => {
    console.log('🔄 Refreshing tray menu after auth complete');
    createTray();
  }, 500);
  
  // Open dashboard
  createDashboard();
});

// Add IPC handler to refresh tray menu (for debugging)
ipcMain.on('refresh-tray', () => {
  console.log('🔄 Manual tray refresh requested');
  createTray();
});




// Get current auth status
ipcMain.handle('get-auth-status', async () => {
  return {
    isAuthenticated,
    user: authService.getUser(),
    subscription: authService.getSubscription(),
    usage: authService.getUsage()
  };
});

// Manual OAuth fix handler
ipcMain.handle('manual-oauth-fix', async (event, oauthUrl) => {
  try {
    console.log('🔧 Manual OAuth fix triggered with URL:', oauthUrl);
    
    if (!oauthUrl || typeof oauthUrl !== 'string') {
      return { success: false, error: 'Invalid OAuth URL provided' };
    }
    
    // Parse the OAuth URL to extract tokens
    let parsedUrl;
    try {
      // Handle both eloquent:// protocol and https:// URLs
      if (oauthUrl.startsWith('eloquent://')) {
        parsedUrl = new URL(oauthUrl.replace('eloquent://', 'https://'));
      } else {
        parsedUrl = new URL(oauthUrl);
      }
    } catch (error) {
      console.error('❌ Invalid URL format:', error);
      return { success: false, error: 'Invalid URL format' };
    }
    
    // Extract tokens from URL parameters
    const params = new URLSearchParams(parsedUrl.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    if (!accessToken) {
      console.error('❌ No access token found in URL');
      return { success: false, error: 'No access token found in URL' };
    }
    
    console.log('🔑 Extracted tokens from manual URL');
    console.log('   Access token length:', accessToken.length);
    console.log('   Has refresh token:', !!refreshToken);
    
    // Process the OAuth callback
    const result = await authService.handleOAuthCallback({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    
    if (result.success) {
      console.log('✅ Manual OAuth fix successful');
      isAuthenticated = true;
      
      // Update user settings if available
      if (result.user?.settings) {
        CONFIG.language = result.user.settings.language || CONFIG.language;
        CONFIG.aiMode = result.user.settings.aiMode || CONFIG.aiMode;
        CONFIG.autoGrammarFix = result.user.settings.autoGrammarFix ?? CONFIG.autoGrammarFix;
      }
      
      // Refresh tray menu
      createTray();
      
      // Update dashboard
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('auth-updated', {
          isAuthenticated: true,
          user: result.user,
          subscription: result.subscription,
          usage: result.usage
        });
      }
      
      // Show success notification
      showNotification('✅ Manual OAuth Fix Successful', `Welcome back, ${result.user?.email || 'User'}!`);
      
      return { success: true, user: result.user };
    } else {
      console.error('❌ Manual OAuth fix failed:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Manual OAuth fix error:', error);
    return { success: false, error: error.message };
  }
});

// Get subscription info
ipcMain.handle('get-subscription', async () => {
  return {
    plan: authService.getSubscription()?.plan || 'free',
    status: authService.getSubscription()?.status || 'none',
    usage: authService.getUsage(),
    limits: authService.getUsageLimits()
  };
});

// Create checkout session
ipcMain.handle('create-checkout', async (event, { plan, interval }) => {
  if (!isAuthenticated) {
    return { error: 'Please sign in first' };
  }
  
  try {
    let token;
    if (authService.isDevelopmentMode) {
      token = 'dev-token';
    } else {
      token = authService.accessToken || authService.token;
    }
    
    // Map plan and interval to Stripe price ID
    const priceId = getPriceIdForPlan(plan, interval);
    
    const response = await axios.post(
      `${authService.baseURL}/api/subscriptions/create-checkout`,
      { 
        priceId: priceId,
        successUrl: 'https://eloquent-app.com/success',
        cancelUrl: 'https://eloquent-app.com/cancel'
      },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    return { error: error.response?.data?.error || error.message };
  }
});

// Check usage before transcription
ipcMain.handle('check-usage', async (event, minutesNeeded = 1) => {
  return await authService.checkUsage(minutesNeeded);
});

// Logout handler
ipcMain.on('auth-logout', () => {
  authService.logout();
  isAuthenticated = false;
  // Refresh tray menu
  createTray();
});

// Close subscription window
ipcMain.on('close-subscription-window', () => {
  if (subscriptionWindow && !subscriptionWindow.isDestroyed()) {
    subscriptionWindow.close();
    subscriptionWindow = null;
  }
});

// Open dashboard from manual OAuth window
ipcMain.on('open-dashboard', () => {
  createDashboard();
});

// Open admin panel from dashboard
ipcMain.on('open-admin-panel', () => {
  console.log('🔧 Received open-admin-panel IPC message');
  console.log('🔧 Current auth state:', {
    isAuthenticated,
    user: authService.getUser()?.email,
    role: authService.getUser()?.role
  });
  
  try {
    createAdminPanel();
  } catch (error) {
    console.error('❌ Error creating admin panel:', error);
    dialog.showErrorBox('Error', 'Failed to open admin panel: ' + error.message);
  }
});

// Open billing portal
ipcMain.handle('open-billing-portal', async () => {
  await authService.openBillingPortal();
});

// Forgot password
ipcMain.on('forgot-password', (event, email) => {
  shell.openExternal(`${authService.baseURL.replace('/api', '')}/forgot-password?email=${encodeURIComponent(email || '')}`);
});

// New Google Sign-in handlers for dashboard
ipcMain.on('check-auth-status', (event) => {
  console.log('🔍 Checking authentication status');
  let user = authService.getUser();
  let authenticated = isAuthenticated && authService.isAuthenticated(); // Check both flags
  let subscription = authService.getSubscription();
  let usage = authService.getUsage();
  
  console.log('🔍 Auth check results:', {
    authenticated,
    userExists: !!user,
    isDevelopmentMode: authService.isDevelopmentMode,
    mainIsAuthenticated: isAuthenticated,
    serviceIsAuthenticated: authService.isAuthenticated()
  });
  
  // ADMIN FALLBACK: If no user but we're checking for admin, create admin user
  if (!user && !authenticated) {
    // Check if we should create an admin user (for development/admin access)
    const adminEmails = ['hritthikin@gmail.com'];
    // For now, we'll only create admin user in development mode or if explicitly requested
    if (authService.isDevelopmentMode) {
      console.log('🔧 Creating admin user for development mode');
      user = {
        id: 'admin-dev',
        email: 'hritthikin@gmail.com',
        name: 'Admin User',
        role: 'admin'
      };
      authenticated = true;
      subscription = { plan: 'enterprise', status: 'active' };
      usage = { currentMonth: 0, totalMinutes: 0, limit: -1 };
      
      // Cache this for future calls
      authService.cacheSession('current', {
        user,
        subscription,
        usage
      });
    }
  }
  
  // Apply admin overrides if user is admin
  if (user && isAdminUser(user)) {
    console.log('🔧 Admin user detected in dashboard check:', user.email);
    if (!subscription || subscription.plan !== 'enterprise') {
      subscription = { plan: 'enterprise', status: 'active' };
    }
    if (!usage || usage.limit !== -1) {
      usage = { currentMonth: 0, totalMinutes: 0, limit: -1 };
    }
  }
  
  console.log('📊 Final Auth Status:', {
    authenticated,
    userEmail: user?.email,
    plan: subscription?.plan,
    isDevelopmentMode: authService.isDevelopmentMode
  });
  
  event.reply('auth-status', {
    isAuthenticated: authenticated,
    user: user,
    subscription: subscription,
    usage: usage
  });
});

ipcMain.on('initiate-google-signin', async (event) => {
  // Prevent multiple simultaneous sign-in attempts
  if (processingOAuth) {
    console.log('🔐 Sign-in already in progress, ignoring duplicate request');
    return;
  }
  
  processingOAuth = true;
  console.log('🔐 Initiating Google Sign-in');
  console.log('🔐 Environment check:');
  console.log('   FORCE_DEV_MODE:', process.env.FORCE_DEV_MODE);
  console.log('   FORCE_QUICK_SIGNIN:', process.env.FORCE_QUICK_SIGNIN);
  console.log('   isDevelopmentMode:', authService.isDevelopmentMode);
  
  try {
    const result = await authService.signInWithGoogle();
    console.log('🔐 Sign-in result:', result);
    
    if (result.success) {
      // In development mode or quick sign-in, skip browser open and directly update UI
      if (result.skipBrowserOpen || result.isDevelopment) {
        console.log('🔧 Quick sign-in mode - updating UI directly');
        isAuthenticated = true;
        
        // Only refresh tray if auth status changed
        const wasAuthenticated = isAuthenticated;
        isAuthenticated = true;
        
        if (!wasAuthenticated) {
          createTray();
        }
        
        const authData = {
          isAuthenticated: true,
          user: result.user || {
            id: 'quick-signin-user',
            email: process.env.ADMIN_EMAIL || 'hritthikin@gmail.com',
            name: 'Admin User',
            role: 'admin'
          },
          subscription: result.subscription || { plan: 'enterprise', status: 'active' },
          usage: { currentMonth: 0, totalMinutes: 0, limit: -1 }
        };
        
        console.log('📤 Sending auth-updated to dashboard:', authData);
        
        // Send auth update to dashboard
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
          dashboardWindow.webContents.send('auth-updated', authData);
          console.log('✅ Auth update sent to dashboard window');
        } else {
          console.warn('⚠️ Dashboard window not available');
          // Try to send via event reply as fallback
          event.reply('auth-updated', authData);
        }
        
        processingOAuth = false;
        return;
      }
      
      // Production mode - Use in-app OAuth window instead of browser for reliability
      if (result.url) {
        console.log('🌐 Opening OAuth in app window for reliability');
        
        // Create an in-app OAuth window instead of opening browser
        const { BrowserWindow } = require('electron');
        
        const authWindow = new BrowserWindow({
          width: 500,
          height: 700,
          show: true,
          center: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          },
          title: 'Sign in with Google'
        });
        
        authWindow.loadURL(result.url);
        
        let authCompleted = false;
        
        // Listen for OAuth callback
        authWindow.webContents.on('will-redirect', async (redirectEvent, url) => {
          if (authCompleted) return;
          
          // Check if this is the callback with tokens
          if ((url.includes('/auth/callback') || url.includes('/auth/success')) && 
              (url.includes('access_token') || url.includes('#access_token'))) {
            authCompleted = true;
            redirectEvent.preventDefault();
            
            try {
              let accessToken, refreshToken;
              const urlObj = new URL(url);
              
              // Try hash fragment first
              if (urlObj.hash) {
                const hashParams = new URLSearchParams(urlObj.hash.substring(1));
                accessToken = hashParams.get('access_token');
                refreshToken = hashParams.get('refresh_token');
              }
              
              // Try query parameters
              if (!accessToken) {
                accessToken = urlObj.searchParams.get('access_token');
                refreshToken = urlObj.searchParams.get('refresh_token');
              }
              
              if (accessToken) {
                console.log('🔑 Token received in OAuth window');
                
                const authResult = await authService.handleOAuthCallback({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
                
                if (authResult.success) {
                  console.log('✅ OAuth successful:', authResult.user?.email);
                  isAuthenticated = true;
                  
                  // Close login window if open
                  if (loginWindow && !loginWindow.isDestroyed()) {
                    loginWindow.close();
                    loginWindow = null;
                  }
                  
                  // Refresh tray
                  createTray();
                  
                  // Update dashboard
                  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
                    dashboardWindow.webContents.send('auth-updated', {
                      isAuthenticated: true,
                      user: authResult.user,
                      subscription: authResult.subscription,
                      usage: authResult.usage
                    });
                  }
                  
                  showNotification('✅ Sign In Successful', `Welcome, ${authResult.user?.email || 'User'}!`);
                } else {
                  console.error('❌ OAuth failed:', authResult.error);
                  showNotification('❌ Sign In Failed', authResult.error || 'Authentication failed');
                }
              }
            } catch (err) {
              console.error('❌ OAuth error:', err);
              showNotification('❌ Sign In Failed', err.message);
            } finally {
              processingOAuth = false;
              if (!authWindow.isDestroyed()) {
                authWindow.close();
              }
            }
          }
        });
        
        // Handle window close
        authWindow.on('closed', () => {
          if (!authCompleted) {
            processingOAuth = false;
            console.log('🔑 OAuth window closed without completing');
          }
        });
        
        return; // Don't continue to browser fallback
      } else {
        // No URL and not dev mode - fallback to dev sign-in
        console.log('⚠️ No OAuth URL available, falling back to dev sign-in');
        isAuthenticated = true;
        createTray();
        
        const authData = {
          isAuthenticated: true,
          user: {
            id: 'fallback-user',
            email: 'hritthikin@gmail.com',
            name: 'User',
            role: 'admin'
          },
          subscription: { plan: 'enterprise', status: 'active' },
          usage: { currentMonth: 0, totalMinutes: 0, limit: -1 }
        };
        
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
          dashboardWindow.webContents.send('auth-updated', authData);
        }
        processingOAuth = false;
      }
    } else {
      console.error('❌ Sign-in failed:', result.error);
      processingOAuth = false;
      // Notify dashboard of failure
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('auth-updated', {
          isAuthenticated: false,
          error: result.error || 'Sign-in failed'
        });
      }
    }
  } catch (error) {
    console.error('Google Sign-in error:', error);
    processingOAuth = false;
    // Notify dashboard of error
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('auth-updated', {
        isAuthenticated: false,
        error: error.message || 'Sign-in error'
      });
    }
  }
});

ipcMain.on('sign-out', async (event) => {
  console.log('👋 Signing out user');
  try {
    await authService.logout();
    isAuthenticated = false;
    
    // Clear OAuth processing state to allow fresh sign-ins
    processingOAuth = false;
    lastProcessedOAuthUrl = null;
    console.log('🔄 OAuth state cleared for fresh sign-in');
    
    // Refresh tray menu
    createTray();
    
    // INSTANT FRONTEND UPDATE: Notify dashboard immediately
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('auth-updated', {
        isAuthenticated: false,
        user: null,
        subscription: null,
        usage: null
      });
    }
    
    event.reply('auth-status', {
      isAuthenticated: false,
      user: null
    });
  } catch (error) {
    console.error('Sign-out error:', error);
  }
});

// Plan management handlers
ipcMain.on('check-subscription-status', (event) => {
  console.log('💳 Checking subscription status');
  const subscription = authService.getSubscription();
  event.reply('subscription-status', {
    planName: subscription?.plan || 'Free Plan',
    status: subscription?.status || 'inactive',
    currentPeriodEnd: subscription?.currentPeriodEnd
  });
});

// Helper function to get crypto payment amounts
function getCryptoPaymentAmount(planType) {
  const amounts = {
    'starter': { usd: 2.99, description: 'Starter Plan - Monthly' },
    'pro': { usd: 9.99, description: 'Pro Plan - Monthly' },
    'enterprise': { usd: 19.99, description: 'Enterprise Plan - Monthly' }
  };
  
  return amounts[planType] || amounts['starter'];
}

// Crypto payment with BlockBee
ipcMain.on('create-crypto-payment', async (event, { amount, currency, coin, planType, description }) => {
  console.log('💰 Creating crypto payment:', { amount, currency, coin, planType, description });
  
  try {
    console.log('🔐 Checking authentication...');
    console.log('🔐 authService.isAuthenticated():', authService.isAuthenticated());
    console.log('🔐 authService.isDevelopmentMode:', authService.isDevelopmentMode);
    console.log('🔐 FORCE_DEV_MODE:', process.env.FORCE_DEV_MODE);
    console.log('🔐 isAuthenticated (main):', isAuthenticated);
    
    // In development mode, bypass authentication check
    const isDevMode = process.env.FORCE_DEV_MODE === 'true' || authService.isDevelopmentMode;
    
    // More robust authentication check
    const userIsAuthenticated = isDevMode || authService.isAuthenticated() || isAuthenticated;
    
    if (!userIsAuthenticated) {
      console.log('❌ User not authenticated, sending auth-status');
      event.reply('crypto-payment-error', 'Please sign in to subscribe to a plan');
      return;
    }
    
    console.log('✅ Authentication check passed (dev mode or authenticated)');
    
    let token;
    if (isDevMode) {
      token = 'dev-token';
      console.log('🔧 Using dev-token for development mode');
    } else {
      token = authService.getAccessToken() || authService.accessToken || authService.token;
      console.log('🔐 Using real token for production mode');
    }
    
    console.log('📡 Making API request to:', `${authService.baseURL}/api/payments/crypto/create`);
    console.log('📡 Request payload:', { 
      plan_id: planType,
      coin: coin || 'usdt_bep20',
      interval: 'monthly'
    });
    
    const response = await axios.post(
      `${authService.baseURL}/api/payments/crypto/create`,
      { 
        plan_id: planType,
        coin: coin || 'usdt_bep20',
        interval: 'monthly'
      },
      { 
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000 // 10 second timeout
      }
    );
    
    console.log('✅ API response:', response.data);
    
    if (response.data.success && response.data.payment_address) {
      console.log('💰 Payment address created:', response.data.payment_address);
      console.log('💰 Payment amount:', response.data.payment_amount, response.data.payment_coin);
      
      // Send payment details to frontend for display
      event.reply('crypto-payment-created', {
        paymentAddress: response.data.payment_address,
        paymentAmount: response.data.payment_amount,
        paymentCoin: response.data.payment_coin,
        orderId: response.data.order_id,
        plan: response.data.plan,
        estimate: response.data.estimate,
        paymentInstructions: response.data.payment_instructions,
        qr_code_url: response.data.qr_code_url,
        order: response.data.order
      });
    } else {
      console.error('❌ No payment address returned:', response.data);
      event.reply('crypto-payment-error', 'Failed to create payment address');
    }
  } catch (error) {
    console.error('❌ Crypto payment error:', error);
    console.error('❌ Error response:', error.response?.data);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create payment';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Backend server is not running. Please start the Go backend.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Authentication failed. Please sign in again.';
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    event.reply('crypto-payment-error', errorMessage);
  }
});

// Check crypto payment status
// Check crypto payment status
ipcMain.on('check-crypto-payment', async (event, paymentId) => {
  console.log('🔍 Checking crypto payment status:', paymentId);
  try {
    if (!authService.isAuthenticated()) {
      event.reply('auth-status', {
        isAuthenticated: false,
        user: null
      });
      return;
    }
    
    let token;
    if (authService.isDevelopmentMode) {
      token = 'dev-token';
    } else {
      token = authService.accessToken || authService.token;
    }
    
    const response = await axios.get(
      `${authService.baseURL}/api/payments/crypto/status/${paymentId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    event.reply('crypto-payment-status', response.data);
  } catch (error) {
    console.error('Check payment error:', error);
    event.reply('crypto-payment-error', error.message);
  }
});

// ============================================
// MANUAL OAUTH WINDOW
// ============================================

function createManualOAuthWindow() {
  if (manualOAuthWindow && !manualOAuthWindow.isDestroyed()) {
    manualOAuthWindow.focus();
    return;
  }

  manualOAuthWindow = new BrowserWindow({
    width: 600,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'logo.png'),
    title: 'Manual OAuth Fix - Eloquent'
  });

  manualOAuthWindow.loadFile(path.join(__dirname, 'ui', 'manual-oauth.html'));

  manualOAuthWindow.once('ready-to-show', () => {
    manualOAuthWindow.show();
  });

  manualOAuthWindow.on('closed', () => {
    manualOAuthWindow = null;
  });
}

// ============================================
// LOGIN WINDOW
// ============================================

function createLoginWindow() {
  console.log('🔑 createLoginWindow() called');
  
  if (loginWindow) {
    console.log('🔑 Login window already exists, focusing...');
    loginWindow.focus();
    return;
  }

  try {
    console.log('🔑 Creating new login window...');
    loginWindow = new BrowserWindow({
      width: 460,
      height: 700,
      resizable: false,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    console.log('🔑 Loading login.html...');
    loginWindow.loadFile('src/ui/login.html');

    loginWindow.on('closed', () => {
      console.log('🔑 Login window closed');
      loginWindow = null;
    });

    loginWindow.on('ready-to-show', () => {
      console.log('✅ Login window ready to show');
      loginWindow.show();
    });

    console.log('✅ Login window created and loading...');
  } catch (error) {
    console.error('❌ Error in createLoginWindow:', error);
    throw error;
  }
}

// ============================================
// SUBSCRIPTION WINDOW
// ============================================

function createSubscriptionWindow() {
  if (subscriptionWindow) {
    subscriptionWindow.focus();
    return;
  }

  subscriptionWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  subscriptionWindow.loadFile('src/ui/subscription.html');

  subscriptionWindow.on('closed', () => {
    subscriptionWindow = null;
  });
}

ipcMain.on('save-config', (event, newConfig) => {
  console.log('💾 Saving configuration:', newConfig);

  // Handle API keys array
  if (newConfig.apiKeys) {
    CONFIG.apiKeys = newConfig.apiKeys;
    console.log(`🔑 Updated API keys: ${CONFIG.apiKeys.filter(k => k.trim()).length} keys configured`);
  }
  // Handle other config properties
  if (newConfig.language) CONFIG.language = newConfig.language;
  if (newConfig.aiMode) CONFIG.aiMode = newConfig.aiMode;
  if (newConfig.preserveClipboard !== undefined) CONFIG.preserveClipboard = newConfig.preserveClipboard;
  if (newConfig.autoGrammarFix !== undefined) CONFIG.autoGrammarFix = newConfig.autoGrammarFix;

  // Save configuration to file
  saveConfigToFile();
  console.log('✅ Configuration saved successfully');
});

ipcMain.on('update-dictionary', (event, dictionary) => {
  CONFIG.customDictionary = dictionary;
  console.log('Dictionary updated:', dictionary);
});

ipcMain.on('get-history', (event) => {
  const history = getHistory();
  console.log(`📋 Sending ${history.length} history items to dashboard`);
  event.reply('history-data', history);
});

ipcMain.on('clear-history', (event) => {
  console.log('🗑️ Clearing all history');
  clearHistory();
  // The clearHistory function already sends the events, but let's ensure consistency
  event.reply('history-data', []);
});

ipcMain.on('delete-history-item', (event, id) => {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    let history = getHistory();
    const beforeCount = history.length;
    history = history.filter(item => item.id !== id);
    const afterCount = history.length;

    // Write the updated history back to file
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

    console.log(`🗑️ Deleted history item (${beforeCount} → ${afterCount} items)`);

    // Notify dashboard of updated history
    event.reply('history-data', history);

    // Also notify via history-updated channel for consistency
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('history-updated', history);
    }
  } catch (error) {
    console.error('Error deleting history item:', error);
  }
});


// Admin IPC handlers
ipcMain.handle('admin-verify-access', async () => {
  const currentUser = authService.getUser();
  const isDev = authService.isDevelopmentMode;
  
  // Allow access in development mode OR if authenticated as admin
  const hasAccess = isDev || (isAuthenticated && isAdminUser(currentUser));
  
  return hasAccess;
});

ipcMain.handle('admin-get-config', async () => {
  const isDev = authService.isDevelopmentMode;
  if (!isDev && (!isAuthenticated || !isAdminUser(authService.getUser()))) {
    throw new Error('Access denied: Admin privileges required');
  }
  return {
    masterApiKey: ADMIN_CONFIG.masterApiKey || '',
    dailyLimit: ADMIN_CONFIG.dailyLimit || 1000,
    rateLimitPerUser: ADMIN_CONFIG.rateLimitPerUser || 100
  };
});

ipcMain.handle('admin-save-config', async (event, newAdminConfig) => {
  const isDev = authService.isDevelopmentMode;
  if (!isDev && (!isAuthenticated || !isAdminUser(authService.getUser()))) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  console.log('💾 Saving admin configuration:', newAdminConfig);
  
  if (newAdminConfig.masterApiKey) ADMIN_CONFIG.masterApiKey = newAdminConfig.masterApiKey;
  if (newAdminConfig.dailyLimit) ADMIN_CONFIG.dailyLimit = newAdminConfig.dailyLimit;
  if (newAdminConfig.rateLimitPerUser) ADMIN_CONFIG.rateLimitPerUser = newAdminConfig.rateLimitPerUser;
  
  // Update main CONFIG with master API key
  if (ADMIN_CONFIG.masterApiKey) {
    CONFIG.apiKeys[0] = ADMIN_CONFIG.masterApiKey;
  }
  
  saveAdminConfigToFile();
  console.log('✅ Admin configuration saved successfully');
  
  return { success: true };
});

ipcMain.handle('admin-get-stats', async () => {
  if (!isAuthenticated || !isAdminUser(authService.getUser())) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  const today = new Date().toISOString().split('T')[0];
  const todayRequests = ADMIN_CONFIG.apiRequests.filter(req => 
    req.timestamp.startsWith(today)
  );
  
  const last24h = Date.now() - (24 * 60 * 60 * 1000);
  const activeUsers = ADMIN_CONFIG.users.filter(user => 
    user.lastActive && new Date(user.lastActive).getTime() > last24h
  ).length;
  
  const successfulRequests = todayRequests.filter(req => req.status === 'success').length;
  const successRate = todayRequests.length > 0 ? Math.round((successfulRequests / todayRequests.length) * 100) : 0;
  
  const apiUsage = Math.round((todayRequests.length / ADMIN_CONFIG.dailyLimit) * 100);
  
  return {
    totalRequests: todayRequests.length,
    activeUsers,
    apiUsage,
    successRate
  };
});

ipcMain.handle('admin-get-users', async () => {
  if (!isAuthenticated || !isAdminUser(authService.getUser())) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  return ADMIN_CONFIG.users.map(user => ({
    ...user,
    requestCount: ADMIN_CONFIG.apiRequests.filter(req => req.userId === user.id).length
  }));
});

ipcMain.handle('admin-add-user', async (event, userData) => {
  if (!isAuthenticated || !isAdminUser(authService.getUser())) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  const newUser = {
    id: Date.now().toString(),
    email: userData.email,
    createdAt: new Date().toISOString(),
    lastActive: null
  };
  
  ADMIN_CONFIG.users.push(newUser);
  saveAdminConfigToFile();
  
  return newUser;
});

ipcMain.handle('admin-remove-user', async (event, userId) => {
  if (!isAuthenticated || !isAdminUser(authService.getUser())) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  ADMIN_CONFIG.users = ADMIN_CONFIG.users.filter(user => user.id !== userId);
  // Also remove user's API requests
  ADMIN_CONFIG.apiRequests = ADMIN_CONFIG.apiRequests.filter(req => req.userId !== userId);
  saveAdminConfigToFile();
  
  return { success: true };
});

ipcMain.handle('admin-get-requests', async () => {
  if (!isAuthenticated || !isAdminUser(authService.getUser())) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  return ADMIN_CONFIG.apiRequests
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100); // Return last 100 requests
});

// Alias for backward compatibility
ipcMain.handle('admin-get-api-requests', async () => {
  const isDev = authService.isDevelopmentMode;
  if (!isDev && (!isAuthenticated || !isAdminUser(authService.getUser()))) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  return ADMIN_CONFIG.apiRequests
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100); // Return last 100 requests
});

ipcMain.handle('admin-clear-logs', async () => {
  if (!isAuthenticated || !isAdminUser(authService.getUser())) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  ADMIN_CONFIG.apiRequests = [];
  saveAdminConfigToFile();
  
  return { success: true };
});

// Backend proxy IPC handlers for admin panel
ipcMain.handle('admin-backend-request', async (event, { method, endpoint, data }) => {
  console.log(`🔧 Admin backend request: ${method} ${endpoint}`);
  
  // Get API URL from environment or fallback
  const getAPIUrl = () => {
    return process.env.ELOQUENT_API_URL || 'https://agile-basin-06335-9109082620ce.herokuapp.com';
  };
  
  // Health check doesn't require authentication
  if (endpoint === '/health') {
    try {
      const url = `${getAPIUrl()}${endpoint}`;
      console.log('   Making health check request to:', url);
      
      const response = await axios({
        method: 'GET',
        url: url,
        timeout: 5000,
        validateStatus: (status) => status >= 200 && status < 600
      });
      
      console.log(`   ✅ Health check response: ${response.status}`);
      
      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      console.error('   ❌ Health check failed:', error.message);
      return {
        success: false,
        status: error.code === 'ECONNREFUSED' ? 503 : 500,
        error: error.message
      };
    }
  }
  
  // Check authentication and admin privileges for other endpoints
  const user = authService.getUser();
  const isDev = authService.isDevelopmentMode;
  
  console.log('   Auth state:', { isAuthenticated, isDev, userEmail: user?.email, isAdmin: isAdminUser(user) });
  
  // Allow in development mode OR if authenticated as admin
  if (!isDev && (!isAuthenticated || !isAdminUser(user))) {
    console.error('   ❌ Access denied: Admin privileges required');
    return {
      success: false,
      status: 403,
      error: 'Access denied: Admin privileges required'
    };
  }
  
  try {
    const url = `${getAPIUrl()}${endpoint}`;
    console.log('   Making request to:', url);
    
    const config = {
      method: method,
      url: url,
      headers: {
        'Authorization': 'Bearer dev-token',
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      validateStatus: function (status) {
        // Accept any status code to handle it properly
        return status >= 200 && status < 600;
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`   ✅ Response: ${response.status}`);
    
    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error('   ❌ Backend request failed:', error.message);
    
    // Check if it's a connection error
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        status: 503,
        error: 'Backend server is not running. Please start the backend with ./start-backend.sh'
      };
    }
    
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.message,
      data: error.response?.data
    };
  }
});

// Get auth token for user management window
ipcMain.handle('get-auth-token', async () => {
  try {
    // In development mode, always return dev-token
    if (authService.isDevelopmentMode) {
      return 'dev-token';
    }
    
    // Try to validate session if not authenticated
    if (!isAuthenticated) {
      try {
        const authResult = await authService.validateSession();
        if (authResult.valid) {
          isAuthenticated = true;
        } else {
          // Return null instead of throwing error for cleaner UX
          return null;
        }
      } catch (error) {
        // Return null instead of throwing error for cleaner UX
        return null;
      }
    }
    
    // Get access token - directly access the property for reliability
    let token = authService.accessToken;
    
    if (!token) {
      // Return null instead of throwing error for cleaner UX
      return null;
    }
    
    return token;
  } catch (error) {
    // Fallback to dev-token if in development mode
    if (authService.isDevelopmentMode) {
      return 'dev-token';
    }
    
    // Return null instead of throwing error for cleaner UX
    return null;
  }
});

// Function to log API requests
function logApiRequest(type, status, duration, tokens = null, errorMessage = null) {
  // Get current user email from auth service
  let userEmail = 'Anonymous';
  try {
    const currentUser = authService.getUser();
    if (currentUser && currentUser.email) {
      userEmail = currentUser.email;
    }
  } catch (e) {
    // Ignore errors getting user
  }
  
  const request = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    type,
    status,
    duration,
    tokens,
    userEmail,
    errorMessage: status === 'error' ? errorMessage : null
  };
  
  ADMIN_CONFIG.apiRequests.push(request);
  console.log(`📊 API Request logged: ${type} - ${status} - ${duration}ms`);
  
  // Keep only last 1000 requests to prevent memory issues
  if (ADMIN_CONFIG.apiRequests.length > 1000) {
    ADMIN_CONFIG.apiRequests = ADMIN_CONFIG.apiRequests.slice(-1000);
  }
  
  // Save after every request to ensure data is persisted
  saveAdminConfigToFile();
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Keep app running in menu bar
});

// Handle custom protocol for OAuth callbacks
app.on('open-url', (event, url) => {
  console.log('📱 app.on(open-url) triggered with:', url);
  event.preventDefault();
  handleProtocolUrl(url);
});

// Also handle protocol URLs when app is already running
app.setAsDefaultProtocolClient('eloquent');

// Handle protocol URL
async function handleProtocolUrl(url) {
  console.log('📱 Received protocol URL:', url);
  console.log('📱 URL length:', url.length);
  
  // Check if this is an OAuth callback URL
  if (url.startsWith('eloquent://auth/callback') || url.startsWith('eloquent://auth/success')) {
    console.log('🔐 OAuth callback URL detected');
    
    // Prevent duplicate processing of the exact same URL
    if (lastProcessedOAuthUrl === url) {
      console.log('⚠️ Duplicate OAuth URL, ignoring');
      return;
    }
    
    console.log('🔐 Processing OAuth callback URL');
    lastProcessedOAuthUrl = url;
    processingOAuth = true;
    
    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (processingOAuth) {
        console.log('⚠️ Protocol URL processing timeout, resetting flags');
        processingOAuth = false;
        lastProcessedOAuthUrl = null;
        showNotification('❌ Sign In Timeout', 'Authentication took too long. Please try again.');
      }
    }, 15000); // 15 second timeout
    
    try {
      let accessToken, refreshToken;
      
      // Parse URL to extract tokens - Handle both query parameters and hash fragments
      const urlObj = new URL(url.replace('eloquent://', 'https://'));
      
      // Method 1: Try query parameters first (preferred for macOS compatibility)
      const queryParams = new URLSearchParams(urlObj.search);
      accessToken = queryParams.get('access_token');
      refreshToken = queryParams.get('refresh_token');
      
      // Method 2: Try hash fragment (Supabase format) if query params don't have tokens
      if (!accessToken && urlObj.hash) {
        const hashFragment = urlObj.hash.substring(1);
        const hashParams = new URLSearchParams(hashFragment);
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      }
      
      console.log('🔑 Token extraction results:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken ? accessToken.length : 0,
        refreshTokenLength: refreshToken ? refreshToken.length : 0,
        extractionMethod: queryParams.get('access_token') ? 'query' : 'hash',
        urlPath: urlObj.pathname,
        hasQuery: !!urlObj.search,
        hasHash: !!urlObj.hash
      });
      
      if (accessToken) {
        console.log('🔑 Processing OAuth tokens...');
        
        // Handle the OAuth callback
        const result = await authService.handleOAuthCallback({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (result.success) {
          console.log('✅ OAuth authentication successful');
          console.log('🔑 User:', result.user?.email);
          console.log('📊 Subscription:', result.subscription?.plan);
          
          // CRITICAL: Set both authentication flags
          isAuthenticated = true;
          
          // Ensure auth service is also updated and session is cached
          if (result.user) {
            console.log('💾 Caching user session in auth service');
            try {
              authService.cacheSession('current', result);
              console.log('✅ Session cached successfully');
            } catch (error) {
              console.error('❌ Error caching session:', error);
            }
          }
          
          if (result.user?.settings) {
            CONFIG.language = result.user.settings.language || CONFIG.language;
            CONFIG.aiMode = result.user.settings.aiMode || CONFIG.aiMode;
            CONFIG.autoGrammarFix = result.user.settings.autoGrammarFix ?? CONFIG.autoGrammarFix;
          }
          
          // Close login window if open
          if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.close();
            loginWindow = null;
          }
          
          // Refresh tray menu
          createTray();
          
          // INSTANT FRONTEND UPDATE: Notify dashboard immediately
          if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('auth-updated', {
              isAuthenticated: true,
              user: result.user,
              subscription: result.subscription,
              usage: result.usage
            });
          }
          
          // Show success notification
          showNotification('✅ Sign In Successful', `Welcome back, ${result.user?.email || 'User'}!`);
          
          // Open dashboard if not already open
          if (!dashboardWindow || dashboardWindow.isDestroyed()) {
            createDashboard();
          }
          
        } else {
          console.error('❌ OAuth authentication failed:', result.error);
          showNotification('❌ Sign In Failed', result.error || 'Authentication failed');
        }
      } else {
        console.error('❌ No access token in OAuth callback URL');
        console.log('🔍 URL details for debugging:', {
          originalUrl: url,
          parsedUrl: urlObj.href,
          search: urlObj.search,
          hash: urlObj.hash,
          pathname: urlObj.pathname
        });
        showNotification('❌ Sign In Failed', 'No access token received from authentication');
      }
    } catch (error) {
      console.error('❌ Error handling OAuth callback:', error);
      showNotification('❌ Sign In Failed', 'Error processing authentication');
    } finally {
      // Clear timeout and reset processing flag
      clearTimeout(timeoutId);
      processingOAuth = false;
      
      // Clear the last processed URL after a delay to allow for legitimate retries
      setTimeout(() => {
        lastProcessedOAuthUrl = null;
      }, 5000);
    }
  } else if (url.startsWith('eloquent://auth/error')) {
    console.log('❌ OAuth error callback received');
    const urlObj = new URL(url.replace('eloquent://', 'https://'));
    const params = new URLSearchParams(urlObj.search);
    const error = params.get('error') || 'Unknown error';
    const errorDescription = params.get('error_description') || '';
    
    console.error('OAuth error:', error, errorDescription);
    showNotification('❌ Sign In Failed', `${error}: ${errorDescription}`);
    
    // Reset processing flags
    processingOAuth = false;
    lastProcessedOAuthUrl = null;
  } else {
    console.log('📱 Non-OAuth protocol URL received:', url);
  }
}