/**
 * AmbientOverlay Component
 *
 * Lightweight React component managing "Cozy High" ambient mode:
 * 1. Listens for audio:state IPC events from the Go audio backend.
 * 2. Dynamically injects and removes .ambient-theme on document root to trigger CSS variable swaps.
 * 3. Renders zero-layout-shift viewport glow and atmospheric breathing effects.
 * 4. Gracefully degrades to a static visual fallback when the Go audio binary is unavailable.
 */

import React, { useEffect, useState, useCallback } from 'react';

export interface AmbientAudioState {
  isPlaying: boolean;
  ambientMode: string | null;
  theme?: string;
  volume: number;
  available: boolean;
  error?: string;
  timestamp?: number;
}

export interface AmbientOverlayProps {
  className?: string;
  showControls?: boolean;
  onStateChange?: (state: AmbientAudioState) => void;
}

export const AmbientOverlay: React.FC<AmbientOverlayProps> = ({
  className = '',
  showControls = true,
  onStateChange
}) => {
  const [audioState, setAudioState] = useState<AmbientAudioState>({
    isPlaying: false,
    ambientMode: null,
    volume: 0.8,
    available: true
  });

  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Synchronize CSS class onto documentElement and body
  const applyThemeClass = useCallback((isActive: boolean) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    if (isActive) {
      root.classList.add('ambient-theme');
      if (body) body.classList.add('ambient-theme');
    } else {
      root.classList.remove('ambient-theme');
      if (body) body.classList.remove('ambient-theme');
    }
  }, []);

  // Listen to IPC audio:state events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStateUpdate = (state: Partial<AmbientAudioState>) => {
      const updated: AmbientAudioState = {
        isPlaying: Boolean(state.isPlaying),
        ambientMode: state.ambientMode ?? null,
        theme: state.theme ?? 'warm-earthy',
        volume: typeof state.volume === 'number' ? state.volume : 0.8,
        available: state.available ?? true,
        error: state.error,
        timestamp: state.timestamp ?? Date.now()
      };

      setAudioState(updated);
      onStateChange?.(updated);

      const isCozyActive = updated.isPlaying || updated.ambientMode === 'cozy-high';
      applyThemeClass(isCozyActive);
    };

    const api = (window as any).electronAPI;
    const audioBridge = (window as any).audioAPI;

    let cleanup = () => {};

    if (audioBridge?.onAudioState) {
      cleanup = audioBridge.onAudioState(handleStateUpdate);
    } else if (api?.receive) {
      api.receive('audio:state', handleStateUpdate);
      cleanup = () => {
        try {
          api.removeAllListeners?.('audio:state');
        } catch (_) {}
      };
    }

    const onUnload = () => {
      cleanup();
      applyThemeClass(false);
    };

    window.addEventListener('beforeunload', onUnload);

    return () => {
      cleanup();
      window.removeEventListener('beforeunload', onUnload);
      applyThemeClass(false);
    };
  }, [applyThemeClass, onStateChange]);

  const toggleAmbient = async () => {
    const api = (window as any).electronAPI;
    const audioBridge = (window as any).audioAPI;

    if (audioState.isPlaying) {
      if (audioBridge?.stopAmbient) {
        await audioBridge.stopAmbient();
      } else if (api?.stopAmbient) {
        await api.stopAmbient();
      }
    } else {
      if (audioBridge?.playAmbient) {
        await audioBridge.playAmbient({ mode: 'cozy-high', volume: audioState.volume });
      } else if (api?.playAmbient) {
        await api.playAmbient({ mode: 'cozy-high', volume: audioState.volume });
      }
    }
  };

  const isActive = audioState.isPlaying || audioState.ambientMode === 'cozy-high';
  const isAudioUnavailable = !audioState.available;

  if (!isActive && !showControls) {
    return null;
  }

  return (
    <>
      {/* Zero layout shift ambient glow layer */}
      {isActive && (
        <div
          className={`ambient-overlay-container ${className}`}
          aria-hidden="true"
          style={{ opacity: isActive ? 1 : 0 }}
        >
          <div className="ambient-overlay-glow" />
        </div>
      )}

      {/* Floating status & control badge */}
      {showControls && (isActive || isAudioUnavailable) && (
        <div
          className="ambient-badge"
          onClick={toggleAmbient}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          role="button"
          tabIndex={0}
          title={
            isAudioUnavailable
              ? 'Audio server offline — Visual warm theme active'
              : audioState.isPlaying
              ? 'Click to pause lo-fi ambient audio'
              : 'Click to resume lo-fi ambient audio'
          }
          style={{ cursor: 'pointer' }}
        >
          <span
            className={`ambient-indicator-dot ${
              isAudioUnavailable ? 'disabled' : audioState.isPlaying ? 'active' : ''
            }`}
          />
          <span className="ambient-badge-text">
            {isAudioUnavailable
              ? 'Cozy High (Visual)'
              : audioState.isPlaying
              ? 'Cozy High • Lo-Fi Active'
              : 'Cozy High • Paused'}
          </span>
          {isAudioUnavailable && (
            <span className="ambient-fallback-notice">
              {isHovered ? '— Audio backend unavailable' : '— Visual only'}
            </span>
          )}
        </div>
      )}
    </>
  );
};

export default AmbientOverlay;
