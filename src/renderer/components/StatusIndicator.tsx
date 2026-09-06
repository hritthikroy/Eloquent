/**
 * src/renderer/components/StatusIndicator.tsx
 * 
 * Status Indicator React UI component.
 * Listens for 'audio:command-recognized' IPC telemetry events from the main process
 * and transitions UI indicator to glowing green 'READY' state upon recognizing
 * the "Chai chhi" (I'm ready) voice trigger.
 */

import React, { useState, useEffect } from 'react';
import { AudioCommandRecognizedPayload, IpcChannels } from '../../shared/types';

export interface StatusIndicatorProps {
  initialState?: 'IDLE' | 'READY';
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  initialState = 'IDLE',
  className = ''
}) => {
  const [audioState, setAudioState] = useState<'IDLE' | 'READY'>(initialState);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  useEffect(() => {
    const handleCommand = (_event: any, payload: AudioCommandRecognizedPayload) => {
      if (payload && payload.state) {
        setAudioState(payload.state);
        setLastCommand(payload.rawText || payload.command);
        setConfidence(payload.confidence);
      }
    };

    let ipcRenderer: any = null;
    if (typeof window !== 'undefined') {
      ipcRenderer = (window as any).electron?.ipcRenderer || (window as any).ipcRenderer;
    }

    if (ipcRenderer && typeof ipcRenderer.on === 'function') {
      ipcRenderer.on(IpcChannels.AUDIO_COMMAND_RECOGNIZED, handleCommand);
    }

    return () => {
      if (ipcRenderer && typeof ipcRenderer.removeListener === 'function') {
        ipcRenderer.removeListener(IpcChannels.AUDIO_COMMAND_RECOGNIZED, handleCommand);
      }
    };
  }, []);

  const toggleCapture = async () => {
    let ipcRenderer: any = null;
    if (typeof window !== 'undefined') {
      ipcRenderer = (window as any).electron?.ipcRenderer || (window as any).ipcRenderer;
    }

    if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') return;

    if (isCapturing) {
      await ipcRenderer.invoke(IpcChannels.AUDIO_STOP_CAPTURE);
      setIsCapturing(false);
    } else {
      const res = await ipcRenderer.invoke(IpcChannels.AUDIO_START_CAPTURE);
      if (res && res.success) {
        setIsCapturing(true);
      }
    }
  };

  const isReady = audioState === 'READY';

  return (
    <div
      className={`status-indicator-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 12px',
        borderRadius: '20px',
        backgroundColor: isReady ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)',
        border: `1px solid ${isReady ? '#22c55e' : '#64748b'}`,
        transition: 'all 0.3s ease-in-out',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        fontWeight: 600
      }}
      data-testid="status-indicator"
    >
      <span
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: isReady ? '#22c55e' : '#94a3b8',
          boxShadow: isReady ? '0 0 10px #22c55e, 0 0 20px #22c55e' : 'none',
          transition: 'all 0.3s ease-in-out'
        }}
      />
      <span style={{ color: isReady ? '#15803d' : '#475569' }}>
        {isReady ? 'READY (Chai chhi)' : 'IDLE'}
      </span>
      {lastCommand && (
        <span
          style={{
            fontSize: '11px',
            color: '#64748b',
            fontWeight: 400,
            marginLeft: '4px'
          }}
        >
          [{lastCommand} - {(confidence * 100).toFixed(0)}%]
        </span>
      )}
      <button
        onClick={toggleCapture}
        style={{
          marginLeft: '8px',
          padding: '2px 8px',
          fontSize: '11px',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
          backgroundColor: isCapturing ? '#ef4444' : '#3b82f6',
          color: '#ffffff'
        }}
      >
        {isCapturing ? 'Stop Mic' : 'Start Mic'}
      </button>
    </div>
  );
};

export default StatusIndicator;
