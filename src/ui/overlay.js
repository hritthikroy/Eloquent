const { ipcRenderer } = require('electron');
const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d');
const timer = document.getElementById('timer');
const overlay = document.getElementById('overlay');

let mode = 'standard';
let quickPopupMode = false;
let audioContext;
let analyser;
let dataArray;
let animationId;
let startTime = Date.now();
let canvasW = 60;
let canvasH = 20;

// Setup canvas after DOM ready
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  canvas.style.width = canvasW + 'px';
  canvas.style.height = canvasH + 'px';
  ctx.scale(dpr, dpr);
}

// Smooth bar heights (6 bars, mirrored to make 12)
let barHeights = new Array(6).fill(2);

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
  analyser.getByteFrequencyData(dataArray);

  // Map frequency data to 6 bars (center has highest energy)
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor((i / 6) * dataArray.length);
    const target = (dataArray[idx] / 255) * 16 + 2;
    barHeights[i] = barHeights[i] * 0.7 + target * 0.3;
  }

  drawBars();
  
  // PERFORMANCE BOOST: Update timer less frequently (every 10 frames = ~6 times per second)
  frameCount++;
  if (frameCount % 10 === 0) {
    updateTimer();
  }
}

// ULTRA-FAST Fake animation fallback with optimizations
function animateFake() {
  let t = 0;
  let frameCount = 0;
  function loop() {
    animationId = requestAnimationFrame(loop);
    
    // PERFORMANCE BOOST: Update bars less frequently for fake animation
    if (frameCount % 2 === 0) {
      for (let i = 0; i < 6; i++) {
        // Center bars (i=0) are tallest, outer bars shorter
        const centerFactor = 1 - (i / 6) * 0.4;
        const target = (Math.sin(t * 0.06 + i * 0.5) * 6 + 10) * centerFactor;
        barHeights[i] = barHeights[i] * 0.8 + target * 0.2;
      }
      drawBars();
      t++;
    }
    
    // PERFORMANCE BOOST: Update timer less frequently
    frameCount++;
    if (frameCount % 10 === 0) {
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
    
    // Fast, energetic animation for quick popup
    for (let i = 0; i < 6; i++) {
      const centerFactor = 1 - (i / 6) * 0.3;
      // Faster oscillation and higher amplitude for quick popup
      const target = (Math.sin(t * 0.15 + i * 0.8) * 8 + 12) * centerFactor;
      barHeights[i] = barHeights[i] * 0.6 + target * 0.4; // Faster response
    }
    drawBars();
    t++;
    
    // Update timer less frequently
    frameCount++;
    if (frameCount % 15 === 0) {
      updateTimer(); // Use actual timer instead of random messages
    }
  }
  loop();
}

// ULTRA-FAST Draw mirrored bars with optimizations
function drawBars() {
  // PERFORMANCE BOOST: Use faster clearRect
  ctx.clearRect(0, 0, canvasW, canvasH);

  const halfBars = 6; // 6 bars on each side
  const barWidth = 2;
  const gap = 3;
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  const color = mode === 'rewrite' ? '#a855f7' : '#22c55e';
  
  // PERFORMANCE BOOST: Set fillStyle once outside loop
  ctx.fillStyle = color;
  
  // Draw bars from center outward (mirrored left and right)
  for (let i = 0; i < halfBars; i++) {
    const h = Math.max(barHeights[i] * 0.6, 2);
    const offset = (i * (barWidth + gap)) + gap / 2;

    // Right side bar
    ctx.fillRect(centerX + offset, centerY - h / 2, barWidth, h);

    // Left side bar (mirrored)
    ctx.fillRect(centerX - offset - barWidth, centerY - h / 2, barWidth, h);
  }
}

// Update timer
function updateTimer() {
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
});

// Listen for recording start time from main process
ipcRenderer.on('recording-started', (_, recordingStartTime) => {
  console.log('Recording started at:', recordingStartTime);
  startTime = recordingStartTime;
  updateTimer(); // Update immediately
  
  // Start timer updates every second
  if (window.timerInterval) clearInterval(window.timerInterval);
  window.timerInterval = setInterval(updateTimer, 1000);
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
  timer.textContent = 'Error';
  timer.style.color = '#ef4444';
  // Stop the timer updates when there's an error
  if (animationId) cancelAnimationFrame(animationId);
  if (window.timerInterval) clearInterval(window.timerInterval);
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

// Initialize
setupCanvas();
updateTimer(); // Show initial time (will show 0:00 until recording starts)
initAudio();

// Cleanup
window.addEventListener('beforeunload', () => {
  if (audioContext) audioContext.close();
  if (animationId) cancelAnimationFrame(animationId);
  if (window.timerInterval) clearInterval(window.timerInterval);
});
