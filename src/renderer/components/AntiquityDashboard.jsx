/**
 * Antiquity Microservice Monitoring Dashboard Component
 *
 * Visualizes the health, latency, and throughput of isolated Antiquity microservices,
 * providing real-time telemetry on the proxy layer's < 5ms overhead budget.
 */

import React, { useState, useEffect, useCallback } from 'react';

export const AntiquityDashboard = ({
  pollIntervalMs = 1500,
  className = '',
  onHealthChange = null,
}) => {
  const [telemetry, setTelemetry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.invoke === 'function') {
        const data = await window.electronAPI.invoke('antiquity:status');
        setTelemetry(data);
        setError(null);
        if (onHealthChange) onHealthChange(data);
      } else {
        // Mock fallback for browser / development preview
        setTelemetry({
          status: 'healthy',
          uptimeSeconds: 120,
          metrics: {
            totalRequests: 42,
            successfulRequests: 42,
            rejectedRequests: 0,
            failedExecutions: 0,
            avgProxyOverheadMs: 0.85,
            maxProxyOverheadMs: 2.10,
            overheadBudgetMet: true,
          },
          registeredTools: ['legacy-parser', 'audio-bridge', 'format-converter'],
          toolUsage: {
            'legacy-parser': { total: 24, success: 24, failed: 0 },
            'audio-bridge': { total: 18, success: 18, failed: 0 },
          },
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to query Antiquity proxy status');
    } finally {
      setIsLoading(false);
    }
  }, [onHealthChange]);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(timer);
  }, [fetchStatus, pollIntervalMs]);

  const metrics = telemetry?.metrics || {
    totalRequests: 0,
    successfulRequests: 0,
    avgProxyOverheadMs: 0,
    overheadBudgetMet: true,
  };

  const isWithinBudget = metrics.overheadBudgetMet;

  return (
    <div className={`antiquity-dashboard-card p-4 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md shadow-2xl text-slate-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-emerald-400/50 shadow-md" />
          <h2 className="text-base font-semibold tracking-wide text-slate-100">
            Antiquity Microservice Mesh
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Proxy Layer
          </span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          SLA Target: &lt; 5.0ms
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded mb-3">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/60 p-2.5 rounded-lg border border-white/5">
          <div className="text-xs text-slate-400 mb-1">Proxy Overhead</div>
          <div className={`text-lg font-bold font-mono ${isWithinBudget ? 'text-emerald-400' : 'text-amber-400'}`}>
            {metrics.avgProxyOverheadMs} <span className="text-xs font-normal">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {isWithinBudget ? '✓ Within Budget' : '⚠ High Overhead'}
          </div>
        </div>

        <div className="bg-slate-800/60 p-2.5 rounded-lg border border-white/5">
          <div className="text-xs text-slate-400 mb-1">Total Requests</div>
          <div className="text-lg font-bold font-mono text-slate-100">
            {metrics.totalRequests}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">
            {metrics.successfulRequests} Passed
          </div>
        </div>

        <div className="bg-slate-800/60 p-2.5 rounded-lg border border-white/5">
          <div className="text-xs text-slate-400 mb-1">Schema Rejections</div>
          <div className="text-lg font-bold font-mono text-amber-400">
            {metrics.rejectedRequests || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Auth / Validation
          </div>
        </div>

        <div className="bg-slate-800/60 p-2.5 rounded-lg border border-white/5">
          <div className="text-xs text-slate-400 mb-1">Max Spike</div>
          <div className="text-lg font-bold font-mono text-cyan-400">
            {metrics.maxProxyOverheadMs || 0} <span className="text-xs font-normal">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Peak Overhead</div>
        </div>
      </div>

      {/* Microservices List */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
          Isolated Endpoints
        </div>
        {(telemetry?.registeredTools || ['legacy-parser', 'audio-bridge']).map((tool) => {
          const usage = telemetry?.toolUsage?.[tool] || { total: 0, success: 0, failed: 0 };
          return (
            <div
              key={tool}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-white/5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-slate-200">{tool}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">
                  stateless
                </span>
              </div>
              <div className="font-mono text-slate-400">
                {usage.total} calls ({usage.success} ok)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AntiquityDashboard;
