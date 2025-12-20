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

// Initialize audio
async function initAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    audioContext = new AudioContext({ latencyHint: 'interactive' });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    animate();
  } catch (err) {
    console.error('Mic error:', err);
    animateFake();
  }
}

// ULTRA-FAST Real audio animation with optimizations
let frameCount = 0;
function animate() {
  animationId = requestAnimationFrame(animate);
  
  // PERFORMANCE BOOST: Only update every other frame for smoother performance
  frameCount++;
  if (frameCount % 2 !== 0) return;
  
  analyser.getByteFrequencyData(dataArray);

  // Map frequency data to 6 bars (center has highest energy)
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor((i / 6) * dataArray.length);
    const target = (dataArray[idx] / 255) * 16 + 2;
    barHeights[i] = barHeights[i] * 0.7 + target * 0.3;
  }

  drawBars();
  
  // PERFORMANCE BOOST: Update timer every 30 frames (~2 times per second is enough)
  if (frameCount % 30 === 0) {
    updateTimer();
  }
}

// ULTRA-FAST Fake animation fallback with optimizations
function animateFake() {
  let t = 0;
  let frameCount = 0;
  function loop() {
    animationId = requestAnimationFrame(loop);
    frameCount++;
    
    // PERFORMANCE BOOST: Update bars every 3rd frame
    if (frameCount % 3 === 0) {
      for (let i = 0; i < 6; i++) {
        const centerFactor = 1 - (i / 6) * 0.4;
        const target = (Math.sin(t * 0.06 + i * 0.5) * 6 + 10) * centerFactor;
        barHeights[i] = barHeights[i] * 0.8 + target * 0.2;
      }
      drawBars();
      t++;
    }
    
    // PERFORMANCE BOOST: Update timer every 60 frames
    if (frameCount % 60 === 0) {
      updateTimer();
    }
  }
  loop();
}

// Quick popup animation - fast and energetic
function animateQuickPopup() {
  let t = 0;
  let frameCount = 0;
  function loop() {
    animationId = requestAnimationFrame(loop);
    frameCount++;
    
    // PERFORMANCE: Update every other frame
    if (frameCount % 2 === 0) {
      for (let i = 0; i < 6; i++) {
        const centerFactor = 1 - (i / 6) * 0.3;
        const target = (Math.sin(t * 0.15 + i * 0.8) * 8 + 12) * centerFactor;
        barHeights[i] = barHeights[i] * 0.6 + target * 0.4;
      }
      drawBars();
      t++;
    }
    
    if (frameCount % 30 === 0) {
      updateTimer();
    }
  }
  loop();
}

// ULTRA-FAST Draw mirrored bars with optimizations
function drawBars() {
  if (!ctx || !canvas) {
    console.error('Cannot draw bars - canvas not ready');
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
    console.log('⏱️ Timer updated');
  }, 1000);
  
  console.log('✅ Timer interval started');
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

// Cancel recording
function cancel() {
  if (audioContext) audioContext.close();
  if (animationId) cancelAnimationFrame(animationId);
  if (window.timerInterval) clearInterval(window.timerInterval);
  window.close();
}

// ESC to cancel
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    cancel();
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
