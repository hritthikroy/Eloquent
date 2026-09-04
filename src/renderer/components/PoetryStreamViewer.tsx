/**
 * PoetryStreamViewer Component
 * 
 * Renders live poetic text with frame-locked dynamic typography updates
 * driven in lockstep by WebRTC audio stream chunks:
 * 1. Frame-accurate verse and word-level glowing typography
 * 2. WebRTC Stream Sync HUD with latency, jitter, and packet loss telemetry
 * 3. Non-blocking rendering batching to prevent UI thread stuttering
 * 4. Automatic error recovery and visual resync indicator
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AudioSyncService,
  SyncTelemetry,
  TypographyUpdate,
  StreamMarker,
  PoemVerse,
  SyncState
} from '../../services/audioSyncService';

export interface PoetryStreamViewerProps {
  verses: PoemVerse[];
  audioSyncService?: AudioSyncService;
  theme?: 'cyberpunk' | 'dark' | 'minimal' | 'luminous';
  className?: string;
  style?: React.CSSProperties;
  showHud?: boolean;
  onTelemetryChange?: (telemetry: SyncTelemetry) => void;
}

export const PoetryStreamViewer: React.FC<PoetryStreamViewerProps> = ({
  verses,
  audioSyncService,
  theme = 'cyberpunk',
  className = '',
  style = {},
  showHud = true,
  onTelemetryChange
}) => {
  // Active typography state lockstep with audio stream packets
  const [activeVerseIndex, setActiveVerseIndex] = useState<number>(0);
  const [activeWordOffset, setActiveWordOffset] = useState<number>(0);
  const [activeWord, setActiveWord] = useState<string>('');
  const [verseProgress, setVerseProgress] = useState<number>(0);

  // Sync Telemetry State
  const [telemetry, setTelemetry] = useState<SyncTelemetry>({
    sessionId: 'webrtc-stream-live',
    totalChunksReceived: 0,
    packetsLost: 0,
    outOfOrderCount: 0,
    bufferUnderruns: 0,
    averageJitterMs: 0,
    maxJitterMs: 0,
    streamClockMs: 0,
    activeMarkersReached: 0,
    syncState: 'synchronized',
    desyncDeltaMs: 0,
    lastEventTimestamp: Date.now()
  });

  // Jitter and Desync notices
  const [desyncNotice, setDesyncNotice] = useState<string | null>(null);

  // Ref to container for smooth auto-scrolling to active verse
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!audioSyncService) return;

    const unsubTypo = audioSyncService.onTypographyUpdate((update: TypographyUpdate) => {
      setActiveVerseIndex(update.verseIndex);
      setActiveWordOffset(update.wordOffset);
      setActiveWord(update.activeWord);
      setVerseProgress(update.progress);
    });

    const unsubTelem = audioSyncService.onTelemetry((stats: SyncTelemetry) => {
      setTelemetry(stats);
      if (onTelemetryChange) {
        onTelemetryChange(stats);
      }
    });

    const unsubDesync = audioSyncService.onDesyncAlert((deltaMs: number, reason: string) => {
      setDesyncNotice(`⚠️ Stream jitter (${deltaMs.toFixed(0)}ms): ${reason}`);
    });

    const unsubResync = audioSyncService.onResynced(() => {
      setDesyncNotice(null);
    });

    return () => {
      unsubTypo();
      unsubTelem();
      unsubDesync();
      unsubResync();
    };
  }, [audioSyncService, onTelemetryChange]);

  // Color schemes according to theme
  const themeStyles = useMemo(() => {
    switch (theme) {
      case 'luminous':
        return {
          bg: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
          activeGlow: '0 0 16px rgba(56, 189, 248, 0.65)',
          activeColor: '#38bdf8',
          wordHighlight: '#f43f5e',
          verseDefault: '#94a3b8',
          hudBg: 'rgba(15, 23, 42, 0.75)',
          border: 'rgba(56, 189, 248, 0.2)'
        };
      case 'cyberpunk':
      default:
        return {
          bg: 'linear-gradient(135deg, #050508 0%, #0d0e15 100%)',
          activeGlow: '0 0 20px rgba(168, 85, 247, 0.7)',
          activeColor: '#c084fc',
          wordHighlight: '#38bdf8',
          verseDefault: '#64748b',
          hudBg: 'rgba(10, 11, 20, 0.85)',
          border: 'rgba(168, 85, 247, 0.25)'
        };
    }
  }, [theme]);

  // Render Status Badge
  const renderSyncBadge = () => {
    let badgeBg = '#10b981'; // Green: synchronized
    let badgeText = 'SYNCHRONIZED';

    if (telemetry.syncState === 'buffering') {
      badgeBg = '#f59e0b'; // Amber: absorbing jitter
      badgeText = 'ABSORBING JITTER';
    } else if (telemetry.syncState === 'recovering') {
      badgeBg = '#ef4444'; // Red: recovering dropped packets
      badgeText = 'RECOVERING';
    } else if (telemetry.syncState === 'desynced') {
      badgeBg = '#dc2626';
      badgeText = 'DESYNCED';
    }

    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '999px',
        backgroundColor: `${badgeBg}22`,
        border: `1px solid ${badgeBg}66`,
        color: badgeBg,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.05em'
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: badgeBg,
          boxShadow: `0 0 8px ${badgeBg}`
        }} />
        {badgeText}
      </div>
    );
  };

  return (
    <div
      className={`poetry-stream-viewer ${className}`}
      style={{
        background: themeStyles.bg,
        borderRadius: '12px',
        border: `1px solid ${themeStyles.border}`,
        padding: '20px',
        color: '#f8fafc',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Stream Sync HUD Bar */}
      {showHud && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderRadius: '8px',
          backgroundColor: themeStyles.hudBg,
          border: `1px solid ${themeStyles.border}`,
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {renderSyncBadge()}
            <span style={{ color: '#94a3b8' }}>
              Latency: <strong style={{ color: '#f8fafc' }}>{telemetry.desyncDeltaMs}ms</strong>
            </span>
            <span style={{ color: '#94a3b8' }}>
              Jitter: <strong style={{ color: '#f8fafc' }}>{telemetry.averageJitterMs}ms</strong>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', color: '#64748b' }}>
            <span>Packets: {telemetry.totalChunksReceived}</span>
            <span>Lost: {telemetry.packetsLost}</span>
            <span>Clock: {(telemetry.streamClockMs / 1000).toFixed(2)}s</span>
          </div>
        </div>
      )}

      {/* Jitter & Recovery Alert Banner */}
      {desyncNotice && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '11px',
          color: '#fca5a5',
          animation: 'pulse 1.5s infinite'
        }}>
          {desyncNotice}
        </div>
      )}

      {/* Frame-Locked Poetry Rendering Canvas */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        maxHeight: '380px',
        overflowY: 'auto',
        paddingRight: '6px'
      }}>
        {verses.map((verse, vIdx) => {
          const isVerseActive = vIdx === activeVerseIndex;
          const isVerseCompleted = vIdx < activeVerseIndex;

          const verseWords = verse.words && verse.words.length > 0
            ? verse.words.map(w => w.word)
            : verse.text.trim().split(/\s+/);

          return (
            <div
              key={`verse-${verse.verseIndex || vIdx}`}
              ref={isVerseActive ? activeLineRef : null}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: isVerseActive ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                borderLeft: isVerseActive
                  ? `3px solid ${themeStyles.activeColor}`
                  : '3px solid transparent',
                transition: 'all 0.18s ease-out',
                opacity: isVerseCompleted ? 0.6 : (isVerseActive ? 1.0 : 0.85)
              }}
            >
              <div style={{
                fontSize: isVerseActive ? '15px' : '14px',
                lineHeight: '1.6',
                color: isVerseActive ? themeStyles.activeColor : themeStyles.verseDefault,
                textShadow: isVerseActive ? themeStyles.activeGlow : 'none',
                transition: 'all 0.18s ease-out'
              }}>
                {verseWords.map((word, wIdx) => {
                  const isWordActive = isVerseActive && wIdx === activeWordOffset;
                  const isWordSpoken = isVerseActive && wIdx < activeWordOffset;

                  return (
                    <span
                      key={`word-${vIdx}-${wIdx}`}
                      style={{
                        marginRight: '6px',
                        display: 'inline-block',
                        fontWeight: isWordActive ? 700 : (isWordSpoken ? 600 : 400),
                        color: isWordActive
                          ? themeStyles.wordHighlight
                          : (isWordSpoken ? '#f8fafc' : undefined),
                        transform: isWordActive ? 'scale(1.08)' : 'scale(1.0)',
                        transition: 'transform 0.12s ease-out, color 0.12s ease-out',
                        textDecoration: isWordActive ? 'underline' : 'none'
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PoetryStreamViewer;
