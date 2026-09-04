/**
 * CameraView Component
 * 
 * Visual feed and HUD overlay for the 'eye' visual tracking subsystem.
 * Displays live camera stream, pose detection feedback (Standing, Sitting, Walking),
 * tracking confidence, real-time FPS, and privacy controls (disable, purge).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import EyeTracker from '../eyeTracker';
import { listenEyeMove, listenEyeUnavailable, listenEyeStatus } from '../utils/ipc';

export const CameraView = ({
  className = '',
  style = {},
  autoStart = true,
  showControls = true,
  onPoseDetected = null
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const trackerRef = useRef(null);

  // Component states
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPose, setCurrentPose] = useState('unknown'); // 'standing' | 'sitting' | 'walking' | 'unknown'
  const [confidence, setConfidence] = useState(0.0);
  const [fps, setFps] = useState(0);
  const [errorNotice, setErrorNotice] = useState(null);
  const [purgeNotice, setPurgeNotice] = useState(false);

  // Initialize and attach EyeTracker
  useEffect(() => {
    let tracker = trackerRef.current;
    if (!tracker) {
      tracker = new EyeTracker({
        videoElement: videoRef.current,
        canvasElement: canvasRef.current,
        targetFps: 30
      });

      trackerRef.current = tracker;

      // Subscribe to local pose changes
      tracker.onPoseChange((event) => {
        setCurrentPose(event.pose);
        setConfidence(event.confidence);
        if (event.metrics && event.metrics.fps !== undefined) {
          setFps(event.metrics.fps);
        }
        if (onPoseDetected) {
          onPoseDetected(event);
        }
      });

      // Subscribe to status changes
      tracker.onStatusChange((status) => {
        setIsActive(status.active);
        setIsPaused(status.paused);
      });

      // Handle unavailable/denied camera gracefully
      tracker.onUnavailable((err) => {
        setIsActive(false);
        setErrorNotice(err.message || 'Camera access denied. No-eye audio mode active.');
      });

      if (autoStart) {
        tracker.start().then((started) => {
          if (started) {
            setIsActive(true);
            setErrorNotice(null);
          } else {
            setIsActive(false);
            setErrorNotice((prev) => prev || 'Camera could not start – check macOS privacy settings (System Settings → Privacy & Security → Camera).');
          }
        });
      }
    } else {
      if (videoRef.current) tracker.setVideoElement(videoRef.current);
      if (canvasRef.current) tracker.setCanvasElement(canvasRef.current);
    }

    // Also listen to IPC channels in case events are forwarded externally
    const unlistenMove = listenEyeMove((event) => {
      if (event && event.pose) {
        setCurrentPose(event.pose);
        if (event.confidence) setConfidence(event.confidence);
      }
    });

    const unlistenUnavailable = listenEyeUnavailable((err) => {
      setErrorNotice(err.message || 'Camera unavailable. Defaulting to stationary audio mode.');
      setIsActive(false);
    });

    const unlistenStatus = listenEyeStatus((status) => {
      if (status) {
        if (status.active !== undefined) setIsActive(status.active);
        if (status.paused !== undefined) setIsPaused(status.paused);
      }
    });

    return () => {
      unlistenMove();
      unlistenUnavailable();
      unlistenStatus();
      if (trackerRef.current) {
        trackerRef.current.stop();
        trackerRef.current = null;
      }
    };
  }, [autoStart, onPoseDetected]);

  // Handle privacy toggles
  const handleToggleActive = useCallback(async () => {
    if (!trackerRef.current) return;
    if (isActive) {
      trackerRef.current.stop();
      setIsActive(false);
    } else {
      setErrorNotice(null);
      const ok = await trackerRef.current.start();
      if (ok) {
        setIsActive(true);
      } else {
        setIsActive(false);
        setErrorNotice((prev) => prev || 'Camera could not start – check macOS privacy settings (System Settings → Privacy & Security → Camera).');
      }
    }
  }, [isActive]);

  const handleTogglePause = useCallback(() => {
    if (!trackerRef.current) return;
    const paused = trackerRef.current.togglePause();
    setIsPaused(paused);
  }, []);

  const handlePurge = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.purgeFrames();
      setPurgeNotice(true);
      setTimeout(() => setPurgeNotice(false), 2000);
    }
  }, []);

  // Compute pose badge styling
  const getPoseBadge = () => {
    switch (currentPose) {
      case 'standing':
        return {
          label: 'Standing',
          icon: '🧍',
          bg: '#065f46',
          border: '#059669',
          color: '#34d399'
        };
      case 'walking':
        return {
          label: 'Walking',
          icon: '🚶',
          bg: '#1e3a8a',
          border: '#2563eb',
          color: '#60a5fa'
        };
      case 'sitting':
        return {
          label: 'Sitting',
          icon: '🪑',
          bg: '#374151',
          border: '#4b5563',
          color: '#e5e7eb'
        };
      default:
        return {
          label: 'No-Eye Mode',
          icon: '🚫',
          bg: '#451a03',
          border: '#b45309',
          color: '#fbbf24'
        };
    }
  };

  const badge = getPoseBadge();

  return (
    <div
      className={`camera-view-subsystem ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        borderRadius: '10px',
        border: '1px solid #1e293b',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        ...style
      }}
    >
      {/* Video Viewport & Overlay HUD */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '200px',
          backgroundColor: '#020617',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isActive && !isPaused && !errorNotice ? 'block' : 'none'
          }}
        />

        {/* Offscreen analysis canvas */}
        <canvas ref={canvasRef} style={{ display: 'none' }} width="160" height="120" />

        {/* Fallback View when Camera is Inactive or Denied */}
        {(!isActive || isPaused || errorNotice) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              textAlign: 'center',
              color: '#94a3b8'
            }}
          >
            <span style={{ fontSize: '32px', marginBottom: '8px' }}>
              {errorNotice ? '⚠️' : isPaused ? '⏸️' : '📷'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
              {errorNotice ? 'Visual Tracking Unavailable' : isPaused ? 'Eye Tracking Paused' : 'Camera Feed Muted'}
            </span>
            <span style={{ fontSize: '11px', marginTop: '4px', maxWidth: '240px' }}>
              {errorNotice || 'Audio pipeline operating in stationary no-eye fallback mode.'}
            </span>
          </div>
        )}

        {/* Top HUD Badge Overlay */}
        {isActive && !errorNotice && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              right: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none'
            }}
          >
            {/* Pose Feedback Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '16px',
                backgroundColor: badge.bg,
                border: `1px solid ${badge.border}`,
                color: badge.color,
                fontSize: '12px',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
              <span style={{ opacity: 0.75, fontSize: '10px' }}>
                ({Math.round(confidence * 100)}%)
              </span>
            </div>

            {/* Telemetry Indicator (FPS & Live state) */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                color: '#38bdf8',
                border: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isPaused ? '#f59e0b' : '#10b981' }} />
              <span>{isPaused ? 'PAUSED' : `${fps || 30} FPS`}</span>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar & Privacy Controls */}
      {showControls && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#0f172a',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleToggleActive}
              style={{
                backgroundColor: isActive ? '#dc2626' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
            >
              {isActive ? 'Turn Off Eye' : 'Start Eye'}
            </button>

            {isActive && (
              <button
                type="button"
                onClick={handleTogglePause}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {purgeNotice && (
              <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 500 }}>
                ✓ Frames Purged
              </span>
            )}
            <button
              type="button"
              onClick={handlePurge}
              title="Purge cached video frames and optical flow buffer from memory"
              style={{
                backgroundColor: 'transparent',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Purge Frames
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraView;
