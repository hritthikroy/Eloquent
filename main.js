// ELOQUENT ELECTRON - VOICE DICTATION APP

// Load environment variables
require('dotenv').config();

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog, Notification, screen, shell } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const AI_PROMPTS = require('./ai-prompts');
const performanceMonitor = require('./performance-monitor');
const authService = require('./auth-service');

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
let loginWindow = null;
let subscriptionWindow = null;

let tray = null;
let recording = null;
let audioFile = null;
let recordingProcess = null;
let currentMode = 'standard';
let isAuthenticated = false;
let processingOAuth = false; // Flag to prevent duplicate OAuth processing
let lastProcessedOAuthUrl = null; // Track last processed URL

// Application configuration
const CONFIG = {
  apiKeys: [
    '', // API Key 1 - Managed by admin
    '', // API Key 2 (optional)
    '', // API Key 3 (optional)
    '', // API Key 4 (optional)
    ''  // API Key 5 (optional)
  ],
  language: 'en',
  customDictionary: '',
  aiMode: 'auto',
  preserveClipboard: false,
  autoGrammarFix: true,
  autoPasteMode: 'direct'
};

// Admin configuration
const ADMIN_CONFIG = {
  masterApiKey: '',
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
  console.log('🚀 App is ready, starting initialization...');

  // Register custom protocol for OAuth callbacks
  if (!app.isDefaultProtocolClient('eloquent')) {
    app.setAsDefaultProtocolClient('eloquent');
  }

  // Load saved configuration first
  console.log('📁 Loading saved configuration...');
  // Functions will be called after they are defined

  // Initialize auth service
  console.log('🔐 Initializing authentication...');
  authService.init();
  
  // Check for existing authentication
  const authResult = await authService.validateSession();
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
    console.log('📝 No valid authentication found');
    isAuthenticated = false;
  }

  // Request permissions
  console.log('🔐 Checking microphone permission...');
  await requestMicrophonePermission();

  console.log('🔐 Checking accessibility permission...');
  checkAccessibilityPermission();

  // Then create UI
  console.log('🎛️ Creating tray...');
  createTray();

  console.log('⌨️ Registering shortcuts...');
  registerShortcuts();

  console.log('✅ Eloquent is ready! Look for the microphone icon in your menu bar.');
  console.log('🎤 Press Alt+Space to start recording, Esc to stop');

  // Show authentication status and require login
  if (isAuthenticated) {
    const subscription = authService.getSubscription();
    const usage = authService.getUsage();
    console.log(`👤 Logged in as: ${authResult.user?.email}`);
    console.log(`📊 Plan: ${subscription?.plan || 'free'}`);
    if (usage) {
      console.log(`⏱️ Usage: ${usage.currentMonth}/${usage.limit === -1 ? '∞' : usage.limit} minutes`);
    }
  } else {
    // REQUIRE SIGN-IN - show login window on startup
    console.log('🔒 Sign-in required - opening login window');
    setTimeout(() => {
      createLoginWindow();
    }, 500);
  }

});

function createTray() {
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
  const subscription = authService.getSubscription();
  const usage = authService.getUsage();
  const plan = subscription?.plan || 'free';

  const menuTemplate = [
    { label: '🎤 Eloquent Voice Dictation', enabled: false },
    { type: 'separator' },
  ];

  // Auth section
  if (isAuthenticated && user) {
    menuTemplate.push(
      { label: `👤 ${user.email}`, enabled: false },
      { label: `📊 Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)}`, enabled: false }
    );
    if (usage && usage.limit !== -1) {
      const remaining = usage.limit - usage.currentMonth;
      menuTemplate.push({ label: `⏱️ ${remaining} min remaining`, enabled: false });
    }
    menuTemplate.push(
      { type: 'separator' },
      { label: 'Open Dashboard', click: () => createDashboard() }
    );

    // Only show subscription management for non-admin users
    if (!authService.isAdmin()) {
      menuTemplate.push(
        { label: plan === 'free' ? '⭐ Upgrade to Pro' : 'Manage Subscription', click: () => createSubscriptionWindow() }
      );
    }
  } else {
    menuTemplate.push(
      { label: '🔑 Sign In / Sign Up', click: () => createLoginWindow() },
      { label: 'Open Dashboard', click: () => createDashboard() }
    );
  }

  // Only show admin panel for admin users
  if (isAuthenticated && authService.isAdmin()) {
    menuTemplate.push(
      { label: 'Admin Panel', click: () => createAdminPanel() },
      { type: 'separator' }
    );
  } else {
    menuTemplate.push({ type: 'separator' });
  }

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
    },
    { type: 'separator' },
    {
      label: CONFIG.autoPasteMode === 'direct' ? '🎯 Auto-Paste Mode: ON (Direct)' : '📋 Auto-Paste Mode: OFF (Clipboard Only)',
      enabled: false
    },
    {
      label: systemPreferences.isTrustedAccessibilityClient(false) ? '✅ Auto-paste enabled' : '🔧 Enable auto-paste',
      click: () => {
        if (!systemPreferences.isTrustedAccessibilityClient(false)) {
          promptAccessibilityPermission();
        }
      }
    },
    { type: 'separator' },
    { label: '💡 Tip: Press Esc to stop recording', enabled: false },
    { type: 'separator' },
    { label: 'Settings', click: () => createDashboard() }
  );

  // Logout option if authenticated
  if (isAuthenticated) {
    menuTemplate.push({
      label: '🚪 Sign Out',
      click: () => {
        authService.logout();
        isAuthenticated = false;
        createTray(); // Refresh menu
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
  } else {
    console.error('❌ Tray not created - icon will not be visible');
  }
}

// Enhanced sound system with better audio feedback
function playSound(type) {
  const sounds = {
    start: '/System/Library/Sounds/Tink.aiff',
    success: '/System/Library/Sounds/Glass.aiff',
    error: '/System/Library/Sounds/Basso.aiff',
    cancel: '/System/Library/Sounds/Funk.aiff',
    notification: '/System/Library/Sounds/Ping.aiff'
  };

  const soundFile = sounds[type] || sounds.notification;

  // Play sound with volume control (70% volume for better UX)
  exec(`afplay "${soundFile}" -v 0.7`, (error) => {
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
      overlayWindow.webContents.send('status', 'Stopping...');
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
  const escapeRegistered = globalShortcut.register('Escape', () => {
    handleShortcut('stop');
  });

  // Backup shortcuts for reliability
  const escapeBackup = globalShortcut.register('Cmd+Escape', () => {
    handleShortcut('stop');
  });

  // Cmd+Shift+A - Open Admin Panel (fallback if tray not visible)
  const adminRegistered = globalShortcut.register('Cmd+Shift+A', () => {
    console.log('🔧 Cmd+Shift+A pressed - opening admin panel');
    createAdminPanel();
  });

  // Cmd+Shift+D - Open Dashboard (fallback if tray not visible)
  const dashboardRegistered = globalShortcut.register('Cmd+Shift+D', () => {
    console.log('📊 Cmd+Shift+D pressed - opening dashboard');
    createDashboard();
  });



  console.log('✅ Shortcuts registered:');
  console.log(`   Alt+Shift+Space (AI Rewrite): ${rewriteRegistered ? 'OK' : 'FAILED'}`);
  console.log(`   Alt+Space (Standard): ${standardRegistered ? 'OK' : 'FAILED'}`);
  console.log(`   Escape (Stop): ${escapeRegistered ? 'OK' : 'FAILED'}`);
  
  if (!rewriteRegistered || !standardRegistered || !escapeRegistered) {
    console.error('❌ Some shortcuts failed to register');
  }
}



// Overlay creation
function createOverlayUltraFast(mode = 'standard') {
  currentMode = mode;

  if (!isAuthenticated) {
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
  
  overlayWindow = new BrowserWindow({
    width: 280,
    height: 50,
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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      offscreen: false,
      preload: false,
      enableRemoteModule: false,
      experimentalFeatures: false
    }
  });
  
  overlayWindow.recordingStartTime = Date.now();

  overlayWindow.loadFile('overlay.html');
  
  const cursorPosition = screen.getCursorScreenPoint();
  const windowBounds = overlayWindow.getBounds();
  
  const x = cursorPosition.x - (windowBounds.width / 2);
  const y = cursorPosition.y - windowBounds.height - 20;
  
  const display = screen.getDisplayNearestPoint(cursorPosition);
  const screenBounds = display.workArea;
  
  const finalX = Math.max(screenBounds.x, Math.min(x, screenBounds.x + screenBounds.width - windowBounds.width));
  const finalY = Math.max(screenBounds.y, Math.min(y, screenBounds.y + screenBounds.height - windowBounds.height));
  
  overlayWindow.setPosition(Math.round(finalX), Math.round(finalY));
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'floating', 1);

  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('set-mode', mode);
    overlayWindow.show();
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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  dashboardWindow.loadFile('dashboard.html');

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}



function createAdminPanel() {
  // Check if user is authenticated and has admin role
  if (!isAuthenticated) {
    console.log('🚫 Admin panel access denied: User not authenticated');
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Access Denied',
      message: 'You must be logged in to access the admin panel.',
      buttons: ['OK']
    });
    return;
  }

  if (!authService.isAdmin()) {
    console.log('🚫 Admin panel access denied: User is not an admin');
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Access Denied',
      message: 'You do not have permission to access the admin panel.',
      buttons: ['OK']
    });
    return;
  }

  if (adminWindow) {
    adminWindow.focus();
    return;
  }

  console.log('✅ Admin panel access granted for:', authService.getUser()?.email);

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

  adminWindow.loadFile('admin.html');

  adminWindow.on('closed', () => {
    adminWindow = null;
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

  playSound('start');
  performanceMonitor.measureRecordingLatency();
  recordingProcess = spawn('rec', [
    '-r', '16000',
    '-c', '1',
    '-b', '16',
    '-t', 'wav',
    audioFile,
    'highpass', '80',
    'lowpass', '8000',
    'compand', '0.02,0.20', '-60,-60,-30,-15,-20,-10,-5,-8,0,-7', '-3', '-90', '0.1',
    'trim', '0'
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

// FIXED: Simplified and reliable stopRecording function
async function stopRecording() {
  if (isProcessing) {
    console.log('⚠️ Already processing recording');
    return;
  }

  isProcessing = true;
  console.log('🛑 Stopping recording...');
  
  // Calculate recording duration
  const recordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;

  // Stop recording process
  if (recordingProcess) {
    recordingProcess.kill('SIGINT');
    recordingProcess = null;
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('status', 'Processing...');
  }

  // Wait for file to be written - reduced from 500ms to 200ms
  await new Promise(r => setTimeout(r, 200));

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

    // Save to history BEFORE closing overlay
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

    // CRITICAL FIX: Close overlay FIRST so focus returns to target app
    // Then paste after a short delay to ensure focus has switched
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
    }
    
    // Wait for focus to return to the original app, then paste
    setTimeout(() => {
      pasteTextRobust(finalText);
      playSound('success');
    }, 200);

    // Track API usage
    if (apiKey && apiKey.trim() !== '') {
      trackAPIUsage(recordingDuration);
    }

  } catch (error) {
    console.error('❌ Recording failed:', error.message);

    playSound('error');
    
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('error', error.message);
      // Close error overlay faster - reduced from 2000ms to 800ms
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.close();
          overlayWindow = null;
        }
      }, 800);
    }
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

// Transcription function
async function transcribe(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Audio file not found');
  }

  const stats = fs.statSync(filePath);
  if (stats.size < 5000) {
    throw new Error('Recording too short. Please speak for at least 1 second.');
  }

  const FormData = require('form-data');
  const form = new FormData();
  
  form.append('file', fs.createReadStream(filePath), {
    filename: 'recording.wav',
    contentType: 'audio/wav'
  });
  
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', CONFIG.language);
  form.append('response_format', 'text');
  form.append('temperature', '0');

  const response = await axios.post(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${getActiveAPIKey()}`
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
  );

  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('api-request', 'whisper');
  }
  
  logApiRequest('whisper', 'success', Date.now() - recordingStartTime);

  let text = response.data;
  if (typeof text !== 'string') {
    text = text.text || '';
  }

  text = postProcessTranscription(text.trim());
  if (!text) {
    throw new Error('No speech detected. Please try again.');
  }

  return text;
}

async function rewrite(text) {
  const startTime = Date.now();
  
  // Get the appropriate AI prompt based on mode
  const aiPrompt = AI_PROMPTS[CONFIG.aiMode] || AI_PROMPTS.qn;
  
  // Adjust temperature based on mode
  const creativeTemp = CONFIG.aiMode === 'auto' ? 0.4 : 0.3;

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
      temperature: creativeTemp,  // Dynamic temp for better rewriting
      max_tokens: 1500  // More room for expanded content
    },
    {
      headers: { 'Authorization': `Bearer ${getActiveAPIKey()}` },
      timeout: 30000
    }
  );

  // Track API usage
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('api-request', 'llama');
  }
  
  // Log API request for admin panel
  logApiRequest('llama-rewrite', 'success', Date.now() - startTime, response.data.usage?.total_tokens);

  return response.data.choices[0].message.content;
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
      timeout: 30000
    }
  );

  // Track API usage
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('api-request', 'llama');
  }
  
  // Log API request for admin panel
  logApiRequest('llama-grammar', 'success', Date.now() - startTime, response.data.usage?.total_tokens);

  return response.data.choices[0].message.content;
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

  // Check if we have Accessibility permission FIRST
  const hasAccessibility = systemPreferences.isTrustedAccessibilityClient(false);
  
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
      
      // Merge saved config with defaults
      if (savedConfig.apiKeys) CONFIG.apiKeys = savedConfig.apiKeys;
      if (savedConfig.language) CONFIG.language = savedConfig.language;
      if (savedConfig.aiMode) CONFIG.aiMode = savedConfig.aiMode;
      if (savedConfig.preserveClipboard !== undefined) CONFIG.preserveClipboard = savedConfig.preserveClipboard;
      if (savedConfig.autoGrammarFix !== undefined) CONFIG.autoGrammarFix = savedConfig.autoGrammarFix;

      if (savedConfig.customDictionary) CONFIG.customDictionary = savedConfig.customDictionary;
      
      const validKeys = CONFIG.apiKeys.filter(k => k && k.trim()).length;
      console.log(`🔑 Loaded ${validKeys} API keys from saved config`);
    } else {
      console.log('📋 No saved config found, using defaults');
    }
  } catch (error) {
    console.error('❌ Error loading config:', error);
    console.log('📋 Using default configuration');
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
          contextIsolation: true
        }
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
  // Refresh tray menu to show logged-in state
  createTray();
  // Open dashboard
  createDashboard();
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
    const token = authService.token;
    const response = await axios.post(
      `${authService.baseURL}/api/subscriptions/create-checkout`,
      { plan, interval },
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
  const user = authService.getUser();
  event.reply('auth-status', {
    isAuthenticated: authService.isAuthenticated(),
    user: user
  });
});

ipcMain.on('initiate-google-signin', async (event) => {
  console.log('🔐 Initiating Google Sign-in');
  try {
    const result = await authService.signInWithGoogle();
    if (result.success) {
      // Open the OAuth URL in the default browser
      shell.openExternal(result.url);
    }
  } catch (error) {
    console.error('Google Sign-in error:', error);
  }
});

ipcMain.on('sign-out', async (event) => {
  console.log('👋 Signing out user');
  try {
    await authService.logout();
    isAuthenticated = false;
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

ipcMain.on('subscribe-to-plan', async (event, planType) => {
  console.log('💰 Subscribing to plan:', planType);
  try {
    if (!authService.isAuthenticated()) {
      // Redirect to sign-in first
      event.reply('auth-status', {
        isAuthenticated: false,
        user: null
      });
      return;
    }
    
    // Open subscription page in browser
    const subscriptionUrl = `${authService.baseURL.replace('/api', '')}/subscribe?plan=${planType}`;
    shell.openExternal(subscriptionUrl);
  } catch (error) {
    console.error('Subscription error:', error);
  }
});

ipcMain.on('manage-subscription', async (event) => {
  console.log('⚙️ Opening subscription management');
  try {
    if (!authService.isAuthenticated()) {
      event.reply('auth-status', {
        isAuthenticated: false,
        user: null
      });
      return;
    }
    
    // Open billing portal
    await authService.openBillingPortal();
  } catch (error) {
    console.error('Manage subscription error:', error);
    // Fallback to opening account page
    const accountUrl = `${authService.baseURL.replace('/api', '')}/account`;
    shell.openExternal(accountUrl);
  }
});

// ============================================
// LOGIN WINDOW
// ============================================

function createLoginWindow() {
  if (loginWindow) {
    loginWindow.focus();
    return;
  }

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

  loginWindow.loadFile('login.html');

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
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

  subscriptionWindow.loadFile('subscription.html');

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
  return isAuthenticated && authService.isAdmin();
});

ipcMain.handle('admin-get-config', async () => {
  if (!isAuthenticated || !authService.isAdmin()) {
    throw new Error('Access denied: Admin privileges required');
  }
  return {
    masterApiKey: ADMIN_CONFIG.masterApiKey || '',
    dailyLimit: ADMIN_CONFIG.dailyLimit || 1000,
    rateLimitPerUser: ADMIN_CONFIG.rateLimitPerUser || 100
  };
});

ipcMain.handle('admin-save-config', async (event, newAdminConfig) => {
  if (!isAuthenticated || !authService.isAdmin()) {
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
  if (!isAuthenticated || !authService.isAdmin()) {
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
  if (!isAuthenticated || !authService.isAdmin()) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  return ADMIN_CONFIG.users.map(user => ({
    ...user,
    requestCount: ADMIN_CONFIG.apiRequests.filter(req => req.userId === user.id).length
  }));
});

ipcMain.handle('admin-add-user', async (event, userData) => {
  if (!isAuthenticated || !authService.isAdmin()) {
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
  if (!isAuthenticated || !authService.isAdmin()) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  ADMIN_CONFIG.users = ADMIN_CONFIG.users.filter(user => user.id !== userId);
  // Also remove user's API requests
  ADMIN_CONFIG.apiRequests = ADMIN_CONFIG.apiRequests.filter(req => req.userId !== userId);
  saveAdminConfigToFile();
  
  return { success: true };
});

ipcMain.handle('admin-get-requests', async () => {
  if (!isAuthenticated || !authService.isAdmin()) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  return ADMIN_CONFIG.apiRequests
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100); // Return last 100 requests
});

ipcMain.handle('admin-clear-logs', async () => {
  if (!isAuthenticated || !authService.isAdmin()) {
    throw new Error('Access denied: Admin privileges required');
  }
  
  ADMIN_CONFIG.apiRequests = [];
  saveAdminConfigToFile();
  
  return { success: true };
});

// Function to log API requests
function logApiRequest(type, status, duration, tokens = null, userId = null) {
  const request = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    type,
    status,
    duration,
    tokens,
    userId,
    userEmail: userId ? ADMIN_CONFIG.users.find(u => u.id === userId)?.email : 'Anonymous'
  };
  
  ADMIN_CONFIG.apiRequests.push(request);
  
  // Keep only last 1000 requests to prevent memory issues
  if (ADMIN_CONFIG.apiRequests.length > 1000) {
    ADMIN_CONFIG.apiRequests = ADMIN_CONFIG.apiRequests.slice(-1000);
  }
  
  // Save periodically (every 10 requests)
  if (ADMIN_CONFIG.apiRequests.length % 10 === 0) {
    saveAdminConfigToFile();
  }
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Keep app running in menu bar
});

// Handle custom protocol for OAuth callbacks
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

// Handle protocol URL
async function handleProtocolUrl(url) {
  console.log('📱 Received protocol URL:', url);
  
  // Prevent duplicate processing of the same OAuth URL
  if (processingOAuth || lastProcessedOAuthUrl === url) {
    console.log('⚠️ OAuth already being processed or duplicate URL, ignoring');
    return;
  }
  
  if (url.startsWith('eloquent://auth/callback') || url.startsWith('eloquent://auth/success')) {
    processingOAuth = true;
    lastProcessedOAuthUrl = url;
    try {
      let accessToken, refreshToken;
      
      // Handle new format: eloquent://auth/success?data={...}
      if (url.includes('eloquent://auth/success?data=')) {
        const dataParam = url.split('?data=')[1];
        const authData = JSON.parse(decodeURIComponent(dataParam));
        accessToken = authData.access_token;
        refreshToken = authData.refresh_token;
        console.log('🔑 Parsed tokens from JSON data');
      } else {
        // Handle old format: eloquent://auth/callback#access_token=...
        const urlObj = new URL(url);
        const fragment = urlObj.hash ? urlObj.hash.substring(1) : urlObj.search.substring(1);
        const params = new URLSearchParams(fragment);
        accessToken = params.get('access_token');
        refreshToken = params.get('refresh_token');
        console.log('🔑 Parsed tokens from URL parameters');
      }
      
      if (accessToken) {
        console.log('🔑 Processing OAuth tokens...');
        
        // Handle the OAuth callback
        const result = await authService.handleOAuthCallback({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (result.success) {
          console.log('✅ OAuth authentication successful');
          isAuthenticated = true;
          
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
          
          // Show success notification
          showNotification('✅ Sign In Successful', `Welcome back, ${result.user?.email || 'User'}!`);
          
          // Open dashboard
          createDashboard();
          
          // Resolve OAuth promise if waiting
          if (globalOAuthResolver) {
            globalOAuthResolver(result);
          }
        } else {
          console.error('❌ OAuth authentication failed:', result.error);
          showNotification('❌ Sign In Failed', result.error || 'Authentication failed');
          
          // Resolve OAuth promise with error
          if (globalOAuthResolver) {
            globalOAuthResolver(result);
          }
        }
      } else {
        console.error('❌ No access token in OAuth callback');
        showNotification('❌ Sign In Failed', 'No access token received');
      }
    } catch (error) {
      console.error('❌ Error handling OAuth callback:', error);
      showNotification('❌ Sign In Failed', 'Error processing authentication');
    }
  }
}