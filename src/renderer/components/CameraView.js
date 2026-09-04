/**
 * CameraView Component (Vanilla JS / React.createElement)
 * 
 * Compliant with Node.js AST syntax verification (node -c) without requiring
 * an external JSX preprocessor.
 */

const React = require('react');
const { useState, useEffect, useRef, useCallback } = React;
const EyeTracker = require('../eyeTracker');
const { listenEyeMove, listenEyeUnavailable, listenEyeStatus } = require('../utils/ipc');

function CameraView(props) {
  const {
    className = '',
    style = {},
    autoStart = true,
    showControls = true,
    onPoseDetected = null
  } = props;

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const trackerRef = useRef(null);

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPose, setCurrentPose] = useState('unknown');
  const [confidence, setConfidence] = useState(0.0);
  const [fps, setFps] = useState(0);
  const [errorNotice, setErrorNotice] = useState(null);
  const [purgeNotice, setPurgeNotice] = useState(false);

  useEffect(() => {
    let tracker = trackerRef.current;
    if (!tracker) {
      tracker = new EyeTracker({
        videoElement: videoRef.current,
        canvasElement: canvasRef.current,
        targetFps: 30
      });
      trackerRef.current = tracker;

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

      tracker.onStatusChange((status) => {
        setIsActive(status.active);
        setIsPaused(status.paused);
      });

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

  const getPoseBadge = () => {
    switch (currentPose) {
      case 'standing':
        return { label: 'Standing', icon: '🧍', bg: '#065f46', border: '#059669', color: '#34d399' };
      case 'walking':
        return { label: 'Walking', icon: '🚶', bg: '#1e3a8a', border: '#2563eb', color: '#60a5fa' };
      case 'sitting':
        return { label: 'Sitting', icon: '🪑', bg: '#374151', border: '#4b5563', color: '#e5e7eb' };
      default:
        return { label: 'No-Eye Mode', icon: '🚫', bg: '#451a03', border: '#b45309', color: '#fbbf24' };
    }
  };

  const badge = getPoseBadge();

  // Root container
  return React.createElement('div', {
    className: `camera-view-subsystem ${className}`,
    style: {
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      border: '1px solid #1e293b',
      overflow: 'hidden',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      ...style
    }
  }, [
    // Video viewport
    React.createElement('div', {
      key: 'viewport',
      style: {
        position: 'relative',
        width: '100%',
        height: '200px',
        backgroundColor: '#020617',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, [
      React.createElement('video', {
        key: 'video',
        ref: videoRef,
        muted: true,
        playsInline: true,
        autoPlay: true,
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: isActive && !isPaused && !errorNotice ? 'block' : 'none'
        }
      }),
      React.createElement('canvas', {
        key: 'canvas',
        ref: canvasRef,
        style: { display: 'none' },
        width: 160,
        height: 120
      }),
      // Fallback
      (!isActive || isPaused || errorNotice) ? React.createElement('div', {
        key: 'fallback',
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          textAlign: 'center',
          color: '#94a3b8'
        }
      }, [
        React.createElement('span', { key: 'fb-icon', style: { fontSize: '32px', marginBottom: '8px' } }, errorNotice ? '⚠️' : isPaused ? '⏸️' : '📷'),
        React.createElement('span', { key: 'fb-title', style: { fontSize: '13px', fontWeight: 600, color: '#e2e8f0' } }, errorNotice ? 'Visual Tracking Unavailable' : isPaused ? 'Eye Tracking Paused' : 'Camera Feed Muted'),
        React.createElement('span', { key: 'fb-sub', style: { fontSize: '11px', marginTop: '4px', maxWidth: '240px' } }, errorNotice || 'Audio pipeline operating in stationary no-eye fallback mode.')
      ]) : null,
      // HUD Overlay
      (isActive && !errorNotice) ? React.createElement('div', {
        key: 'hud',
        style: {
          position: 'absolute',
          top: '10px',
          left: '10px',
          right: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }
      }, [
        React.createElement('div', {
          key: 'badge',
          style: {
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
          }
        }, [
          React.createElement('span', { key: 'b-icon' }, badge.icon),
          React.createElement('span', { key: 'b-label' }, badge.label),
          React.createElement('span', { key: 'b-conf', style: { opacity: 0.75, fontSize: '10px' } }, ` (${Math.round(confidence * 100)}%)`)
        ]),
        React.createElement('div', {
          key: 'fps',
          style: {
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '10px',
            color: '#38bdf8',
            border: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }
        }, [
          React.createElement('span', { key: 'fps-dot', style: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isPaused ? '#f59e0b' : '#10b981' } }),
          React.createElement('span', { key: 'fps-val' }, isPaused ? 'PAUSED' : `${fps || 30} FPS`)
        ])
      ]) : null
    ]),
    // Controls bar
    showControls ? React.createElement('div', {
      key: 'controls',
      style: {
        padding: '10px 14px',
        backgroundColor: '#0f172a',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, [
      React.createElement('div', { key: 'btns', style: { display: 'flex', gap: '8px' } }, [
        React.createElement('button', {
          key: 'btn-active',
          type: 'button',
          onClick: handleToggleActive,
          style: {
            backgroundColor: isActive ? '#dc2626' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }
        }, isActive ? 'Turn Off Eye' : 'Start Eye'),
        isActive ? React.createElement('button', {
          key: 'btn-pause',
          type: 'button',
          onClick: handleTogglePause,
          style: {
            backgroundColor: '#1e293b',
            color: '#cbd5e1',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer'
          }
        }, isPaused ? 'Resume' : 'Pause') : null
      ]),
      React.createElement('div', { key: 'purge-box', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        purgeNotice ? React.createElement('span', { key: 'purge-txt', style: { fontSize: '10px', color: '#34d399', fontWeight: 500 } }, '✓ Frames Purged') : null,
        React.createElement('button', {
          key: 'btn-purge',
          type: 'button',
          onClick: handlePurge,
          title: 'Purge cached video frames and optical flow buffer from memory',
          style: {
            backgroundColor: 'transparent',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer'
          }
        }, 'Purge Frames')
      ])
    ]) : null
  ]);
}

CameraView.default = CameraView;
module.exports = CameraView;
module.exports.CameraView = CameraView;
