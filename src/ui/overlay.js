const { ipcRenderer } = require('electron');

// DOM Element References
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

  console.log('✅ Elements initialized:', {
    canvas: !!canvas,
    ctx: !!ctx,
    timer: !!timer,
    overlay: !!overlay
  });
  return true;
}

// State Engine Variables
let mode = 'standard';
let quickPopupMode = false;
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;
let startTime = Date.now();
let canvasW = 60;
let canvasH = 20;

// State Machine: 'idle' | 'listening' | 'thinking' | 'speaking' | 'recording'
let currentState = 'listening';
let currentAgentName = 'Tuk Tuk';
let ipcAmplitude = 0;
let lastIpcTime = 0;

// Agent Aura Colors matching UI design system
const AGENT_COLORS = {
  tuktuk: '#f43f5e',   // Tuk Tuk Rose
  vision: '#06b6d4',   // Vision Cyan
  andrew: '#06b6d4',   // Andrew Cyan (alias)
  friday: '#10b981',   // Friday Emerald
  brian: '#f59e0b',    // Brian Amber
  rewrite: '#a855f7',  // AI Rewriter Purple
  standard: '#22c55e'  // Standard Recording Green
};

function getActiveColor() {
  if (mode === 'rewrite') return AGENT_COLORS.rewrite;
  if (mode === 'standard') return AGENT_COLORS.standard;

  const name = (currentAgentName || '').toLowerCase().trim();
  if (name.includes('tuk')) return AGENT_COLORS.tuktuk;
  if (name.includes('vision') || name.includes('andrew')) return AGENT_COLORS.vision;
  if (name.includes('friday') || name.includes('fry day')) return AGENT_COLORS.friday;
  if (name.includes('brian')) return AGENT_COLORS.brian;

  return AGENT_COLORS.tuktuk; // Default to vibrant Tuk Tuk rose
}

// Smooth Equalizer Bars (6 bars mirrored to make 12)
const HALF_BARS = 6;
let barHeights = new Float32Array(HALF_BARS).fill(3.0);
let frameCount = 0;

// Canvas Setup with DPR Scaling and Matrix Reset
function setupCanvas() {
  if (!canvas || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  console.log('✅ Canvas setup complete:', { width: canvas.width, height: canvas.height, dpr });
}

// Ensure the animation loop is active and resilient
function ensureAnimating() {
  if (!animationId) {
    animationId = requestAnimationFrame(animate);
  }
}

// Initialize Audio Stream with Fallback
let micStream = null;

async function initAudio() {
  try {
    if (micStream) {
      try { micStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      micStream = null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    micStream = stream;

    audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    analyser.minDecibels = -85;
    analyser.maxDecibels = -10;
    source.connect(analyser);

    dataArray = new Uint8Array(analyser.frequencyBinCount);
    console.log('✅ Real mic audio captured for visualizer');
  } catch (err) {
    console.log('⚠️ Mic stream not directly available for visualizer (using synthesized/IPC audio):', err.message);
  }

  ensureAnimating();
}

// 60FPS High-Performance Visualizer Loop
function animate() {
  animationId = requestAnimationFrame(animate);
  frameCount++;

  const now = performance.now();

  // Multi-State Waveform Generator
  if (currentState === 'speaking') {
    // 🗣️ AI IS SPEAKING:
    // Generate organic, vibrant, multi-layered voice waveform simulation
    // This solves the physical problem: hardware echo cancellation zeros mic input while speaker is playing!
    const t = now * 0.0055;
    // Syllabic cadence envelope with natural human pauses (2-4 Hz speech rhythms)
    const cadence1 = Math.sin(t * 1.6) * 0.35;
    const cadence2 = Math.sin(t * 3.8) * 0.25;
    const speechMod = Math.max(0.2, 0.65 + cadence1 + cadence2); // oscillates ~0.2 to 1.25

    for (let i = 0; i < HALF_BARS; i++) {
      const harmonic = Math.sin(t * (2.2 + i * 0.7) + (i * 0.9)) * 0.5 + 0.5;
      const target = 3.0 + (harmonic * speechMod * 13.0); // 3px to 17px
      barHeights[i] = barHeights[i] * 0.6 + target * 0.4;
    }
  } else if (currentState === 'thinking' || currentState === 'working') {
    // 🧠 AI IS THINKING / EXECUTING / WORKING:
    // Equational dual-harmonic quantum compute wave pulsing in agent's signature aura color
    const t = now * 0.0075;
    for (let i = 0; i < HALF_BARS; i++) {
      const harmonic1 = Math.sin(t * 3.5 + i * 0.85);
      const harmonic2 = Math.cos(t * 6.2 - i * 1.2) * 0.5;
      const target = 3.0 + Math.abs(harmonic1 + harmonic2) * 5.5; // 3px to 11.5px
      barHeights[i] = barHeights[i] * 0.6 + target * 0.4;
    }
  } else if (currentState === 'synthesizing') {
    // ⚡ AI IS SYNTHESIZING VOICE:
    // Resonant harmonic wave preparing acoustic output
    const t = now * 0.0065;
    for (let i = 0; i < HALF_BARS; i++) {
      const synthWave = Math.sin(t * 2.8 + i * 0.75) * Math.cos(t * 1.4);
      const target = 3.2 + Math.abs(synthWave) * 7.5; // 3.2px to 10.7px
      barHeights[i] = barHeights[i] * 0.65 + target * 0.35;
    }
  } else if (currentState === 'transcribing') {
    // 👂 TRANSCRIBING / HEARING YOU:
    // Rapid acoustic ingestion ripple wave
    const t = now * 0.009;
    for (let i = 0; i < HALF_BARS; i++) {
      const wave = Math.sin(t * 3.2 + i * 1.15);
      const target = 3.0 + ((wave + 1.0) * 4.2); // 3px to 11.4px
      barHeights[i] = barHeights[i] * 0.6 + target * 0.4;
    }
  } else {
    // 🎙️ LISTENING / RECORDING:
    // Combine real mic analyser + IPC VAD amplitude + subtle breathing idle floor
    let hasRealAudio = false;

    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      if (rms > 8) {
        hasRealAudio = true;
        const boost = rms > 20 ? 1.4 : 1.0;
        for (let i = 0; i < HALF_BARS; i++) {
          const startBin = 2;
          const endBin = Math.floor(dataArray.length * 0.45);
          const idx = startBin + Math.floor((i / HALF_BARS) * (endBin - startBin));
          const val1 = dataArray[Math.max(0, idx - 1)] || 0;
          const val2 = dataArray[idx] || 0;
          const val3 = dataArray[Math.min(dataArray.length - 1, idx + 1)] || 0;
          const avgVal = (val1 + val2 + val3) / 3;
          const target = (avgVal / 255.0) * 15.0 * boost + 2.5;
          barHeights[i] = barHeights[i] * 0.5 + target * 0.5;
        }
      }
    }

    // Check if main process reported amplitude via IPC recently (within 250ms)
    if (!hasRealAudio && (now - lastIpcTime < 250) && ipcAmplitude > 0.05) {
      hasRealAudio = true;
      const targetBase = ipcAmplitude * 15.0;
      for (let i = 0; i < HALF_BARS; i++) {
        const jitter = Math.sin(now * 0.01 + i) * 2.0;
        const target = Math.max(2.5, Math.min(16.0, targetBase + jitter));
        barHeights[i] = barHeights[i] * 0.5 + target * 0.5;
      }
    }

    // If quiet room / idle listening, subtle breathing wave so the pill looks alive and responsive
    if (!hasRealAudio) {
      const t = now * 0.003;
      for (let i = 0; i < HALF_BARS; i++) {
        const idleWave = Math.sin(t * 1.5 + i * 0.6) * 1.2 + 3.0; // 1.8px to 4.2px
        barHeights[i] = barHeights[i] * 0.8 + idleWave * 0.2;
      }
    }
  }

  drawBars();

  // Update timer every 30 frames (~2 times per second)
  if (frameCount % 30 === 0) {
    updateTimer();
  }
}

// Draw Mirrored Rounded Capsule Bars
function drawBars() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvasW, canvasH);

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;
  const barWidth = canvasW <= 40 ? 1.8 : 2.5;
  const barGap = canvasW <= 40 ? 1.5 : 2.5;

  const activeColor = getActiveColor();
  ctx.fillStyle = activeColor;
  ctx.shadowBlur = 6;
  ctx.shadowColor = activeColor;

  for (let i = 0; i < HALF_BARS; i++) {
    const h = Math.max(barHeights[i], 2.5);
    const offset = (i * (barWidth + barGap)) + barGap / 2;
    const y = centerY - h / 2;
    const radius = Math.min(barWidth / 2, h / 2);

    // Right side bar
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(centerX + offset, y, barWidth, h, radius);
    } else {
      ctx.rect(centerX + offset, y, barWidth, h);
    }
    ctx.fill();

    // Left side bar (mirrored)
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(centerX - offset - barWidth, y, barWidth, h, radius);
    } else {
      ctx.rect(centerX - offset - barWidth, y, barWidth, h);
    }
    ctx.fill();
  }
}

// Update Timer Display
function updateTimer() {
  if (!timer) return;

  if (!startTime) {
    timer.textContent = '0:00';
    return;
  }
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Mode Selection Handler
ipcRenderer.on('set-mode', (_, m) => {
  mode = m;
  if (overlay) {
    overlay.classList.remove('fade-out', 'error');
    overlay.classList.toggle('rewrite', m === 'rewrite');
    overlay.classList.toggle('jarvis', m === 'jarvis');
  }

  const recLabel = document.querySelector('.rec-label');
  if (recLabel) {
    if (m === 'rewrite') {
      recLabel.textContent = 'AI Rewriter';
    } else if (m === 'jarvis') {
      recLabel.textContent = `${currentAgentName} listening...`;
    } else {
      recLabel.textContent = 'Recording';
    }
  }

  updateTimer();
  ensureAnimating();
});

// Agent Name & Persona Aura Listener
ipcRenderer.on('set-agent-name', (_, agentName) => {
  if (agentName) {
    currentAgentName = agentName;
    const lower = agentName.toLowerCase();
    if (overlay) {
      overlay.classList.remove('agent-tuktuk', 'agent-vision', 'agent-andrew', 'agent-friday', 'agent-brian');
      if (lower.includes('tuk')) overlay.classList.add('agent-tuktuk');
      else if (lower.includes('vision') || lower.includes('andrew')) overlay.classList.add('agent-vision');
      else if (lower.includes('friday') || lower.includes('fry day')) overlay.classList.add('agent-friday');
      else if (lower.includes('brian')) overlay.classList.add('agent-brian');
    }

    const recLabel = document.querySelector('.rec-label');
    if (recLabel) {
      if (currentState === 'speaking') {
        recLabel.textContent = `${currentAgentName} speaking...`;
      } else if (currentState === 'thinking') {
        recLabel.textContent = `${currentAgentName} thinking...`;
      } else if (currentState === 'working') {
        recLabel.textContent = `${currentAgentName} working...`;
      } else if (currentState === 'synthesizing') {
        recLabel.textContent = `${currentAgentName} readying voice...`;
      } else if (currentState === 'transcribing') {
        recLabel.textContent = 'Hearing you...';
      } else if (currentState === 'listening') {
        recLabel.textContent = `${currentAgentName} listening...`;
      } else {
        recLabel.textContent = currentAgentName;
      }
    }
    ensureAnimating();
  }
});

// Helper to switch overlay CSS states cleanly
function setOverlayStateClass(stateName) {
  if (!overlay) return;
  overlay.classList.remove('thinking', 'working', 'transcribing', 'synthesizing');
  if (stateName === 'thinking' || stateName === 'working' || stateName === 'transcribing' || stateName === 'synthesizing') {
    overlay.classList.add(stateName);
  }
}

// Jarvis / Agent Lifecycle Events
ipcRenderer.on('jarvis-transcribing', () => {
  currentState = 'transcribing';
  setOverlayStateClass('transcribing');
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) recLabel.textContent = 'Hearing you...';
  ensureAnimating();
});

ipcRenderer.on('jarvis-thinking', (_, data) => {
  currentState = 'thinking';
  if (data && data.agent) currentAgentName = data.agent;
  setOverlayStateClass('thinking');
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) recLabel.textContent = `${currentAgentName} thinking...`;
  ensureAnimating();
});

ipcRenderer.on('jarvis-working', (_, data) => {
  currentState = 'working';
  if (data && data.agent) currentAgentName = data.agent;
  const action = (data && data.action) ? data.action : 'working';
  setOverlayStateClass('working');
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) recLabel.textContent = `${currentAgentName} ${action}...`;
  ensureAnimating();
});

ipcRenderer.on('jarvis-synthesizing', (_, data) => {
  currentState = 'synthesizing';
  if (data && data.agent) currentAgentName = data.agent;
  setOverlayStateClass('synthesizing');
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) recLabel.textContent = `${currentAgentName} readying voice...`;
  ensureAnimating();
});

ipcRenderer.on('jarvis-speaking', (_, data) => {
  currentState = 'speaking';
  if (data && data.agent) currentAgentName = data.agent;
  setOverlayStateClass('speaking');
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) recLabel.textContent = `${currentAgentName} speaking...`;
  ensureAnimating();
});

ipcRenderer.on('jarvis-listening', (_, data) => {
  currentState = 'listening';
  if (data && data.agent) currentAgentName = data.agent;
  setOverlayStateClass('listening');
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) recLabel.textContent = `${currentAgentName} listening...`;
  ensureAnimating();
});

ipcRenderer.on('amplitude-update', (_, amp) => {
  ipcAmplitude = Math.max(0, Math.min(1.0, amp || 0));
  lastIpcTime = performance.now();
  ensureAnimating();
});

ipcRenderer.on('live-polishing', () => {
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) recLabel.textContent = 'Polishing...';
  ensureAnimating();
});

ipcRenderer.on('live-done', () => {
  const recLabel = document.querySelector('.rec-label');
  if (recLabel) recLabel.textContent = 'Done!';
  ensureAnimating();
});

// Recording Started Handler
ipcRenderer.on('recording-started', (_, recordingStartTime) => {
  console.log('🎙️ Recording started event received:', recordingStartTime);
  startTime = recordingStartTime;
  currentState = mode === 'jarvis' ? 'listening' : 'recording';

  if (overlay) {
    overlay.style.display = '';
    overlay.classList.remove('fade-out', 'error', 'thinking');
  }

  const recLabel = document.querySelector('.rec-label');
  if (recLabel) {
    if (mode === 'rewrite') {
      recLabel.textContent = 'AI Rewriter';
    } else if (mode === 'jarvis') {
      recLabel.textContent = `${currentAgentName} listening...`;
    } else {
      recLabel.textContent = 'Recording';
    }
  }

  if (!audioContext || audioContext.state === 'closed') {
    initAudio();
  } else if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }

  ensureAnimating();
  updateTimer();

  if (window.timerInterval) clearInterval(window.timerInterval);
  window.timerInterval = setInterval(() => {
    updateTimer();
  }, 1000);
});

// Quick Popup Mode
ipcRenderer.on('quick-popup-mode', (_, enabled) => {
  quickPopupMode = enabled;
  if (overlay) {
    overlay.classList.toggle('quick-popup', enabled);
  }

  if (enabled) {
    canvasW = 40;
    canvasH = 16;
  } else {
    canvasW = 60;
    canvasH = 20;
  }
  setupCanvas();
  updateTimer();
  ensureAnimating();
});

// Resilient Error Handling (Timer notification without killing visualizer loop)
ipcRenderer.on('error', (_, errorMsg) => {
  console.error('Recording error:', errorMsg);
  const displayMsg = errorMsg ? (errorMsg.length > 20 ? `${errorMsg.substring(0, 20)}...` : errorMsg) : 'Error';
  if (timer) {
    timer.textContent = displayMsg;
    timer.title = errorMsg || 'Error';
  }
  ensureAnimating();
});

// Renderer-side cleanup (stop tracks, audioContext, animations, and hide DOM)
function cleanupRenderer() {
  // 1. Immediately stop all mic tracks in renderer
  if (micStream) {
    try {
      micStream.getTracks().forEach(t => t.stop());
    } catch (e) {}
    micStream = null;
  }

  // 2. Immediately close / suspend audioContext
  if (audioContext) {
    try {
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    } catch (e) {}
    audioContext = null;
  }

  // 3. Cancel rendering loop and intervals
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
    window.timerInterval = null;
  }

  // 4. Instantly vanish the overlay visually
  if (overlay) {
    overlay.classList.add('fade-out');
    overlay.style.display = 'none';
  }
}

// User-initiated ESC abort (sends signal to main process once)
function userAbortSession() {
  console.log('⚡ ESC pressed - user hard abort (0ms latency)');
  cleanupRenderer();
  try {
    ipcRenderer.send('abort-session');
  } catch (e) {}
}

// User Keyboard Stop (ESC key) - capture phase for instant intercept
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    console.log('⌨️ ESC key detected in overlay - instant abort');
    userAbortSession();
  }
}, { capture: true });

// One-way signals from main process (clean up renderer only, NEVER re-emit abort-session)
ipcRenderer.on('close-with-animation', () => {
  cleanupRenderer();
});

ipcRenderer.on('session-aborted', () => {
  cleanupRenderer();
});

// Initialization
function initialize() {
  console.log('🎬 Initializing overlay...');

  if (!initializeElements()) {
    console.error('❌ Failed to initialize elements');
    return;
  }

  setupCanvas();
  updateTimer();
  initAudio();

  console.log('✅ Overlay initialized successfully');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Cleanup on Unload
window.addEventListener('beforeunload', () => {
  if (audioContext) audioContext.close().catch(() => {});
  if (animationId) cancelAnimationFrame(animationId);
  if (window.timerInterval) clearInterval(window.timerInterval);
});
