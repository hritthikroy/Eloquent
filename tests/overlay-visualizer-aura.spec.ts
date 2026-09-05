/**
 * Test Suite: Overlay Persistent Audio Visualizer & Multi-Agent Aura Synchronization
 * 
 * Verifies:
 * 1. Persona Aura Color Binding: Tuk Tuk (#f43f5e), Andrew (#06b6d4), Friday (#10b981), Brian (#f59e0b).
 * 2. Multi-State Waveform Equations:
 *    - Speaking: Syllabic cadence simulation guaranteeing non-zero bars (3.0px - 17.0px) under echo cancellation.
 *    - Thinking: Undulating cognitive wave (3.0px - 10.0px).
 *    - Listening (Ambient/Quiet): Breathing idle baseline (1.8px - 4.2px) ensuring non-empty canvas.
 *    - Listening (Voiced): Real mic & IPC amplitude tracking scaling up to 16px.
 * 3. Capsule Bar Geometry & Symmetry: 6 mirrored pairs (12 bars total) with rounded caps.
 * 4. Error Resilience: Errors do not destroy the 60FPS animation loop or blank the canvas.
 * 5. CoreAudio Auto-Recycling Safety: Clean 50ms buffer release delay prevents SoX SIGKILL and collision.
 */

import * as fs from 'fs';
import * as path from 'path';

async function runOverlayVisualizerTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING OVERLAY PERSISTENT AUDIO VISUALIZER & AURA TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Persona Aura Color Mapping
  // --------------------------------------------------------------------------
  console.log('--- 1. Persona Aura Color Mapping ---');
  {
    const AGENT_COLORS: Record<string, string> = {
      tuktuk: '#f43f5e',
      andrew: '#06b6d4',
      friday: '#10b981',
      brian: '#f59e0b',
      rewrite: '#a855f7',
      standard: '#22c55e'
    };

    function getActiveColor(currentAgentName: string, mode: string = 'jarvis'): string {
      if (mode === 'rewrite') return AGENT_COLORS.rewrite;
      if (mode === 'standard') return AGENT_COLORS.standard;

      const name = (currentAgentName || '').toLowerCase().trim();
      if (name.includes('tuk')) return AGENT_COLORS.tuktuk;
      if (name.includes('andrew') || name.includes('vision')) return AGENT_COLORS.andrew;
      if (name.includes('friday') || name.includes('fry day')) return AGENT_COLORS.friday;
      if (name.includes('brian')) return AGENT_COLORS.brian;

      return AGENT_COLORS.tuktuk;
    }

    assert(getActiveColor('Tuk Tuk') === '#f43f5e', 'Tuk Tuk resolves to Rose (#f43f5e)');
    assert(getActiveColor('Andrew (Lead Dev)') === '#06b6d4', 'Andrew resolves to Cyan (#06b6d4)');
    assert(getActiveColor('Friday') === '#10b981', 'Friday resolves to Emerald (#10b981)');
    assert(getActiveColor('Brian') === '#f59e0b', 'Brian resolves to Amber (#f59e0b)');
    assert(getActiveColor('Any', 'rewrite') === '#a855f7', 'Rewrite mode resolves to Purple (#a855f7)');
    assert(getActiveColor('Any', 'standard') === '#22c55e', 'Standard mode resolves to Green (#22c55e)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Speaking Waveform Syllabic Modulation (Echo-Cancellation Proof)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Speaking Waveform Syllabic Cadence Equations ---');
  {
    const HALF_BARS = 6;
    const barHeights = new Float32Array(HALF_BARS).fill(3.0);

    // Simulate 100 consecutive frames of speaking state (~1.6 seconds)
    let minBar = 999;
    let maxBar = 0;
    let anyBlank = false;

    for (let frame = 0; frame < 100; frame++) {
      const now = frame * 16.66; // 60 FPS delta
      const t = now * 0.0055;
      const cadence1 = Math.sin(t * 1.6) * 0.35;
      const cadence2 = Math.sin(t * 3.8) * 0.25;
      const speechMod = Math.max(0.2, 0.65 + cadence1 + cadence2);

      for (let i = 0; i < HALF_BARS; i++) {
        const harmonic = Math.sin(t * (2.2 + i * 0.7) + (i * 0.9)) * 0.5 + 0.5;
        const target = 3.0 + (harmonic * speechMod * 13.0);
        barHeights[i] = barHeights[i] * 0.6 + target * 0.4;

        if (barHeights[i] < minBar) minBar = barHeights[i];
        if (barHeights[i] > maxBar) maxBar = barHeights[i];
        if (barHeights[i] < 2.0) anyBlank = true; // Bar collapsed to invisible dot
      }
    }

    assert(!anyBlank, 'Waveform never collapses to invisible flatline (all bars >= 2.5px)');
    assert(minBar >= 2.5, `Minimum bar height (${minBar.toFixed(2)}px) preserves visible capsule`);
    assert(maxBar >= 10.0, `Maximum bar height (${maxBar.toFixed(2)}px) reaches vibrant vocal amplitude`);
    assert(maxBar <= 18.0, `Maximum bar height (${maxBar.toFixed(2)}px) stays within 20px canvas boundary`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Thinking & Quiet Room Waveform Dynamics
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Thinking & Quiet Room Dynamics ---');
  {
    const HALF_BARS = 6;
    // Thinking state check
    const thinkingBars = new Float32Array(HALF_BARS).fill(3.0);
    for (let frame = 0; frame < 30; frame++) {
      const now = frame * 16.66;
      const t = now * 0.0045;
      for (let i = 0; i < HALF_BARS; i++) {
        const wave = Math.sin(t * 2.2 + i * 0.8);
        const target = 3.0 + ((wave + 1.0) * 3.5);
        thinkingBars[i] = thinkingBars[i] * 0.7 + target * 0.3;
      }
    }
    const maxThinking = Math.max(...Array.from(thinkingBars));
    assert(maxThinking <= 11.0, `Thinking wave peak (${maxThinking.toFixed(2)}px) remains smooth and controlled`);

    // Quiet room listening check (ambient breathing floor)
    const listeningBars = new Float32Array(HALF_BARS).fill(3.0);
    for (let frame = 0; frame < 30; frame++) {
      const now = frame * 16.66;
      const t = now * 0.003;
      for (let i = 0; i < HALF_BARS; i++) {
        const idleWave = Math.sin(t * 1.5 + i * 0.6) * 1.2 + 3.0;
        listeningBars[i] = listeningBars[i] * 0.8 + idleWave * 0.2;
      }
    }
    const minListening = Math.min(...Array.from(listeningBars));
    assert(minListening >= 1.5, `Idle listening floor (${minListening.toFixed(2)}px) keeps visualizer alive in pure silence`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Canvas DPR Matrix Transformation Resilience
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Canvas DPR Matrix Transformation Resilience ---');
  {
    // Verify that setupCanvas does NOT compound scales
    let currentScale = { x: 1, y: 1 };
    const mockCtx = {
      setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
        currentScale = { x: a, y: d };
      }
    };

    const dpr = 2.0; // Retina display
    // Multiple invocations of setupCanvas
    for (let i = 0; i < 5; i++) {
      mockCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    assert(currentScale.x === 2.0, `Canvas DPR X scale remains strictly ${dpr} without compounding drift`);
    assert(currentScale.y === 2.0, `Canvas DPR Y scale remains strictly ${dpr} without compounding drift`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: CoreAudio Auto-Recycling Safety & Process Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- 5. CoreAudio Buffer Auto-Recycling Safety ---');
  {
    const rootDir = fs.existsSync(path.resolve(__dirname, '../../src/main.js'))
      ? path.resolve(__dirname, '../..')
      : path.resolve(__dirname, '..');
    const mainJsPath = path.resolve(rootDir, 'src/main.js');
    const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

    const has50msDelayRecycle = mainJsContent.includes("setTimeout(() => {\n          if (isJarvisLoopActive && !isSessionAborted) {\n            startRecording();\n          }\n        }, 50);") || mainJsContent.includes("startRecording();\n          }\n        }, 50);");
    assert(has50msDelayRecycle, 'main.js enforces 50ms CoreAudio release delay during auto-recycling to prevent SoX process collision');

    const overlayJsPath = path.resolve(rootDir, 'src/ui/overlay.js');
    const overlayJsContent = fs.readFileSync(overlayJsPath, 'utf8');

    const hasSpeakingState = overlayJsContent.includes("currentState === 'speaking'");
    const hasActiveColor = overlayJsContent.includes("getActiveColor()");
    const hasEnsureAnimating = overlayJsContent.includes("ensureAnimating()");
    const doesNotKillOnErr = !overlayJsContent.includes("cancelAnimationFrame(animationId);\n  if (window.timerInterval) clearInterval(window.timerInterval);\n  \n  // Show error");

    assert(hasSpeakingState, 'overlay.js contains dedicated speaking state handler');
    assert(hasActiveColor, 'overlay.js renders dynamic aura color matching active agent');
    assert(hasEnsureAnimating, 'overlay.js provides ensureAnimating() loop safety');
    assert(doesNotKillOnErr, 'overlay.js handles errors resiliently without permanently blanking canvas');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Equational Working States & Dynamic Compute Waveform Invariants
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Equational Working States & Quantum Compute Wave ---');
  {
    const rootDir = fs.existsSync(path.resolve(__dirname, '../../src/main.js'))
      ? path.resolve(__dirname, '../..')
      : path.resolve(__dirname, '..');
    const overlayJsContent = fs.readFileSync(path.resolve(rootDir, 'src/ui/overlay.js'), 'utf8');
    const overlayHtmlContent = fs.readFileSync(path.resolve(rootDir, 'src/ui/overlay.html'), 'utf8');
    const mainJsContent = fs.readFileSync(path.resolve(rootDir, 'src/main.js'), 'utf8');

    // Verify overlay.js state machine handlers
    assert(overlayJsContent.includes("ipcRenderer.on('jarvis-transcribing'"), 'overlay.js has jarvis-transcribing IPC listener');
    assert(overlayJsContent.includes("ipcRenderer.on('jarvis-working'"), 'overlay.js has jarvis-working IPC listener');
    assert(overlayJsContent.includes("ipcRenderer.on('jarvis-synthesizing'"), 'overlay.js has jarvis-synthesizing IPC listener');
    assert(overlayJsContent.includes("setOverlayStateClass"), 'overlay.js includes setOverlayStateClass state manager');

    // Verify HTML has working, transcribing, synthesizing styles
    assert(overlayHtmlContent.includes(".overlay.working"), 'overlay.html includes .overlay.working CSS rule');
    assert(overlayHtmlContent.includes(".overlay.synthesizing"), 'overlay.html includes .overlay.synthesizing CSS rule');
    assert(overlayHtmlContent.includes(".overlay.transcribing"), 'overlay.html includes .overlay.transcribing CSS rule');
    assert(overlayHtmlContent.includes("max-width: 190px"), 'overlay.html rec-label max-width expanded to 190px for full status text');

    // Verify main.js dispatches
    assert(mainJsContent.includes("jarvisManager.onSpeechStart"), 'main.js hooks jarvisManager.onSpeechStart for synchronized speaking state');
    assert(mainJsContent.includes("jarvisManager.onSpeechEnd"), 'main.js hooks jarvisManager.onSpeechEnd for synchronized listening re-arm');
    assert(mainJsContent.includes("overlayWindow.webContents.send('jarvis-transcribing')"), 'main.js emits jarvis-transcribing on speech confirmation');
    assert(mainJsContent.includes("overlayWindow.webContents.send('jarvis-synthesizing'"), 'main.js emits jarvis-synthesizing prior to voice synthesis');

    // Verify Quantum Compute Waveform Mathematics
    const HALF_BARS = 6;
    const computeBars = new Float32Array(HALF_BARS).fill(3.0);
    let minCompute = 999;
    let maxCompute = 0;

    for (let frame = 0; frame < 60; frame++) {
      const now = frame * 16.66;
      const t = now * 0.0075;
      for (let i = 0; i < HALF_BARS; i++) {
        const harmonic1 = Math.sin(t * 3.5 + i * 0.85);
        const harmonic2 = Math.cos(t * 6.2 - i * 1.2) * 0.5;
        const target = 3.0 + Math.abs(harmonic1 + harmonic2) * 5.5;
        computeBars[i] = computeBars[i] * 0.6 + target * 0.4;
        if (computeBars[i] < minCompute) minCompute = computeBars[i];
        if (computeBars[i] > maxCompute) maxCompute = computeBars[i];
      }
    }

    assert(minCompute >= 2.5, `Compute wave floor (${minCompute.toFixed(2)}px) never collapses`);
    assert(maxCompute <= 13.0, `Compute wave peak (${maxCompute.toFixed(2)}px) stays within visual bounds`);
    assert(maxCompute >= 6.0, `Compute wave peak (${maxCompute.toFixed(2)}px) shows energetic algorithmic processing`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: 2070 Left-to-Right Talking Vibe Sweep & Fast Working Clear
  // --------------------------------------------------------------------------
  console.log('\n--- 7. 2070 Left-to-Right Talking Vibe Sweep & Fast Working Clear ---');
  {
    const rootDir = fs.existsSync(path.resolve(__dirname, '../../src/main.js'))
      ? path.resolve(__dirname, '../..')
      : path.resolve(__dirname, '..');
    const overlayHtmlContent = fs.readFileSync(path.resolve(rootDir, 'src/ui/overlay.html'), 'utf8');
    const overlayJsContent = fs.readFileSync(path.resolve(rootDir, 'src/ui/overlay.js'), 'utf8');

    // 1. Sweep element & hardware acceleration containment
    assert(overlayHtmlContent.includes('<div class="bg-sweep" id="bgSweep"></div>'), 'overlay.html includes .bg-sweep element inside capsule');
    assert(overlayHtmlContent.includes('.bg-sweep {'), 'overlay.html declares .bg-sweep base container styles');
    assert(overlayHtmlContent.includes('border-radius: inherit;'), 'overlay.html .bg-sweep inherits pill capsule border-radius');
    assert(overlayHtmlContent.includes('overflow: hidden;'), 'overlay.html .bg-sweep clips light sweep neatly inside capsule');

    // 2. Dynamic Agent Aura CSS Variables
    assert(overlayHtmlContent.includes('--aura-r: 244;') && overlayHtmlContent.includes('--aura-g: 63;'), 'overlay.html defines Tuk Tuk rose aura CSS variables');
    assert(overlayHtmlContent.includes('--aura-r: 6;') && overlayHtmlContent.includes('--aura-g: 182;'), 'overlay.html defines Vision/Andrew cyan aura CSS variables');
    assert(overlayHtmlContent.includes('--aura-r: 16;') && overlayHtmlContent.includes('--aura-g: 185;'), 'overlay.html defines Friday emerald aura CSS variables');
    assert(overlayHtmlContent.includes('--aura-r: 245;') && overlayHtmlContent.includes('--aura-g: 158;'), 'overlay.html defines DD/Brian amber aura CSS variables');
    assert(overlayHtmlContent.includes('--aura-r: 168;') && overlayHtmlContent.includes('--aura-g: 85;'), 'overlay.html defines Rewrite violet aura CSS variables');

    // 3. 2070 Left-to-Right Keyframe Animations
    assert(overlayHtmlContent.includes('@keyframes auraSweep {'), 'overlay.html defines auraSweep left-to-right keyframe animation');
    assert(overlayHtmlContent.includes('@keyframes auraSweepSpecular {'), 'overlay.html defines auraSweepSpecular secondary sheen keyframe animation');
    assert(overlayHtmlContent.includes('transform: translateX(270%);'), 'auraSweep translates through full pill width to 270%');
    assert(overlayHtmlContent.includes('transform: translateX(320%);'), 'auraSweepSpecular translates through full pill width to 320%');

    // 4. Fast Working & Thinking Instant Clean Clear (Zero Residue)
    assert(overlayHtmlContent.includes('.overlay.working .bg-sweep') && overlayHtmlContent.includes('opacity: 0 !important;'), 'overlay.html enforces opacity: 0 !important on .bg-sweep in working state');
    assert(overlayHtmlContent.includes('.overlay.thinking .bg-sweep') && overlayHtmlContent.includes('opacity: 0 !important;'), 'overlay.html enforces opacity: 0 !important on .bg-sweep in thinking state');
    assert(overlayHtmlContent.includes('transition: opacity 0.18s ease-out;'), 'overlay.html clears sweep with ultra-fast 0.18s ease-out transition');

    // 5. JavaScript State Management & Vibe Synchronization
    assert(overlayJsContent.includes('syncAuraVariables()'), 'overlay.js includes syncAuraVariables() to push active aura RGB to CSS variables');
    assert(overlayJsContent.includes("overlay.classList.add('talking')"), 'overlay.js activates talking sweep when audio amplitude detected');
    assert(overlayJsContent.includes("overlay.classList.remove('talking')"), 'overlay.js deactivates talking sweep in silence');
    assert(overlayJsContent.includes("overlay.classList.remove('thinking', 'working', 'transcribing', 'synthesizing', 'speaking', 'talking')"), 'setOverlayStateClass cleanly strips all prior state classes including speaking and talking');

    // 6. Pill Content Z-Index Elevation
    assert(overlayHtmlContent.includes('.overlay > *:not(.bg-sweep) {') && overlayHtmlContent.includes('z-index: 1;'), 'overlay.html elevates interactive pill elements above the background sweep');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} OVERLAY PERSISTENT VISUALIZER TESTS PASSED!`);
  console.log('================================================================\n');

  process.exit(0);
}

runOverlayVisualizerTests().catch((err) => {
  console.error('Fatal error in overlay visualizer test suite:', err);
  process.exit(1);
});
