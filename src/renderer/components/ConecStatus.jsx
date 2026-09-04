/**
 * ConecStatus Component (React JSX)
 * 
 * Renders real-time connection status between Electron UI and the Go audio backend.
 * Provides latency metrics, connection state badge, and manual reconnect triggers.
 */

import React, { useState, useEffect, useCallback } from 'react';

export const ConecStatus = ({
  pollIntervalMs = 2000,
  className = '',
  showDetails = true,
  onStatusChange = null
}) => {
  const [status, setStatus] = useState('connecting'); // 'connected' | 'connecting' | 'disconnected' | 'error'
  const [latencyMs, setLatencyMs] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [config, setConfig] = useState(null);
  const [lastCheckTime, setLastCheckTime] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState(null);

  const checkConnection = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.invoke === 'function') {
        const pingRes = await window.electronAPI.invoke('conec:ping');
        const statusRes = await window.electronAPI.invoke('conec:get-status');
        const configRes = await window.electronAPI.invoke('conec:get-config');

        if (pingRes && pingRes.pong) {
          setStatus('connected');
          setLatencyMs(pingRes.latencyMs || 0);
          setMetrics(statusRes?.metrics || null);
          setConfig(configRes || null);
          setErrorMessage(null);
          if (onStatusChange) onStatusChange('connected', pingRes);
        } else {
          setStatus('disconnected');
          if (onStatusChange) onStatusChange('disconnected');
        }
      } else {
        // Fallback for standalone preview / mock testing
        setStatus('connected');
        setLatencyMs(1);
        setMetrics({ framesDispatched: 1024, syncStallCount: 0 });
        if (onStatusChange) onStatusChange('connected');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Connection failed');
      if (onStatusChange) onStatusChange('error', err);
    } finally {
      setLastCheckTime(Date.now());
    }
  }, [onStatusChange]);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkConnection, pollIntervalMs]);

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Connecting...
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Error
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className={`p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
            ⚡
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-tight">Conec Audio Bridge</h4>
            <p className="text-xs text-slate-400">Go Backend Handshake</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <button
            onClick={checkConnection}
            title="Refresh status"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs"
          >
            ↻
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-slate-500 block">Latency</span>
            <span className="font-mono text-slate-300">
              {latencyMs !== null ? `${latencyMs}ms` : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Port / Pipe</span>
            <span className="font-mono text-slate-300 truncate block">
              {config ? `${config.host}:${config.port}` : '127.0.0.1:48080'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Sync Stalls</span>
            <span className="font-mono text-emerald-400">
              {metrics?.syncStallCount ?? 0}
            </span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-2.5 p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
};

export default ConecStatus;
