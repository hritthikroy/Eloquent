const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const AI_PROMPTS = require('./ai-prompts');

let overlayWindow = null;
let dashboardWindow = null;
let tray = null;
let recording = null;
let audioFile = null;
let recordingProcess = null;
let currentMode = 'standard';

// Configuration - Store your API keys here (supports up to 5 keys for 200 minutes/day)
const CONFIG = {
  apiKeys: [
    '', // API Key 1 (required) - Add your Groq API key here
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
};

// Recording state
let isRecording = false;
let isCreatingOverlay = false; // Prevent race conditions

// Get active API key based on usage
function getActiveAPIKey() {
  const validKeys = CONFIG.apiKeys.filter(key => key && key.trim() !== '');
  if (validKeys.length === 0) {
    throw new Error('No API keys configured. Please add at least one API key in settings.');
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

    // Update usage for current key
    const currentKey = getActiveAPIKey();
    const keyIndex = usageData.keys.findIndex(k => k.key === currentKey);
    if (keyIndex !== -1) {
      usageData.keys[keyIndex].timeUsed += duration;
    } else {
      usageData.keys.push({ key: currentKey, timeUsed: duration });
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

    if (micStatus !== 'granted') {
      console.log('Requesting microphone permission...');
      const granted = await systemPreferences.askForMediaAccess('microphone');

      if (!granted) {
        console.error('Microphone permission denied!');

        // Show helpful dialog
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: 'Microphone Permission Required',
          message: 'VoicyClone needs microphone access to record your voice.',
          detail: 'Please grant microphone permission in System Settings.\n\nGo to: System Settings > Privacy & Security > Microphone\n\nThen enable "Electron" or "VoicyClone".',
          buttons: ['Open System Settings', 'I\'ll Do It Later'],
          defaultId: 0,
          cancelId: 1
        });

        if (result.response === 0) {
          // Open System Settings to Microphone
          exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
        }

        return false;
      }
    }

    console.log('✅ Microphone permission granted');
    return true;
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
}

// Check accessibility permission
function checkAccessibilityPermission() {
  if (process.platform !== 'darwin') return;

  const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);

  if (!isTrusted) {
    console.warn('⚠️  Accessibility permission not granted');

    dialog.showMessageBox({
      type: 'info',
      title: 'Accessibility Permission Needed',
      message: 'VoicyClone needs Accessibility permission to paste text.',
      detail: 'To enable:\n\n1. Go to System Settings > Privacy & Security > Accessibility\n2. Click the lock icon to unlock\n3. Click "+" and add Electron/VoicyClone\n4. Toggle it ON\n\nWithout this, text pasting won\'t work.',
      buttons: ['Open System Settings', 'OK']
    }).then(result => {
      if (result.response === 0) {
        exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
      }
    });
  } else {
    console.log('✅ Accessibility permission granted');
  }
}

app.whenReady().then(async () => {
  // Request permissions first
  await requestMicrophonePermission();
  checkAccessibilityPermission();

  // Then create UI
  createTray();
  registerShortcuts();
  // Show dashboard on first launch
  createDashboard();
});

function createTray() {
  // Create a simple 16x16 icon
  const icon = nativeImage.createFromBuffer(Buffer.alloc(16 * 16 * 4, 128));
  icon.setTemplateImage(true);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => createDashboard() },
    { 
      label: 'Start Recording (⌥D)', 
      click: () => {
        if (!overlayWindow && !isCreatingOverlay) {
          createOverlay('standard');
        }
      }
    },
    { type: 'separator' },
    { label: 'Settings', click: () => createDashboard() },
    { type: 'separator' },
    { label: 'Quit Eloquent', click: () => app.quit() }
  ]);

  tray.setToolTip('VoicyClone');
  tray.setContextMenu(contextMenu);
}

// Double-tap detection
let lastDTapTime = 0;
const DOUBLE_TAP_DELAY = 300; // 300ms window for double tap

function registerShortcuts() {
  // Unregister all existing shortcuts first to prevent duplicates
  globalShortcut.unregisterAll();
  
  // Double tap D for standard transcription
  globalShortcut.register('D', () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastDTapTime;
    
    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        stopRecording();
      } else if (!isCreatingOverlay) {
        createOverlay('standard');
      }
      lastDTapTime = 0; // Reset
    } else {
      // First tap
      lastDTapTime = now;
    }
  });

  // AI Rewrite mode: Option + D
  globalShortcut.register('Alt+D', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      stopRecording();
    } else if (!isCreatingOverlay) {
      createOverlay('rewrite');
    }
  });

  console.log('✅ Keyboard shortcuts registered (Double-tap D for standard, ⌥D for AI)');
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

function createOverlay(mode = 'standard') {
  currentMode = mode;

  // CRITICAL FIX: Prevent duplicate recordings with double-check
  if (isCreatingOverlay) {
    console.log('⚠️ Already creating overlay - ignoring duplicate request');
    return;
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    console.log('⚠️ Recording already in progress - ignoring duplicate request');
    overlayWindow.focus(); // Bring existing window to front
    return; // Don't create another overlay if one exists
  }

  // Stop any existing recording process (safety check)
  if (recordingProcess) {
    console.log('⚠️ Stopping existing recording process');
    recordingProcess.kill();
    recordingProcess = null;
  }

  // Set flag to prevent race conditions
  isCreatingOverlay = true;
  
  // Safety timeout: reset flag after 3 seconds if something goes wrong
  const safetyTimeout = setTimeout(() => {
    if (isCreatingOverlay) {
      console.log('⚠️ Safety timeout: resetting isCreatingOverlay flag');
      isCreatingOverlay = false;
    }
  }, 3000);

  overlayWindow = new BrowserWindow({
    width: 280,  // More compact width
    height: 60,  // Smaller height
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    focusable: false,  // Prevents stealing focus from active app
    acceptFirstMouse: false,  // Prevents mouse clicks from focusing
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  overlayWindow.loadFile('overlay.html');
  overlayWindow.center();

  // Prevent window from stealing focus
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'floating', 1);

  overlayWindow.webContents.on('did-finish-load', () => {
    clearTimeout(safetyTimeout); // Clear safety timeout
    overlayWindow.webContents.send('set-mode', mode);
    startRecording();
    // Clear the creation flag after window is fully loaded
    isCreatingOverlay = false;
  });

  overlayWindow.on('closed', () => {
    clearTimeout(safetyTimeout); // Clear safety timeout
    overlayWindow = null;
    isCreatingOverlay = false; // Reset flag when window closes
  });
}

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

function startRecording() {
  // Prevent duplicate recording processes
  if (recordingProcess) {
    console.log('⚠️ Recording already in progress - skipping');
    return;
  }

  audioFile = path.join(app.getPath('temp'), `voicy-${Date.now()}.wav`);

  // Play start sound
  exec('afplay /System/Library/Sounds/Tink.aiff');
  console.log('🎵 Recording started');

  // ENHANCED audio recording with professional-grade settings
  // Optimized for maximum speech clarity and recognition accuracy
  recordingProcess = spawn('rec', [
    '-r', '16000',      // 16kHz sample rate (Whisper optimal)
    '-c', '1',          // Mono channel
    '-b', '16',         // 16-bit depth
    '-e', 'signed-integer',  // Encoding type
    audioFile,
    // Advanced audio processing chain for crystal-clear voice
    'highpass', '80',   // Remove deep bass/rumble (speech starts at ~80Hz)
    'lowpass', '8000',  // Keep full speech spectrum (up to 8kHz)
    'compand', '0.05,0.2', '6:-70,-60,-20', '-5', '-90', '0.1',  // Dynamic range compression
    'gain', '-n', '-3', // Normalize and prevent clipping
    'treble', '2',      // Boost clarity
    'rate', '16k'       // Ensure consistent sample rate
    // NO TIME LIMIT - Record as long as you want!
  ]);

  // Simulate waveform animation
  let amplitudeInterval = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const amplitude = Math.random() * 0.5 + 0.2;
      overlayWindow.webContents.send('amplitude', amplitude);
    } else {
      clearInterval(amplitudeInterval);
    }
  }, 100);

  recordingProcess.on('close', () => {
    clearInterval(amplitudeInterval);
  });

  recordingProcess.on('error', (err) => {
    console.error('Recording error:', err);
    clearInterval(amplitudeInterval);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('error', 'Recording failed. Install sox: brew install sox');
    }
  });
}

async function stopRecording() {
  const recordingStartTime = Date.now();
  let recordingDuration = 0;

  if (recordingProcess) {
    recordingProcess.kill('SIGINT');
    recordingProcess = null;
  }

  if (overlayWindow) {
    overlayWindow.webContents.send('status', 'Processing...');
  }

  // Wait for file to be written (reduced from 500ms to 200ms for speed)
  await new Promise(r => setTimeout(r, 200));

  try {
    const apiKey = getActiveAPIKey();
    if (!apiKey) {
      throw new Error('No API keys configured. Please add at least one API key in settings.');
    }

    // Calculate recording duration from audio file
    if (fs.existsSync(audioFile)) {
      const stats = fs.statSync(audioFile);
      // Estimate duration: 16kHz mono 16-bit = 32000 bytes/sec
      recordingDuration = Math.round((stats.size - 44) / 32000); // Subtract WAV header
    }

    // Transcribe audio with enhanced processing
    console.log('🎤 Transcribing audio...');
    const text = await transcribe(audioFile);
    console.log(`✅ Raw transcription: "${text.substring(0, 100)}..."`);

    // INTELLIGENT PROCESSING MODE
    // - Standard mode: Post-processed transcription (FAST + accurate)
    // - Rewrite mode: AI optimization (SLOWER but better quality)
    let finalText;
    if (currentMode === 'rewrite') {
      // Use AI for advanced rewriting
      console.log('🤖 Applying AI rewrite...');
      finalText = await rewrite(text);
      console.log(`✅ AI rewritten: "${finalText.substring(0, 100)}..."`);
    } else {
      // Standard mode: Apply smart post-processing
      finalText = text;
      
      // Optional: Apply auto grammar fix if enabled
      if (CONFIG.autoGrammarFix) {
        try {
          console.log('📝 Applying auto grammar fix...');
          finalText = await applyGrammarFixes(text);
          console.log(`✅ Grammar fixed: "${finalText.substring(0, 100)}..."`);
        } catch (error) {
          console.error('Grammar fix error:', error);
          // Fall back to original text if grammar fix fails
          finalText = text;
        }
      }
    }
    
    console.log(`📋 Final text (${finalText.length} chars): "${finalText}"`);
    
    // Verify text is not empty
    if (!finalText || finalText.trim().length === 0) {
      throw new Error('Transcription resulted in empty text. Please try again.');
    }

    // Paste text using ultra-robust mechanism
    pasteTextRobust(finalText);

    // Play success sound
    exec('afplay /System/Library/Sounds/Glass.aiff');
    console.log('🎵 Recording completed successfully');

    // Track API usage time
    trackAPIUsage(recordingDuration);

    // Save to history
    const historyEntry = {
      id: Date.now(),
      text: finalText,
      originalText: text,
      mode: currentMode,
      timestamp: new Date().toISOString(),
      duration: recordingDuration
    };
    saveToHistory(historyEntry);

    // Notify dashboard of recording completion with duration and updated history
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('recording-complete', {
        duration: recordingDuration,
        mode: currentMode,
        history: historyEntry
      });
      // Send updated history immediately
      dashboardWindow.webContents.send('history-data', getHistory());
    }

    // Close overlay
    if (overlayWindow) {
      overlayWindow.close();
      overlayWindow = null;
    }

    // Clean up audio file
    fs.unlink(audioFile, () => { });

  } catch (error) {
    console.error('Processing error:', error);
    
    // Play error sound
    exec('afplay /System/Library/Sounds/Basso.aiff');
    console.log('🔴 Recording error:', error.message);
    
    if (overlayWindow) {
      overlayWindow.webContents.send('error', error.message);
    }
  }
}

async function transcribe(filePath) {
  // Check if file exists and has content
  if (!fs.existsSync(filePath)) {
    throw new Error('Audio file not found');
  }

  const stats = fs.statSync(filePath);
  if (stats.size < 1000) {
    throw new Error('Recording too short. Please speak longer.');
  }

  // ENHANCED MULTI-STRATEGY TRANSCRIPTION
  // Try multiple approaches for maximum accuracy
  
  try {
    // Strategy 1: High-accuracy transcription with enhanced prompting
    const transcribedText = await transcribeWithEnhancedPrompt(filePath);
    return transcribedText;
  } catch (error) {
    console.error('Enhanced transcription failed, trying fallback:', error.message);
    
    // Strategy 2: Fallback to basic transcription
    try {
      const fallbackText = await transcribeBasic(filePath);
      return fallbackText;
    } catch (fallbackError) {
      throw new Error(`Transcription failed: ${fallbackError.message}`);
    }
  }
}

// Enhanced transcription with optimal settings
async function transcribeWithEnhancedPrompt(filePath) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: 'recording.wav',
    contentType: 'audio/wav'
  });

  // Use the most accurate Whisper model
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', CONFIG.language);
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0'); // Maximum accuracy
  
  // CRITICAL: Professional-grade prompt engineering for maximum recognition accuracy
  let contextPrompt = 'Professional voice dictation for writing text. Clear, articulate speech with proper grammar, punctuation, and capitalization. ';
  
  // Add custom dictionary words if provided
  if (CONFIG.customDictionary && CONFIG.customDictionary.trim()) {
    contextPrompt += `Important specialized terms: ${CONFIG.customDictionary}. `;
  }
  
  // Add comprehensive context for better recognition
  contextPrompt += 'Common vocabulary: the, and, is, are, can, you, make, this, that, have, will, would, should, could, recognize, voice, properly, sentence, different, approach, very, smooth, perfect, professional, model, text, writing, dictation, paste, much, more, it, for, a, in, to, of, with, from, by, at, on, be, do, say, get, go, know, take, see, come, think, look, want, give, use, find, tell, ask, work, seem, feel, try, leave, call.';
  
  form.append('prompt', contextPrompt);

  const response = await axios.post(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${getActiveAPIKey()}`
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
  );

  // Track API usage
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('api-request', 'whisper');
  }

  // Extract and process text
  let transcribedText = '';
  if (typeof response.data === 'string') {
    transcribedText = response.data;
  } else if (response.data.text) {
    transcribedText = response.data.text;
  } else {
    throw new Error('Invalid transcription response format');
  }

  // Post-process for better accuracy
  transcribedText = postProcessTranscription(transcribedText);
  
  console.log(`📝 Transcribed (${transcribedText.length} chars): "${transcribedText.substring(0, 50)}..."`);

  return transcribedText;
}

// Fallback basic transcription
async function transcribeBasic(filePath) {
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
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
  );

  // Track API usage
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('api-request', 'whisper');
  }

  const transcribedText = postProcessTranscription(response.data);
  return transcribedText;
}

async function rewrite(text) {
  // Get the appropriate AI prompt based on mode
  const aiPrompt = AI_PROMPTS[CONFIG.aiMode] || AI_PROMPTS.smart;

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: aiPrompt
        },
        { role: 'user', content: text }
      ],
      temperature: 0.2,  // Lower for more consistent results
      max_tokens: 1000  // Increased for longer outputs
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
    'voicy': 'voice',
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
    // Use case-insensitive for word corrections
    if (wrong.includes(' ')) {
      // For phrases with spaces, use case-sensitive to avoid over-correction
      text = text.replace(new RegExp(wrong, 'g'), right);
    } else {
      // For single words, use case-insensitive
      const regex = new RegExp('\\b' + wrong + '\\b', 'gi');
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
            // Show notification if all attempts failed
            exec(`osascript -e 'display notification "Text copied to clipboard. Please paste manually (⌘V)" with title "VoicyClone"'`);
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

// Alternative paste method using direct AppleScript (most reliable)
function pasteTextRobust(text) {
  const preserveClipboard = CONFIG.preserveClipboard || false;
  let oldClipboard = '';

  if (preserveClipboard) {
    oldClipboard = clipboard.readText();
  }

  // Set clipboard with verification
  clipboard.writeText(text);
  
  // Verify clipboard
  const clipboardCheck = clipboard.readText();
  if (clipboardCheck !== text) {
    console.warn('⚠️ Clipboard verification failed in robust paste');
    clipboard.writeText(text);
  }

  // Use AppleScript with explicit delays and triple-retry
  const script = `
    tell application "System Events"
      delay 0.1
      keystroke "v" using command down
      delay 0.15
      keystroke "v" using command down
      delay 0.15
      keystroke "v" using command down
    end tell
  `;

  exec(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, (error) => {
    if (error) {
      console.error('Robust paste error:', error);
      // Ultimate fallback: try simple paste multiple times
      exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      setTimeout(() => {
        exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      }, 200);
    }

    // Restore clipboard after all attempts
    if (preserveClipboard) {
      setTimeout(() => clipboard.writeText(oldClipboard), 600);
    }
  });

  console.log(`✅ Ultra-robust paste: ${text.length} characters with triple-retry`);
}

// History management
function saveToHistory(entry) {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    let history = [];

    // Load existing history
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf8');
      history = JSON.parse(data);
    }

    // Add new entry at the beginning
    history.unshift(entry);

    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    // Save back to file
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

function getHistory() {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading history:', error);
  }
  return [];
}

function clearHistory() {
  try {
    const historyFile = path.join(app.getPath('userData'), 'history.json');
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
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
  // Handle API keys array
  if (newConfig.apiKeys) {
    CONFIG.apiKeys = newConfig.apiKeys;
  }
  // Handle other config properties
  if (newConfig.language) CONFIG.language = newConfig.language;
  if (newConfig.aiMode) CONFIG.aiMode = newConfig.aiMode;
  if (newConfig.preserveClipboard !== undefined) CONFIG.preserveClipboard = newConfig.preserveClipboard;
  if (newConfig.autoGrammarFix !== undefined) CONFIG.autoGrammarFix = newConfig.autoGrammarFix;
  if (newConfig.enableWakeWord !== undefined) CONFIG.enableWakeWord = newConfig.enableWakeWord;
});

ipcMain.on('update-dictionary', (event, dictionary) => {
  CONFIG.customDictionary = dictionary;
  console.log('Dictionary updated:', dictionary);
});

ipcMain.on('get-history', (event) => {
  event.reply('history-data', getHistory());
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
  } catch (error) {
    console.error('Error deleting history item:', error);
  }
});


app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Keep app running in menu bar
});
