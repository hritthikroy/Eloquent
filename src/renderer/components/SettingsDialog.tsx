/**
 * SettingsDialog Component
 *
 * Configures Go audio backend parameters (sample rate, buffer size, output device),
 * persists selections to local store via Electron IPC, propagates real-time audio parameters
 * without application restarts, supports bilingual (English / Bengali) localization,
 * and includes a "Reset to Defaults" button.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AudioBackendConfig, AudioConfigResponse, IpcChannels } from '../../shared/types';

export interface SettingsDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  onConfigSaved?: (config: AudioBackendConfig) => void;
  className?: string;
  style?: React.CSSProperties;
  language?: 'en' | 'bn';
}

const DEFAULT_CONFIG: AudioBackendConfig = {
  sampleRate: 48000,
  bufferSize: 1024,
  outputDevice: 'default',
  channels: 1,
  volume: 1.0
};

const SAMPLE_RATE_OPTIONS = [16000, 22050, 44100, 48000, 96000];
const BUFFER_SIZE_OPTIONS = [256, 512, 1024, 2048, 4096];
const OUTPUT_DEVICE_OPTIONS = [
  { id: 'default', labelEn: 'Default System Output', labelBn: 'ডিফল্ট সিস্টেম আউটপুট' },
  { id: 'speakers', labelEn: 'Speakers (Realtek High Definition Audio)', labelBn: 'স্পিকার (রিয়েলটেক অডিও)' },
  { id: 'headphones', labelEn: 'Headphones / Headset Output', labelBn: 'হেডফোন / হেডসেট আউটপুট' },
  { id: 'display-audio', labelEn: 'HDMI / DisplayPort Audio', labelBn: 'এইচডিএমআই অডিও' }
];

const TRANSLATIONS = {
  en: {
    title: '⚙️ Audio Backend Settings',
    subtitle: 'Configure real-time Go audio parameters & hardware devices',
    sampleRate: 'Sample Rate (Hz)',
    bufferSize: 'Buffer Size (samples)',
    outputDevice: 'Audio Output Device',
    saving: 'Saving...',
    save: 'Save Changes',
    reset: 'Reset to Defaults',
    close: 'Close',
    successMsg: 'Audio backend configuration updated in real time!',
    errorMsg: 'Failed to update audio configuration',
    resetMsg: 'Audio settings reset to safe defaults'
  },
  bn: {
    title: '⚙️ অডিও ব্যাকএন্ড সেটিংস',
    subtitle: 'রিয়েল-টাইম গো অডিও প্যারামিটার ও ডিভাইস কনফিগার করুন',
    sampleRate: 'স্যাম্পল রেট (Hz)',
    bufferSize: 'বাফার সাইজ (স্যাম্পল)',
    outputDevice: 'অডিও আউটপুট ডিভাইস',
    saving: 'সেভ হচ্ছে...',
    save: 'পরিবর্তন সেভ করুন',
    reset: 'ডিফল্টে রিসেট করুন',
    close: 'বন্ধ করুন',
    successMsg: 'রিয়েল-টাইম গো অডিও ব্যাকএন্ড কনফিগারেশন আপডেট হয়েছে!',
    errorMsg: 'অডিও কনফিগারেশন আপডেট ব্যর্থ হয়েছে',
    resetMsg: 'অডিও সেটিংস সেফ ডিফল্টে রিসেট হয়েছে'
  }
};

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen = true,
  onClose,
  onConfigSaved,
  className = '',
  style = {},
  language = 'en'
}) => {
  const [config, setConfig] = useState<AudioBackendConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Fetch current config on mount / open
  const fetchConfig = useCallback(async () => {
    try {
      let res: AudioConfigResponse;

      if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
        res = await (window as any).ipcRenderer.invoke('get-audio-config');
      } else {
        // Fallback for standalone view / mock
        res = { success: true, config: DEFAULT_CONFIG };
      }

      if (res && res.success && res.config) {
        setConfig({
          sampleRate: Number(res.config.sampleRate) || 48000,
          bufferSize: Number(res.config.bufferSize) || 1024,
          outputDevice: res.config.outputDevice || 'default',
          channels: res.config.channels || 1,
          volume: res.config.volume || 1.0
        });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch (err) {
      setConfig(DEFAULT_CONFIG);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen, fetchConfig]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      let res: AudioConfigResponse;

      if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
        res = await (window as any).ipcRenderer.invoke('set-audio-config', { config });
      } else {
        res = { success: true, config };
      }

      if (res && res.success) {
        setStatusMessage({ type: 'success', text: t.successMsg });
        if (onConfigSaved) onConfigSaved(res.config || config);
      } else {
        setStatusMessage({ type: 'error', text: res?.error || t.errorMsg });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || t.errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = DEFAULT_CONFIG;
    setConfig(defaults);
    setIsSaving(true);
    setStatusMessage(null);

    try {
      if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
        await (window as any).ipcRenderer.invoke('set-audio-config', { config: defaults });
      }
      setStatusMessage({ type: 'success', text: t.resetMsg });
      if (onConfigSaved) onConfigSaved(defaults);
    } catch (err) {
      // Fallback clean reset
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`settings-dialog-overlay ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        ...style
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '520px',
          color: '#f8fafc',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#38bdf8' }}>{t.title}</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>{t.subtitle}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.25rem',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Toast Notification */}
        {statusMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: statusMessage.type === 'success' ? '#34d399' : '#f87171',
              border: `1px solid ${statusMessage.type === 'success' ? '#10b981' : '#ef4444'}`
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Form Controls */}
        <form onSubmit={handleSave}>
          {/* Sample Rate */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>
              {t.sampleRate}
            </label>
            <select
              value={config.sampleRate}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig({ ...config, sampleRate: Number(e.target.value) })}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '10px 12px',
                fontSize: '0.9rem'
              }}
            >
              {SAMPLE_RATE_OPTIONS.map(sr => (
                <option key={sr} value={sr}>
                  {sr} Hz {sr === 48000 ? '(Recommended)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Buffer Size */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>
              {t.bufferSize}
            </label>
            <select
              value={config.bufferSize}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig({ ...config, bufferSize: Number(e.target.value) })}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '10px 12px',
                fontSize: '0.9rem'
              }}
            >
              {BUFFER_SIZE_OPTIONS.map(bs => (
                <option key={bs} value={bs}>
                  {bs} samples {bs === 1024 ? '(Recommended)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Output Device */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '6px', color: '#cbd5e1' }}>
              {t.outputDevice}
            </label>
            <select
              value={config.outputDevice}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig({ ...config, outputDevice: e.target.value })}
              style={{
                width: '100%',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '10px 12px',
                fontSize: '0.9rem'
              }}
            >
              {OUTPUT_DEVICE_OPTIONS.map(dev => (
                <option key={dev.id} value={dev.id}>
                  {language === 'bn' ? dev.labelBn : dev.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Dialog Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              style={{
                backgroundColor: '#334155',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 16px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {t.reset}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {t.close}
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  backgroundColor: isSaving ? '#475569' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}
              >
                {isSaving ? t.saving : t.save}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
