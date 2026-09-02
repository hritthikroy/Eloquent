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
let canvasW = 66;
let canvasH = 22;
let frameCount = 0;

// Dynamic acoustic parameters
const BAR_WIDTH = 2.5;
const BAR_GAP = 3;
const HALF_BARS = 6; // 12 mirrored bars total across 66px

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
let barHeights = new Float32Array(6).fill(2.5);

let currentAmp = 0.25;
let isAnimating = false;
let noiseFloor = 12.0; // Adaptive background noise cancellation baseline

// Initialize real microphone audio with FULL NOISE CANCELLATION & AGC
async function initAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,      // Hardware/driver echo cancellation
        noiseSuppression: true,      // Built-in WebRTC noise cancellation (cleans fan/ambient hum)
        autoGainControl: true,       // Auto-levels soft vs loud speech
        channelCount: 1,
        sampleRate: 48000
      }
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.45; // Snappy & emotionally responsive
    analyser.minDecibels = -85;
    analyser.maxDecibels = -10;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    console.log('✅ Real audio initialized: Full Noise Cancellation + Acoustic Voice Measurement active');
    startVisualizer();
  } catch (err) {
    console.warn('Microphone WebAudio fallback to simulated:', err);
    startVisualizer();
  }
}

// IPC listener for real-time audio amplitude from main process
ipcRenderer.on('amplitude', (_, amp) => {
  if (typeof amp === 'number') {
    currentAmp = Math.max(0.15, Math.min(1.0, amp));
  }
});

ipcRenderer.on('voice-activity', (_, hasVoice) => {
  if (hasVoice) {
    currentAmp = Math.max(currentAmp, 0.6);
  }
});

// 60fps Emotional voice waveform loop with adaptive noise gating & formant measurement
function animate() {
  if (!isAnimating) return;
  animationId = requestAnimationFrame(animate);
  frameCount++;
  
  if (analyser && dataArray) {
    // 1. Capture real audio spectrum
    analyser.getByteFrequencyData(dataArray);

    // 2. Measure overall voice acoustic energy (RMS)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // 3. Adaptive Noise Floor Tracking (Background noise cancellation)
    if (rms < noiseFloor) {
      noiseFloor = noiseFloor * 0.92 + rms * 0.08; // Rapid downward tracking on silence
    } else {
      noiseFloor = noiseFloor * 0.998 + rms * 0.002; // Very slow drift for ambient noise
    }
    noiseFloor = Math.max(6.0, Math.min(26.0, noiseFloor));

    // Signal-to-Noise Ratio (voice energy above ambient room floor)
    const voiceSNR = Math.max(0, rms - noiseFloor);
    const isSpeaking = voiceSNR > 2.5;

    // 4. Human Voice Formant Bands (Fundamental pitch, vowels, consonants, air)
    const bandBins = [
      [1, 2],    // 100-280 Hz: Pitch / Chest voice fundamental
      [3, 5],    // 280-560 Hz: Warmth / Body vowels ("oo", "ah")
      [6, 10],   // 560-1100 Hz: Formant 1 (clarity & core vowels)
      [11, 18],  // 1100-2000 Hz: Formant 2 (speech articulation & diction)
      [19, 32],  // 2000-3500 Hz: Emotional presence & consonant bite
      [33, 48]   // 3500-5500 Hz: Sibilance ("s", "sh", "th", breath)
    ];

    const t = frameCount * 0.05;

    for (let i = 0; i < HALF_BARS; i++) {
      let bandEnergy = 0;
      const [bStart, bEnd] = bandBins[i];
      for (let b = bStart; b <= bEnd; b++) {
        bandEnergy += dataArray[b] || 0;
      }
      bandEnergy /= (bEnd - bStart + 1);

      // Noise gate: Subtract noise floor per band
      const cleanEnergy = Math.max(0, bandEnergy - noiseFloor * 1.15);

      let target;
      if (isSpeaking && cleanEnergy > 0) {
        // High-emotion dynamic vocal response with perceptual curve
        const normalized = Math.min(1.0, cleanEnergy / 185);
        const curved = Math.pow(normalized, 0.72); // Perceptual expansion
        const emotionBoost = Math.min(1.75, 1.0 + (voiceSNR / 28));
        target = Math.max(2.5, curved * 18 * emotionBoost);
      } else {
        // Idle organic breathing pulse when quiet (calm, alive, zero jitter)
        const breath = Math.sin(t + i * 0.6) * 0.7 + 2.3;
        target = Math.max(2.0, breath);
      }

      // Ballistics: Snappy Attack (voice pops up instantly), Musical Decay (smooth glide down)
      if (target > barHeights[i]) {
        barHeights[i] = barHeights[i] * 0.22 + target * 0.78; // Fast attack
      } else {
        barHeights[i] = barHeights[i] * 0.83 + target * 0.17; // Musical smooth decay
      }
    }
  } else {
    // Fallback while connecting
    const t = frameCount * 0.08;
    for (let i = 0; i < HALF_BARS; i++) {
      const centerFactor = 1 - (i / 6) * 0.35;
      const wave = Math.sin(t + i * 0.7) * 0.5 + 0.5;
      const target = (wave * 12 * currentAmp + 2.5) * centerFactor;
      barHeights[i] = barHeights[i] * 0.6 + target * 0.4;
    }
  }
  
  drawBars();
}

function startVisualizer() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
  if (!isAnimating) {
    isAnimating = true;
    animate();
  }
}

function stopVisualizer() {
  isAnimating = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvasW, canvasH);
  }
}

// ULTRA-FAST Draw mirrored bars with emotional gradient & pill curves
function drawBars() {
  if (!ctx || !canvas) {
    return;
  }
  
  ctx.clearRect(0, 0, canvasW, canvasH);

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // Rich, vibrant multi-stop linear gradient for depth and emotion
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
  if (mode === 'rewrite') {
    grad.addColorStop(0, '#c084fc');   // Radiant Lilac top
    grad.addColorStop(0.5, '#a855f7'); // Vibrant Purple center
    grad.addColorStop(1, '#7c3aed');   // Royal Violet base
  } else {
    grad.addColorStop(0, '#6ee7b7');   // Bright Mint top
    grad.addColorStop(0.5, '#22c55e'); // Vibrant Emerald center
    grad.addColorStop(1, '#16a34a');   // Rich Forest green base
  }
  ctx.fillStyle = grad;
  
  const radius = BAR_WIDTH / 2;

  // Draw rounded equalizer bars
  for (let i = 0; i < HALF_BARS; i++) {
    const h = Math.max(barHeights[i], 2.5);
    const offset = (i * (BAR_WIDTH + BAR_GAP)) + BAR_GAP / 2;
    const y = centerY - h / 2;

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(centerX + offset, y, BAR_WIDTH, h, radius);
      ctx.roundRect(centerX - offset - BAR_WIDTH, y, BAR_WIDTH, h, radius);
      ctx.fill();
    } else {
      ctx.fillRect(centerX + offset, y, BAR_WIDTH, h);
      ctx.fillRect(centerX - offset - BAR_WIDTH, y, BAR_WIDTH, h);
    }
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
  if (overlay) {
    overlay.classList.remove('fade-out', 'error', 'processing');
    overlay.classList.toggle('rewrite', m === 'rewrite');
  }
  
  // Update label based on mode
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) {
    recLabel.textContent = m === 'rewrite' ? 'AI Rewriter' : 'Recording';
  }
  
  // Ensure timer is visible and reset
  startTime = Date.now();
  updateTimer();
  startVisualizer();
});

// Magic Processing state: show glowing animation while AI is transcribing/rewriting
ipcRenderer.on('processing', (_, m) => {
  if (overlay) {
    overlay.classList.remove('fade-out', 'error');
    overlay.classList.add('processing');
  }
  
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
    window.timerInterval = null;
  }
  
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) {
    recLabel.textContent = (m || mode) === 'rewrite' ? '✨ Enhancing...' : '⚡ Transcribing...';
  }
  
  // Waveform runs an energetic magic shimmer
  currentAmp = 0.85;
  startVisualizer();
});

// Listen for recording start time from main process
ipcRenderer.on('recording-started', (_, recordingStartTime) => {
  startTime = recordingStartTime || Date.now();
  if (overlay) {
    overlay.classList.remove('fade-out', 'error', 'processing');
  }
  updateTimer();
  startVisualizer();
  
  // Start timer updates every second
  if (window.timerInterval) clearInterval(window.timerInterval);
  window.timerInterval = setInterval(() => {
    updateTimer();
  }, 1000);
});

// Quick popup mode
ipcRenderer.on('quick-popup-mode', (_, enabled) => {
  quickPopupMode = enabled;
  if (overlay) {
    overlay.classList.toggle('quick-popup', enabled);
  }
  if (enabled) {
    canvasW = 40;
    canvasH = 16;
    setupCanvas();
    updateTimer();
  }
});

// Error handling
ipcRenderer.on('error', (_, errorMsg) => {
  console.error('Recording error:', errorMsg);
  
  stopVisualizer();
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
    window.timerInterval = null;
  }
  
  if (overlay) {
    overlay.classList.add('error');
  }
  
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) {
    recLabel.textContent = 'Error';
  }
  
  const displayMsg = errorMsg ? (errorMsg.length > 50 ? errorMsg.substring(0, 50) + '...' : errorMsg) : 'Unknown error';
  if (timer) {
    timer.textContent = displayMsg;
    timer.title = errorMsg || 'Error';
  }
});

// Listen for close-with-animation from main process
ipcRenderer.on('close-with-animation', () => {
  if (overlay) {
    overlay.classList.add('fade-out');
  }
  stopVisualizer();
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
    window.timerInterval = null;
  }
});

// Stop recording (triggered by ESC key)
function stopRecording() {
  console.log('🛑 ESC pressed - stopping recording');
  if (overlay) {
    overlay.classList.add('fade-out');
  }
  stopVisualizer();
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
    window.timerInterval = null;
  }
  
  setTimeout(() => {
    ipcRenderer.send('stop-recording');
  }, 100);
}

// ESC key to stop recording
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    stopRecording();
  }
});

// Initialize when DOM is ready
function initialize() {
  if (!initializeElements()) {
    console.error('❌ Failed to initialize elements');
    return;
  }
  
  setupCanvas();
  updateTimer();
  initAudio();
  console.log('✅ Overlay elements & canvas ready');
}

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Cleanup
window.addEventListener('beforeunload', () => {
  stopVisualizer();
  if (window.timerInterval) clearInterval(window.timerInterval);
});
