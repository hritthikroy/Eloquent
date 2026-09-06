/**
 * ExecutionConsole Component
 *
 * Real-time execution console component displaying Antigravity Execution Engine telemetry,
 * intent controls, process status indicators, and emergency abort actions.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ExecutionStatusPayload,
  ExecutionResult,
  ExecutionStatus,
  IpcChannels
} from '../../shared/types';

export interface ExecutionConsoleProps {
  initialIntent?: string;
  onComplete?: (result: ExecutionResult) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ExecutionConsole: React.FC<ExecutionConsoleProps> = ({
  initialIntent = '',
  onComplete,
  className = '',
  style = {}
}) => {
  const [intent, setIntent] = useState<string>(initialIntent);
  const [planId, setPlanId] = useState<string>('');
  const [status, setStatus] = useState<ExecutionStatus>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log window to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Subscribe to IPC telemetry status updates
  useEffect(() => {
    const handleStatusUpdate = (_event: any, payload: ExecutionStatusPayload) => {
      if (payload) {
        if (payload.planId) setPlanId(payload.planId);
        if (payload.status) setStatus(payload.status);
        if (payload.logs) setLogs(payload.logs);
        if (payload.currentStepIndex !== undefined) setCurrentStepIndex(payload.currentStepIndex);
        if (payload.totalSteps !== undefined) setTotalSteps(payload.totalSteps);

        if (payload.status === 'COMPLETED' || payload.status === 'FAILED' || payload.status === 'ABORTED') {
          setIsExecuting(false);
        }
      }
    };

    if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
      (window as any).ipcRenderer.on(IpcChannels.EXEC_STATUS, handleStatusUpdate);
      return () => {
        (window as any).ipcRenderer.removeListener(IpcChannels.EXEC_STATUS, handleStatusUpdate);
      };
    }
  }, []);

  const handleRunIntent = async () => {
    if (!intent.trim()) return;

    setIsExecuting(true);
    setStatus('PENDING');
    setLogs([`[ExecutionConsole] Submitting intent: "${intent}"`]);

    try {
      let result: ExecutionResult;

      if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
        result = await (window as any).ipcRenderer.invoke(IpcChannels.EXEC_RUN, { intent });
      } else {
        // Fallback for isolated web view
        result = {
          success: true,
          planId: `mock_${Date.now()}`,
          completedSteps: 1,
          totalSteps: 1,
          output: 'Mock execution result',
          logs: ['[ExecutionConsole - Mock] Intent processed']
        };
      }

      setStatus(result.success ? 'COMPLETED' : 'FAILED');
      setLogs(result.logs || []);

      if (onComplete) {
        onComplete(result);
      }
    } catch (err: any) {
      setStatus('FAILED');
      setLogs(prev => [...prev, `[ExecutionConsole Error] ${err.message || 'Execution error'}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleAbort = async () => {
    if (!planId) return;

    try {
      if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
        await (window as any).ipcRenderer.invoke(IpcChannels.EXEC_ABORT, { planId });
      }
      setStatus('ABORTED');
      setLogs(prev => [...prev, '[ExecutionConsole] User initiated process abort.']);
    } catch (err: any) {
      console.error('Abort failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusBadgeColor = (): string => {
    switch (status) {
      case 'EXECUTING': return '#3b82f6';
      case 'COMPLETED': return '#10b981';
      case 'FAILED': return '#ef4444';
      case 'ABORTED': return '#f59e0b';
      case 'PENDING': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const progressPercent = totalSteps > 0 ? Math.min(100, Math.round(((currentStepIndex + (status === 'COMPLETED' ? 1 : 0)) / totalSteps) * 100)) : 0;

  return (
    <div
      className={`execution-console ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        borderRadius: '8px',
        padding: '16px',
        fontFamily: 'monospace',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
        ...style
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#38bdf8' }}>⚡ Antigravity Execution Console</h3>
        <span
          style={{
            backgroundColor: getStatusBadgeColor(),
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}
        >
          {status}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="text"
          value={intent}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIntent(e.target.value)}
          placeholder="Enter developer intent or command..."
          disabled={isExecuting}
          style={{
            flex: 1,
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '4px',
            color: '#f1f5f9',
            padding: '8px 12px',
            fontSize: '0.9rem'
          }}
        />
        <button
          onClick={handleRunIntent}
          disabled={isExecuting || !intent.trim()}
          style={{
            backgroundColor: isExecuting ? '#475569' : '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: isExecuting ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          Run
        </button>
        {isExecuting && (
          <button
            onClick={handleAbort}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Abort
          </button>
        )}
      </div>

      {totalSteps > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
            <span>Progress ({progressPercent}%)</span>
            <span>Step {Math.min(currentStepIndex + 1, totalSteps)} of {totalSteps}</span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: getStatusBadgeColor(),
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>
      )}

      <div
        ref={logContainerRef}
        style={{
          height: '180px',
          overflowY: 'auto',
          backgroundColor: '#020617',
          border: '1px solid #1e293b',
          borderRadius: '4px',
          padding: '10px',
          fontSize: '0.8rem',
          lineHeight: '1.4'
        }}
      >
        {logs.length === 0 ? (
          <span style={{ color: '#64748b' }}>No logs recorded. Submit an intent to begin execution.</span>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ color: log.includes('Error') || log.includes('FAILED') ? '#f87171' : log.includes('Tuk Tuk') || log.includes('Vision') ? '#38bdf8' : '#cbd5e1' }}>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
