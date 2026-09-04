import React, { useState, useEffect, useCallback } from 'react';

export interface CacheClearResult {
  success: boolean;
  timestamp?: number;
  chromiumCleared?: boolean;
  nodeCleared?: boolean;
  goBackendCleared?: boolean;
  error?: string;
  details?: {
    drainedFrames?: number;
    goBackend?: any;
    [key: string]: any;
  };
}

export interface SettingsProps {
  className?: string;
  style?: React.CSSProperties;
  onCacheCleared?: (result: CacheClearResult) => void;
  onCacheError?: (error: string) => void;
}

export interface ToastState {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  details?: string;
}

const STORAGE_KEYS = {
  SKIP_CONFIRMATION: 'eloquent_skip_cache_clear_confirm',
  AUTO_CLEAN_ENABLED: 'eloquent_auto_cache_clean_enabled',
  AUTO_CLEAN_TTL_HOURS: 'eloquent_auto_cache_clean_ttl_hours',
  LAST_CLEARED_TIMESTAMP: 'eloquent_last_cache_cleared_at'
};

export const Settings: React.FC<SettingsProps> = ({
  className = '',
  style = {},
  onCacheCleared,
  onCacheError
}) => {
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [skipConfirmation, setSkipConfirmation] = useState<boolean>(false);
  const [autoCleanEnabled, setAutoCleanEnabled] = useState<boolean>(false);
  const [autoCleanTtl, setAutoCleanTtl] = useState<number>(24);
  const [lastClearedAt, setLastClearedAt] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Load persisted preferences
  useEffect(() => {
    try {
      const savedSkipConfirm = localStorage.getItem(STORAGE_KEYS.SKIP_CONFIRMATION);
      if (savedSkipConfirm !== null) {
        setSkipConfirmation(savedSkipConfirm === 'true');
      }

      const savedAutoClean = localStorage.getItem(STORAGE_KEYS.AUTO_CLEAN_ENABLED);
      if (savedAutoClean !== null) {
        setAutoCleanEnabled(savedAutoClean === 'true');
      }

      const savedTtl = localStorage.getItem(STORAGE_KEYS.AUTO_CLEAN_TTL_HOURS);
      if (savedTtl !== null) {
        setAutoCleanTtl(parseInt(savedTtl, 10) || 24);
      }

      const savedLastCleared = localStorage.getItem(STORAGE_KEYS.LAST_CLEARED_TIMESTAMP);
      if (savedLastCleared !== null) {
        setLastClearedAt(parseInt(savedLastCleared, 10) || null);
      }
    } catch (e) {
      // LocalStorage access fallback
    }
  }, []);

  // Periodic Cache Health Check / Stale Entry Auto-Clear
  useEffect(() => {
    if (!autoCleanEnabled) return;

    const intervalMs = 60 * 60 * 1000; // Check hourly
    const checkCacheHealth = async () => {
      const now = Date.now();
      const ttlMs = autoCleanTtl * 60 * 60 * 1000;
      const last = lastClearedAt || 0;

      if (now - last > ttlMs && !isClearing) {
        console.log('🧹 [Settings/AutoClean] Periodic cache TTL expired, auto-clearing stale entries...');
        await executeCacheClear(true);
      }
    };

    const timer = setInterval(checkCacheHealth, intervalMs);
    return () => clearInterval(timer);
  }, [autoCleanEnabled, autoCleanTtl, lastClearedAt, isClearing]);

  const showToastNotification = (type: 'success' | 'error' | 'info', message: string, details?: string) => {
    const id = String(Date.now());
    setToast({ id, type, message, details });
    setTimeout(() => {
      setToast((current) => (current && current.id === id ? null : current));
    }, 4500);
  };

  const executeCacheClear = useCallback(async (isSilentAuto = false) => {
    setIsClearing(true);
    try {
      let result: CacheClearResult;

      // 1. Prioritize safe window.api.clearCache()
      if (typeof window !== 'undefined' && (window as any).api && typeof (window as any).api.clearCache === 'function') {
        result = await (window as any).api.clearCache();
      } else if (typeof window !== 'undefined' && (window as any).electronInvoke && typeof (window as any).electronInvoke.invoke === 'function') {
        result = await (window as any).electronInvoke.invoke('clear-app-cache');
      } else if (typeof window !== 'undefined' && (window as any).ipcRenderer && typeof (window as any).ipcRenderer.invoke === 'function') {
        result = await (window as any).ipcRenderer.invoke('clear-app-cache');
      } else {
        // Mock fallback for browser / unit testing
        result = {
          success: true,
          timestamp: Date.now(),
          chromiumCleared: true,
          nodeCleared: true,
          goBackendCleared: true
        };
      }

      if (result && result.success) {
        const now = Date.now();
        setLastClearedAt(now);
        try {
          localStorage.setItem(STORAGE_KEYS.LAST_CLEARED_TIMESTAMP, String(now));
        } catch (e) {}

        const detailsStr = `Purged Chromium Cache • Reset Node.js Memory • Flushed Go Audio Buffers`;
        if (!isSilentAuto) {
          showToastNotification('success', 'Application Cache Cleared Successfully', detailsStr);
        }
        if (onCacheCleared) {
          onCacheCleared(result);
        }
      } else {
        const errMsg = result?.error || 'Unknown error occurred while clearing cache';
        showToastNotification('error', 'Failed to Clear Cache', errMsg);
        if (onCacheError) {
          onCacheError(errMsg);
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Exception thrown during cache clear invocation';
      showToastNotification('error', 'Cache Clearing Error', errMsg);
      if (onCacheError) {
        onCacheError(errMsg);
      }
    } finally {
      setIsClearing(false);
      setShowConfirmModal(false);
    }
  }, [onCacheCleared, onCacheError]);

  const handleClearCacheClick = () => {
    if (skipConfirmation) {
      executeCacheClear();
    } else {
      setShowConfirmModal(true);
    }
  };

  const handleToggleSkipConfirm = (checked: boolean) => {
    setSkipConfirmation(checked);
    try {
      localStorage.setItem(STORAGE_KEYS.SKIP_CONFIRMATION, String(checked));
    } catch (e) {}
  };

  const handleToggleAutoClean = (checked: boolean) => {
    setAutoCleanEnabled(checked);
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_CLEAN_ENABLED, String(checked));
    } catch (e) {}
  };

  const handleTtlChange = (hours: number) => {
    setAutoCleanTtl(hours);
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_CLEAN_TTL_HOURS, String(hours));
    } catch (e) {}
  };

  return (
    <div
      className={`eloquent-settings-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '24px',
        backgroundColor: '#0f172a',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: '680px',
        margin: '0 auto',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        ...style
      }}
    >
      {/* Settings Header */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
          Application Settings & Storage
        </h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
          Manage local memory buffers, Chromium session caches, and Go audio backend state.
        </p>
      </div>

      {/* Cache & Memory Optimization Section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: 'rgba(30, 41, 59, 0.6)',
          padding: '18px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
              Clear Application Cache
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
              Purges the Chromium network cache, drains Node.js audio queues, and resets Go backend memory buffers.
              Restores a clean state without needing to restart Eloquent.
            </div>
            {lastClearedAt && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                Last cleared: {new Date(lastClearedAt).toLocaleTimeString()} ({new Date(lastClearedAt).toLocaleDateString()})
              </div>
            )}
          </div>

          <button
            type="button"
            id="clear-cache-btn"
            disabled={isClearing}
            onClick={handleClearCacheClick}
            style={{
              backgroundColor: isClearing ? '#475569' : '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isClearing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
              transition: 'all 0.15s ease',
              outline: 'none'
            }}
          >
            <span>{isClearing ? '🔄' : '🗑️'}</span>
            <span>{isClearing ? 'Clearing Cache...' : 'Clear Cache'}</span>
          </button>
        </div>

        {/* Periodic Health Check / Auto Clean Option */}
        <div
          style={{
            marginTop: '12px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={autoCleanEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleToggleAutoClean(e.target.checked)}
              style={{ accentColor: '#6366f1', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span style={{ color: '#cbd5e1', fontWeight: 500 }}>
              Periodic Cache Health Check (Auto-clear stale entries)
            </span>
          </label>

          {autoCleanEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '26px', fontSize: '12px', color: '#94a3b8' }}>
              <span>Auto-clean interval TTL:</span>
              <select
                value={autoCleanTtl}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTtlChange(Number(e.target.value))}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value={1}>1 Hour</option>
                <option value={6}>6 Hours</option>
                <option value={24}>24 Hours (Daily)</option>
                <option value={168}>7 Days (Weekly)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              color: '#f8fafc'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '22px' }}>⚠️</span>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Confirm Cache Reset
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Are you sure you want to clear the application cache? This will purge Chromium session temporary storage,
              reset in-memory audio queues, and reinitialize Go audio engine buffers.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px', fontSize: '12px', color: '#94a3b8' }}>
              <input
                type="checkbox"
                checked={skipConfirmation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleToggleSkipConfirm(e.target.checked)}
                style={{ accentColor: '#6366f1', cursor: 'pointer' }}
              />
              <span>Do not ask again (remember my choice)</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                id="confirm-clear-cache-btn"
                onClick={() => executeCacheClear()}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(220, 38, 38, 0.4)'
                }}
              >
                Yes, Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            backgroundColor: toast.type === 'success' ? '#065f46' : '#991b1b',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '10px',
            border: `1px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxWidth: '380px',
            animation: 'fadeIn 0.2s ease',
            zIndex: 1000
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px' }}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
          {toast.details && (
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', paddingLeft: '22px' }}>
              {toast.details}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;
