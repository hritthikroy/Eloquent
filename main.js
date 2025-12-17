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
    '', // API Key 1 - Get your free key at https://console.groq.com
    '', // API Key 2 (optional)
    '', // API Key 3 (optional)
    '', // API Key 4 (optional)
    ''  // API Key 5 (optional)
  ],
  language: 'en',
  customDictionary: '', // Custom words for better recognition
  aiMode: 'qn', // AI rewriting mode: qn (default), code, grammar - OPTIMIZED (removed 5 redundant modes)
  preserveClipboard: false, // Default: false for instant pasting with zero latency
  autoGrammarFix: true, // Automatically apply grammar fixes to all transcriptions
  // Wake Word Detection Settings
  enableWakeWord: false, // Enable wake word detection mode
  wakeWord: 'hey queen', // Wake word to trigger recording (customizable)
  wakeWordTimeout: 5 // Seconds to listen for wake word before canceling
};

// Wake word listening state
let isWakeWordListening = false;
let wakeWordWindow = null;

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
    { label: 'Start Recording (⌥D)', click: () => createOverlay('standard') },
    { type: 'separator' },
    { label: 'Settings', click: () => createDashboard() },
    { type: 'separator' },
    { label: 'Quit VoicyClone', click: () => app.quit() }
  ]);

  tray.setToolTip('VoicyClone');
  tray.setContextMenu(contextMenu);
}

function registerShortcuts() {
  // Standard transcription: Option + D
  globalShortcut.register('Alt+D', () => {
    if (overlayWindow) {
      stopRecording();
    } else {
      createOverlay('standard');
    }
  });

  // Rewrite mode: Option + Shift + D
  globalShortcut.register('Alt+Shift+D', () => {
    if (overlayWindow) {
      stopRecording();
    } else {
      createOverlay('rewrite');
    }
  });

  // Wake Word Mode: Option + W (Toggle always-listening mode)
  globalShortcut.register('Alt+W', () => {
    toggleWakeWordListening();
  });
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
    startWakeWordListening();
  } else {
    stopWakeWordListening();
  }
}

// Start wake word listening - continuous audio monitoring
function startWakeWordListening() {
  if (wakeWordListeningProcess) {
    wakeWordListeningProcess.kill();
  }

  console.log(`Starting wake word listening for: "${CONFIG.wakeWord}"`);

  // For a more sophisticated wake word detection, we'll use a continuous recording approach
  // that listens in short chunks and sends them to a lightweight local speech recognition
  const chunkDuration = 2; // seconds per chunk
  const tempAudioFile = path.join(app.getPath('temp'), `wake-${Date.now()}.wav`);

  // Start continuous audio monitoring with sox in chunks
  wakeWordListeningProcess = spawn('rec', [
    '-r', '16000',      // Sample rate
    '-c', '1',          // Mono
    '-b', '16',         // Bit depth
    '-d',               // Record from default device
    tempAudioFile,
    'trim', '0', `${chunkDuration}`  // Record in chunks
  ]);

  wakeWordListeningProcess.on('close', (code) => {
    wakeWordListeningProcess = null;

    if (isWakeWordListening) {
      // Process the recorded chunk for wake word detection
      if (fs.existsSync(tempAudioFile)) {
        const stats = fs.statSync(tempAudioFile);
        if (stats.size > 8000) { // If file has meaningful audio
          // In a real implementation, we would send this to a local wake word detection model
          // For now we'll use a simplified approach - in a production app we would use:
          // - A local wake word detection library like Porcupine
          // - Or send to a lightweight local speech recognition service

          // Simulate wake word detection by trying to transcribe the audio snippet
          // to see if it contains the wake word
          checkForWakeWord(tempAudioFile);
        }

        // Clean up the temporary file
        fs.unlink(tempAudioFile, () => {});
      }

      // Restart listening after a short delay
      setTimeout(startWakeWordListening, 500);
    }
  });

  wakeWordListeningProcess.on('error', (err) => {
    console.error('Wake word listening process error:', err);
    wakeWordListeningProcess = null;

    if (isWakeWordListening) {
      setTimeout(startWakeWordListening, 1000);
    }
  });
}

// Function to check if audio contains the wake word
async function checkForWakeWord(audioFilePath) {
  try {
    // For a proper implementation, we'd use a local model to detect the wake word
    // For this implementation, we'll create a simulation that's more realistic

    // Check if the configured wake word is enabled
    if (!CONFIG.enableWakeWord || !CONFIG.wakeWord) {
      return;
    }

    // In a real implementation, we would use a dedicated wake word detection library like:
    // - Porcupine by Picovoice
    // - Snowboy (now part of KITT.AI)
    // - Built-in system APIs
    // - Custom ML model

    // For this implementation, we'll simulate by using the Whisper API to
    // transcribe the small audio chunk and check if it contains the wake word
    // NOTE: In production, this would be expensive and inefficient
    // A proper implementation would use a lightweight local model

    // First, check if the audio file has content
    const stats = fs.statSync(audioFilePath);
    if (stats.size < 4000) { // Too small to contain speech
      return;
    }

    // Temporarily use Whisper to check for the wake word (not efficient for production)
    // This is just for demonstration
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(audioFilePath), {
      filename: 'wake_check.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', CONFIG.language);
    form.append('response_format', 'text');

    const firstValidKey = getActiveAPIKey();
    if (!firstValidKey) {
      console.error('No valid API key available for wake word check');
      return;
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${firstValidKey}`
        },
        timeout: 15000, // Shorter timeout for wake word check
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const transcription = response.data.trim().toLowerCase();
    const wakeWord = CONFIG.wakeWord.toLowerCase();

    // Check if the transcription contains the wake word
    if (transcription.includes(wakeWord)) {
      console.log(`Wake word "${CONFIG.wakeWord}" detected! Starting recording...`);

      // Stop wake word listening temporarily to avoid multiple triggers
      if (isWakeWordListening) {
        stopWakeWordListening();
        // Restart after recording is done
        setTimeout(() => {
          if (CONFIG.enableWakeWord) {
            isWakeWordListening = true;
            startWakeWordListening();
          }
        }, 5000); // Wait 5 seconds after recording starts
      }

      // Create the recording overlay
      createOverlay('standard');
    } else {
      console.log('Audio detected but no wake word found:', transcription);
    }

  } catch (error) {
    console.error('Error in wake word detection:', error.message);
    // Continue listening despite error
  }
}

// Stop wake word listening
function stopWakeWordListening() {
  console.log('Stopping wake word listening');
  if (wakeWordProcess) {
    wakeWordProcess.kill();
    wakeWordProcess = null;
  }
  // Optionally show a notification
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('wake-word-status', 'stopped');
  }
}

// Variable to hold the wake word detection process
let wakeWordListeningProcess = null;

function createOverlay(mode = 'standard') {
  currentMode = mode;

  // CRITICAL FIX: Close existing overlay before creating new one
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    console.log('Closing existing overlay window');
    overlayWindow.close();
    overlayWindow = null;
  }

  // Stop any existing recording
  if (recordingProcess) {
    recordingProcess.kill();
    recordingProcess = null;
  }

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
    overlayWindow.webContents.send('set-mode', mode);
    startRecording();
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
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
  audioFile = path.join(app.getPath('temp'), `voicy-${Date.now()}.wav`);

  // Enhanced audio recording for MAXIMUM voice recognition accuracy
  // Higher quality settings for better Whisper transcription
  recordingProcess = spawn('rec', [
    '-r', '16000',      // 16kHz sample rate (optimal for Whisper)
    '-c', '1',          // Mono channel
    '-b', '16',         // 16-bit depth
    '-e', 'signed-integer',  // Encoding type
    audioFile,
    // Audio enhancement filters for clearer voice
    'highpass', '200',  // Remove low-frequency noise
    'lowpass', '3000',  // Remove high-frequency noise
    'compand', '0.3,1', '6:-70,-60,-20', '-5', '-90', '0.2'  // Normalize volume
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

    // Transcribe audio
    const text = await transcribe(audioFile);

    // Smart grammar fixing:
    // - If in 'rewrite' mode: Use selected AI mode (frontend, backend, etc.)
    // - If in 'standard' mode AND autoGrammarFix is enabled: Apply basic grammar fixes
    // - Otherwise: Use raw transcription
    let finalText;
    if (currentMode === 'rewrite') {
      // Full AI rewriting with selected mode
      finalText = await rewrite(text);
    } else if (CONFIG.autoGrammarFix) {
      // Auto grammar fix for standard mode (light corrections)
      finalText = await applyGrammarFixes(text);
    } else {
      // Raw transcription, no fixes
      finalText = text;
    }

    // Paste text
    pasteText(finalText);

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

    // Notify dashboard of recording completion with duration and history
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('recording-complete', {
        duration: recordingDuration,
        mode: currentMode,
        history: historyEntry
      });
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

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: 'recording.wav',
    contentType: 'audio/wav'
  });

  // Use the most accurate Whisper model
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', CONFIG.language);
  form.append('response_format', 'verbose_json'); // Get more detailed output
  form.append('temperature', '0'); // Most accurate, least creative

  // Enhanced prompt for better context and accuracy
  const contextPrompt = CONFIG.customDictionary ||
    'This is a voice dictation for writing text. Include proper punctuation, capitalization, and complete sentences.';
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

  return response.data.text;
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

  // ROBUST PASTE MECHANISM with retry logic
  // This ensures text ALWAYS pastes, even if focus is lost

  // Step 1: Set clipboard immediately
  clipboard.writeText(text);

  // Step 2: Wait a tiny bit for clipboard to be ready (50ms)
  setTimeout(() => {
    // Step 3: First paste attempt
    exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);

    // Step 4: Verify paste with second attempt after 100ms (fallback)
    setTimeout(() => {
      // Second attempt - ensures paste happens even if first failed
      exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);

      // Step 5: Restore clipboard if needed
      if (preserveClipboard) {
        setTimeout(() => {
          clipboard.writeText(oldClipboard);
        }, 300);
      }
    }, 100);
  }, 50);

  console.log(`✅ Pasting text (${text.length} characters)`);
}

// Alternative paste method using direct AppleScript (more reliable)
function pasteTextRobust(text) {
  const preserveClipboard = CONFIG.preserveClipboard || false;
  let oldClipboard = '';

  if (preserveClipboard) {
    oldClipboard = clipboard.readText();
  }

  // Set clipboard
  clipboard.writeText(text);

  // Use AppleScript with explicit delay and retry
  const script = `
    tell application "System Events"
      delay 0.05
      keystroke "v" using command down
      delay 0.1
      keystroke "v" using command down
    end tell
  `;

  exec(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, (error) => {
    if (error) {
      console.error('Paste error:', error);
      // Fallback: try simple paste
      exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
    }

    // Restore clipboard
    if (preserveClipboard) {
      setTimeout(() => clipboard.writeText(oldClipboard), 400);
    }
  });

  console.log(`✅ Robust paste: ${text.length} characters`);
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
