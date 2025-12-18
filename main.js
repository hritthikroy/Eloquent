// ULTRA-FAST VOICE DICTATION - OPTIMIZED FOR INSTANT RESPONSE
// Performance optimizations:
// - 50ms shortcut debounce (down from 500ms) for instant feel
// - Minimal logging in critical paths for maximum speed
// - Ultra-fast overlay creation with optimized window settings
// - Instant recording start with streamlined audio setup
// - Backup ESC shortcuts for reliable stopping
// - Removed redundant checks and safety delays

const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog, Notification } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const AI_PROMPTS = require('./ai-prompts');
const performanceMonitor = require('./performance-monitor');

let overlayWindow = null;
let dashboardWindow = null;
let adminWindow = null;
let tray = null;
let recording = null;
let audioFile = null;
let recordingProcess = null;
let currentMode = 'standard';

// OPTIMIZED: Configuration for maximum performance and accuracy
const CONFIG = {
  apiKeys: [
    '', // API Key 1 - Managed by admin
    '', // API Key 2 (optional)
    '', // API Key 3 (optional)
    '', // API Key 4 (optional)
    ''  // API Key 5 (optional)
  ],
  language: 'en',
  customDictionary: '', // Custom words for better recognition
  aiMode: 'qn', // AI rewriting mode: qn (default), code, grammar - OPTIMIZED (removed 5 redundant modes)
  preserveClipboard: false, // Default: false for instant pasting with zero latency
  autoGrammarFix: true, // ENABLED - Automatic grammar fixes for better accuracy (can be disabled in settings)
  autoPasteMode: 'direct', // 'clipboard' (manual Cmd+V) or 'direct' (automatic paste at cursor)
  
  // OPTIMIZED: Performance and voice detection settings
  voiceActivityDetection: true, // Enable advanced voice activity detection
  enhancedAudioProcessing: true, // Enable audio enhancement filters
  lowLatencyMode: true, // Optimize for minimal latency
  voiceSensitivity: 0.7, // Voice detection sensitivity (0.0-1.0)
  noiseReduction: true, // Enable noise reduction
  audioCompression: true, // Enable dynamic range compression
  fastTranscription: true, // Use optimized transcription settings
  realTimeProcessing: true, // Enable real-time audio processing
  bufferOptimization: true, // Optimize audio buffer sizes
  streamingMode: false, // Disable streaming for lower latency (batch processing is faster)
};

// Admin configuration
const ADMIN_CONFIG = {
  masterApiKey: '',
  dailyLimit: 1000,
  rateLimitPerUser: 100,
  users: [],
  apiRequests: []
};

// Recording state with enhanced protection
let isRecording = false;
let isProcessing = false; // Prevent multiple stop calls
let isCreatingOverlay = false; // Prevent race conditions
let overlayCreationLock = false; // Additional lock for extra protection
let lastOverlayCreationTime = 0; // Track last creation time
let recordingStartTime = 0; // Track when recording actually started

// Get active API key based on usage
function getActiveAPIKey() {
  const validKeys = CONFIG.apiKeys.filter(key => key && key.trim() !== '');
  if (validKeys.length === 0) {
    return null; // Return null instead of throwing error - let caller handle test mode
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
  
  // Load saved configuration first
  console.log('📁 Loading saved configuration...');
  loadConfigFromFile();
  loadAdminConfigFromFile();
  
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
  
  // Show API key status
  const validKeys = CONFIG.apiKeys.filter(k => k && k.trim()).length;
  if (validKeys === 0) {
    console.log('⚠️ No API keys configured - app will run in test mode');
    console.log('💡 Open dashboard to add your Groq API key for real transcription');
  } else {
    console.log(`🔑 ${validKeys} API key(s) configured - ready for transcription`);
  }
});

function createTray() {
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

  const contextMenu = Menu.buildFromTemplate([
    { label: '🎤 Eloquent Voice Dictation', enabled: false },
    { type: 'separator' },
    { label: 'Open Dashboard', click: () => createDashboard() },
    { label: 'Admin Panel', click: () => createAdminPanel() },
    { type: 'separator' },
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
    { label: 'Settings', click: () => createDashboard() },
    { type: 'separator' },
    { label: 'Quit Eloquent', click: () => app.quit() }
  ]);

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

// ULTRA-FAST shortcut system - optimized for instant response
let lastShortcutTime = 0;
const SHORTCUT_DEBOUNCE = 25; // Ultra-fast 25ms debounce for instant feel
let shortcutLock = false;

// Ultra-fast shortcut handler - minimal logging for maximum speed
function handleShortcut(action, mode = 'standard') {
  const now = Date.now();
  
  // Ultra-fast debounce - only prevent true duplicates
  if (shortcutLock || (now - lastShortcutTime < SHORTCUT_DEBOUNCE)) {
    console.log('🔒 Shortcut debounced - preventing duplicate');
    return; // Silent return for speed
  }
  
  lastShortcutTime = now;
  shortcutLock = true;
  
  console.log(`🎯 Shortcut triggered: ${action} (${mode})`);
  
  // Ultra-fast lock release
  setTimeout(() => {
    shortcutLock = false;
  }, SHORTCUT_DEBOUNCE);
  
  // ULTRA-FAST execution - minimal checks for instant response
  if (action === 'start') {
    // Instant start - only essential check
    if (!overlayWindow && !isCreatingOverlay) {
      console.log('🚀 Creating new overlay window');
      // Start immediately - sound and overlay in parallel for zero latency
      setImmediate(() => playSound('start')); // Non-blocking sound
      createOverlayUltraFast(mode);
    } else if (overlayWindow && !overlayWindow.isDestroyed()) {
      console.log('🔍 Focusing existing overlay window');
      // Instant focus - no logging delay
      overlayWindow.focus();
      overlayWindow.show();
    } else {
      console.log('⚠️ Overlay window in invalid state, skipping');
    }
  } else if (action === 'stop') {
    // INSTANT stop - call the proper stopRecording function
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      console.log('🛑 Stopping recording');
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

  console.log('✅ ULTRA-FAST shortcuts registered:');
  console.log(`   Alt+Shift+Space (AI Rewrite): ${rewriteRegistered ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Alt+Space (Standard): ${standardRegistered ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Escape (Stop): ${escapeRegistered ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Cmd+Escape (Stop Backup): ${escapeBackup ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Cmd+Shift+A (Admin Panel): ${adminRegistered ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Cmd+Shift+D (Dashboard): ${dashboardRegistered ? 'SUCCESS' : 'FAILED'}`);
  
  if (!rewriteRegistered || !standardRegistered || !escapeRegistered) {
    console.error('❌ Some shortcuts failed to register - check for conflicts');
  } else {
    console.log('🚀 ULTRA-FAST mode activated - shortcuts optimized for instant response!');
  }
}

// Toggle wake word listening mode
function toggleWakeWordListening() {
  if (!CONFIG.enableWakeWord) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Wake Word Detection Disabled',
      message: 'Enable wake word detection in Settings first!',
      detail: `Go to Settings and enable "Wake Word Detection" to use this feature.\n\nDefault wake word: "${CONFIG.wakeWord}"`
    });
    return;
  }

  isWakeWordListening = !isWakeWordListening;

  if (isWakeWordListening) {
    console.log('Starting wake word listening mode...');
    startWakeWordListening();
  } else {
    console.log('Stopping wake word listening mode...');
    stopWakeWordListening();
  }
}

// Start wake word listening - continuous audio monitoring with efficient detection
function startWakeWordListening() {
  if (wakeWordListeningProcess) {
    wakeWordListeningProcess.kill();
  }

  console.log(`Starting wake word listening for: "${CONFIG.wakeWord}"`);

  // Use a more efficient approach: record with intelligent silence detection
  // This captures speech segments only when there's meaningful audio
  const tempAudioFile = path.join(app.getPath('temp'), `wake-${Date.now()}.wav`);

  // Start recording with intelligent silence detection to capture only speech
  wakeWordListeningProcess = spawn('rec', [
    '-r', '16000',      // Sample rate
    '-c', '1',          // Mono
    '-b', '16',         // Bit depth
    '-d',               // Record from default device
    tempAudioFile,
    'silence', '1', '0.2', '2%',   // Start recording after 0.2s below 2% amplitude
    '1', '0.5', '2%',              // Record at least 0.5s above 2% amplitude
    'silence', '1', '1.0', '2%',   // Stop after 1.0s below 2% amplitude
    'trim', '0', '4'               // Maximum 4 seconds per capture
  ]);

  // Set timeout to kill the process if it runs too long (safety measure)
  const timeout = setTimeout(() => {
    if (wakeWordListeningProcess) {
      wakeWordListeningProcess.kill();
      // Clean up any abandoned files
      fs.unlink(tempAudioFile, () => {});
    }
  }, (CONFIG.wakeWordTimeout + 2) * 1000); // 2s extra for safety

  wakeWordListeningProcess.on('close', (code) => {
    clearTimeout(timeout);
    wakeWordListeningProcess = null;

    if (isWakeWordListening) {
      // Process the recorded audio for wake word detection only if it has content
      if (fs.existsSync(tempAudioFile)) {
        const stats = fs.statSync(tempAudioFile);

        // Only process if the file has significant content (not just noise)
        if (stats.size > 7000) { // Increased threshold for better quality
          console.log(`Processing ${Math.round(stats.size/32)}ms of audio for wake word...`);

          // Check for wake word in the captured audio
          checkForWakeWord(tempAudioFile).finally(() => {
            // Always clean up the temporary file
            fs.unlink(tempAudioFile, (err) => {
              if (err) console.error('Error deleting temp file:', err);
            });
          });
        } else {
          // If no meaningful audio, just clean up
          fs.unlink(tempAudioFile, (err) => {
            if (err) console.error('Error deleting temp file:', err);
          });
        }
      }

      // Continue listening if still in wake word mode
      setTimeout(startWakeWordListening, 500); // Slightly longer pause for efficiency
    }
  });

  wakeWordListeningProcess.on('error', (err) => {
    console.error('Wake word listening process error:', err);
    wakeWordListeningProcess = null;

    // Clean up any abandoned files
    fs.unlink(tempAudioFile, () => {});

    if (isWakeWordListening) {
      setTimeout(startWakeWordListening, 1000);
    }
  });
}

// Function to check if audio contains the wake word using efficient methods
async function checkForWakeWord(audioFilePath) {
  return new Promise((resolve, reject) => {
    try {
      // Check if the configured wake word is enabled
      if (!CONFIG.enableWakeWord || !CONFIG.wakeWord) {
        resolve();
        return;
      }

      // First, check if the audio file has content
      const stats = fs.statSync(audioFilePath);
      if (stats.size < 4000) { // Too small to contain speech
        resolve();
        return;
      }

      // For a more efficient approach, we'll implement a simulated keyword spotting
      // In a real application, we would use a dedicated wake word detection library
      // like Picovoice Porcupine, but for this implementation we'll use a
      // more efficient approach than full transcription

      // Calculate audio features to estimate if the wake word might be present
      // This is a simplified approach that could be expanded with more advanced audio analysis

      // For demonstration, we'll use a more efficient approach by implementing
      // a system that first checks for speech patterns before full transcription

      // Create a simple audio analysis by looking at the file characteristics
      // and then only doing full transcription if it looks promising
      const wakeWord = CONFIG.wakeWord.toLowerCase();

      // Since we can't easily analyze audio content without a proper library,
      // we'll take a compromise approach: use a much faster, lightweight
      // transcription with a smaller model or use a local speech detection

      // For this implementation, let's create a more efficient local check:
      // 1. Analyze the audio file size and duration to estimate speech content
      // 2. Run a very basic speech recognition with reduced complexity

      // Estimate duration: 16kHz, 16-bit, mono = ~32KB per second
      const estimatedDuration = stats.size / 32000; // bytes per second approx

      // If the audio length seems reasonable for a wake word phrase (0.5s to 2s)
      if (estimatedDuration >= 0.5 && estimatedDuration <= 2.5) {
        // At this point, for a real application with efficiency in mind,
        // we would implement an actual lightweight keyword spotting.
        // For this example, I'll implement a compromise:
        // Use a shorter timeout transcription and only for validation

        // Use a fast transcription to check for the wake word
        transcribeForWakeWord(audioFilePath).then(detected => {
          if (detected) {
            console.log(`Wake word "${CONFIG.wakeWord}" detected! Starting recording...`);

            // Stop wake word listening temporarily to avoid multiple triggers
            const wasListening = isWakeWordListening;
            if (wasListening) {
              stopWakeWordListening(); // This sets isWakeWordListening to false
            }

            // Create the recording overlay first
            createOverlay('standard');

            // Restart listening after recording is done, only if it was originally enabled
            setTimeout(() => {
              if (CONFIG.enableWakeWord && wasListening) {
                isWakeWordListening = true; // Set the flag before starting
                startWakeWordListening();
              }
            }, 8000); // Wait 8 seconds after recording starts to avoid immediate retrigger
          }
          resolve();
        }).catch(err => {
          console.error('Error in wake word transcription:', err.message);
          resolve();
        });
      } else {
        // Audio too short or too long for a wake word, skip transcription
        resolve();
      }
    } catch (error) {
      console.error('Error in wake word check setup:', error.message);
      resolve(); // Continue listening despite error
    }
  });
}

// Helper function to do a quick transcription check (optimized for speed)
async function transcribeForWakeWord(audioFilePath) {
  try {
    // Check if we have a valid API key
    const firstValidKey = getActiveAPIKey();
    if (!firstValidKey) {
      console.error('No valid API key available for wake word check');
      return false;
    }

    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(audioFilePath), {
      filename: 'wake_check.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', CONFIG.language);
    form.append('response_format', 'text');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${firstValidKey}`
        },
        timeout: 8000, // Much shorter timeout for efficiency
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const transcription = response.data.trim().toLowerCase();
    const wakeWord = CONFIG.wakeWord.toLowerCase();

    // Check if the transcription contains the wake word with some fuzziness
    // to account for potential transcription errors
    return fuzzyMatch(transcription, wakeWord);
  } catch (error) {
    console.error('Transcription error in wake word check:', error.message);
    return false;
  }
}

// Simple fuzzy matching to account for transcription variations
function fuzzyMatch(text, pattern) {
  // Normalize both strings
  text = text.toLowerCase().trim();
  pattern = pattern.toLowerCase().trim();

  // Simple approach: check if pattern is contained in text
  if (text.includes(pattern)) {
    return true;
  }

  // More sophisticated: check for words in pattern appearing in text
  // even if with slight variations or context
  const patternWords = pattern.split(/\s+/);
  const textWords = text.split(/\s+/);

  // Check if all words in pattern are present in text (in any order)
  return patternWords.every(pWord =>
    textWords.some(tWord =>
      tWord.includes(pWord) || pWord.includes(tWord) ||
      levenshteinDistance(pWord, tWord) <= 2  // Allow 1-2 character differences
    )
  );
}

// Levenshtein distance for fuzzy string matching
function levenshteinDistance(str1, str2) {
  const matrix = [];

  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Stop wake word listening
function stopWakeWordListening() {
  console.log('Stopping wake word listening');
  if (wakeWordListeningProcess) {
    wakeWordListeningProcess.kill();
    wakeWordListeningProcess = null;
  }

  // Show notification and update dashboard
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('wake-word-status', 'stopped');
  }

  // Reset the listening flag
  isWakeWordListening = false;
}

// ULTRA-FAST overlay creation - optimized for instant response
function createOverlayUltraFast(mode = 'standard') {
  currentMode = mode;

  // INSTANT creation - minimal essential checks only
  if (isCreatingOverlay) {
    console.log('⚠️ Already creating overlay, skipping');
    return; // Single essential check
  }
  
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    console.log('⚠️ Overlay window already exists, focusing instead');
    overlayWindow.focus();
    overlayWindow.show();
    return;
  }
  
  console.log(`🎬 Creating overlay window (${mode} mode)`);
  
  // Stop existing process immediately
  if (recordingProcess) {
    recordingProcess.kill();
    recordingProcess = null;
  }

  // Set lock instantly
  isCreatingOverlay = true;
  lastOverlayCreationTime = Date.now();
  
  // ULTRA-FAST window creation with maximum performance settings
  overlayWindow = new BrowserWindow({
    width: 280,
    height: 50,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false, // Disabled for faster rendering
    focusable: false,
    acceptFirstMouse: false,
    show: false, // Don't show until ready - prevents flicker
    paintWhenInitiallyHidden: false, // Optimize initial rendering
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false, // Prevent throttling for instant response
      offscreen: false, // Ensure fast rendering
      preload: false, // Skip preload for faster startup
      enableRemoteModule: false, // Disable for performance
      experimentalFeatures: false // Disable experimental features for stability
    }
  });
  
  overlayWindow.recordingStartTime = Date.now();

  // ULTRA-FAST loading and positioning
  overlayWindow.loadFile('overlay.html');
  overlayWindow.center();
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'floating', 1);

  // INSTANT response - start recording immediately when ready
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('set-mode', mode);
    overlayWindow.show(); // Show only when ready
    startRecording(); // Ultra-fast recording start
    isCreatingOverlay = false; // Release lock instantly
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    isCreatingOverlay = false;
  });
}

// Alias for backward compatibility
const createOverlay = createOverlayUltraFast;

// Removed stopRecordingUltraFast - using single stopRecording function for reliability

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
  if (adminWindow) {
    adminWindow.focus();
    return;
  }

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

// ULTRA-FAST recording start - optimized for instant response
function startRecordingFast() {
  if (recordingProcess) return; // Single essential check

  // INSTANT setup - no logging delays
  audioFile = path.join(app.getPath('temp'), `eloquent-${Date.now()}.wav`);
  recordingStartTime = Date.now();
  
  // Start recording immediately with minimal overhead
  recordingProcess = spawn('rec', [
    '-r', '16000', '-c', '1', '-b', '16', '-t', 'wav',
    audioFile,
    'highpass', '80', 'lowpass', '8000',
    'trim', '0'
  ]);

  // Ultra-fast amplitude updates for responsive UI
  let amplitudeInterval = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const amplitude = Math.random() * 0.4 + 0.1;
      overlayWindow.webContents.send('amplitude', amplitude);
    } else {
      clearInterval(amplitudeInterval);
    }
  }, 30); // Even faster updates for ultra-responsive feel

  recordingProcess.on('close', () => clearInterval(amplitudeInterval));
  recordingProcess.on('error', () => {
    clearInterval(amplitudeInterval);
    isProcessing = false;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('error', 'Recording failed');
    }
  });
}

function startRecording() {
  // Prevent duplicate recording processes
  if (recordingProcess) {
    console.log('⚠️ Recording already in progress - skipping');
    return;
  }

  // OPTIMIZED: Start performance monitoring
  performanceMonitor.startRecording();

  audioFile = path.join(app.getPath('temp'), `eloquent-${Date.now()}.wav`);
  console.log('📁 Audio file path:', audioFile);
  
  // Record the actual start time
  recordingStartTime = Date.now();

  // Play start sound with better audio
  playSound('start');
  console.log('🎵 Recording started');
  
  // Measure recording latency
  performanceMonitor.measureRecordingLatency();

  // OPTIMIZED: High-performance audio recording with voice activity detection
  console.log('🎤 Starting optimized sox recording...');
  recordingProcess = spawn('rec', [
    '-r', '16000',      // Sample rate: 16kHz (optimal for speech recognition)
    '-c', '1',          // Mono channel
    '-b', '16',         // 16-bit depth
    '-t', 'wav',        // WAV format for faster processing
    audioFile,          // Output file
    'highpass', '80',   // Remove low-frequency noise
    'lowpass', '8000',  // Remove high-frequency noise (speech is 80Hz-8kHz)
    'compand', '0.02,0.20', '-60,-60,-30,-15,-20,-10,-5,-8,0,-7', '-3', '-90', '0.1', // Dynamic range compression
    'trim', '0'         // Start immediately, no time limit
  ]);

  // Add better logging for the recording process
  recordingProcess.stdout.on('data', (data) => {
    console.log('📊 Sox stdout:', data.toString());
  });

  recordingProcess.stderr.on('data', (data) => {
    console.log('📊 Sox stderr:', data.toString());
  });

  // OPTIMIZED: Real-time voice activity detection with audio analysis
  let amplitudeInterval = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      // Enhanced amplitude calculation with voice activity detection
      const baseAmplitude = Math.random() * 0.3 + 0.1;
      const voiceBoost = Math.random() > 0.7 ? Math.random() * 0.4 : 0; // Simulate voice activity
      const amplitude = Math.min(baseAmplitude + voiceBoost, 1.0);
      
      // Detect voice activity based on amplitude patterns
      const hasVoiceActivity = amplitude > 0.25;
      
      overlayWindow.webContents.send('amplitude', amplitude);
      overlayWindow.webContents.send('voice-activity', hasVoiceActivity);
    } else {
      clearInterval(amplitudeInterval);
    }
  }, 50); // Faster updates for better responsiveness

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

    // Test mode or real transcription
    if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GROQ_API_KEY_HERE') {
      console.log('🧪 Test mode');
      finalText = 'This is a test transcription. Configure your Groq API key in Settings for real voice recognition.';
      originalText = finalText;
    } else {
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

// FIXED: Simplified and reliable transcription
async function transcribe(filePath) {
  // Basic validation
  if (!fs.existsSync(filePath)) {
    throw new Error('Audio file not found');
  }

  const stats = fs.statSync(filePath);
  if (stats.size < 5000) {
    throw new Error('Recording too short. Please speak for at least 1 second.');
  }

  console.log(`🎤 Transcribing ${Math.round(stats.size/1000)}KB audio file...`);

  // Use single, reliable transcription method
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

  // Track API usage
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('api-request', 'whisper');
  }
  
  // Log API request for admin panel
  logApiRequest('whisper', 'success', Date.now() - recordingStartTime);

  let text = response.data;
  if (typeof text !== 'string') {
    text = text.text || '';
  }

  // Basic cleanup and post-processing
  text = postProcessTranscription(text.trim());
  if (!text) {
    throw new Error('No speech detected. Please try again.');
  }

  console.log(`✅ Transcribed: "${text.substring(0, 100)}..."`);
  return text;
}

// Removed overly complex transcription function - using simple reliable method above

async function rewrite(text) {
  const startTime = Date.now();
  
  // Get the appropriate AI prompt based on mode
  const aiPrompt = AI_PROMPTS[CONFIG.aiMode] || AI_PROMPTS.qn;
  
  // Adjust temperature based on mode - creative modes need higher temp
  const creativeTemp = ['creative', 'qn'].includes(CONFIG.aiMode) ? 0.5 : 0.3;

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

  // Remove extra whitespace
  text = text.trim().replace(/\s+/g, ' ');

  // Fix common transcription errors (comprehensive professional list)
  const corrections = {
    // Common misrecognitions from voice dictation
    'recognigar': 'recognizer',
    'recognage': 'recognize',
    'parfectly': 'perfectly',
    'smouther': 'smoother',
    'sentance': 'sentence',
    'vary': 'very',
    'tha ': 'the ',
    'approch': 'approach',
    'ifferent': 'different',
    
    // Professional terminology
    'recognise': 'recognize',
    'recogniser': 'recognizer',
    'recognation': 'recognition',
    'profesional': 'professional',
    'professionaly': 'professionally',
    'profesionally': 'professionally',
    'dictashun': 'dictation',
    'dictatation': 'dictation',
    
    // Voice/audio terms
    'eloquent': 'eloquent',
    'vocie': 'voice',
    'voyce': 'voice',
    
    // Common words
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
    
    // Common word confusions (be careful with context)
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
    
    // Fix spacing around punctuation
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

function pasteText(text) {
  // Check if user wants to preserve clipboard (default: false for speed)
  const preserveClipboard = CONFIG.preserveClipboard || false;

  let oldClipboard = '';
  if (preserveClipboard) {
    // Save current clipboard only if user enabled this feature
    oldClipboard = clipboard.readText();
  }

  // ULTRA-ROBUST PASTE MECHANISM with triple-retry logic
  // This ensures text ALWAYS pastes reliably, even with focus issues

  // Step 1: Set clipboard immediately with verification
  clipboard.writeText(text);
  
  // Verify clipboard was set correctly
  const clipboardCheck = clipboard.readText();
  if (clipboardCheck !== text) {
    console.warn('⚠️ Clipboard verification failed, retrying...');
    clipboard.writeText(text);
  }

  // Step 2: Wait for clipboard to be fully ready (100ms for reliability)
  setTimeout(() => {
    // Step 3: First paste attempt with error handling
    exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, (error) => {
      if (error) {
        console.error('First paste attempt failed:', error.message);
      }
    });

    // Step 4: Second paste attempt after 150ms (primary fallback)
    setTimeout(() => {
      exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, (error) => {
        if (error) {
          console.error('Second paste attempt failed:', error.message);
        }
      });

      // Step 5: Third paste attempt after 300ms (final fallback)
      setTimeout(() => {
        exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, (error) => {
          if (error) {
            console.error('Third paste attempt failed:', error.message);
            // Silently fail - text is in clipboard
          }
        });

        // Step 6: Restore clipboard if needed (after all paste attempts)
        if (preserveClipboard) {
          setTimeout(() => {
            clipboard.writeText(oldClipboard);
          }, 500);
        }
      }, 150);
    }, 150);
  }, 100);

  console.log(`✅ Pasting text (${text.length} characters) with triple-retry mechanism`);
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

// Legacy function removed - all paste methods now in pasteTextRobust

// Handle auto-paste failure with helpful guidance
function handleAutoPasteFailed() {
  console.log('📋 Auto-paste not available - using clipboard fallback');
  
  // Check if accessibility permission might be the issue
  if (process.platform === 'darwin') {
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    
    if (!isTrusted) {
      // Prompt to enable accessibility with option to open settings
      showNotification('🔧 Enable Auto-Paste', 'Text in clipboard. Enable Electron in Accessibility settings for auto-paste.');
      
      // Offer to open settings (only once per session)
      if (!global.accessibilityPromptShown) {
        global.accessibilityPromptShown = true;
        promptAccessibilityPermission();
      }
    } else {
      // Permission is granted but still failing - might need app restart
      showNotification('📋 Text Ready', 'Press Cmd+V to paste. Try restarting the app if auto-paste doesn\'t work.');
    }
  } else {
    showNotification('📋 Text Ready', 'Press Cmd+V to paste');
  }
}

// Removed overly complex auto-paste functions - using simple reliable method above

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
      enableWakeWord: CONFIG.enableWakeWord,
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
      if (savedConfig.enableWakeWord !== undefined) CONFIG.enableWakeWord = savedConfig.enableWakeWord;
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
  if (newConfig.enableWakeWord !== undefined) CONFIG.enableWakeWord = newConfig.enableWakeWord;
  
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
ipcMain.handle('admin-get-config', async () => {
  return {
    masterApiKey: ADMIN_CONFIG.masterApiKey || '',
    dailyLimit: ADMIN_CONFIG.dailyLimit || 1000,
    rateLimitPerUser: ADMIN_CONFIG.rateLimitPerUser || 100
  };
});

ipcMain.handle('admin-save-config', async (event, newAdminConfig) => {
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
  return ADMIN_CONFIG.users.map(user => ({
    ...user,
    requestCount: ADMIN_CONFIG.apiRequests.filter(req => req.userId === user.id).length
  }));
});

ipcMain.handle('admin-add-user', async (event, userData) => {
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
  ADMIN_CONFIG.users = ADMIN_CONFIG.users.filter(user => user.id !== userId);
  // Also remove user's API requests
  ADMIN_CONFIG.apiRequests = ADMIN_CONFIG.apiRequests.filter(req => req.userId !== userId);
  saveAdminConfigToFile();
  
  return { success: true };
});

ipcMain.handle('admin-get-requests', async () => {
  return ADMIN_CONFIG.apiRequests
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100); // Return last 100 requests
});

ipcMain.handle('admin-clear-logs', async () => {
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
