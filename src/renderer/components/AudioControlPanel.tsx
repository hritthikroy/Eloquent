/**
 * AudioControlPanel Component
 * 
 * High-performance UI component controlling the Go audio backend via window.audioAPI:
 * 1. Live bidirectional telemetry (stream status, latency, sample rate, dropped frames).
 * 2. Debounced parameter updates (volume, VAD sensitivity) to prevent IPC flooding.
 * 3. Dynamic audio effect toggles (Noise Suppression, Echo Cancellation, AGC).
 * 4. Self-healing backend connection monitoring and manual reconnect triggers.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface AudioControlPanelProps {
  className?: string;
  style?: React.CSSProperties;
  colorScheme?: 'emerald' | 'neon-purple' | 'cyan';
  onStreamStateChange?: (isStreaming: boolean) => void;
  onError?: (error: string) => void;
}

export interface AudioParametersState {
  volume: number;
  latencyTargetMs: number;
  bufferSize: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  vadSensitivity: number;
  sampleRate: number;
  channels: number;
  inputDevice?: string;
  outputDevice?: string;
}

export interface AudioTelemetryState {
  isStreaming: boolean;
  isConnected: boolean;
  currentLatencyMs: number;
  framesIngested: number;
  framesDropped: number;
  bufferUnderruns: number;
  rms: number;
  peak: number;
  uptimeMs: number;
  statusText: string;
}

export const AudioControlPanel: React.FC<AudioControlPanelProps> = ({
  className = '',
  style = {},
  colorScheme = 'emerald',
  onStreamStateChange,
  onError
}) => {
  // Local state for immediate UI responsiveness
  const [params, setParams] = useState<AudioParametersState>({
    volume: 1.0,
    latencyTargetMs: 20,
    bufferSize: 1024,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    vadSensitivity: 0.7,
    sampleRate: 48000,
    channels: 1,
    inputDevice: 'default',
    outputDevice: 'default'
  });

  const [telemetry, setTelemetry] = useState<AudioTelemetryState>({
    isStreaming: false,
    isConnected: false,
    currentLatencyMs: 20.0,
    framesIngested: 0,
    framesDropped: 0,
    bufferUnderruns: 0,
    rms: 0,
    peak: 0,
    uptimeMs: 0,
    statusText: 'Connecting...'
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debounce timers to prevent flooding the IPC channel
  const volumeDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const vadDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Safe accessor for window.audioAPI
  const getAudioAPI = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).audioAPI) {
      return (window as any).audioAPI;
    }
    return null;
  }, []);

  // Fetch initial backend state
  const refreshBackendStatus = useCallback(async () => {
    const api = getAudioAPI();
    if (!api) {
      setTelemetry((prev) => ({ ...prev, statusText: 'Mock Mode (No IPC API)' }));
      return;
    }

    try {
      setIsProcessing(true);
      const [statusRes, healthRes] = await Promise.allSettled([
        api.getStatus(),
        api.getHealth()
      ]);

      let isConn = false;
      let isStream = false;

      if (healthRes.status === 'fulfilled' && (healthRes.value.ready || healthRes.value.status === 'ok')) {
        isConn = true;
      }

      if (statusRes.status === 'fulfilled') {
        const data = statusRes.value;
        isConn = true;
        isStream = !!data.isStreaming;

        if (data.parameters) {
          setParams((prev) => ({ ...prev, ...data.parameters }));
        }

        setTelemetry((prev) => ({
          ...prev,
          isConnected: true,
          isStreaming: isStream,
          currentLatencyMs: data.currentLatencyMs || prev.currentLatencyMs,
          framesIngested: data.framesIngested || 0,
          framesDropped: data.framesDropped || 0,
          bufferUnderruns: data.bufferUnderruns || 0,
          uptimeMs: data.uptimeMs || 0,
          statusText: isStream ? 'Streaming Live' : 'Backend Ready'
        }));

        onStreamStateChange?.(isStream);
      } else {
        setTelemetry((prev) => ({
          ...prev,
          isConnected: isConn,
          statusText: isConn ? 'Connected' : 'Backend Offline'
        }));
      }

      setErrorMessage(null);
    } catch (err: any) {
      console.warn('[AudioControlPanel] Failed to retrieve audio status:', err);
      setTelemetry((prev) => ({
        ...prev,
        isConnected: false,
        statusText: 'Disconnected'
      }));
      setErrorMessage(err.message || 'Connection error');
    } finally {
      setIsProcessing(false);
    }
  }, [getAudioAPI, onStreamStateChange]);

  // Subscribe to real-time events from IPC bridge
  useEffect(() => {
    const api = getAudioAPI();
    if (!api) return;

    refreshBackendStatus();

    // 1. Status and parameters broadcast subscription
    const unsubStatus = api.onStatusUpdate((statusUpdate: any) => {
      if (statusUpdate) {
        setTelemetry((prev) => ({
          ...prev,
          isConnected: statusUpdate.isHealthy ?? true,
          isStreaming: statusUpdate.isStreaming ?? prev.isStreaming,
          currentLatencyMs: statusUpdate.currentLatencyMs ?? prev.currentLatencyMs,
          framesIngested: statusUpdate.framesIngested ?? prev.framesIngested,
          framesDropped: statusUpdate.framesDropped ?? prev.framesDropped,
          bufferUnderruns: statusUpdate.bufferUnderruns ?? prev.bufferUnderruns,
          statusText: statusUpdate.isStreaming ? 'Streaming Live' : 'Backend Ready'
        }));

        if (statusUpdate.parameters) {
          setParams((prev) => ({ ...prev, ...statusUpdate.parameters }));
        }

        if (typeof statusUpdate.isStreaming === 'boolean') {
          onStreamStateChange?.(statusUpdate.isStreaming);
        }
      }
    });

    // 2. Real-time audio frame packet subscription for VU meter
    const unsubStream = api.onStreamData((frame: any) => {
      if (frame) {
        setTelemetry((prev) => ({
          ...prev,
          rms: frame.rms !== undefined ? frame.rms : prev.rms,
          peak: frame.peak !== undefined ? frame.peak : prev.peak
        }));
      }
    });

    // 3. Error and crash alerts
    const unsubError = api.onError((err: any) => {
      const msg = err.message || 'Audio backend error';
      setErrorMessage(msg);
      onError?.(msg);
      setTelemetry((prev) => ({
        ...prev,
        isConnected: false,
        statusText: 'Error / Crash Detected'
      }));
    });

    return () => {
      unsubStatus?.();
      unsubStream?.();
      unsubError?.();
    };
  }, [getAudioAPI, refreshBackendStatus, onStreamStateChange, onError]);

  // Master Stream Toggle (Start / Stop)
  const toggleStream = async () => {
    const api = getAudioAPI();
    if (!api) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      if (telemetry.isStreaming) {
        const res = await api.stopStream();
        if (res.ok) {
          setTelemetry((prev) => ({ ...prev, isStreaming: false, statusText: 'Stream Stopped' }));
          onStreamStateChange?.(false);
        } else {
          throw new Error(res.error || 'Failed to stop stream');
        }
      } else {
        const res = await api.startStream(params);
        if (res.ok) {
          setTelemetry((prev) => ({ ...prev, isStreaming: true, statusText: 'Streaming Live' }));
          onStreamStateChange?.(true);
        } else {
          throw new Error(res.error || 'Failed to start stream');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Stream control failed');
      onError?.(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Debounced Volume Change (60ms) to prevent IPC flooding
  const handleVolumeChange = (newVolume: number) => {
    setParams((prev) => ({ ...prev, volume: newVolume }));

    if (volumeDebounceTimer.current) {
      clearTimeout(volumeDebounceTimer.current);
    }

    volumeDebounceTimer.current = setTimeout(async () => {
      const api = getAudioAPI();
      if (!api) return;
      try {
        await api.updateParameters({ volume: newVolume });
      } catch (err: any) {
        console.warn('[AudioControlPanel] Volume update failed:', err);
      }
    }, 60);
  };

  // Debounced VAD Sensitivity Change (80ms)
  const handleVadChange = (newVad: number) => {
    setParams((prev) => ({ ...prev, vadSensitivity: newVad }));

    if (vadDebounceTimer.current) {
      clearTimeout(vadDebounceTimer.current);
    }

    vadDebounceTimer.current = setTimeout(async () => {
      const api = getAudioAPI();
      if (!api) return;
      try {
        await api.updateParameters({ vadSensitivity: newVad });
      } catch (err: any) {
        console.warn('[AudioControlPanel] VAD sensitivity update failed:', err);
      }
    }, 80);
  };

  // Immediate Toggle for Boolean DSP Effects
  const toggleEffect = async (key: 'noiseSuppression' | 'echoCancellation' | 'autoGainControl') => {
    const updatedValue = !params[key];
    setParams((prev) => ({ ...prev, [key]: updatedValue }));

    const api = getAudioAPI();
    if (!api) return;
    try {
      await api.updateParameters({ [key]: updatedValue });
    } catch (err: any) {
      console.warn(`[AudioControlPanel] Failed to update effect ${key}:`, err);
    }
  };

  // Latency Target Change
  const handleLatencyChange = async (targetMs: number) => {
    setParams((prev) => ({ ...prev, latencyTargetMs: targetMs }));

    const api = getAudioAPI();
    if (!api) return;
    try {
      await api.updateParameters({ latencyTargetMs: targetMs });
      setTelemetry((prev) => ({ ...prev, currentLatencyMs: targetMs }));
    } catch (err: any) {
      console.warn('[AudioControlPanel] Latency update failed:', err);
    }
  };

  // Manual Reconnect
  const handleReconnect = async () => {
    const api = getAudioAPI();
    if (!api) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await api.reconnect();
      await refreshBackendStatus();
    } catch (err: any) {
      setErrorMessage(`Reconnect failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Primary accent color based on theme
  const accentColor = colorScheme === 'emerald' ? '#10b981' : colorScheme === 'cyan' ? '#06b6d4' : '#a855f7';

  return (
    <div
      className={`audio-control-panel ${className}`}
      style={{
        background: '#0d1117',
        color: '#e6edf3',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #30363d',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '680px',
        ...style
      }}
    >
      {/* Header with Connection & Status Indicators */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎙️</span> Go Audio Engine
          </h3>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            Low-Latency Go Daemon &times; Electron IPC Bridge
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              background: telemetry.isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: telemetry.isConnected ? '#10b981' : '#ef4444',
              border: `1px solid ${telemetry.isConnected ? '#10b981' : '#ef4444'}`
            }}
          >
            {telemetry.isConnected ? '● Connected' : '○ Disconnected'}
          </span>

          {!telemetry.isConnected && (
            <button
              onClick={handleReconnect}
              disabled={isProcessing}
              style={{
                background: '#21262d',
                color: '#c9d1d9',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: isProcessing ? 'wait' : 'pointer'
              }}
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Error / Warning Alert Banner */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#f87171',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '13px',
            marginBottom: '16px'
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Real-time Telemetry Metrics HUD */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          background: '#161b22',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #21262d'
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Latency</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: telemetry.currentLatencyMs <= 25 ? '#10b981' : '#f59e0b' }}>
            {telemetry.currentLatencyMs.toFixed(1)} ms
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Sample Rate</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#c9d1d9' }}>
            {params.sampleRate / 1000} kHz
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Underruns</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: telemetry.bufferUnderruns === 0 ? '#10b981' : '#ef4444' }}>
            {telemetry.bufferUnderruns}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Drops</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: telemetry.framesDropped === 0 ? '#10b981' : '#ef4444' }}>
            {telemetry.framesDropped}
          </div>
        </div>
      </div>

      {/* Audio Level VU Meter */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>
          <span>Input Amplitude</span>
          <span>RMS: {(telemetry.rms * 100).toFixed(1)}%</span>
        </div>
        <div style={{ height: '8px', background: '#21262d', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, telemetry.rms * 400)}%`,
              background: `linear-gradient(90deg, ${accentColor} 0%, #f59e0b 80%, #ef4444 100%)`,
              transition: 'width 60ms ease-out'
            }}
          />
        </div>
      </div>

      {/* Master Streaming Toggle Button */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={toggleStream}
          disabled={isProcessing}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isProcessing ? 'wait' : 'pointer',
            background: telemetry.isStreaming ? '#dc2626' : accentColor,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'background 150ms ease'
          }}
        >
          {telemetry.isStreaming ? '🛑 Stop Audio Stream' : '▶️ Initiate Audio Stream'}
        </button>
      </div>

      {/* Dynamic Controls Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Volume Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span>Master Volume</span>
            <span style={{ fontWeight: 600 }}>{Math.round(params.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={params.volume}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleVolumeChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor }}
          />
        </div>

        {/* Latency Target Selector */}
        <div>
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>Target Latency</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[10, 20, 50, 100].map((lat) => (
              <button
                key={lat}
                onClick={() => handleLatencyChange(lat)}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: params.latencyTargetMs === lat ? 600 : 400,
                  border: `1px solid ${params.latencyTargetMs === lat ? accentColor : '#30363d'}`,
                  background: params.latencyTargetMs === lat ? 'rgba(16, 185, 129, 0.15)' : '#161b22',
                  color: params.latencyTargetMs === lat ? accentColor : '#c9d1d9',
                  cursor: 'pointer'
                }}
              >
                {lat} ms
              </button>
            ))}
          </div>
        </div>

        {/* DSP Effects Toggles */}
        <div>
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>DSP & Noise Filters</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button
              onClick={() => toggleEffect('noiseSuppression')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                fontSize: '12px',
                border: `1px solid ${params.noiseSuppression ? accentColor : '#30363d'}`,
                background: params.noiseSuppression ? 'rgba(16, 185, 129, 0.12)' : '#161b22',
                color: params.noiseSuppression ? accentColor : '#8b949e',
                cursor: 'pointer'
              }}
            >
              {params.noiseSuppression ? '✓ Noise Suppress' : 'Noise Suppress'}
            </button>

            <button
              onClick={() => toggleEffect('echoCancellation')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                fontSize: '12px',
                border: `1px solid ${params.echoCancellation ? accentColor : '#30363d'}`,
                background: params.echoCancellation ? 'rgba(16, 185, 129, 0.12)' : '#161b22',
                color: params.echoCancellation ? accentColor : '#8b949e',
                cursor: 'pointer'
              }}
            >
              {params.echoCancellation ? '✓ Echo Cancel' : 'Echo Cancel'}
            </button>

            <button
              onClick={() => toggleEffect('autoGainControl')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                fontSize: '12px',
                border: `1px solid ${params.autoGainControl ? accentColor : '#30363d'}`,
                background: params.autoGainControl ? 'rgba(16, 185, 129, 0.12)' : '#161b22',
                color: params.autoGainControl ? accentColor : '#8b949e',
                cursor: 'pointer'
              }}
            >
              {params.autoGainControl ? '✓ Auto Gain' : 'Auto Gain'}
            </button>
          </div>
        </div>

        {/* VAD Sensitivity Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span>Voice Activity Detection (VAD) Sensitivity</span>
            <span style={{ fontWeight: 600 }}>{Math.round(params.vadSensitivity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={params.vadSensitivity}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleVadChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor }}
          />
        </div>
      </div>
    </div>
  );
};

export default AudioControlPanel;
