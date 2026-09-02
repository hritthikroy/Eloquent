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
let canvasW = 60;
let canvasH = 20;
let frameCount = 0;

// PERFORMANCE BOOST: Pre-calculate constants
const BAR_WIDTH = 2;
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
let barHeights = new Float32Array(6).fill(2); // PERFORMANCE: Use typed array

let currentAmp = 0.25;
let isAnimating = false;

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

// Ultra-lightweight 60fps waveform loop
function animate() {
  if (!isAnimating) return;
  animationId = requestAnimationFrame(animate);
  
  frameCount++;
  const t = frameCount * 0.08;
  
  for (let i = 0; i < 6; i++) {
    const centerFactor = 1 - (i / 6) * 0.35;
    const wave = Math.sin(t + i * 0.7) * 0.5 + 0.5;
    const target = (wave * 12 * currentAmp + 2) * centerFactor;
    // Smooth exponential smoothing
    barHeights[i] = barHeights[i] * 0.6 + target * 0.4;
  }
  
  drawBars();
}

function startVisualizer() {
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

// ULTRA-FAST Draw mirrored bars with optimizations
function drawBars() {
  if (!ctx || !canvas) {
    return;
  }
  
  ctx.clearRect(0, 0, canvasW, canvasH);

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  const color = mode === 'rewrite' ? '#a855f7' : '#22c55e';
  ctx.fillStyle = color;
  
  // PERFORMANCE BOOST: Batch all rectangles
  for (let i = 0; i < HALF_BARS; i++) {
    const h = Math.max(barHeights[i] * 0.6, 2);
    const offset = (i * (BAR_WIDTH + BAR_GAP)) + BAR_GAP / 2;
    const y = centerY - h / 2;

    // Right side bar
    ctx.fillRect(centerX + offset, y, BAR_WIDTH, h);
    // Left side bar (mirrored)
    ctx.fillRect(centerX - offset - BAR_WIDTH, y, BAR_WIDTH, h);
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
  startVisualizer();
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
