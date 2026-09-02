const { ipcRenderer } = require('electron');

// Wait for DOM to be fully loaded before accessing elements
let canvas, ctx, timer, overlay;

function initializeElements() {
  canvas = document.getElementById('waveCanvas');
  timer = document.getElementById('timer');
  overlay = document.getElementById('overlay');
  
  if (!canvas) {
    console.error('Canvas element not found!');
    return false;
  }
  
  ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  
  if (!ctx) {
    console.error('Could not get canvas context!');
    return false;
  }
  
  console.log('✅ Elements initialized:', { canvas: !!canvas, ctx: !!ctx, timer: !!timer, overlay: !!overlay });
  return true;
}

let mode = 'standard';
let quickPopupMode = false;
let audioContext;
let analyser;
let dataArray;
let animationId;
let startTime = Date.now();
let canvasW = 76;
let canvasH = 24;

// Professional Equalizer: 12 sleek rounded capsule bars (6 mirrored pairs)
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const HALF_BARS = 6;

// Setup canvas after DOM ready
function setupCanvas() {
  if (!canvas || !ctx) {
    console.error('Cannot setup canvas - elements not initialized');
    return;
  }
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  canvas.style.width = canvasW + 'px';
  canvas.style.height = canvasH + 'px';
  ctx.scale(dpr, dpr);
  
  console.log('✅ Canvas setup complete:', { width: canvas.width, height: canvas.height, dpr });
}

// Smooth bar heights (6 bars, mirrored to make 12)
let barHeights = new Float32Array(HALF_BARS).fill(3);

let ipcAmplitude = 0;
let smoothAmplitude = 0;

// Initialize real-time Web Audio analyser with microphone
async function initAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true
      }
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 128; // 64 frequency bins
    analyser.smoothingTimeConstant = 0.5; // Fast, snappy response to voice!
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    console.log('✅ Real mic audio captured for visualizer! Bins:', analyser.frequencyBinCount);
    animate();
  } catch (err) {
    console.warn('⚠️ getUserMedia unavailable, using IPC amplitude fallback:', err);
    animateFromIPC();
  }
}

// Listen for amplitude data from main process as backup
ipcRenderer.on('amplitude', (_, amp) => {
  ipcAmplitude = amp;
});

// Professional Voice-Reactive Animation (Web Audio FFT)
let frameCount = 0;
function animate() {
  animationId = requestAnimationFrame(animate);
  frameCount++;

  analyser.getByteFrequencyData(dataArray);

  // Compute average energy in human vocal speech frequencies (bins 1 to 16, ~80Hz - 6000Hz)
  let voiceEnergySum = 0;
  const numVoiceBins = 16;
  for (let b = 1; b <= numVoiceBins; b++) {
    voiceEnergySum += dataArray[b] || 0;
  }
  const avgVoiceEnergy = voiceEnergySum / (numVoiceBins * 255); // 0.0 to 1.0
  const isSpeaking = avgVoiceEnergy > 0.05;

  // Map 6 bars (mirrored to 12) across vocal speech spectrum
  for (let i = 0; i < HALF_BARS; i++) {
    // i = 0 is center, i = 5 is outer edge
    // Center bars get powerful low-mid frequencies (vowels)
    // Outer bars get upper mid/high frequencies (consonants)
    const binIdx = Math.min(1 + Math.floor(i * 1.6), dataArray.length - 1);
    const binVal = (dataArray[binIdx] || 0) / 255;
    
    if (isSpeaking) {
      // Dynamic jumping proportional to vocal intensity
      const vocalTarget = (binVal * 0.7 + avgVoiceEnergy * 0.3) * (canvasH - 4);
      const target = Math.max(3, vocalTarget + 2);
      // Fast attack for snappy jumps, smooth fall
      if (target > barHeights[i]) {
        barHeights[i] = barHeights[i] * 0.3 + target * 0.7; // Fast jump up!
      } else {
        barHeights[i] = barHeights[i] * 0.78 + target * 0.22; // Smooth drop
      }
    } else {
      // Subtle elegant breathing pulse when not speaking so it feels alive
      const idleWave = Math.sin(frameCount * 0.08 + i * 0.6) * 1.5 + 3.5;
      barHeights[i] = barHeights[i] * 0.82 + idleWave * 0.18;
    }
  }

  drawBars();

  if (frameCount % 30 === 0) {
    updateTimer();
  }
}

// Fallback animation using Node IPC amplitude
function animateFromIPC() {
  function loop() {
    animationId = requestAnimationFrame(loop);
    frameCount++;

    if (ipcAmplitude > smoothAmplitude) {
      smoothAmplitude = smoothAmplitude * 0.35 + ipcAmplitude * 0.65; // Fast attack
    } else {
      smoothAmplitude = smoothAmplitude * 0.82 + ipcAmplitude * 0.18; // Smooth decay
    }

    const isSpeaking = smoothAmplitude > 0.08;

    for (let i = 0; i < HALF_BARS; i++) {
      const centerFactor = 1 - (i / HALF_BARS) * 0.35;
      if (isSpeaking) {
        const harmonic = Math.sin(frameCount * 0.2 + i * 0.9) * 0.35 + 0.65;
        const target = Math.max(3, (smoothAmplitude * (canvasH - 4) * harmonic + 2) * centerFactor);
        barHeights[i] = barHeights[i] * 0.35 + target * 0.65;
      } else {
        const idleWave = Math.sin(frameCount * 0.08 + i * 0.6) * 1.5 + 3.5;
        barHeights[i] = barHeights[i] * 0.82 + idleWave * 0.18;
      }
    }

    drawBars();

    if (frameCount % 30 === 0) {
      updateTimer();
    }
  }
  loop();
}

// Draw mirrored rounded capsule equalizer bars
function drawBars() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvasW, canvasH);

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  const color = mode === 'rewrite' ? '#a855f7' : '#22c55e';
  ctx.fillStyle = color;

  const radius = BAR_WIDTH / 2;

  for (let i = 0; i < HALF_BARS; i++) {
    const h = Math.max(3, Math.min(barHeights[i], canvasH - 2));
    const offset = (i * (BAR_WIDTH + BAR_GAP)) + BAR_GAP / 2;
    const y = Math.round(centerY - h / 2);

    // Right side bar (rounded capsule)
    const rightX = Math.round(centerX + offset);
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(rightX, y, BAR_WIDTH, h, radius);
    } else {
      ctx.rect(rightX, y, BAR_WIDTH, h);
    }
    ctx.fill();

    // Left side bar (mirrored rounded capsule)
    const leftX = Math.round(centerX - offset - BAR_WIDTH);
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(leftX, y, BAR_WIDTH, h, radius);
    } else {
      ctx.rect(leftX, y, BAR_WIDTH, h);
    }
    ctx.fill();
  }
}

// Update timer
function updateTimer() {
  if (!timer) {
    console.error('Timer element not found');
    return;
  }
  
  if (!startTime) {
    timer.textContent = '0:00';
    return;
  }
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Set mode
ipcRenderer.on('set-mode', (_, m) => {
  mode = m;
  overlay.classList.toggle('rewrite', m === 'rewrite');
  
  // Update label based on mode
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) {
    if (m === 'rewrite') {
      recLabel.textContent = 'AI Rewriter';
    } else {
      recLabel.textContent = 'Recording';
    }
  }
  
  // Ensure timer is visible and initialized
  updateTimer();
});

// Listen for recording start time from main process
ipcRenderer.on('recording-started', (_, recordingStartTime) => {
  console.log('🎙️ Recording started event received:', recordingStartTime);
  startTime = recordingStartTime;
  updateTimer(); // Update immediately

  // Start timer updates every second
  if (window.timerInterval) clearInterval(window.timerInterval);
  window.timerInterval = setInterval(() => {
    updateTimer();
  }, 1000);
});

// Quick popup mode
ipcRenderer.on('quick-popup-mode', (_, enabled) => {
  quickPopupMode = enabled;
  overlay.classList.toggle('quick-popup', enabled);
  
  if (enabled) {
    // Update canvas size for quick popup
    canvasW = 40;
    canvasH = 16;
    setupCanvas();
    
    // Initialize timer for quick mode
    updateTimer();
    
    // Start quick animation immediately
    animateQuickPopup();
  }
});

// Error handling
ipcRenderer.on('error', (_, errorMsg) => {
  console.error('Recording error:', errorMsg);
  
  // Stop animations and timer
  if (animationId) cancelAnimationFrame(animationId);
  if (window.timerInterval) clearInterval(window.timerInterval);
  
  // Add error class to overlay for styling
  overlay.classList.add('error');
  
  // Update overlay to show error state
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) {
    recLabel.textContent = 'Error';
  }
  
  // Show error message in timer area (truncate if too long)
  const displayMsg = errorMsg ? (errorMsg.length > 50 ? errorMsg.substring(0, 50) + '...' : errorMsg) : 'Unknown error';
  timer.textContent = displayMsg;
  timer.title = errorMsg || 'Error'; // Full message on hover
  
  // Clear waveform
  ctx.clearRect(0, 0, canvasW, canvasH);
});

// Listen for close-with-animation from main process
ipcRenderer.on('close-with-animation', () => {
  console.log('🎬 Close with animation requested');
  
  // Add fade-out animation
  if (overlay) {
    overlay.classList.add('fade-out');
  }
  
  // Clean up audio resources
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
    window.timerInterval = null;
  }
  
  // Window will be closed by main process after animation
});

// Stop recording (triggered by ESC key)
function stopRecording() {
  console.log('🛑 ESC pressed - stopping recording');
  
  // Add fade-out animation before closing
  if (overlay) {
    overlay.classList.add('fade-out');
  }
  
  // Clean up audio resources
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
    window.timerInterval = null;
  }
  
  // Notify main process to stop recording with a small delay for animation
  setTimeout(() => {
    ipcRenderer.send('stop-recording');
    console.log('✅ Stop recording signal sent to main process');
  }, 150); // Small delay to allow fade-out animation
}

// ESC key to stop recording (works in both modes)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    console.log('⌨️ ESC key detected in overlay');
    stopRecording();
  }
});

// Initialize when DOM is ready
function initialize() {
  console.log('🎬 Initializing overlay...');
  
  if (!initializeElements()) {
    console.error('❌ Failed to initialize elements');
    return;
  }
  
  setupCanvas();
  updateTimer(); // Show initial time (will show 0:00 until recording starts)
  initAudio();
  
  console.log('✅ Overlay initialized successfully');
}

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOM is already loaded
  initialize();
}

// Cleanup
window.addEventListener('beforeunload', () => {
  if (audioContext) audioContext.close();
  if (animationId) cancelAnimationFrame(animationId);
  if (window.timerInterval) clearInterval(window.timerInterval);
});
