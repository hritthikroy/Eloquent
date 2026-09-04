/**
 * AudioVisualizer Component
 * 
 * High-performance Canvas audio visualizer engineered for a locked 60 FPS frame rate:
 * 1. requestAnimationFrame delta throttling (16.66ms interval gating) to prevent redundant draw passes.
 * 2. Pre-allocated frequency bin buffers to prevent V8 garbage collection pauses.
 * 3. Exponential moving average smoothing for silk-smooth bar transitions.
 * 4. Real-time telemetry HUD displaying current FPS, render latency (ms), and dropped frames.
 * 5. Supports Web Audio API AnalyserNode and direct amplitude telemetry arrays.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface AudioVisualizerProps {
  analyser?: any; // Web Audio API AnalyserNode or mock
  amplitudeData?: Uint8Array | number[]; // Direct IPC/bridge amplitude telemetry
  width?: number;
  height?: number;
  barCount?: number;
  colorScheme?: 'neon-purple' | 'matrix-green' | 'electric-cyan' | 'cyber-amber';
  showHud?: boolean;
  targetFps?: number;
  smoothingTimeConstant?: number;
  className?: string;
  style?: React.CSSProperties;
  onFpsUpdate?: (fps: number, droppedFrames: number) => void;
}

export interface VisualizerTelemetry {
  fps: number;
  frameTimeMs: number;
  droppedFrames: number;
  isLocked60Fps: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  amplitudeData,
  width = 640,
  height = 180,
  barCount = 48,
  colorScheme = 'neon-purple',
  showHud = true,
  targetFps = 60,
  smoothingTimeConstant = 0.82,
  className = '',
  style = {},
  onFpsUpdate
}) => {
  const canvasRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Pre-allocated typed arrays to prevent garbage collection allocations during 60 FPS render loops
  const frequencyBufferRef = useRef<Uint8Array>(new Uint8Array(barCount));
  const smoothedBufferRef = useRef<Float32Array>(new Float32Array(barCount));

  // Telemetry state
  const [telemetry, setTelemetry] = useState<VisualizerTelemetry>({
    fps: targetFps,
    frameTimeMs: 0,
    droppedFrames: 0,
    isLocked60Fps: true
  });

  // Theme palettes
  const palette = useMemo(() => {
    switch (colorScheme) {
      case 'matrix-green':
        return {
          primary: '#10b981',
          secondary: '#34d399',
          glow: 'rgba(16, 185, 129, 0.4)',
          bg: '#05180f'
        };
      case 'electric-cyan':
        return {
          primary: '#06b6d4',
          secondary: '#38bdf8',
          glow: 'rgba(6, 182, 212, 0.4)',
          bg: '#081726'
        };
      case 'cyber-amber':
        return {
          primary: '#f59e0b',
          secondary: '#fbbf24',
          glow: 'rgba(245, 158, 11, 0.4)',
          bg: '#1c1305'
        };
      case 'neon-purple':
      default:
        return {
          primary: '#a855f7',
          secondary: '#c084fc',
          glow: 'rgba(168, 85, 247, 0.45)',
          bg: '#110726'
        };
    }
  }, [colorScheme]);

  // Adjust pre-allocated buffers if barCount changes
  useEffect(() => {
    if (frequencyBufferRef.current.length !== barCount) {
      frequencyBufferRef.current = new Uint8Array(barCount);
      smoothedBufferRef.current = new Float32Array(barCount);
    }
  }, [barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;

    const targetIntervalMs = 1000 / targetFps;
    // Allow small 1.5ms timing jitter to align with browser refresh rate (vsync)
    const minFrameIntervalMs = targetIntervalMs - 1.5;

    let lastFrameTimestamp = performance.now();
    let frameCount = 0;
    let lastFpsCalculation = performance.now();
    let droppedFrameCount = 0;

    const render = (now: number) => {
      const delta = now - lastFrameTimestamp;

      // Frame Rate Throttling: Skip rendering if delta is less than the 60 FPS target interval
      if (delta < minFrameIntervalMs) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // Check for frame drop (>1.6x expected delta)
      if (delta > targetIntervalMs * 1.6 && frameCount > 5) {
        droppedFrameCount++;
      }

      lastFrameTimestamp = now - (delta >= targetIntervalMs ? delta % targetIntervalMs : 0);
      frameCount++;

      const renderStart = performance.now();

      // 1. Fetch frequency data without heap allocations
      const freqBuffer = frequencyBufferRef.current;
      const smoothedBuffer = smoothedBufferRef.current;

      if (analyser && typeof analyser.getByteFrequencyData === 'function') {
        analyser.getByteFrequencyData(freqBuffer);
      } else if (amplitudeData && amplitudeData.length > 0) {
        const step = amplitudeData.length / barCount;
        for (let i = 0; i < barCount; i++) {
          const idx = Math.min(Math.floor(i * step), amplitudeData.length - 1);
          freqBuffer[i] = amplitudeData[idx] || 0;
        }
      } else {
        // Subtle ambient breathing simulation when idle
        const time = now * 0.003;
        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(time + i * 0.2) * 0.5 + 0.5;
          freqBuffer[i] = Math.floor(wave * 28 + 6);
        }
      }

      // 2. Exponential Moving Average Smoothing
      for (let i = 0; i < barCount; i++) {
        smoothedBuffer[i] = smoothedBuffer[i] * smoothingTimeConstant + freqBuffer[i] * (1 - smoothingTimeConstant);
      }

      // 3. Clear canvas buffer
      ctx.clearRect(0, 0, width, height);

      // 4. Render frequency bars
      const padding = 2;
      const totalSpacing = padding * (barCount + 1);
      const barWidth = Math.max(1, (width - totalSpacing) / barCount);
      const maxBarHeight = height - 12;

      // Draw background baseline glow
      ctx.fillStyle = palette.glow;
      ctx.fillRect(0, height - 2, width, 2);

      for (let i = 0; i < barCount; i++) {
        const val = smoothedBuffer[i] || 0;
        const normalized = Math.min(1.0, val / 255);
        const barHeight = Math.max(3, normalized * maxBarHeight);
        const x = padding + i * (barWidth + padding);
        const y = height - barHeight;

        // Gradient for visual depth
        const gradient = ctx.createLinearGradient(0, y, 0, height);
        gradient.addColorStop(0, palette.secondary);
        gradient.addColorStop(1, palette.primary);

        ctx.fillStyle = gradient;

        // Rounded bar top
        const radius = Math.min(barWidth / 2, 3);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        // High frequency peak cap
        if (normalized > 0.45) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, Math.max(0, y - 2), barWidth, 1.5);
        }
      }

      const renderEnd = performance.now();
      const currentFrameTime = renderEnd - renderStart;

      // 5. Update Telemetry every 500ms
      const timeSinceLastFps = now - lastFpsCalculation;
      if (timeSinceLastFps >= 500) {
        const currentFps = Math.round((frameCount * 1000) / timeSinceLastFps);
        const isLocked = currentFps >= 57 && currentFps <= 63;

        setTelemetry({
          fps: currentFps,
          frameTimeMs: parseFloat(currentFrameTime.toFixed(2)),
          droppedFrames: droppedFrameCount,
          isLocked60Fps: isLocked
        });

        if (onFpsUpdate) {
          onFpsUpdate(currentFps, droppedFrameCount);
        }

        frameCount = 0;
        lastFpsCalculation = now;
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [analyser, amplitudeData, width, height, barCount, palette, targetFps, smoothingTimeConstant, onFpsUpdate]);

  return (
    <div
      className={`audio-visualizer-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: palette.bg,
        border: `1px solid ${palette.primary}44`,
        borderRadius: '10px',
        padding: '12px',
        boxShadow: `0 4px 20px ${palette.glow}`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        ...style
      }}
    >
      {/* 60 FPS Telemetry HUD */}
      {showHud && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#94a3b8',
            paddingBottom: '4px',
            borderBottom: `1px solid ${palette.primary}22`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: telemetry.isLocked60Fps ? '#10b981' : '#f59e0b',
                boxShadow: `0 0 6px ${telemetry.isLocked60Fps ? '#10b981' : '#f59e0b'}`
              }}
            />
            <strong style={{ color: '#f8fafc' }}>
              {telemetry.fps} FPS
            </strong>
            <span style={{ color: telemetry.isLocked60Fps ? '#10b981' : '#f59e0b' }}>
              {telemetry.isLocked60Fps ? 'LOCKED (60Hz)' : 'ADAPTIVE'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <span>Render: <strong style={{ color: '#f8fafc' }}>{telemetry.frameTimeMs}ms</strong></span>
            <span>Drops: <strong style={{ color: telemetry.droppedFrames === 0 ? '#10b981' : '#ef4444' }}>{telemetry.droppedFrames}</strong></span>
            <span>Bins: <strong style={{ color: '#f8fafc' }}>{barCount}</strong></span>
          </div>
        </div>
      )}

      {/* Canvas Element */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: 'block',
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: '6px'
        }}
      />
    </div>
  );
};

export default AudioVisualizer;
