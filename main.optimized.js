const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog, Notification, screen } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const AI_PROMPTS = require('./ai-prompts');

let overlayWindow = null;
let dashboardWindow = null;
let adminWindow = null;
let tray = null;
let recording = null;
let audioFile = null;
let recordingProcess = null;
let currentMode = 'standard';

const CONFIG = {
  apiKeys: ['', '', '', '', ''],
  language: 'en',
  customDictionary: '',
  aiMode: 'qn',
  preserveClipboard: false,
  autoGrammarFix: true,
  autoPasteMode: 'direct',
  voiceActivityDetection: true,
  enhancedAudioProcessing: true,
  lowLatencyMode: true,
  voiceSensitivity: 0.7,
  noiseReduction: true,
  audioCompression: true,
  fastTranscription: true,
  realTimeProcessing: true,
  bufferOptimization: true,
  streamingMode: false,
};

const ADMIN_CONFIG = {
  masterApiKey: '',
  dailyLimit: 1000,
  rateLimitPerUser: 100,
  users: [],
  apiRequests: []
};

let isRecording = false;
let isProcessing = false;
let isCreatingOverlay = false;
let overlayCreationLock = false;
let lastOverlayCreationTime = 0;
let recordingStartTime = 0;

function getActiveAPIKey() {
  const validKeys = CONFIG.apiKeys.filter(key => key && key.trim() !== '');
  if (validKeys.length === 0) return null;

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

  if (usageData.date !== today) {
    const newUsage = {
      date: today,
      keys: validKeys.map(key => ({ key, timeUsed: 0 }))
    };
    fs.writeFileSync(usageFile, JSON.stringify(newUsage, null, 2));
    return validKeys[0];
  }

  const MAX_TIME_PER_KEY = 40 * 60;
  for (const keyData of usageData.keys || []) {
    if (validKeys.includes(keyData.key) && keyData.timeUsed < MAX_TIME_PER_KEY) {
      return keyData.key;
    }
  }

  return validKeys[0];
}

function trackAPIUsage(duration) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const usageFile = path.join(app.getPath('userData'), 'api-usage.json');

    let usageData = { date: today, keys: [] };
    if (fs.existsSync(usageFile)) {
      usageData = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    }

    if (usageData.date !== today) {
      const validKeys = CONFIG.apiKeys.filter(key => key && key.trim() !== '');
      usageData = {
        date: today,
        keys: validKeys.map(key => ({ key, timeUsed: 0 }))
      };
    }

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

    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('usage-updated', usageData);
    }
  } catch (error) {
    console.error('Error tracking API usage:', error);
  }
}

if (app.dock) app.dock.hide();

async function requestMicrophonePermission() {
  if (process.platform !== 'darwin') return true;

  try {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    if (micStatus === 'granted') return true;

    if (micStatus === 'not-determined') {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      if (granted) return true;
    }

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
      exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
    }
    
    app.quit();
    return false;

  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
}

function checkAccessibilityPermission() {
  if (process.platform !== 'darwin') return;

  let isTrusted = false;
  try {
    isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
  } catch (error) {
    console.log('Could not check accessibility permission:', error.message);
  }

  if (!isTrusted) {
    console.warn('Accessibility permission not detected');
  }
}

function promptAccessibilityPermission() {
  const result = dialog.showMessageBoxSync({
    type: 'info',
    title: 'Enable Auto-Paste Feature',
    message: 'Make Eloquent paste text automatically at your cursor?',
    detail: 'AUTO-PASTE BENEFITS:\n• Text appears instantly where you\'re typing\n• No need to press Cmd+V\n• Seamless workflow\n\nSETUP STEPS:\n1. Click "Open Settings" below\n2. Find "Electron" or "Eloquent" in the list\n3. Toggle it ON\n4. Restart Eloquent\n\nBACKUP: Text is always copied to clipboard regardless\n\nSECURITY: Only allows pasting transcribed text, nothing else',
    buttons: ['Open Settings', 'Maybe Later', 'Keep Clipboard Only'],
    defaultId: 0,
    cancelId: 1
  });

  if (result === 0) {
    exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
    setTimeout(() => {
      showNotification('Setup Instructions', 'Find "Electron" or "Eloquent" in the list and toggle it ON. Then restart Eloquent.');
    }, 2000);
  } else if (result === 1) {
    showNotification('Clipboard Mode', 'Text will be copied to clipboard. Press Cmd+V to paste. You can enable auto-paste anytime from the menu.');
  }
  
  return result;
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
});

app.whenReady().then(async () => {
  loadConfigFromFile();
  loadAdminConfigFromFile();
  await requestMicrophonePermission();
  checkAccessibilityPermission();
  createTray();
  registerShortcuts();
  
  const validKeys = CONFIG.apiKeys.filter(k => k && k.trim()).length;
  if (validKeys === 0) {
    console.log('No API keys configured - app will run in test mode');
  }
});

function createTray() {
  const size = 32;
  const canvas = Buffer.alloc(size * size * 4);
  
  const setPixel = (x, y, alpha) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const idx = (y * size + x) * 4;
      canvas[idx] = 0;
      canvas[idx + 1] = 0;
      canvas[idx + 2] = 0;
      canvas[idx + 3] = Math.min(255, Math.max(0, Math.round(alpha)));
    }
  };
  
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
  
  const drawArc = (cx, cy, r, startAngle, endAngle, thickness) => {
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / steps);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      fillCircle(x, y, thickness / 2);
    }
  };
  
  const centerX = 16;
  fillRoundedRect(10, 4, 22, 16, 6);
  drawArc(centerX, 14, 9, 0, Math.PI, 2);
  drawLine(centerX, 23, centerX, 27, 2.5);
  drawLine(10, 27, 22, 27, 2.5);
  
  let icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  icon = icon.resize({ width: 18, height: 18, quality: 'best' });
  icon.setTemplateImage(true);
  
  try {
    tray = new Tray(icon);
  } catch (error) {
    console.error('Failed to create tray icon:', error);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Eloquent Voice Dictation', enabled: false },
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
      label: CONFIG.autoPasteMode === 'direct' ? 'Auto-Paste Mode: ON (Direct)' : 'Auto-Paste Mode: OFF (Clipboard Only)',
      enabled: false
    },
    { 
      label: systemPreferences.isTrustedAccessibilityClient(false) ? 'Auto-paste enabled' : 'Enable auto-paste',
      click: () => {
        if (!systemPreferences.isTrustedAccessibilityClient(false)) {
          promptAccessibilityPermission();
        }
      }
    },
    { type: 'separator' },
    { label: 'Tip: Press Esc to stop recording', enabled: false },
    { type: 'separator' },
    { label: 'Settings', click: () => createDashboard() },
    { type: 'separator' },
    { label: 'Quit Eloquent', click: () => app.quit() }
  ]);

  if (tray) {
    tray.setToolTip('Eloquent - Voice to Text');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => createDashboard());
    tray.on('right-click', () => tray.popUpContextMenu());
  }
}

function playSound(type) {
  const sounds = {
    start: '/System/Library/Sounds/Tink.aiff',
    success: '/System/Library/Sounds/Glass.aiff',
    error: '/System/Library/Sounds/Basso.aiff',
    cancel: '/System/Library/Sounds/Funk.aiff',
    notification: '/System/Library/Sounds/Ping.aiff'
  };

  const soundFile = sounds[type] || sounds.notification;
  exec(`afplay "${soundFile}" -v 0.7`, (error) => {
    if (error) {
      console.error(`Sound playback error (${type}):`, error.message);
    }
  });
}

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
  globalShortcut.unregisterAll();
  
  const rewriteRegistered = globalShortcut.register('Alt+Shift+Space', () => {
    handleShortcut('start', 'rewrite');
  });

  const standardRegistered = globalShortcut.register('Alt+Space', () => {
    handleShortcut('start', 'standard');
  });

  const escapeRegistered = globalShortcut.register('Escape', () => {
    handleShortcut('stop');
  });

  const escapeBackup = globalShortcut.register('Cmd+Escape', () => {
    handleShortcut('stop');
  });

  const adminRegistered = globalShortcut.register('Cmd+Shift+A', () => {
    createAdminPanel();
  });

  const dashboardRegistered = globalShortcut.register('Cmd+Shift+D', () => {
    createDashboard();
  });
}

function createOverlayUltraFast(mode = 'standard') {
  currentMode = mode;

  if (isCreatingOverlay) return;
  
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
  
  // Position overlay near cursor (above it)
  const cursorPosition = screen.getCursorScreenPoint();
  const windowBounds = overlayWindow.getBounds();
  
  // Position the overlay above the cursor with some padding
  const x = cursorPosition.x - (windowBounds.width / 2);
  const y = cursorPosition.y - windowBounds.height - 20; // 20px above cursor
  
  // Make sure the window stays within screen bounds
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

function startRecording() {
  if (recordingProcess) return;

  audioFile = path.join(app.getPath('temp'), `eloquent-${Date.now()}.wav`);
  recordingStartTime = Date.now();

  playSound('start');
  
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
    clearInterval(amplitudeInterval);
  });
}

async function stopRecording() {
  if (isProcessing) return;

  isProcessing = true;

  if (recordingProcess) {
    recordingProcess.kill('SIGINT');
    recordingProcess = null;
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('status', 'Processing...');
  }

  await new Promise(r => setTimeout(r, 200));

  try {
    if (!audioFile) {
      throw new Error('No audio file path - recording may have been cancelled');
    }
    
    if (!fs.existsSync(audioFile)) {
      throw new Error('Audio file not created. Please install sox: brew install sox');
    }

    const stats = fs.statSync(audioFile);
    
    if (stats.size < 5000) {
      throw new Error('Recording too short. Please speak for at least 1 second.');
    }

    const recordingDuration = Math.max(1, Math.round((stats.size - 44) / 32000));
    const apiKey = getActiveAPIKey();

    let finalText;
    let originalText = '';

    if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GROQ_API_KEY_HERE') {
      finalText = 'This is a test transcription. Configure your Groq API key in Settings for real voice recognition.';
      originalText = finalText;
    } else {
      originalText = await transcribe(audioFile);
      
      if (currentMode === 'rewrite') {
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

    const historyEntry = {
      id: Date.now(),
      text: finalText,
      originalText: originalText,
      mode: currentMode,
      timestamp: new Date().toISOString(),
      duration: recordingDuration
    };
    
    saveToHistory(historyEntry);

    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('recording-complete', {
        duration: recordingDuration,
        mode: currentMode,
        history: historyEntry
      });
    }

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
    }
    
    setTimeout(() => {
      pasteTextRobust(finalText);
      playSound('success');
    }, 200);

    if (apiKey && apiKey.trim() !== '') {
      trackAPIUsage(recordingDuration);
    }

  } catch (error) {
    console.error('Recording failed:', error.message);
    
    playSound('error');
    
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('error', error.message);
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.close();
          overlayWindow = null;
        }
      }, 800);
    }
  } finally {
    isProcessing = false;
    const fileToCleanup = audioFile;
    audioFile = null;
    
    if (fileToCleanup && fs.existsSync(fileToCleanup)) {
      fs.unlink(fileToCleanup, (err) => {
        if (err) console.log('Cleanup warning:', err.message);
      });
    }
  }
}

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
  
  const aiPrompt = AI_PROMPTS[CONFIG.aiMode] || AI_PROMPTS.qn;
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
      temperature: creativeTemp,
      max_tokens: 1500
    },
    {
      headers: { 'Authorization': `Bearer ${getActiveAPIKey()}` },
      timeout: 30000
    }
  );

  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('api-request', 'llama');
  }
  
  logApiRequest('llama-rewrite', 'success', Date.now() - startTime, response.data.usage?.total_tokens);

  return response.data.choices[0].message.content;
}

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
    'eloquent': 'eloquent',
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

  for (const [wrong, right] of Object.entries(corrections)) {
    const escapedWrong = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (wrong.includes(' ')) {
      text = text.replace(new RegExp(escapedWrong, 'g'), right);
    } else {
      const regex = new RegExp('\\b' + escapedWrong + '\\b', 'gi');
      text = text.replace(regex, right);
    }
  }

  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  text = text.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  text = text.replace(/\s+/g, ' ');

  if (text.length > 0 && !/[.!?]$/.test(text)) {
    text += '.';
  }

  return text;
}

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
      temperature: 0.2,
      max_tokens: 2000
    },
    {
      headers: { 'Authorization': `Bearer ${getActiveAPIKey()}` },
      timeout: 30000
    }
  );

  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('api-request', 'llama');
  }
  
  logApiRequest('llama-grammar', 'success', Date.now() - startTime, response.data.usage?.total_tokens);

  return response.data.choices[0].message.content;
}

function pasteTextRobust(text) {
  clipboard.writeText(text);

  if (CONFIG.autoPasteMode === 'clipboard') {
    showNotification('Text Ready', 'Press Cmd+V to paste');
    return;
  }

  const hasAccessibility = systemPreferences.isTrustedAccessibilityClient(false);
  
  if (!hasAccessibility) {
    showNotification('Press Cmd+V to Paste', 'Enable Accessibility for auto-paste');
    
    if (!global.accessibilityPromptShown) {
      global.accessibilityPromptShown = true;
      setTimeout(() => {
        promptAccessibilityPermission();
      }, 500);
    }
    return;
  }
  
  const pasteScript = `
    tell application "System Events"
      keystroke "v" using command down
    end tell
  `;
  
  setTimeout(() => {
    exec(`osascript -e '${pasteScript}'`, (error) => {
      if (error) {
        exec('cliclick kd:cmd t:v ku:cmd', (cliclickError) => {
          if (cliclickError) {
            showNotification('Press Cmd+V', 'Auto-paste failed, text in clipboard');
          } else {
            showNotification('Text Pasted', 'Text inserted automatically');
          }
        });
      } else {
        showNotification('Text Pasted', 'Text inserted automatically');
      }
    });
  }, 100);

  if (CONFIG.preserveClipboard) {
    const oldClipboard = clipboard.readText();
    if (oldClipboard !== text) {
      setTimeout(() => {
        clipboard.writeText(oldClipboard);
      }, 4000);
    }
  }
}

function showNotification(title, body) {
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: title,
        body: body,
        silent: false,
        timeoutType: 'default',
        urgency: 'normal'
      });
      
      notification.show();
      
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  } catch (error) {
    console.log('Notification error:', error.message);
  }
}

function saveConfigToFile() {
  try {
    const configFile = path.join(app.getPath('userData'), 'config.json');
    fs.writeFileSync(configFile, JSON.stringify(CONFIG, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

function saveAdminConfigToFile() {
  try {
    const adminConfigFile = path.join(app.getPath('userData'), 'admin-config.json');
    fs.writeFileSync(adminConfigFile, JSON.stringify(ADMIN_CONFIG, null, 2));
  } catch (error) {
    console.error('Error saving admin config:', error);
  }
}

function loadAdminConfigFromFile() {
  try {
    const adminConfigFile = path.join(app.getPath('userData'), 'admin-config.json');
    
    if (fs.existsSync(adminConfigFile)) {
      const savedAdminConfig = JSON.parse(fs.readFileSync(adminConfigFile, 'utf8'));
      
      if (savedAdminConfig.masterApiKey) ADMIN_CONFIG.masterApiKey = savedAdminConfig.masterApiKey;
      if (savedAdminConfig.dailyLimit) ADMIN_CONFIG.dailyLimit = savedAdminConfig.dailyLimit;
      if (savedAdminConfig.rateLimitPerUser) ADMIN_CONFIG.rateLimitPerUser = savedAdminConfig.rateLimitPerUser;
      if (savedAdminConfig.users) ADMIN_CONFIG.users = savedAdminConfig.users;
      if (savedAdminConfig.apiRequests) ADMIN_CONFIG.apiRequests = savedAdminConfig.apiRequests;
      
      if (ADMIN_CONFIG.masterApiKey) {
        CONFIG.apiKeys[0] = ADMIN_CONFIG.masterApiKey;
      }
    }
  } catch (error) {
    console.error('Error loading admin config:', error);
  }
}

function loadConfigFromFile() {
  try {
    const configFile = path.join(app.getPath('userData'), 'config.json');
    
    if (fs.existsSync(configFile)) {
      const savedConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      
      if (savedConfig.apiKeys) CONFIG.apiKeys = savedConfig.apiKeys;
      if (savedConfig.language) CONFIG.language = savedConfig.language;
      if (savedConfig.aiMode) CONFIG.aiMode = savedConfig.aiMode;
      if (savedConfig.preserveClipboard !== undefined) CONFIG.preserveClipboard = savedConfig.preserveClipboard;
      if (savedConfig.autoGrammarFix !== undefined) CONFIG.autoGrammarFix = savedConfig.autoGrammarFix;
      if (savedConfig.enableWakeWord !== undefined) CONFIG.enableWakeWord = savedConfig.enableWakeWord;
      if (savedConfig.customDictionary) CONFIG.customDictionary = savedConfig.customDictionary;
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

function saveToHistory(entry) {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    
    if (!entry.text || !entry.id) {
      console.error('Invalid history entry - missing text or id');
      return;
    }
    
    let history = [];

    if (fs.existsSync(historyFile)) {
      try {
        const data = fs.readFileSync(historyFile, 'utf8');
        history = JSON.parse(data) || [];
      } catch (parseError) {
        console.warn('History file corrupted, starting fresh');
        history = [];
      }
    }

    history.unshift(entry);

    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    const tempFile = historyFile + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(history, null, 2));
    fs.renameSync(tempFile, historyFile);
    
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('history-updated', history);
      dashboardWindow.webContents.send('history-data', history);
    }
    
  } catch (error) {
    console.error('History save failed:', error.message);
  }
}

function getHistory() {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');

    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf8');
      const history = JSON.parse(data);
      return history;
    } else {
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

    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('history-data', []);
      dashboardWindow.webContents.send('history-updated', []);
    }
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
  if (newConfig.apiKeys) {
    CONFIG.apiKeys = newConfig.apiKeys;
  }
  if (newConfig.language) CONFIG.language = newConfig.language;
  if (newConfig.aiMode) CONFIG.aiMode = newConfig.aiMode;
  if (newConfig.preserveClipboard !== undefined) CONFIG.preserveClipboard = newConfig.preserveClipboard;
  if (newConfig.autoGrammarFix !== undefined) CONFIG.autoGrammarFix = newConfig.autoGrammarFix;
  if (newConfig.enableWakeWord !== undefined) CONFIG.enableWakeWord = newConfig.enableWakeWord;
  
  saveConfigToFile();
});

ipcMain.on('update-dictionary', (event, dictionary) => {
  CONFIG.customDictionary = dictionary;
});

ipcMain.on('get-history', (event) => {
  const history = getHistory();
  event.reply('history-data', history);
});

ipcMain.on('clear-history', (event) => {
  clearHistory();
  event.reply('history-data', []);
});

ipcMain.on('delete-history-item', (event, id) => {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    let history = getHistory();
    history = history.filter(item => item.id !== id);

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

    event.reply('history-data', history);

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
  if (newAdminConfig.masterApiKey) ADMIN_CONFIG.masterApiKey = newAdminConfig.masterApiKey;
  if (newAdminConfig.dailyLimit) ADMIN_CONFIG.dailyLimit = newAdminConfig.dailyLimit;
  if (newAdminConfig.rateLimitPerUser) ADMIN_CONFIG.rateLimitPerUser = newAdminConfig.rateLimitPerUser;
  
  if (ADMIN_CONFIG.masterApiKey) {
    CONFIG.apiKeys[0] = ADMIN_CONFIG.masterApiKey;
  }
  
  saveAdminConfigToFile();
  
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
  ADMIN_CONFIG.apiRequests = ADMIN_CONFIG.apiRequests.filter(req => req.userId !== userId);
  saveAdminConfigToFile();
  
  return { success: true };
});

ipcMain.handle('admin-get-requests', async () => {
  return ADMIN_CONFIG.apiRequests
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100);
});

ipcMain.handle('admin-clear-logs', async () => {
  ADMIN_CONFIG.apiRequests = [];
  saveAdminConfigToFile();
  
  return { success: true };
});

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
  
  if (ADMIN_CONFIG.apiRequests.length > 1000) {
    ADMIN_CONFIG.apiRequests = ADMIN_CONFIG.apiRequests.slice(-1000);
  }
  
  if (ADMIN_CONFIG.apiRequests.length % 10 === 0) {
    saveAdminConfigToFile();
  }
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});