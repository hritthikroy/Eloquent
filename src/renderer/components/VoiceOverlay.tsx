/**
 * VoiceOverlay Component
 *
 * Unified voice interaction widget combining:
 * 1. Real-time audio input amplitude bars (audio:memory-telemetry IPC)
 * 2. TTS playback state visualization (speaking waveform vs listening bars)
 * 3. Agent identity badge with animated state dot
 * 4. Graceful text-only degradation on audio:error
 *
 * Performance contract:
 * - Canvas draws via requestAnimationFrame at locked 60 FPS
 * - IPC amplitude stored in ref — zero React re-renders during active audio
 * - EMA smoothing (α=0.85) eliminates bar jitter
 * - beforeunload + useEffect cleanup prevent listener leaks
 */

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface VoiceOverlayProps {
  agentName?: string;
  state?: VoiceState;
  barCount?: number;
  width?: number;
  height?: number;
  showBadge?: boolean;
  className?: string;
  onDeviceError?: (message: string) => void;
}

const AGENT_COLORS: Record<string, { primary: string; glow: string }> = {
  'Tuk Tuk': { primary: '#c084fc', glow: 'rgba(192,132,252,0.45)' },
  'Vision':  { primary: '#38bdf8', glow: 'rgba(56,189,248,0.45)' },
  'Friday':  { primary: '#34d399', glow: 'rgba(52,211,153,0.45)' },
  'DD':      { primary: '#fb923c', glow: 'rgba(251,146,60,0.45)' },
  'default': { primary: '#a78bfa', glow: 'rgba(167,139,250,0.40)' },
};

const STATE_LABELS: Record<VoiceState, string> = {
  idle:      'Ready',
  listening: 'Listening…',
  thinking:  'Thinking…',
  speaking:  'Speaking',
  error:     'Audio unavailable — text mode',
};

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  agentName = 'Tuk Tuk',
  state = 'idle',
  barCount = 32,
  width = 320,
  height = 64,
  showBadge = true,
  className = '',
  onDeviceError,
}) => {
  const canvasRef     = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef  = useRef<number | null>(null);
  const lastTickRef   = useRef<number>(0);
  const amplitudeRef  = useRef<Float32Array>(new Float32Array(barCount));
  const smoothedRef   = useRef<Float32Array>(new Float32Array(barCount));

  const [deviceError, setDeviceError] = useState<string | null>(null);

  const palette    = useMemo(() => AGENT_COLORS[agentName] ?? AGENT_COLORS['default'], [agentName]);
  const stateLabel = STATE_LABELS[state] ?? STATE_LABELS.idle;

  // ── IPC subscription ────────────────────────────────────────────────────────
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.receive) return;

    const onTelemetry = (t: any) => {
      const raw: number[] = t?.amplitudeData ?? t?.bars ?? [];
      const len = Math.min(raw.length, barCount);
      for (let i = 0; i < len; i++) amplitudeRef.current[i] = raw[i] / 255;
    };

    const onError = (p: any) => {
      const msg: string = p?.message ?? 'Audio device unavailable';
      setDeviceError(msg);
      onDeviceError?.(msg);
    };

    api.receive('audio:memory-telemetry', onTelemetry);
    api.receive('audio:error', onError);

    const cleanup = () => {
      try { api.removeAllListeners?.('audio:memory-telemetry'); } catch { /* noop */ }
      try { api.removeAllListeners?.('audio:error'); } catch { /* noop */ }
    };
    window.addEventListener('beforeunload', cleanup);
    return () => { cleanup(); window.removeEventListener('beforeunload', cleanup); };
  }, [barCount, onDeviceError]);

  // ── Canvas render loop ──────────────────────────────────────────────────────
  const draw = useCallback((ts: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (ts - lastTickRef.current < 16) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }
    lastTickRef.current = ts;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    // Pill background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    (ctx as any).roundRect(0, 0, width, height, height / 2);
    ctx.fill();

    const isActive   = state !== 'idle' && state !== 'error';
    const isSpeaking = state === 'speaking';
    const barW  = (width - 16) / (barCount * 1.6);
    const gap   = barW * 0.6;
    const totalW = barCount * (barW + gap) - gap;
    const startX = (width - totalW) / 2;

    for (let i = 0; i < barCount; i++) {
      const raw = isActive ? amplitudeRef.current[i] : 0;
      smoothedRef.current[i] = 0.85 * smoothedRef.current[i] + 0.15 * raw;
      const amp  = smoothedRef.current[i];
      const barH = Math.max(3, amp * (height - 16));
      const x    = startX + i * (barW + gap);

      if (isSpeaking) {
        const y    = (height - barH) / 2;
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, palette.glow);
        grad.addColorStop(0.5, palette.primary);
        grad.addColorStop(1, palette.glow);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = palette.primary + (isActive ? 'cc' : '44');
      }
      ctx.beginPath();
      (ctx as any).roundRect(x, isSpeaking ? (height - barH) / 2 : height - 8 - barH, barW, barH, barW / 2);
      ctx.fill();
    }

    if (isActive) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = palette.glow;
      ctx.beginPath();
      (ctx as any).roundRect(0, 0, width, height, height / 2);
      ctx.fill();
      ctx.restore();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [barCount, width, height, state, palette]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [draw]);

  // ── Text-only degraded mode ─────────────────────────────────────────────────
  if (deviceError) {
    return (
      <div className={className} style={{ display:'flex', alignItems:'center', gap:'6px',
        padding:'4px 12px', borderRadius:'999px', background:'rgba(0,0,0,0.6)',
        border:'1px solid #f8717155', backdropFilter:'blur(8px)', userSelect:'none' }}>
        <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#f87171', display:'inline-block' }} />
        <span style={{ fontSize:'11px', color:'#fca5a5', fontFamily:'system-ui,sans-serif' }}>
          {agentName} — Audio unavailable, text mode active
        </span>
      </div>
    );
  }

  // ── Normal render ───────────────────────────────────────────────────────────
  const dotActive = state !== 'idle' && state !== 'error';
  return (
    <div className={className} style={{ display:'flex', flexDirection:'column',
      alignItems:'center', gap:'6px', userSelect:'none', pointerEvents:'none' }}>
      {showBadge && (
        <div style={{ display:'flex', alignItems:'center', gap:'6px',
          padding:'3px 10px', borderRadius:'999px', background:'rgba(0,0,0,0.6)',
          border:`1px solid ${palette.primary}55`, backdropFilter:'blur(8px)' }}>
          <span style={{ width:'7px', height:'7px', borderRadius:'50%',
            background: palette.primary, display:'inline-block',
            boxShadow: dotActive ? `0 0 6px 2px ${palette.glow}` : 'none',
            transition:'box-shadow 0.3s ease' }} />
          <span style={{ fontSize:'11px', fontWeight:500, color: palette.primary,
            letterSpacing:'0.03em', fontFamily:'system-ui,sans-serif',
            transition:'color 0.3s ease' }}>
            {agentName} · {stateLabel}
          </span>
        </div>
      )}
      <canvas ref={canvasRef} width={width} height={height}
        style={{ borderRadius:`${height / 2}px`, display:'block' }}
        aria-label={`${agentName} voice activity — ${stateLabel}`}
        role="img" />
    </div>
  );
};

export default VoiceOverlay;
