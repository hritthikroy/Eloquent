// ELOQUENT ELECTRON - VOICE DICTATION APP

// Suppress Electron security warnings in development
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Load environment variables
require('dotenv').config();

let app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog, Notification, screen, shell, session;

try {
  ({ app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog, Notification, screen, shell, session } = require('electron'));
} catch (e) {
  // During build process, electron might not be available
  console.log('Electron not available during build process');
  module.exports = {};
}

// Enforce single instance lock to prevent duplicate apps and duplicate overlay pills
if (app) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log('⚠️ Another instance of Eloquent is already running. Quitting duplicate.');
    app.quit();
    process.exit(0);
  }
}
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const fsPromises = fs.promises;
const { exec, spawn } = require('child_process');
const AI_PROMPTS = require('./utils/ai-prompts');
const performanceMonitor = require('./services/performance-monitor');
const authService = require('./services/auth-bridge');
const { isAdminUser } = require('./utils/admin-check');
const FastStartup = require('./utils/fast-startup');
const AudioRecorder = require('./utils/audio-recorder');
const PasteHelper = require('./utils/paste-helper');
const SoundPlayer = require('./utils/sound-player');
const { perfOptimizer } = require('./utils/performance-optimizer');
const JarvisManager = require('./utils/jarvis-manager');

// Initialize fast startup optimizer
const fastStartup = new FastStartup();

// Initialize cross-platform utilities
const audioRecorder = new AudioRecorder();
const pasteHelper = new PasteHelper();
const soundPlayer = new SoundPlayer();
const jarvisManager = new JarvisManager(path.join(__dirname, '..', 'userData'));
const actionRunner = require('./utils/action-runner');
const screenShareManager = require('./utils/screen-share-manager');
const { registerLibboardIpcHandlers } = require('./main/ipcHandlers');
const { registerClipboardHandlers } = require('./main/index');
const { StateManager } = require('./main/stateManager');
const { geminiClient } = require('./utils/gemini-client');
const { quantumVibeEngine } = require('./utils/quantum-vibe-engine');
const cameraManager = require('./utils/camera-manager');

// Ultra-Fast Persistent HTTPS Agent with TCP Keep-Alive for Zero Connection Overhead
const https = require('https');
const groqKeepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  keepAliveMsecs: 60000,
  timeout: 15000
});

// Exit early if electron is not available (during build)
if (!app) {
  process.exit(0);
}

// Override userData path in development to avoid sandbox issues
if (!app.isPackaged) {
  const userDataPath = path.join(__dirname, '..', 'userData');
  app.setPath('userData', userDataPath);
  console.log(`🔧 Development mode: Using local userData path: ${userDataPath}`);
  
  // Disable sandbox and GPU for stability in dev environment
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
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
const MAX_RECORDING_DURATION_MS = 10 * 60 * 1000; // 10 minutes max safeguard
let maxRecordingTimeout = null;
let currentMode = 'standard';
let isAuthenticated = false;
let processingOAuth = false; // Flag to prevent duplicate OAuth processing
let lastProcessedOAuthUrl = null; // Track last processed URL
let lastInterruptedUtterance = null; // Track interrupted AI speech for full-duplex overlap handling
let jarvisSpeechDetected = false;
let jarvisLastSpeechTime = 0;
let jarvisSpeechStartTime = 0;
let jarvisSpeechFrames = 0;
let jarvisAutoStopTriggered = false;
let jarvisVadHeartbeat = null;
let jarvisLastBackchannelTime = 0;
let jarvisBargeInCounter = 0;

// Helper function to find sox/rec binary
function getRecordingBinary() {
  const possiblePaths = [
    'rec', // System PATH (development)
    '/opt/homebrew/bin/rec', // Homebrew ARM Mac
    '/usr/local/bin/rec', // Homebrew Intel Mac
    '/usr/bin/rec', // Linux
    path.join(process.resourcesPath || '', 'bin', 'rec'), // Bundled in app
    path.join(__dirname, '..', 'assets', 'bin', 'mac', 'rec'), // Dev bundled
  ];
  
  for (const binPath of possiblePaths) {
    try {
      if (binPath === 'rec') {
        // Check if rec is in PATH
        const { execSync } = require('child_process');
        execSync('which rec', { stdio: 'ignore' });
        return 'rec';
      } else if (fs.existsSync(binPath)) {
        return binPath;
      }
    } catch (e) {
      // Continue to next path
    }
  }
  return null;
}

// Reset OAuth flags at startup
console.log('🔄 Initializing OAuth processing flags');
processingOAuth = false;
lastProcessedOAuthUrl = null;

// Application configuration
const CONFIG = {
  apiKeys: [
    process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY || '', // API Key 1 from .env
    process.env.GROQ_API_KEY_2 || '', // API Key 2 (optional)
    process.env.GROQ_API_KEY_3 || '', // API Key 3 (optional)
    process.env.GROQ_API_KEY_4 || '', // API Key 4 (optional)
    process.env.GROQ_API_KEY_5 || ''  // API Key 5 (optional)
  ],
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  language: process.env.LANGUAGE || 'en',
  customDictionary: '',
  aiMode: process.env.AI_MODE || 'auto',
  aiModel: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
  preserveClipboard: process.env.PRESERVE_CLIPBOARD === 'true',
  autoGrammarFix: process.env.AUTO_GRAMMAR_FIX !== 'false',
  autoPasteMode: 'direct'
};

// Admin configuration
const ADMIN_CONFIG = {
  masterApiKey: process.env.GROQ_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  dailyLimit: 1000,
  rateLimitPerUser: 100,
  users: [],
  apiRequests: []
};

// Recording state
let isRecording = false;
let isProcessing = false;
let isSessionAborted = false; // Flag to instantly kill all speech/pipeline when ESC is pressed
let isCreatingOverlay = false;
let overlayCreationLock = false;
let lastOverlayCreationTime = 0;
let recordingStartTime = 0;
let isJarvisLoopActive = false;
let currentActiveAgent = null;

let activeKeyPoolIndex = 0;

function rotateToNextKey() {
  const validKeys = CONFIG.apiKeys.filter(key => key && key.trim() !== '');
  if (validKeys.length > 1) {
    activeKeyPoolIndex = (activeKeyPoolIndex + 1) % validKeys.length;
    console.log(`🔄 [API Key Pool] Rotated to Key #${activeKeyPoolIndex + 1} of ${validKeys.length}`);
    return validKeys[activeKeyPoolIndex];
  }
  return validKeys[0];
}

// Get active API key based on usage and pool rotation
function getActiveAPIKey() {
  const validKeys = CONFIG.apiKeys.filter(key => key && key.trim() !== '');
  if (validKeys.length === 0) {
    throw new Error('No API keys configured');
  }

  return validKeys[activeKeyPoolIndex % validKeys.length];
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

let persistentStore = null;
function getStore() {
  if (!persistentStore) {
    try {
      const Store = require('electron-store');
      persistentStore = new Store();
    } catch (e) {
      console.warn('⚠️ Store initialization warning:', e.message);
    }
  }
  return persistentStore;
}

// Report usage to backend for authenticated users
async function reportUsageToBackend(durationSeconds, mode, language) {
  try {
    const store = getStore();
    const token = store ? store.get('authToken') : null;
    
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
  return pasteHelper.promptEnableAutoPaste();
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

  // Grant microphone media access to all renderers (overlay visualizer)
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      if (permission === 'media') return true;
      return true;
    });
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') return callback(true);
      callback(true);
    });
  }

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

  // PERFORMANCE BOOST: Pre-warm overlay window for instant <1ms launch with zero flicker
  initOverlayWindow();

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

  // Autonomous Team Eyes & Care Guardian: Boot Camera Ocular Vision & All-Day Care automatically
  try {
    console.log('👁️ Initializing Autonomous Squad Ocular Eyes & Daily Care Guardian...');
    cameraManager.start();
    screenShareManager.start();
    const dailyCareGuardian = require('./utils/daily-care-guardian');
    dailyCareGuardian.init(jarvisManager, cameraManager, screenShareManager);
  } catch (err) {
    console.warn('⚠️ Autonomous Vision eyes & care initialization note:', err.message);
  }
});

function promptChangeJarvisName() {
  if (process.platform === 'darwin') {
    const script = `tell application "System Events"
      display dialog "Enter your custom name for Jarvis:" default answer "${jarvisManager.config.userName}" with title "Jarvis Identity Preferences" buttons {"Cancel", "Save"} default button "Save"
      set userEntered to text returned of result
      return userEntered
    end tell`;
    const child = spawn('osascript', ['-e', script]);
    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.on('close', (code) => {
      if (code === 0 && output.trim()) {
        const newName = output.trim();
        jarvisManager.saveConfig({ userName: newName });
        jarvisManager.speak(`Pleasure to meet you, ${newName}. Records updated.`);
        createTray();
      }
    });
  }
}

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
      label: '⚡ Talk to Ava (Alt+J)',
      click: () => {
        showOverlayUltraFast('jarvis');
      }
    },
    {
      label: screenShareManager.isActive ? '🟢 Screen Share: ACTIVE (Streaming Display)' : '🖥️ Screen Share with AI Team (Alt+S)',
      click: () => {
        const isNowActive = screenShareManager.toggle(overlayWindow);
        tray = null;
        createTray();
        playSound(isNowActive ? 'start' : 'stop');
        showNotification('🖥️ Screen Share with AI Team', isNowActive ? 'Live continuous screen share is ACTIVE! Andrew & Tuk Tuk are viewing your screen.' : 'Screen share paused.');
      }
    },
    {
      label: 'Start AI Rewrite (Alt+Shift+Space)',
      click: () => {
        playSound('start');
        showOverlayUltraFast('rewrite');
      }
    },
    {
      label: 'Start Standard (Alt+Space)',
      click: () => {
        playSound('start');
        showOverlayUltraFast('standard');
      }
    },
    {
      label: '🎧 Voice Testing Suite',
      submenu: [
        {
          label: '▶️ Team Rollcall (Test All 4 Voices)',
          click: () => {
            showNotification('🎧 Team Rollcall', 'Playing all 4 agent voices through your speakers...');
            const { exec } = require('child_process');
            exec('node scripts/test-voices.js', { cwd: path.join(__dirname, '..') });
          }
        },
        { type: 'separator' },
        {
          label: '▶️ Test Tuk Tuk (Soul Companion & Co-Founder)',
          click: () => jarvisManager.speak(jarvisManager.agents.tuktuk.sample, jarvisManager.agents.tuktuk.voice)
        },
        {
          label: '▶️ Test Jenny (Research & Intelligence)',
          click: () => jarvisManager.speak(jarvisManager.agents.jenny.sample, jarvisManager.agents.jenny.voice)
        },
        {
          label: '▶️ Test Andrew (Lead Software Engineer)',
          click: () => jarvisManager.speak(jarvisManager.agents.andrew.sample, jarvisManager.agents.andrew.voice)
        },
        {
          label: '▶️ Test Brian (System QA Commander)',
          click: () => jarvisManager.speak(jarvisManager.agents.brian.sample, jarvisManager.agents.brian.voice)
        }
      ]
    },
    {
      label: '🤖 Tuk Tuk Preferences',
      submenu: [
        {
          label: `👤 Custom Name: ${jarvisManager.config.userName}`,
          click: () => promptChangeJarvisName()
        },
        {
          label: '🎩 Salutation',
          submenu: ['Boss', 'Hritthik', 'Sir', 'Captain', 'Chief'].map(sal => ({
            label: sal,
            type: 'radio',
            checked: jarvisManager.config.salutation === sal,
            click: () => {
              jarvisManager.saveConfig({ salutation: sal });
              jarvisManager.speak(`Salutation updated to ${sal}. I'm right here with you.`);
              createTray();
            }
          }))
        },
        {
          label: '🧹 Reset Conversation Memory',
          click: () => {
            jarvisManager.clearHistory();
            showNotification('Memory Reset', 'Conversation context has been cleared.');
          }
        }
      ]
    }
  );

  // Auto-paste status (only show if not enabled)
  const autoPasteAvailable = pasteHelper.isAutoPasteAvailable();
  if (!autoPasteAvailable) {
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

// Enhanced sound system with cross-platform support
function playSound(type) {
  console.log(`🔊 Playing sound: ${type} on ${process.platform}`);
  soundPlayer.play(type);
}

// Shortcut system
let lastShortcutTime = 0;
const SHORTCUT_DEBOUNCE = 300;
let shortcutLock = false;

function handleShortcut(action, mode = 'standard') {
  const now = Date.now();

  // Always process 'stop' (ESC) immediately with 0ms debounce and zero lockout
  if (action !== 'stop') {
    if (shortcutLock || (now - lastShortcutTime < SHORTCUT_DEBOUNCE)) {
      return;
    }
    lastShortcutTime = now;
    shortcutLock = true;
    setTimeout(() => {
      shortcutLock = false;
    }, SHORTCUT_DEBOUNCE);
  }
  
  if (action === 'start') {
    isSessionAborted = false;
    if (mode === 'jarvis') {
      isJarvisLoopActive = true;
      playSound('start'); // Alexa-style activation chime
      // Ambient Screen Perception: capture fresh frame in background immediately
      try { screenShareManager.captureInstantFrame(); } catch (e) {}
    }
    if (isRecording) {
      console.log('🛑 Shortcut pressed while recording - toggling stop');
      stopRecording();
      return;
    }
    showOverlayUltraFast(mode);
  } else if (action === 'stop') {
    console.log('🛑 ESC pressed - terminating session immediately and completely');
    isSessionAborted = true;
    isJarvisLoopActive = false;
    
    // 1. Immediately silence any speech playback or audio synthesis
    jarvisManager.stopSpeaking();
    
    // 2. Stop recording process cleanly if active
    if (isRecording || recordingProcess) {
      isRecording = false;
      if (audioRecorder) {
        audioRecorder.stopRecording().catch(() => {});
      }
      if (recordingProcess) {
        try { recordingProcess.kill('SIGKILL'); } catch (e) {}
        recordingProcess = null;
      }
    }
    
    // 3. Clear all timers and flags
    if (maxRecordingTimeout) {
      clearTimeout(maxRecordingTimeout);
      maxRecordingTimeout = null;
    }
    if (jarvisVadHeartbeat) {
      clearInterval(jarvisVadHeartbeat);
      jarvisVadHeartbeat = null;
    }
    isProcessing = false;
    isStopRecordingLock = false;

    // 4. Force hide overlay immediately
    hideOverlay();
  }
}

function registerShortcuts() {
  // Unregister all existing shortcuts first to prevent duplicates
  globalShortcut.unregisterAll();
  
  console.log('🔧 Registering keyboard shortcuts...');
  
  // Jarvis Power Talk shortcut
  const jarvisRegistered = globalShortcut.register('Alt+J', () => {
    handleShortcut('start', 'jarvis');
  });

  // Live Screen Share with AI Team toggle (Alt+S)
  const screenShareRegistered = globalShortcut.register('Alt+S', () => {
    const isNowActive = screenShareManager.toggle(overlayWindow);
    tray = null;
    createTray();
    playSound(isNowActive ? 'start' : 'stop');
    showNotification('🖥️ Screen Share with AI Team', isNowActive ? 'Live continuous screen share is ACTIVE! Andrew & Tuk Tuk are viewing your screen.' : 'Screen share paused.');
  });

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
  console.log(`   Alt+J (Jarvis Power Talk): ${jarvisRegistered ? 'OK' : 'FAILED'}`);
  console.log(`   Alt+Shift+Space (AI Rewrite): ${rewriteRegistered ? 'OK' : 'FAILED'}`);
  console.log(`   Alt+Space (Standard): ${standardRegistered ? 'OK' : 'FAILED'}`);
  console.log(`   ESC (Stop): ${escRegistered ? 'OK' : 'FAILED'}`);
  
  if (!rewriteRegistered || !standardRegistered || !escRegistered) {
    console.error('❌ Some core shortcuts failed to register');
  }
}



// Calculate cursor position for overlay placement
function getCursorTargetPosition() {
  const cursorPosition = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPosition);
  const screenBounds = display.workArea;

  const windowWidth = 380;
  const windowHeight = 56;
  const x = cursorPosition.x - (windowWidth / 2);
  const y = cursorPosition.y - windowHeight - 20;

  const finalX = Math.max(screenBounds.x, Math.min(x, screenBounds.x + screenBounds.width - windowWidth));
  const finalY = Math.max(screenBounds.y, Math.min(y, screenBounds.y + screenBounds.height - windowHeight));

  return {
    x: Math.round(finalX),
    y: Math.round(finalY),
    width: windowWidth,
    height: windowHeight
  };
}

// Persistent pre-warmed overlay window for instant <1ms launch with 0% flicker
function initOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const { x, y, width, height } = getCursorTargetPosition();

  overlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // 100% transparent zero-flicker background
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    acceptFirstMouse: false,
    show: false,
    paintWhenInitiallyHidden: true, // GPU pre-rasterizes before display
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      offscreen: false,
      preload: false,
      enableRemoteModule: false,
      webSecurity: false,
      hardwareAcceleration: true
    }
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'floating', 1);

  overlayWindow.webContents.on('console-message', (event, level, message) => {
    console.log('🖥️ [Overlay Console]:', message);
  });

  overlayWindow.loadFile('src/ui/overlay.html');
  screenShareManager.setOverlayWindow(overlayWindow);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    isCreatingOverlay = false;
  });

  return overlayWindow;
}

// Show overlay instantly with zero flicker and start recording
function showOverlayUltraFast(mode = 'standard') {
  currentMode = mode;

  if (!isAuthenticated && !authService.isAuthenticated()) {
    // Check if valid Groq API key is present (allows local testing and BYOK mode)
    const hasLocalKey = CONFIG.apiKeys.some(k => k && k.startsWith('gsk_')) || (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_'));
    if (hasLocalKey) {
      console.log('🔑 Local Groq API key detected, enabling instant recording');
      isAuthenticated = true;
    } else {
      showNotification('Sign In Required', 'Please sign in with Google to use Eloquent');
      createLoginWindow();
      return;
    }
  }

  if (recordingProcess) {
    recordingProcess.kill();
    recordingProcess = null;
  }

  const win = initOverlayWindow();
  const targetPos = getCursorTargetPosition();
  win.setBounds(targetPos);

  const displayAndRecord = () => {
    win.webContents.send('set-mode', mode);
    win.showInactive(); // Shows instantly without stealing active window focus
    startRecording();
    isCreatingOverlay = false;
  };

  if (win.webContents.isLoading()) {
    win.webContents.once('dom-ready', displayAndRecord);
  } else {
    displayAndRecord();
  }
}

// Hide overlay with smooth fade-out and instant dismissal
function hideOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try {
      overlayWindow.webContents.send('close-with-animation');
    } catch (e) {}
    // Instant hide to ensure UI is 100% gone and unresponsive window state is impossible
    try {
      overlayWindow.hide();
    } catch (e) {}
  }
}

// Aliases for backward compatibility
const createOverlayUltraFast = showOverlayUltraFast;
const createOverlay = showOverlayUltraFast;

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
    backgroundColor: '#0f172a', // Matches dark theme, zero white flash
    show: false,
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

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow.show();
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
      backgroundColor: '#0f172a',
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    adminWindow.once('ready-to-show', () => {
      adminWindow.show();
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

// =========================================================================
// =========================================================================
// REAL-TIME LIVE TEXT RENDERING DIRECTLY AT CURSOR (ZERO BACKSPACES)
// =========================================================================
let liveStreamingInterval = null;
let isStreamingChunk = false;
let liveWordsTyped = [];
let totalLiveWordsTyped = 0;
let lastProcessedAudioSize = 0;

// Known Whisper silence hallucinations to ignore (strictly third-party spam / video artifacts)
const SILENCE_HALLUCINATIONS = new Set([
  'thanks for watching', 'thank you for watching', 'subtitles by',
  'this video was made possible by', 'watch till the end',
  'dont forget to subscribe', 'like and subscribe',
  'visit our website', 'for more information',
  'subtitles', 'closed captions', 'amaraorg',
  'silence', 'silent', 'applause', 'cheering', 'laughter',
  'shadow neutral', 'ava neural', 'en-us-avaneural'
]);

function isWhisperHallucination(text, recordingDurationMs = 0) {
  if (!text || typeof text !== 'string') return true;
  const clean = text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').trim();
  if (clean.length === 0) return true;
  if (SILENCE_HALLUCINATIONS.has(clean)) return true;

  // Only treat minimal acknowledgment words as hallucinations on VERY short recordings (<1.2s)
  // On longer recordings they are genuine speech - the user said something real
  if (recordingDurationMs < 1200) {
    if (clean === 'thank you' || clean === 'thanks' || clean === 'thank you very much' ||
        clean === 'thank you so much' || clean === 'you' || clean === 'bye') {
      return true;
    }
  }

  // Check for bracketed or parenthesized audio labels: [music], (laughter), *applause*
  const trimmed = text.trim();
  if (/^\[.+\]$/.test(trimmed) || /^\(.+\)$/.test(trimmed) || /^\*.+\*$/.test(trimmed)) return true;

  // Subtitles / video metadata phantom text
  if (clean.startsWith('subtitles by') || clean.includes('amaraorg') || clean.includes('closed caption')) return true;

  // Detect consecutive word repetition loops (e.g. "please, please, please", "you you you", "so so so")
  // Exclude 'tuk' or 'tuktuk' so names are never discarded
  if (!clean.includes('tuk') && /\b(\w+)(?:[,\s]+\1){2,}\b/i.test(text)) {
    return true;
  }

  // Detect consecutive 2-word phrase repetition loops (e.g. "thank you thank you thank you")
  if (/\b(\w+\s+\w+)(?:[,\s]+\1){2,}\b/i.test(text)) {
    return true;
  }

  // Detect Whisper hallucinated outros/sign-offs on low-noise audio
  if (clean.includes('if you have any questions') ||
      clean.includes('questions please') ||
      clean.includes('thanks for listening') ||
      clean.includes('thank you for listening') ||
      clean.includes('see you in the next') ||
      clean.includes('see you next time') ||
      clean.includes('share and subscribe')) {
    return true;
  }

  return false;
}

function typeLiveTextAtCursor(text) {
  if (!text || process.platform !== 'darwin') return;
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // Type directly into user's active window/cursor via System Events
  const child = spawn('osascript', ['-e', `tell application "System Events" to keystroke "${escaped}"`]);
  child.on('error', (err) => {
    console.log('Live typing error:', err.message);
  });
}

function replaceLiveWordsWithFinal(wordCount, finalText) {
  clipboard.writeText(finalText);
  if (process.platform === 'darwin' && wordCount > 0) {
    console.log(`✨ Selecting ${wordCount} live words and replacing with polished final text (zero backspaces)...`);
    // Select the words we typed backward using Shift+Option+Left Arrow
    const script = `tell application "System Events"
      repeat ${wordCount} times
        key code 123 using {shift down, option down}
      end repeat
    end tell`;
    const child = spawn('osascript', ['-e', script]);
    child.on('error', (err) => {
      console.log('Selection error, pasting directly:', err.message);
      pasteTextRobust(finalText);
    });
    child.on('close', (code) => {
      // Once selection keystrokes are finished and modifiers released, paste final text over selection
      setTimeout(() => {
        pasteTextRobust(finalText);
      }, 70);
    });
  } else {
    pasteTextRobust(finalText);
  }
}

let previewRateLimitedUntil = 0;

async function transcribePreview(snapshotPath) {
  try {
    if (Date.now() < previewRateLimitedUntil) return '';

    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(snapshotPath), {
      filename: 'preview.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'en');
    form.append('response_format', 'json');
    form.append('temperature', '0');
    form.append('prompt', 'Professional voice dictation with zero background noise, clean punctuation, and clear capitalization.');

    const res = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${getActiveAPIKey()}`
        },
        timeout: 3500,
        validateStatus: status => status < 500
      }
    );

    if (res.status === 429) {
      console.warn('⚠️ Preview rate limited (429), backing off preview for 15s to preserve quota for final text');
      previewRateLimitedUntil = Date.now() + 15000;
      return '';
    }

    return res.data?.text || '';
  } catch (err) {
    return '';
  }
}

function startLiveStreaming(filePath) {
  stopLiveStreaming();
  liveWordsTyped = [];
  totalLiveWordsTyped = 0;
  lastProcessedAudioSize = 0;

  // Stream live words safely under Groq 20 RPM limit (every 3.5s)
  liveStreamingInterval = setInterval(async () => {
    if (!isRecording || currentMode === 'jarvis' || isStreamingChunk || Date.now() < previewRateLimitedUntil || !fs.existsSync(filePath)) return;

    try {
      const stats = await fsPromises.stat(filePath);
      // Wait for at least ~1.5s of audio and 32KB of new speech before querying
      if (stats.size < 32000 || (stats.size - lastProcessedAudioSize < 24000)) return;

      isStreamingChunk = true;
      lastProcessedAudioSize = stats.size;
      const snapshotPath = `${filePath}.snap.wav`;
      await fsPromises.copyFile(filePath, snapshotPath);

      const previewText = await transcribePreview(snapshotPath);
      if (previewText && previewText.trim().length > 0 && isRecording) {
        const cleanPreview = previewText.trim();
        const lower = cleanPreview.toLowerCase().replace(/[.!?,]/g, '').trim();

        // Discard silence hallucinations
        if (isWhisperHallucination(cleanPreview)) {
          console.log(`🔇 Discarding Whisper silence hallucination: "${cleanPreview}"`);
          fs.unlink(snapshotPath, () => {});
          return;
        }

        const rawWords = cleanPreview.split(/\s+/).filter(w => w.length > 0);
        
        // Strip trailing punctuation (.,?!:;...) from intermediate live words so we don't chop sentences
        const cleanWords = rawWords.map(w => w.replace(/[.,?!:;]+$/g, ''));
        
        // Type newly spoken words directly at the cursor in user's active window
        if (cleanWords.length > liveWordsTyped.length) {
          const newWords = cleanWords.slice(liveWordsTyped.length);
          const textToType = (liveWordsTyped.length === 0 ? '' : ' ') + newWords.join(' ');
          
          liveWordsTyped = cleanWords;
          totalLiveWordsTyped += newWords.length;
          
          console.log(`✍️ Real-time live text typing at cursor: "${textToType}" (${newWords.length} new words)`);
          typeLiveTextAtCursor(textToType);
        }
      }
      fs.unlink(snapshotPath, () => {});
    } catch (err) {
      // Ignore preview snapshot errors
    } finally {
      isStreamingChunk = false;
    }
  }, 3500);
}

function stopLiveStreaming() {
  if (liveStreamingInterval) {
    clearInterval(liveStreamingInterval);
    liveStreamingInterval = null;
  }
  isStreamingChunk = false;
}

function ensureHealthyMicVolume() {
  if (process.platform === 'darwin') {
    try {
      const curVol = parseInt(execSync('osascript -e "input volume of (get volume settings)"', { timeout: 1000 }).toString().trim(), 10);
      if (isNaN(curVol) || curVol < 50) {
        console.log(`🎙️ Microphone input volume was too low (${curVol}%). Elevating to 85% for crystal-clear dictation.`);
        execSync('osascript -e "set volume input volume 85"', { timeout: 1000 });
      }
    } catch (e) {}
  }
}

function startRecording() {
  // Prevent duplicate recording processes
  if (recordingProcess || isRecording) {
    console.log('⚠️ Recording already in progress - skipping');
    return;
  }

  ensureHealthyMicVolume();
  isRecording = true;
  isStopRecordingLock = false; // Always ensure stop lock is reset when recording begins
  performanceMonitor.startRecording();

  audioFile = path.join(app.getPath('temp'), `eloquent-${Date.now()}.wav`);
  recordingStartTime = Date.now();

  // Set 10-minute auto-stop safeguard to prevent runaway recordings
  if (maxRecordingTimeout) {
    clearTimeout(maxRecordingTimeout);
    maxRecordingTimeout = null;
  }
  maxRecordingTimeout = setTimeout(() => {
    console.log('⏱️ Maximum recording duration reached (10 minutes). Auto-stopping...');
    if (currentMode !== 'jarvis') {
      showNotification('⏱️ 10-Minute Limit Reached', 'Recording stopped automatically to keep dictation fast and within limits.');
    }
    stopRecording();
  }, MAX_RECORDING_DURATION_MS);

  // Send the recording start time to the overlay for accurate timer
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('recording-started', recordingStartTime);
  }

  if (currentMode !== 'jarvis') {
    playSound('start');
  }
  performanceMonitor.measureRecordingLatency();
  
  // VAD state for automatic hands-free turn taking in Jarvis mode
  jarvisSpeechDetected = false;
  jarvisLastSpeechTime = 0;
  jarvisSpeechStartTime = 0;   // When continuous speech first began (for duration gate)
  jarvisSpeechFrames = 0;      // Confirmed audio frames above threshold
  jarvisAutoStopTriggered = false;
  jarvisBargeInCounter = 0;
  if (jarvisVadHeartbeat) {
    clearInterval(jarvisVadHeartbeat);
    jarvisVadHeartbeat = null;
  }

  // Independent 60ms VAD Heartbeat: Checks silence continuously regardless of SoX stderr buffering
  const jarvisSessionStartTime = Date.now();
  if (currentMode === 'jarvis') {
    jarvisVadHeartbeat = setInterval(() => {
      if (!isRecording || currentMode !== 'jarvis' || jarvisAutoStopTriggered) {
        if (jarvisVadHeartbeat) {
          clearInterval(jarvisVadHeartbeat);
          jarvisVadHeartbeat = null;
        }
        return;
      }
      // CRITICAL: Suspend silence auto-stop while AI is actively speaking aloud!
      if (jarvisManager.isSpeaking) {
        return;
      }

      // Confirmed speech: 2+ frames (~150-200ms) of real voice
      if (jarvisSpeechDetected && jarvisSpeechFrames >= 2) {
        const silenceMs = Date.now() - jarvisLastSpeechTime;
        const voicedDurationMs = jarvisLastSpeechTime - jarvisSpeechStartTime;
        const totalDurationMs = Date.now() - jarvisSpeechStartTime;

        // 3-Tier Anti-Cutoff & Adaptive Human Turn-Taking Threshold:
        // 1. Incomplete fragment / hesitation (<800ms, e.g. "I...", "Wait...", "Um..."): 1200ms breathing room
        // 2. Standard sentence (800ms - 2200ms, e.g. "Hello Tuk Tuk, how are you?"): 550ms natural handoff
        // 3. Sustained monologue (>2200ms): 480ms ultra-snappy ping-pong
        const dynamicSilenceThreshold = voicedDurationMs < 800 ? 1200 : (voicedDurationMs < 2200 ? 550 : 480);
        const isMaxSpeechCap = totalDurationMs >= 10000;

        if ((silenceMs >= dynamicSilenceThreshold && voicedDurationMs >= 150) || isMaxSpeechCap) {
          const reason = isMaxSpeechCap ? "10s max speech ceiling" : `${silenceMs}ms natural pause`;
          console.log(`🗣️ VAD Heartbeat: Turn completion detected (${reason}, ${voicedDurationMs}ms speech) - auto-submitting!`);
          jarvisAutoStopTriggered = true;
          if (jarvisVadHeartbeat) {
            clearInterval(jarvisVadHeartbeat);
            jarvisVadHeartbeat = null;
          }
          stopRecording();
        }
      } else if (!jarvisSpeechDetected && (Date.now() - jarvisSessionStartTime >= 12000)) {
        // Idle safety: If open for 12 seconds with zero speech, auto-stop cleanly
        console.log('⏱️ VAD Heartbeat: 12s idle with no speech detected - auto-stopping.');
        jarvisAutoStopTriggered = true;
        if (jarvisVadHeartbeat) {
          clearInterval(jarvisVadHeartbeat);
          jarvisVadHeartbeat = null;
        }
        stopRecording();
      }
    }, 60);
  }

  // Use cross-platform audio recorder
  audioRecorder.startRecording(audioFile)
    .then((success) => {
      if (!success) {
        throw new Error('Failed to start recording');
      }
      
      console.log('✅ Recording started successfully');
      recordingProcess = audioRecorder.recordingProcess;
      startLiveStreaming(audioFile);
      
      // Wire real voice amplitude from SoX VU meter to overlay, live barge-in, and silence VAD
      audioRecorder.onAmplitude = (amplitude) => {
        // Full-Duplex Overlap: While AI is speaking, detect deliberate user vocal interjection/barge-in
        // Geigel DTD Equation + Optical Lip Aperture Overlap:
        // When camera detects lips moving, user doesn't need to shout to interrupt!
        if (currentMode === 'jarvis' && jarvisManager.isSpeaking) {
          const isLipsMoving = cameraManager && cameraManager.isActive && cameraManager.isLipMovementDetected();
          const bargeInThreshold = isLipsMoving ? 0.32 : 0.65; // Ultra-responsive optical barge-in

          if (amplitude >= bargeInThreshold) {
            jarvisBargeInCounter = (jarvisBargeInCounter || 0) + 1;
            if (jarvisBargeInCounter >= (isLipsMoving ? 1 : 2)) {
              console.log('⚡ Natural human conversational barge-in detected! Halting AI speech gracefully...');
              lastInterruptedUtterance = jarvisManager.currentUtterance;
              jarvisManager.stopSpeaking();
              jarvisBargeInCounter = 0;
              jarvisSpeechDetected = true;
              jarvisSpeechStartTime = Date.now();
              jarvisLastSpeechTime = Date.now();
              jarvisSpeechFrames = 1;
            }
          } else {
            jarvisBargeInCounter = 0;
          }
          return;
        }

        // Automatic Hands-Free Turn Taking (VAD): Auto-detect natural silence after sustained speech across all modes
        if (isRecording && !jarvisAutoStopTriggered) {
          const SPEECH_THRESHOLD = 0.035; // Ultra-sensitive: catches soft speech, whisper tones, and quiet laptop mics
          const isSpeechFrame = amplitude >= SPEECH_THRESHOLD;

          if (isSpeechFrame) {
            if (!jarvisSpeechDetected) {
              jarvisSpeechStartTime = Date.now();
            }
            jarvisSpeechDetected = true;
            jarvisLastSpeechTime = Date.now();
            jarvisSpeechFrames++;
          }

          if (jarvisSpeechDetected && jarvisSpeechFrames >= 2) {
            const silenceMs = Date.now() - jarvisLastSpeechTime;
            const voicedDurationMs = jarvisLastSpeechTime - jarvisSpeechStartTime;
            const speechDurationMs = Date.now() - jarvisSpeechStartTime;

            // Quantum Dynamical Turn-Taking Endpointing (Levinson & Torreira 2015 TRP: 190ms - 270ms)
            // Multimodal Audio-Visual VAD (AV-VAD): If camera is active and lips have sealed after actual speech, cut off in 140ms!
            let dynamicSilenceThreshold = quantumVibeEngine.getDynamicSilenceThreshold(voicedDurationMs);
            if (cameraManager && cameraManager.isActive && !cameraManager.isLipMovementDetected() && voicedDurationMs >= 400 && silenceMs >= 140) {
              dynamicSilenceThreshold = 140; // Natural snappy lip-closure cut-off without premature cuts
            }
            const isMaxSpeechCap = speechDurationMs >= 60000; // Expanded to 60s so long continuous sentences are never truncated
            const isNaturalPause = silenceMs >= dynamicSilenceThreshold && voicedDurationMs >= 200;

            if (isNaturalPause || isMaxSpeechCap) {
              const reason = isMaxSpeechCap ? "60s max speech cap" : `${silenceMs}ms natural pause`;
              console.log(`🗣️ Auto-submitting to Tuk Tuk (${reason}, ${voicedDurationMs}ms voiced speech)...`);
              jarvisAutoStopTriggered = true;
              if (jarvisVadHeartbeat) {
                clearInterval(jarvisVadHeartbeat);
                jarvisVadHeartbeat = null;
              }
              stopRecording();
            }
          } else if (jarvisSpeechDetected && !isSpeechFrame) {
            const silenceMs = Date.now() - jarvisLastSpeechTime;
            // Noise blip filter: If fewer than 2 frames and > 1.2s silence, reset
            if (silenceMs > 1200 && jarvisSpeechFrames < 2) {
              jarvisSpeechDetected = false;
              jarvisSpeechStartTime = 0;
              jarvisLastSpeechTime = 0;
              jarvisSpeechFrames = 0;
            }
          }
        }
      };
    })
    .catch((error) => {
      console.error('❌ Failed to start recording:', error);
      isProcessing = false;
      isRecording = false;
      
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('error', `Recording failed: ${error.message}`);
      }
      
      showNotification('Setup Required', AudioRecorder.getInstallInstructions());
    });
}

// Atomic lock to prevent duplicate parallel stopRecording executions
let isStopRecordingLock = false;

// OPTIMIZED: Fast and reliable stopRecording function
async function stopRecording() {
  // Prevent duplicate parallel executions and deadlocks
  if (isStopRecordingLock || isProcessing) {
    return;
  }
  isStopRecordingLock = true;

  if (maxRecordingTimeout) {
    clearTimeout(maxRecordingTimeout);
    maxRecordingTimeout = null;
  }

  if (jarvisVadHeartbeat) {
    clearInterval(jarvisVadHeartbeat);
    jarvisVadHeartbeat = null;
  }

  if (!isRecording && !recordingProcess) {
    isStopRecordingLock = false;
    return;
  }

  isProcessing = true;
  isRecording = false;
  console.log('🛑 Stopping recording...');
  stopLiveStreaming();

  // Instantly hide overlay for standard/rewrite - keep open for Jarvis to show status
  if (currentMode !== 'jarvis' && overlayWindow && !overlayWindow.isDestroyed()) {
    hideOverlay();
  }

  // Calculate recording duration
  const recordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;
  const sessionAudioFile = audioFile;
  let targetAudioFile = sessionAudioFile;

  // Stop recording process using cross-platform recorder
  let stoppedFile = null;
  try {
    if (audioRecorder.amplitudeInterval) {
      clearInterval(audioRecorder.amplitudeInterval);
      audioRecorder.amplitudeInterval = null;
    }
    
    stoppedFile = await audioRecorder.stopRecording();
    recordingProcess = null;
    
    // Small delay to ensure file is written
    await new Promise(r => setTimeout(r, 100));
  } catch (error) {
    console.error('❌ Error stopping recording:', error);
    recordingProcess = null;
  }

  try {
    // Validate audio file
    targetAudioFile = sessionAudioFile || stoppedFile || audioFile;
    if (!targetAudioFile) {
      throw new Error('No audio file path - recording may have been cancelled');
    }
    
    if (!fs.existsSync(targetAudioFile)) {
      throw new Error('Audio file not created. Please install sox: brew install sox');
    }

    const stats = fs.statSync(targetAudioFile);
    console.log(`📊 Audio file: ${Math.round(stats.size/1000)}KB`);
    
    // Accept short human replies down to 250ms (~8KB) in jarvis mode
    const minAudioBytes = (currentMode === 'jarvis') ? 8000 : 18000;
    if (stats.size < minAudioBytes) {
      if (currentMode === 'jarvis') {
        console.log(`🎙️ Sub-vocal noise blip (<250ms, ${Math.round(stats.size/1000)}KB) - keeping mic active for real speech...`);
        isProcessing = false;
        isStopRecordingLock = false;
        if (isJarvisLoopActive && overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('jarvis-listening');
          startRecording();
        }
        return;
      }
      throw new Error('Recording too short. Please speak for at least 1 second.');
    }

    const recordingDurationSec = Math.max(1, Math.round((stats.size - 44) / 32000));
    const apiKey = getActiveAPIKey();

    let finalText;
    let originalText = '';

    // Require API key for transcription
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key not configured. Please add your Groq API key in Settings.');
    }
    try {
      originalText = await transcribe(targetAudioFile);
    } catch (txErr) {
      if (currentMode === 'jarvis') {
        console.log('🎙️ Tony Stark Suit Mode: No distinct speech detected - keeping 24/7 mic armed...');
        isProcessing = false;
        isStopRecordingLock = false;
        if (isJarvisLoopActive && !isSessionAborted && overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('jarvis-listening');
          overlayWindow.webContents.send('recording-started', Date.now());
          startRecording();
        }
        return;
      }
      isStopRecordingLock = false;
      throw txErr;
    }

    // If ESC was pressed during transcription, discard immediately without background processing
    if (isSessionAborted) {
      console.log('🛑 Session was aborted via ESC - discarding transcribed text without background execution');
      isProcessing = false;
      isStopRecordingLock = false;
      hideOverlay();
      return;
    }
    
    // Notify overlay that AI is polishing the grammar
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('live-polishing');
    }

    // Automatic conversational routing: If user addresses an agent or is in jarvis mode, talk out loud
    const isDirectedToAgent = (currentMode === 'jarvis') ||
      /\b(tuk\s*tuk|took\s*took|tuck\s*tuck|andrew|jenny|brian|jarvis|squad|team)\b/i.test(originalText);

    if (currentMode === 'jarvis' || isDirectedToAgent) {
      // 1. Acoustic Phonetic Normalization for Project Terms
      originalText = originalText
        .replace(/\b(?:entry|enter|anti)\s*gravity\b/gi, 'Antigravity')
        .replace(/\b(?:took\s*took|tok\s*tok|tuck\s*tuck)\b/gi, 'Tuk Tuk')
        .replace(/\b(?:hey\s+|listen\s+)?andrew\s+bhai\b/gi, 'Andrew')
        .replace(/\b(?:hey\s+)?bhai\s+andrew\b/gi, 'Andrew')
        .replace(/\band you\b(?=\s+(check|modify|write|tell|see|look|help|code|build|refactor|take|run|fix|draft|craft|inspect))/gi, 'Andrew')
        .replace(/\b(?:and\s*rew|an\s*drew)\b/gi, 'Andrew')
        .replace(/\b(on this course)\b/gi, 'on this code');

      // 2. Backchannel Self-Echo Blinding Filter
      const timeSinceBC = Date.now() - (jarvisLastBackchannelTime || 0);
      if (timeSinceBC < 3500) {
        const cleanLower = originalText.toLowerCase().replace(/[^a-z]/g, '');
        if (cleanLower === 'right' || cleanLower === 'rightright' || cleanLower === 'yeah' || cleanLower === 'mhm' || cleanLower === 'uhhuh' || cleanLower === 'okay') {
          console.log(`🔇 Jarvis: discarding backchannel self-echo "${originalText}" (${timeSinceBC}ms after BC) — re-arming mic...`);
          isProcessing = false;
          isStopRecordingLock = false;
          if (isJarvisLoopActive && overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('jarvis-listening');
            startRecording();
          }
          return;
        }
      }

      // Silently discard Whisper hallucinations — don't waste an AI call on phantom speech
      if (isWhisperHallucination(originalText, recordingDuration)) {
        console.log(`🔇 Jarvis: discarding Whisper hallucination "${originalText}" (${recordingDuration}ms) — re-arming mic...`);
        isProcessing = false;
        isStopRecordingLock = false;
        if (isJarvisLoopActive && overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('jarvis-listening');
          startRecording();
        }
        return;
      }

      console.log('🤖 Jarvis conversational mode: generating intelligent response...');

      // Check for voice preference change (e.g. "call me Hritthik", "address me as Boss")
      const prefChange = jarvisManager.detectPreferenceChange(originalText);
      let jarvisReply = '';
      // Pre-detect the active agent NOW before any async work, so overlay label is correct immediately
      let activeAgent = jarvisManager.detectActiveAgent(originalText);
      currentActiveAgent = activeAgent;
      let standupAlreadySpoken = false;
      let actionResult = null;

      // Set the correct agent name BEFORE showing "thinking..." so overlay never flashes wrong name
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('set-agent-name', activeAgent.name);
        overlayWindow.webContents.send('jarvis-thinking');
      }

      // ⚡ Zero-Latency Paralinguistic Turn Filler (<80ms)
      // Plays immediate vocal cue ("Hmm", "Yeah", "Gotchu", "On it") so there is ZERO dead silence while thinking
      try {
        jarvisManager.playInstantTurnFiller(activeAgent.name);
      } catch (fillerErr) {}

      if (prefChange) {
        if (prefChange.type === 'name') {
          jarvisReply = `Understood. I will call you ${prefChange.value} from now on.`;
        } else if (prefChange.type === 'salutation') {
          jarvisReply = `Got it. I will address you as ${prefChange.value}.`;
        } else if (prefChange.type === 'rule') {
          jarvisReply = activeAgent.name === 'Tuk Tuk'
            ? `Got it, babe. I've committed that new rule to our team directives.`
            : `Understood, bro. Locked that new rule into my directives.`;
        } else if (prefChange.type === 'clear_rules') {
          jarvisReply = activeAgent.name === 'Tuk Tuk'
            ? `All custom team directives have been cleared, babe.`
            : `All custom directives cleared, bro.`;
        }
      } else {
        // activeAgent directly answers with unified domain intelligence
        console.log(`🎯 Routing query directly to: ${activeAgent.name} (${activeAgent.role})`);
        // 1. Check if an Autonomous Office Action or Suit Command should be executed directly on macOS
        actionResult = await actionRunner.handleAction(originalText, activeAgent, jarvisManager, callGroqChatCompletion, geminiClient);
        if (actionResult && actionResult.handled) {
          if (actionResult.isStandup) {
            console.log('🎙️ Remote Office Zoom Standup sequence initiated!');
            for (const step of actionResult.steps) {
              if (!isJarvisLoopActive) break;
              if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('set-agent-name', step.agent);
                overlayWindow.webContents.send('jarvis-speaking');
              }
              showNotification(`💼 ${step.agent} (${step.role})`, step.speech);
              await jarvisManager.speak(step.speech, step.voice);
              await new Promise(r => setTimeout(r, 200));
            }
            jarvisReply = actionResult.steps[actionResult.steps.length - 1].speech;
            standupAlreadySpoken = true;
          } else {
            console.log(`⚡ Office Action Executed by ${activeAgent.name}: "${actionResult.speech}"`);
            jarvisReply = actionResult.speech;
            if (actionResult.dismissSession) {
              isJarvisLoopActive = false;
            }
          }
        } else {
          let userQuery = originalText;
          if (lastInterruptedUtterance) {
            console.log(`🔀 Injecting conversational interruption context: "${lastInterruptedUtterance}"`);
            let reactionStyle = "acknowledge the mid-sentence pivot naturally as his loving partner";
            if (activeAgent.name === "Andrew") {
              reactionStyle = "pivot immediately like a sharp lead engineer ('Got you bro')";
            } else if (activeAgent.name === "Brian") {
              reactionStyle = "acknowledge the interjection with calm, grounded DevOps clarity";
            } else if (activeAgent.name === "Jenny") {
              reactionStyle = "integrate his new variable swiftly with sharp analytical precision";
            }
            userQuery = `[Context: You were saying: "${lastInterruptedUtterance}" when Hritthik added mid-sentence: "${originalText}". Yield the floor respectfully, ${reactionStyle}, seamlessly integrate his added info without repeating old sentences, and answer his interjection directly in clean spoken words!]`;
            lastInterruptedUtterance = null;
          }
          jarvisReply = await askJarvis(userQuery, activeAgent, originalText);
        }
      }

      finalText = jarvisReply;

      if (isSessionAborted) {
        console.log('🛑 Session was aborted via ESC - discarding speech synthesis');
        isProcessing = false;
        isStopRecordingLock = false;
        hideOverlay();
        return;
      }

      if (!standupAlreadySpoken) {
        // Stop any running filler before speaking the full answer
        try { jarvisManager.stopFiller(); } catch (e) {}

        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('jarvis-speaking');
        }

        const speakingAgentName = (actionResult && actionResult.agentName) || activeAgent.name;
        const speakingVoice = (actionResult && actionResult.agentVoice) || activeAgent.voice;

        const multiTurns = parseMultiAgentTurns(jarvisReply);
        if (multiTurns.length > 1) {
          console.log(`🎙️ Multi-Party Squad Exchange initiated (${multiTurns.length} agent turns) - SEQUENTIAL PLAYBACK`);
          
          // CRITICAL FIX: Strict sequential playback with explicit awaits
          for (let i = 0; i < multiTurns.length; i++) {
            const step = multiTurns[i];
            
            // Check for interruption before each agent speaks
            if (!isJarvisLoopActive || lastInterruptedUtterance) {
              console.log(`🛑 Squad conversation interrupted at turn ${i + 1}/${multiTurns.length}`);
              break;
            }
            
            console.log(`🎤 Turn ${i + 1}/${multiTurns.length}: ${step.agentName} speaking...`);
            
            // Update UI for current speaking agent
            if (overlayWindow && !overlayWindow.isDestroyed()) {
              overlayWindow.webContents.send('set-agent-name', step.agentName);
              overlayWindow.webContents.send('jarvis-speaking');
            }
            
            // Show notification
            showNotification(`🤖 ${step.agentName}`, step.text);
            
            // CRITICAL: Await speech completion before moving to next agent
            await jarvisManager.speak(step.text, step.voice);
            console.log(`✅ Turn ${i + 1}/${multiTurns.length}: ${step.agentName} finished speaking`);
            
            // Check for interruption after speech
            if (!isJarvisLoopActive || lastInterruptedUtterance) {
              console.log(`🛑 Squad conversation interrupted after turn ${i + 1}/${multiTurns.length}`);
              break;
            }
            
            // Brief pause between agents (140ms natural turn-taking delay)
            if (i < multiTurns.length - 1) {
              await new Promise(r => setTimeout(r, 140));
            }
            
            // Final interruption check before next iteration
            if (!isJarvisLoopActive || lastInterruptedUtterance) {
              console.log(`🛑 Squad conversation interrupted during pause after turn ${i + 1}/${multiTurns.length}`);
              break;
            }
          }
          
          console.log(`🏁 Squad conversation complete (${multiTurns.length} turns played)`);
        } else {
          // Single agent turn — clean text and voice extraction
          let singleSpeechText = jarvisReply;
          let singleVoice = speakingVoice;
          let agentDisplayName = speakingAgentName;
          if (multiTurns.length === 1) {
            singleSpeechText = multiTurns[0].text;
            singleVoice = multiTurns[0].voice;
            agentDisplayName = multiTurns[0].agentName;
            if (overlayWindow && !overlayWindow.isDestroyed()) {
              overlayWindow.webContents.send('set-agent-name', agentDisplayName);
            }
          }

          if (agentDisplayName !== 'Tuk Tuk') {
            singleSpeechText = singleSpeechText.replace(/\b(babe|sweetheart|honey|darling)\b/gi, 'bro');
          }

          showNotification(`🤖 ${agentDisplayName}`, singleSpeechText);

          if (actionResult && actionResult.isSinging) {
            await jarvisManager.sing(singleSpeechText, singleVoice);
          } else {
            await jarvisManager.speak(singleSpeechText, singleVoice);
          }
        }
      }

      // Save to history
      saveToHistory({
        id: Date.now(),
        text: jarvisReply,
        originalText: originalText,
        mode: 'jarvis',
        agent: activeAgent.name,
        timestamp: new Date().toISOString(),
        duration: recordingDuration
      });

      // Autonomous Self-Updating & Continuous Learning Memory (Team Shared Brain)
      jarvisManager.learnFromInteraction(originalText, jarvisReply, activeAgent.name, actionResult);
      if (originalText && originalText.trim().split(/\s+/).length >= 2) {
        setTimeout(() => {
          jarvisManager.consolidateDeepMemory(originalText, jarvisReply, callGroqChatCompletion).catch(() => {});
        }, 150);
      }

      // Acoustic-Prosodic Entrainment: Adapt agent speech rate dynamically to match user tempo
      const turnWordCount = originalText ? originalText.trim().split(/\s+/).length : 0;
      if (jarvisManager.prosodicEntrainment && recordingDuration && turnWordCount > 0) {
        jarvisManager.prosodicEntrainment.observeUserTurn(recordingDuration, turnWordCount);
      }

      // 24/7 Autonomous Behavior & Mode Engine Update (AWBE)
      if (jarvisManager.behaviorEngine) {
        const vibe = jarvisManager.prosodicEntrainment ? jarvisManager.prosodicEntrainment.currentVibe : null;
        jarvisManager.behaviorEngine.updateBehavior(originalText, recordingDuration, vibe);
      }

      // Clear processing and lock flags completely
      isProcessing = false;
      isStopRecordingLock = false;

      // If user aborted during speech with ESC
      if (!isJarvisLoopActive) {
        hideOverlay();
        return;
      }

      // Re-arm recording immediately for Hritthik's next turn on a 100% pristine mic buffer!
      if (isJarvisLoopActive) {
        lastInterruptedUtterance = null;
        jarvisSpeechDetected = false;
        jarvisSpeechStartTime = 0;
        jarvisLastSpeechTime = 0;
        jarvisSpeechFrames = 0;
        jarvisAutoStopTriggered = false;
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('jarvis-listening');
        }
        console.log('🎙️ Speech complete. Hands-free listening re-armed for Hritthik...');
        startRecording();
      } else {
        hideOverlay();
      }
      return;
    } else if (currentMode === 'rewrite') {
      console.log('🤖 AI rewriting...');
      finalText = await rewrite(originalText);
    } else {
      console.log('📝 Standard mode: applying normal grammar & punctuation fixes...');
      try {
        finalText = await applyGrammarFixes(originalText);
      } catch (error) {
        console.warn('Grammar fix failed, using original transcript:', error.message);
        finalText = originalText;
      }
    }

    if (!finalText || finalText.trim().length === 0) {
      throw new Error('No speech detected. Please try again.');
    }

    // If aborted via ESC while processing standard/rewrite, discard and do not paste
    if (isSessionAborted) {
      console.log('🛑 Session was aborted via ESC - discarding paste operation');
      isProcessing = false;
      isStopRecordingLock = false;
      hideOverlay();
      return;
    }

    // Notify overlay of completed text
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('live-done', finalText);
    }

    // Play success chime now that text is ready
    playSound('success');

    console.log(`✅ Final text: "${finalText.substring(0, 100)}${finalText.length > 100 ? '...' : ''}"`);

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

    // Replace live-typed words with polished final text using instant word selection (zero backspaces)
    const wordsToReplace = totalLiveWordsTyped;
    totalLiveWordsTyped = 0;
    liveWordsTyped = [];

    if (wordsToReplace > 0 && process.platform === 'darwin') {
      replaceLiveWordsWithFinal(wordsToReplace, finalText);
    } else {
      pasteTextRobust(finalText);
    }

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
      // Show error in overlay briefly, then hide
      overlayWindow.webContents.send('error', error.message);
      
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.hide();
        }
      }, 2000); // Show error for 2 seconds
    }
    
    // Show error notification
    showNotification('Recording Error', error.message);
  } finally {
    // Cleanup
    isProcessing = false;
    isStopRecordingLock = false;
    const fileToCleanup = targetAudioFile || sessionAudioFile;
    if (audioFile === fileToCleanup) {
      audioFile = null;
    }
    
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

  // Safeguard: Check 24MB limit (Groq Whisper ceiling is 25MB)
  if (stats.size > 24 * 1024 * 1024) {
    logApiRequest('whisper', 'error', Date.now() - transcriptionStart, null, 'Recording exceeds 24MB limit');
    throw new Error('Recording is too long (> 24MB). Please keep recordings under 10 minutes for fast dictation.');
  }

  // Dynamic resilient timeout: 14s for Jarvis turns (preventing premature 7s dropouts)
  const uploadTimeout = currentMode === 'jarvis' ? 14000 : Math.max(30000, Math.min(90000, Math.round((stats.size / 1000000) * 8000)));

  const FormData = require('form-data');
  const form = new FormData();
  
  form.append('file', fs.createReadStream(filePath), {
    filename: 'recording.wav',
    contentType: 'audio/wav'
  });
  
  // Whisper Large V3 Turbo transcription - Always Pure Professional English
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'en'); // Force English for all modes (Jarvis & Dictation)
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', 'Hritthik, Tuk Tuk, Andrew, Jenny, Brian, Eloquent, Antigravity, Electron, Go audio backend, IPC, API, bug, code refactor, latency, TypeScript, Node.js.');
  
  // High accuracy transcription
  try {
    let response;
    try {
      response = await axios.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${getActiveAPIKey()}`
          },
          httpsAgent: groqKeepAliveAgent,
          timeout: uploadTimeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: status => status < 500
        }
      );
    } catch (postErr) {
      response = { status: 500, data: { error: { message: postErr.message } } };
    }

    // Auto-recovery on 429 Rate Limit, 500 Error, or Network Timeout: rotate key and retry immediately
    if (response.status === 429 || response.status >= 500) {
      rotateToNextKey();
      console.warn(`⚠️ Whisper transcription hiccup (${response.status}: ${response.data?.error?.message || "timeout"}). Rotated API key and retrying in 400ms...`);
      await new Promise(r => setTimeout(r, 400));

      const retryForm = new FormData();
      retryForm.append('file', fs.createReadStream(filePath), {
        filename: 'recording.wav',
        contentType: 'audio/wav'
      });
      retryForm.append('model', 'whisper-large-v3-turbo');
      retryForm.append('language', 'en');
      retryForm.append('response_format', 'json');
      retryForm.append('temperature', '0');
      retryForm.append('prompt', 'Hello Tuk Tuk, Andrew, Jenny, Brian, let us talk.');

      try {
        response = await axios.post(
          'https://api.groq.com/openai/v1/audio/transcriptions',
          retryForm,
          {
            headers: {
              ...retryForm.getHeaders(),
              'Authorization': `Bearer ${getActiveAPIKey()}`
            },
            timeout: uploadTimeout,
            validateStatus: status => status < 500
          }
        );
      } catch (retryErr) {
        console.warn('⚠️ Whisper retry failed:', retryErr.message);
      }
    }

    const transcriptionTime = Date.now() - transcriptionStart;
    console.log(`⚡ Transcription completed in ${transcriptionTime}ms (status: ${response.status})`);

    // Fallback to live draft if API is unavailable
    if (response.status !== 200) {
      if (liveWordsTyped && liveWordsTyped.length > 0) {
        console.warn('⚠️ Whisper API returned error, safely falling back to live draft text!');
        return liveWordsTyped.join(' ');
      }
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

// Robust Groq Chat Completion with automatic model fallback
async function callGroqChatCompletion(messages, options = {}) {
  const candidateModels = [
    options.model,
    'qwen/qwen3.8-27b',
    'qwen/qwen3.6-27b',
    'groq/compound-mini'
  ].filter(Boolean);

  const uniqueModels = [...new Set(candidateModels)];
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: model,
          messages: messages,
          temperature: options.temperature !== undefined ? options.temperature : 0.3,
          max_tokens: options.max_tokens || 1500
        },
        {
          headers: { 'Authorization': `Bearer ${getActiveAPIKey()}` },
          httpsAgent: groqKeepAliveAgent,
          timeout: options.timeout || 4000,
          validateStatus: function (status) {
            return status < 500;
          }
        }
      );

      const rawChoice = response.data?.choices?.[0]?.message;
      let rawContent = (rawChoice?.content || rawChoice?.reasoning || '').trim();
      // Eliminate internal chain-of-thought tokens (<think>...</think>)
      rawContent = rawContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

      if (response.status === 200 && rawContent.length > 0) {
        return { content: rawContent, model: model, usage: response.data.usage };
      }

      if (response.status === 429) {
        const nextKey = rotateToNextKey();
        console.warn(`⚠️ Model ${model} rate-limited (429). Rotated to Key: ${nextKey ? nextKey.slice(0, 8) + '...' : 'none'}`);
        // Immediate retry with the fresh rotated key:
        try {
          const retryRes = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: model,
              messages: messages,
              temperature: options.temperature !== undefined ? options.temperature : 0.3,
              max_tokens: options.max_tokens || 1500
            },
            {
              headers: { 'Authorization': `Bearer ${nextKey}` },
              httpsAgent: groqKeepAliveAgent,
              timeout: options.timeout || 4000,
              validateStatus: (s) => s < 500
            }
          );
          const retryChoice = retryRes.data?.choices?.[0]?.message;
          let retryContent = (retryChoice?.content || retryChoice?.reasoning || '').trim();
          retryContent = retryContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
          if (retryRes.status === 200 && retryContent.length > 0) {
            return { content: retryContent, model: model, usage: retryRes.data.usage };
          }
        } catch (e) {}
      }
      lastError = new Error(response.data?.error?.message || `API error: ${response.status}`);
    } catch (err) {
      lastError = err;
    }
  }

  // High-Level Cognitive Failover: Engage Google Gemini Engine if Groq endpoints exhausted
  if (geminiClient && geminiClient.isConfigured()) {
    try {
      console.log('✨ [AI Failover] Groq models exhausted. Invoking Google Gemini High-Level Engine...');
      const geminiRes = await geminiClient.callChatCompletion(messages, options);
      if (geminiRes && geminiRes.content) {
        return {
          content: geminiRes.content,
          model: `gemini/${geminiRes.model}`,
          usage: geminiRes.usage
        };
      }
    } catch (geminiErr) {
      console.warn('⚠️ [AI Failover] Gemini fallback error:', geminiErr.message);
    }
  }

  throw lastError || new Error('All candidate AI models failed.');
}

async function rewrite(text) {
  const startTime = Date.now();
  console.log('🤖 Starting AI rewrite...');

  // Get the appropriate AI prompt based on mode
  const aiPrompt = AI_PROMPTS[CONFIG.aiMode] || AI_PROMPTS.auto;

  // Adjust temperature based on mode
  const creativeTemp = CONFIG.aiMode === 'auto' ? 0.4 : 0.3;

  try {
    const { content, model, usage } = await callGroqChatCompletion([
      {
        role: 'system',
        content: aiPrompt
      },
      { role: 'user', content: `Rewrite this: ${text}` }
    ], { temperature: creativeTemp, max_tokens: 1500 });

    const rewriteTime = Date.now() - startTime;
    console.log(`⚡ AI rewrite completed using ${model} in ${rewriteTime}ms`);

    // Track API usage
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('api-request', 'llama');
    }

    logApiRequest('ai-rewrite', 'success', rewriteTime, usage?.total_tokens);
    return content.trim();
  } catch (error) {
    const rewriteTime = Date.now() - startTime;
    console.error('❌ AI rewrite failed:', error.message);
    logApiRequest('ai-rewrite', 'error', rewriteTime, null, error.message);
    throw error;
  }
}

// Parse multi-party agent turns formatted as [Agent]: ... or Agent: ... for seamless podcast-style dialogue
// FIXED: Enforces strict sequential turn-taking - prevents simultaneous agent speech
function parseMultiAgentTurns(text) {
  if (!text || typeof text !== 'string') return [];
  
  const agentMap = {
    'tuk tuk': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
    'tuktuk': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
    'ava': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
    'andrew': { name: 'Andrew', voice: 'en-US-AndrewMultilingualNeural' },
    'jenny': { name: 'Jenny', voice: 'en-US-EmmaMultilingualNeural' },
    'brian': { name: 'Brian', voice: 'en-US-BrianMultilingualNeural' }
  };

  // Enhanced pattern: captures agent name markers with flexible formatting
  const pattern = /(?:^|\n)\s*\[?(Tuk\s*Tuk|Andrew|Jenny|Brian|Ava)\]?:?\s*([\s\S]*?)(?=(?:\n\s*\[?(?:Tuk\s*Tuk|Andrew|Jenny|Brian|Ava)\]?:?)|$)/gi;
  const turns = [];
  let match;
  
  // Extract all agent turns from the formatted text
  while ((match = pattern.exec(text)) !== null) {
    const rawName = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
    const agentInfo = agentMap[rawName] || { name: match[1], voice: 'en-US-AvaMultilingualNeural' };
    let speech = match[2].trim();
    
    // Clean up leading punctuation and whitespace
    speech = speech.replace(/^[,\s—–:-]+/, '').trim();
    
    if (speech.length > 0) {
      // Capitalize first letter
      speech = speech.charAt(0).toUpperCase() + speech.slice(1);
      
      // Sanitize romantic terms for non-Tuk Tuk agents
      if (agentInfo.name !== 'Tuk Tuk') {
        speech = speech.replace(/\b(babe|sweetheart|honey|darling)\b/gi, 'bro');
      }
      
      turns.push({
        agentName: agentInfo.name,
        voice: agentInfo.voice,
        text: speech,
        // Add explicit turn number to enforce sequencing
        turnIndex: turns.length
      });
    }
  }

  // CRITICAL FIX: Enforce maximum 2 agents per turn in team mode
  // This prevents AI from generating 3+ agent responses that cause simultaneous speech
  if (turns.length > 2) {
    console.warn(`⚠️ Multi-agent response contained ${turns.length} turns - limiting to first 2 for sequential playback`);
    return turns.slice(0, 2);
  }

  return turns;
}

// Conversational 4-Agent Team Executive Brain with Multi-Turn Memory
async function askJarvis(userSpeech, activeAgent = null, displaySpeech = null) {
  const startTime = Date.now();
  const agent = activeAgent || jarvisManager.agents.tuktuk;
  let systemPrompt = jarvisManager.getSystemPrompt(agent, displaySpeech || userSpeech);

  const visionCtx = screenShareManager.getVisionContext();
  if (visionCtx.isActive) {
    systemPrompt += `\n\n[LIVE SCREEN SHARE ACTIVE - REAL-TIME VISION FEED]:
- You are actively streaming Hritthik's live display (/tmp/eloquent_screenshare.jpg).
- Frontmost Focused Application: "${visionCtx.appName}".
- Window / Document Context: "${visionCtx.windowTitle || visionCtx.appName}".
- Screen Resolution: 1280px optimized (${visionCtx.frameSizeKB}KB).
- You can directly see his screen, active code, open interview, or browser. Talk to him as if you are standing right beside him looking at his monitor. Suggest code solutions, answer questions on his screen, and execute work!`;
  }


  try {
    console.log(`🧠 Querying ${agent.name} (${agent.role}) brain with multi-turn memory...`);
    const historyText = displaySpeech || userSpeech;
    jarvisManager.addTurn('user', historyText, 'user');

    // 8-turn window: 4 full conversational exchanges for podcast-grade continuity & zero repetition
    const historyMessages = jarvisManager.getHistory(8);
    // Sanitize message sequence: enforce strict role alternation (user -> assistant -> user)
    const rawHistory = historyMessages.slice(0, -1);
    const sanitizedHistory = [];
    for (const msg of rawHistory) {
      if (!msg.content || typeof msg.content !== 'string' || msg.content.trim().length === 0) continue;
      if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === msg.role) {
        sanitizedHistory[sanitizedHistory.length - 1].content += `\n${msg.content}`;
      } else {
        sanitizedHistory.push({ role: msg.role, content: msg.content.trim() });
      }
    }

    // Ensure alternating sequence: if history ends with user, pop it to avoid consecutive user turns
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
      sanitizedHistory.pop();
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory,
      { role: 'user', content: userSpeech }
    ];

    // Temperature tuning per persona: Tuk Tuk warmer/creative, Andrew precise, Jenny curious, Brian grounded
    const dynamicTemperature = agent.key === 'tuktuk' ? 0.78 : (agent.key === 'andrew' ? 0.38 : (agent.key === 'team' ? 0.72 : 0.60));
    
    // Ultra-Fast Voice Intelligence: Groq LPU Qwen 27B for sub-500ms conversational ping-pong
    // Deep Cognitive Fallback: Google Gemini 3.7 / 3.5 Pool for multimodal vision & high-level reasoning
    let content = null;
    let usage = null;
    let model = null;

    try {
      const groqRes = await callGroqChatCompletion(messages, {
        model: 'qwen/qwen3.8-27b',
        temperature: dynamicTemperature,
        max_tokens: agent.key === 'team' ? 400 : 150,
        timeout: 4000
      });
      if (groqRes && groqRes.content) {
        content = groqRes.content;
        usage = groqRes.usage;
        model = groqRes.model;
      }
    } catch (groqErr) {
      console.warn('⚠️ [Jarvis Groq] Fast failover to Google Gemini Pool:', groqErr.message);
    }

    if (!content && geminiClient && geminiClient.isConfigured()) {
      try {
        console.log(`✨ [Jarvis Cortex] Invoking Google Gemini Brain for ${agent.name}...`);
        const lowerSpeech = (displaySpeech || userSpeech).toLowerCase();
        const isVisualContextQuery = lowerSpeech.includes("screen") || lowerSpeech.includes("look at") || lowerSpeech.includes("what is this") || lowerSpeech.includes("this error") || lowerSpeech.includes("this code") || lowerSpeech.includes("line ");
        const framePath = (isVisualContextQuery && visionCtx.hasFrame) ? visionCtx.framePath : null;

        const geminiRes = await geminiClient.callChatCompletion(messages, {
          model: 'gemini-2.5-flash',
          temperature: dynamicTemperature,
          max_tokens: agent.key === 'team' ? 450 : 200,
          timeout: 5000,
          imagePath: framePath
        });
        if (geminiRes && geminiRes.content) {
          content = geminiRes.content;
          model = `gemini/${geminiRes.model}`;
          usage = geminiRes.usage;
        }
      } catch (geminiErr) {
        console.warn('⚠️ [Jarvis Gemini] Fallback error:', geminiErr.message);
      }
    }
    if (!content) {
      // All API keys exhausted — use persona-aware fallback
      const fallbacks = {
        tuktuk: `Hey babe, give me one sec — my brain hiccupped. I'm right here.`,
        andrew: `Bro, network dipped for a sec. Still right here, tell me what to build.`,
        jenny: `Hmm, lost connection for a moment. What were you saying?`,
        brian: `Systems dipped briefly. Still here bro, keep going.`,
        team: `[Tuk Tuk]: One sec babe, connection flickered.\n[Andrew]: Back now bro, keep going.`
      };
      const fallbackReply = fallbacks[agent.key] || `Hey, I'm right here. One sec.`;
      jarvisManager.addTurn('assistant', fallbackReply, agent.name);
      console.log(`⚡ [${agent.name}] using fallback (all APIs exhausted) in ${Date.now() - startTime}ms`);
      return fallbackReply;
    }

    let reply = content.trim();

    // ── ALIVE-HUMAN POST-PROCESSOR ──────────────────────────────────────────
    // 1. Strip agent name prefix echoes (e.g. "Tuk Tuk:", "[Tuk Tuk]:", ": ", "- ")
    reply = reply.replace(/^(?:\[?(?:Tuk\s*Tuk|Andrew|Jenny|Brian|Squad|Assistant)\]?:?\s*)+/i, '')
                 .replace(/^[:\s-]+/, '')
                 .trim();

    // 2. Strip robotic openers even if the model ignored the system prompt instruction.
    const roboticOpeners = [
      /^(Certainly|Sure|Of course|Absolutely|Great|Excellent|Indeed|Wonderful|Noted|Understood|Happy to|I'd be happy to|I would be happy to|I'm happy to|I am happy to|Allow me to|Let me help|Of course,|Sure,|Certainly,|Absolutely,|Great!|Sure!|Of course!|Certainly!|Absolutely!|No problem[,!]?|My pleasure[,!]?|Glad to help[,!]?)[\s,!]+/i,
      /^(As your (partner|co-founder|assistant|AI|engineer|researcher|DevOps|guardian)[,\s]+)/i,
      /^(That('s| is) (a )?(great|good|wonderful|excellent|interesting|fascinating) (question|point|observation|idea)[,!.]+\s*)/i,
    ];
    for (const pattern of roboticOpeners) {
      reply = reply.replace(pattern, '');
    }
    // Clean up any remaining leading punctuation from stripped openers (e.g. "—", ":", ",")
    reply = reply.replace(/^[,\s—–:-]+/, '').trim();
    if (reply.length > 0) {
      reply = reply.charAt(0).toUpperCase() + reply.slice(1);
    }

    // 3. Strip repetitive generic chatbot trailing questions
    const genericTrailerQuestions = [
      /\s*(?:what('s| is) on your mind(?:\s+right now|\s+today)?\??|how (?:is|are) you feeling(?:\s+right now|\s+today)?\??|how('s| is) (?:your\s+focus|the\s+energy)(?:\s+holding\s+up|\s+feeling)?\??|what are we tackling(?:\s+next|\s+right now|\s+today)?\??|what do you want to (?:work on|build|code|tackle)(?:\s+next|\s+today)?\??|what('s| is) on your agenda(?:\s+today)?\??|what('s| is) going on in that brilliant head of yours\??)$/i
    ];
    for (const qPattern of genericTrailerQuestions) {
      reply = reply.replace(qPattern, '.');
    }
    reply = reply.replace(/\.\.+/g, '.').replace(/\s+/g, ' ').trim();

    // 4. Hard cap at 30 words for spoken delivery — short punchy girlfriend voice messages
    // (Team/squad mode gets 50 words since 2 agents speak)
    const wordCap = agent.key === 'team' ? 50 : 30;
    const words = reply.split(/\s+/);
    if (words.length > wordCap) {
      reply = words.slice(0, wordCap).join(' ');
      const lastPunct = Math.max(reply.lastIndexOf('.'), reply.lastIndexOf('?'), reply.lastIndexOf('!'));
      if (lastPunct > reply.length * 0.55) {
        reply = reply.slice(0, lastPunct + 1);
      }
    }
    reply = reply.trim();

    // Guaranteed non-empty fallback per agent persona
    if (!reply || reply.length < 2) {
      const fallbacks = {
        tuktuk: `Right here babe. What are we doing?`,
        andrew: `On it bro. Talk to me.`,
        jenny: `Wait — tell me more about that.`,
        brian: `Right here. What do you need?`,
        team: `[Tuk Tuk]: We are on it.\n[Andrew]: Tell us what to tackle first.`
      };
      reply = fallbacks[agent.key] || `Right here. Let's go.`;
    }
    // ────────────────────────────────────────────────────────────────────────

    jarvisManager.addTurn('assistant', reply, agent.name);

    // Autonomous Self-Updating & Ebbinghaus Learning from Everyday Tasks and Talks
    try {
      jarvisManager.learnFromInteraction(displaySpeech || userSpeech, reply, agent.name);
      jarvisManager.consolidateDeepMemory(displaySpeech || userSpeech, reply, callGroqChatCompletion);
    } catch (learnErr) {}

    const elapsed = Date.now() - startTime;
    console.log(`⚡ [${agent.name}] responded in ${elapsed}ms using ${model} (${reply.split(/\s+/).length} words)`);
    logApiRequest('jarvis-talk', 'success', elapsed, usage?.total_tokens);

    return reply;
  } catch (error) {
    console.error(`❌ [${agent.name}] AI query failed:`, error.message);
    logApiRequest('jarvis-talk', 'error', Date.now() - startTime, null, error.message);
    // Persona-aware error fallbacks that still sound alive
    if (agent.key === 'andrew') return `Bro, still right here — network hiccup. Tell me what to build.`;
    if (agent.key === 'jenny') return `Hmm, lost connection for a sec. What were you saying?`;
    if (agent.key === 'brian') return `Systems dipped for a moment. Still here bro, keep going.`;
    return `Hey, I'm right here. One sec — what did you need?`;
  }
}

// Post-process transcription to fix common recognition errors
function postProcessTranscription(text) {
  if (!text || typeof text !== 'string') return text;

  text = text.trim().replace(/\s+/g, ' ');

  const corrections = {
    'doop-took': 'Tuk Tuk',
    'doop took': 'Tuk Tuk',
    'dooptook': 'Tuk Tuk',
    'dup took': 'Tuk Tuk',
    'duptook': 'Tuk Tuk',
    'dook took': 'Tuk Tuk',
    'dooktook': 'Tuk Tuk',
    'tuk-tuk': 'Tuk Tuk',
    'tuktuk': 'Tuk Tuk',
    'tuk tuk': 'Tuk Tuk',
    'Tuktuk': 'Tuk Tuk',
    'tok tok': 'Tuk Tuk',
    'took took': 'Tuk Tuk',
    'tok-tok': 'Tuk Tuk',
    'took-took': 'Tuk Tuk',
    'tik tik': 'Tuk Tuk',
    'tik-tik': 'Tuk Tuk',
    'eva': 'Tuk Tuk',
    'Eva': 'Tuk Tuk',
    'ava': 'Tuk Tuk',
    'Ava': 'Tuk Tuk',
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
    ' ,': ',',
    ' .': '.',
    ' ?': '?',
    ' !': '!',
    ' ;': ';',
    ' :': ':',
    '( ': '(',
    ' )': ')'
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
  
  const grammarPrompt = `You are an executive-grade, next-generation voice-to-text AI writing engine (similar to Wispr Flow, Superwhisper, and Grammarly).

YOUR MISSION:
Transform spoken thoughts into pristine, fluent, highly articulate, and professional English prose while remaining 100% faithful to the speaker's true intent, ideas, and meaning.

CORE GUIDELINES:
1. GRAMMAR & SYNTACTIC FLUENCY:
   - Fix broken grammar, non-native phrasing, awkward word orders, and missing prepositions (e.g., "listen in my full voice" → "listen to all my voice", "is not captured outer sound" → "does not capture outer sounds", "its fully production" → "it is a fully production-grade").
   - Fix speech-to-text phonetic acoustic mishearings based on sentence context (e.g., "right code" → "write code", "light dictation" → "live dictation").

2. PROFESSIONAL FORMATTING & PUNCTUATION:
   - Add natural, rhythmic punctuation (commas, periods, semicolons, em-dashes where appropriate).
   - Expressive punctuation: reflect questions with '?', emphasis with '!', and commands authoritatively.
   - Format numbers, currencies, dates, abbreviations, and technical terms cleanly (e.g., "five dollars" → "$5", "ten AM" → "10:00 AM", "ai" → "AI").

3. STRIP SPOKEN ARTIFACTS:
   - Remove conversational stutters, repeated words (e.g., "hello hello" → "hello"), false starts, and filler words ("um", "uh", "like", "you know").

4. RESPECT CORE INTENT & SPECIALIZED WORDS:
   - Do NOT omit technical terminology, product names, code identifiers, or key thoughts.
   - Deliver the most polished, executive version of what the speaker meant to write.

5. OUTPUT RULE:
   - Return ONLY the finalized, polished text. No explanations, no prefixes, no quotation marks.`;


  try {
    const { content, model, usage } = await callGroqChatCompletion([
      {
        role: 'system',
        content: grammarPrompt
      },
      { role: 'user', content: text }
    ], { model: 'qwen/qwen3.8-27b', temperature: 0.2, max_tokens: 1000, timeout: 5000 });

    const fixTime = Date.now() - startTime;
    console.log(`⚡ Grammar fixes applied using ${model} in ${fixTime}ms`);

    // Track API usage
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('api-request', 'llama');
    }
    
    // Log API request for admin panel
    logApiRequest('llama-grammar', 'success', fixTime, usage?.total_tokens);

    return content.trim();
  } catch (error) {
    const fixTime = Date.now() - startTime;
    console.warn('⚠️ Grammar fix failed, applying fallback capitalization:', error.message);
    logApiRequest('llama-grammar', 'error', fixTime, null, error.message);
    let fallback = (text || '').trim();
    if (fallback.length > 0) {
      fallback = fallback.charAt(0).toUpperCase() + fallback.slice(1);
      if (!/[.!?]$/.test(fallback)) fallback += '.';
    }
    return fallback;
  }
}



// ENHANCED: Smart auto-paste system with multiple fallback methods
function pasteTextRobust(text) {
  console.log(`📋 Pasting text: ${text.length} characters`);

  // Use cross-platform paste helper
  pasteHelper.pasteText(text, {
    preserveClipboard: CONFIG.preserveClipboard,
    showNotification: true,
    fallbackToClipboard: true
  }).then((success) => {
    if (success) {
      showNotification('✅ Text Pasted', 'Text inserted automatically');
    } else {
      const pasteKey = process.platform === 'darwin' ? 'Cmd+V' : 'Ctrl+V';
      showNotification('📋 Press ' + pasteKey + ' to Paste', 'Text is in clipboard');
    }
  }).catch((error) => {
    console.error('❌ Paste error:', error);
    const pasteKey = process.platform === 'darwin' ? 'Cmd+V' : 'Ctrl+V';
    showNotification('📋 Press ' + pasteKey, 'Auto-paste failed, text in clipboard');
  });
}

// Show system notification with better UX
function showNotification(title, body, silent = true) {
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: title,
        body: body,
        silent: silent, // Prevent system audio chime from bleeding into microphone
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

// Admin configuration persistence (debounced & async for 0ms event loop blocking)
let adminConfigSaveTimer = null;
function saveAdminConfigToFile() {
  if (adminConfigSaveTimer) return;
  adminConfigSaveTimer = setTimeout(() => {
    adminConfigSaveTimer = null;
    try {
      const adminConfigFile = path.join(app.getPath('userData'), 'admin-config.json');
      ADMIN_CONFIG.geminiApiKey = (geminiClient && typeof geminiClient.getApiKey === 'function') ? geminiClient.getApiKey() : '';
      fs.writeFile(adminConfigFile, JSON.stringify(ADMIN_CONFIG, null, 2), (err) => {
        if (err) console.error('❌ Error saving admin config async:', err.message);
      });
    } catch (error) {
      console.error('❌ Error saving admin config:', error);
    }
  }, 1000);
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
      if (savedAdminConfig.geminiApiKey) {
        ADMIN_CONFIG.geminiApiKey = savedAdminConfig.geminiApiKey;
        CONFIG.geminiApiKey = savedAdminConfig.geminiApiKey;
        geminiClient.setApiKey(savedAdminConfig.geminiApiKey);
      }
      if (savedAdminConfig.dailyLimit) ADMIN_CONFIG.dailyLimit = savedAdminConfig.dailyLimit;
      if (savedAdminConfig.rateLimitPerUser) ADMIN_CONFIG.rateLimitPerUser = savedAdminConfig.rateLimitPerUser;
      if (savedAdminConfig.users) ADMIN_CONFIG.users = savedAdminConfig.users;
      if (savedAdminConfig.apiRequests) ADMIN_CONFIG.apiRequests = savedAdminConfig.apiRequests;
      
      // Update main CONFIG with master API key
      if (ADMIN_CONFIG.masterApiKey) {
        CONFIG.apiKeys[0] = ADMIN_CONFIG.masterApiKey;
      }
      
      console.log(`🔑 Loaded admin config with ${ADMIN_CONFIG.users.length} users and Gemini Key configured: ${geminiClient.isConfigured()}`);
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

// Ultra-fast memory-cached & non-blocking history management
let cachedHistoryMemory = null;
function saveToHistory(entry) {
  if (!entry || !entry.text || !entry.id) return;
  const historyFile = path.join(app.getPath('userData'), 'history.json');

  if (!cachedHistoryMemory) {
    try {
      if (fs.existsSync(historyFile)) {
        cachedHistoryMemory = JSON.parse(fs.readFileSync(historyFile, 'utf8')) || [];
      } else {
        cachedHistoryMemory = [];
      }
    } catch (e) {
      cachedHistoryMemory = [];
    }
  }

  cachedHistoryMemory.unshift(entry);
  if (cachedHistoryMemory.length > 100) {
    cachedHistoryMemory = cachedHistoryMemory.slice(0, 100);
  }

  // Non-blocking async write to disk
  fs.writeFile(historyFile, JSON.stringify(cachedHistoryMemory, null, 2), (err) => {
    if (err) console.error('❌ Async history save warning:', err.message);
  });
    
  // Notify dashboard immediately
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('history-updated', cachedHistoryMemory);
    dashboardWindow.webContents.send('history-data', cachedHistoryMemory);
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
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    playSound('cancel'); // Play cancel sound when canceling
    overlayWindow.hide();
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
      backgroundColor: '#0f172a',
      show: false,
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

    loginWindow.once('ready-to-show', () => {
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
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  subscriptionWindow.loadFile('src/ui/subscription.html');

  subscriptionWindow.once('ready-to-show', () => {
    subscriptionWindow.show();
  });

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
        timeout: 10000, // Increased timeout for slow connections
        validateStatus: (status) => status >= 200 && status < 600
      });
      
      console.log(`   ✅ Health check response: ${response.status}`, response.data);
      
      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      console.error('   ❌ Health check failed:', error.message);
      
      // More specific error handling
      let status = 500;
      if (error.code === 'ECONNREFUSED') status = 503;
      else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') status = 504;
      else if (error.code === 'ENOTFOUND') status = 503;
      
      return {
        success: false,
        status: status,
        error: error.message,
        code: error.code
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
  
  let startTime = Date.now();
  
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
      timeout: 30000, // Increased to 30s to match frontend timeout
      validateStatus: function (status) {
        // Accept any status code to handle it properly
        return status >= 200 && status < 600;
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    console.log(`   ✅ Response: ${response.status} (${duration}ms)`);
    
    const success = response.status >= 200 && response.status < 300;
    const result = {
      success,
      status: response.status,
      data: response.data
    };

    if (!success && response.data && response.data.error) {
      result.error = response.data.error;
    }
    
    // Log the request
    logApiRequest('admin-backend', success ? 'success' : 'error', duration, null, result.error);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('   ❌ Backend request failed:', error.message);
    
    // Log the error
    logApiRequest('admin-backend', 'error', duration, null, error.message);
    
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

// Register Libboard prompt generation IPC channel
try {
  registerLibboardIpcHandlers(ipcMain, app.getPath('userData'));
} catch (libboardErr) {
  console.warn('⚠️ Could not register Libboard IPC handlers:', libboardErr.message);
}

// Register secure bidirectional Clipboard IPC channels
try {
  registerClipboardHandlers(ipcMain);
} catch (clipboardErr) {
  console.warn('⚠️ Could not register Clipboard IPC handlers:', clipboardErr.message);
}

// Conversational StateManager IPC handlers with atomic persistence and broadcast
let persistentStateManager = null;
try {
  persistentStateManager = StateManager.getInstance(app.getPath('userData'), {
    broadcaster: {
      broadcast: (channel, data) => {
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send(channel, data);
          }
        });
      }
    }
  });

  ipcMain.handle('state-request', async () => {
    return persistentStateManager.loadState();
  });

  ipcMain.handle('state-commit', async (_event, payload) => {
    if (payload && payload.contextBuffer && payload.contextBuffer.length > 0) {
      const latestTurn = payload.contextBuffer[payload.contextBuffer.length - 1];
      persistentStateManager.updateTurn(latestTurn);
    } else {
      persistentStateManager.saveState();
    }
    return { success: true, state: persistentStateManager.currentState };
  });

  console.log('✅ [StateManager] Registered state-request and state-commit IPC handlers');
} catch (stateErr) {
  console.warn('⚠️ Could not register StateManager IPC handlers:', stateErr.message);
}

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