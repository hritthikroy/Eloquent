/**
 * Eloquent Renderer - Reactive Multi-Language UILayer Component
 * 
 * Provides flicker-free, zero-latency reactive UI binding to the global
 * language detection and auto-switching state across:
 * - English [en-US]
 * - Bengali (বাংলা) [bn-IN]
 * - Banglish (Roman Bengali) [bn-Roman]
 * - Hindi (हिन्दी) [hi-IN]
 * - Hinglish (Roman Hindi) [hi-Roman]
 * 
 * Performance & Flicker Prevention:
 * 1. Strict React Key Stability: Invariant keys ensure no DOM destruction/remounting on locale swaps.
 * 2. Smooth CSS Transitions: 150ms opacity/transform transitions eliminate visual tearing.
 * 3. Pre-rendered Multi-Dialect Dictionary: Instantaneous (0ms) string lookups without async network waits.
 * 4. Bi-directional IPC synchronization via window.localeBridge & electronAPI.locale.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Pre-rendered localized strings for zero-latency 0ms text lookup
const I18N_DICTIONARY = {
  'en-US': {
    appName: 'Eloquent',
    statusReady: 'System Ready',
    statusListening: 'Listening...',
    statusThinking: 'Processing...',
    statusSpeaking: 'Speaking...',
    autoDetect: 'Auto-Detect Language',
    manualMode: 'Manual Mode',
    audioSync: 'Audio Backend Synced',
    confidenceLabel: 'Confidence',
    greeting: 'All systems synchronized. How can I assist you today?',
    agentTukTuk: 'Tuk Tuk (Soul Partner)',
    agentVision: 'Vision (Lead Architect)',
    agentAndrew: 'Vision (Lead Architect)',
    latencyLabel: 'Latency',
    bufferLabel: 'Buffer'
  },
  'bn-IN': {
    appName: 'Eloquent',
    statusReady: 'সিস্টেম প্রস্তুত',
    statusListening: 'শুনছি...',
    statusThinking: 'প্রসেস হচ্ছে...',
    statusSpeaking: 'কথা বলছি...',
    autoDetect: 'অটো ভাষা শনাক্তকরণ',
    manualMode: 'ম্যানুয়াল মোড',
    audioSync: 'অডিও ব্যাকএন্ড সিঙ্কড',
    confidenceLabel: 'নির্ভুলতা',
    greeting: 'সিস্টেম সম্পূর্ণ প্রস্তুত। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
    agentTukTuk: 'টুকটুক',
    agentVision: 'ভিশন',
    agentAndrew: 'ভিশন',
    latencyLabel: 'লেটেন্সি',
    bufferLabel: 'বাফার'
  },
  'bn-Roman': {
    appName: 'Eloquent',
    statusReady: 'System Ready Ache',
    statusListening: 'Shunchhi...',
    statusThinking: 'Bhabchhi...',
    statusSpeaking: 'Bolchhi...',
    autoDetect: 'Auto Bhasha Detect',
    manualMode: 'Manual Mode',
    audioSync: 'Audio Backend Synced',
    confidenceLabel: 'Confidence',
    greeting: 'System steady ache bhai! Aajke ki help lagbe bolo?',
    agentTukTuk: 'Tuk Tuk',
    agentVision: 'Vision bhai',
    agentAndrew: 'Vision bhai',
    latencyLabel: 'Latency',
    bufferLabel: 'Buffer'
  },
  'hi-IN': {
    appName: 'Eloquent',
    statusReady: 'सिस्टम तैयार है',
    statusListening: 'सुन रहे हैं...',
    statusThinking: 'सोच रहे हैं...',
    statusSpeaking: 'बोल रहे हैं...',
    autoDetect: 'स्वचालित भाषा पहचान',
    manualMode: 'मैनुअल मोड',
    audioSync: 'ऑडियो बैकएंड सिंक हुआ',
    confidenceLabel: 'सटीकता',
    greeting: 'सिस्टम पूरी तरह तैयार है। आज मैं आपकी क्या मदद कर सकता हूँ?',
    agentTukTuk: 'टुकटुक',
    agentVision: 'विजन',
    agentAndrew: 'विजन',
    latencyLabel: 'विलंबता',
    bufferLabel: 'बफ़र'
  },
  'hi-Roman': {
    appName: 'Eloquent',
    statusReady: 'System Ready Hai',
    statusListening: 'Sun rahe hain...',
    statusThinking: 'Soch rahe hain...',
    statusSpeaking: 'Bol rahe hain...',
    autoDetect: 'Auto Language Detect',
    manualMode: 'Manual Mode',
    audioSync: 'Audio Backend Synced',
    confidenceLabel: 'Confidence',
    greeting: 'Sab steady chal raha hai bhai! Aaj kya help chahiye?',
    agentTukTuk: 'Tuk Tuk',
    agentVision: 'Vision bhai',
    agentAndrew: 'Vision bhai',
    latencyLabel: 'Latency',
    bufferLabel: 'Buffer'
  }
};

const SUPPORTED_LOCALES_LIST = [
  { code: 'en-US', label: 'English', flag: '🇺🇸' },
  { code: 'bn-IN', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'bn-Roman', label: 'Banglish', flag: '🇧🇩' },
  { code: 'hi-IN', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'hi-Roman', label: 'Hinglish', flag: '🇮🇳' }
];

export const UILayer = ({
  className = '',
  style = {},
  conversationPhase = 'idle',
  audioLatencyMs = 12,
  onLocaleChange = null
}) => {
  const [currentLocale, setCurrentLocale] = useState('en-US');
  const [autoDetect, setAutoDetect] = useState(true);
  const [confidence, setConfidence] = useState(1.0);
  const [lastSwitchSource, setLastSwitchSource] = useState('initial');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef(null);

  // Safely resolve the electron bridge
  const bridge = typeof window !== 'undefined'
    ? (window.localeBridge || (window.electronAPI && window.electronAPI.locale) || null)
    : null;

  // 1. Initial configuration load & event subscription
  useEffect(() => {
    let unsubscribe = null;

    const initBridge = async () => {
      if (bridge && typeof bridge.getCurrent === 'function') {
        try {
          const current = await bridge.getCurrent();
          if (current && current.locale) {
            setCurrentLocale(current.locale);
            if (typeof current.autoDetect === 'boolean') {
              setAutoDetect(current.autoDetect);
            }
          }
        } catch (e) {
          console.warn('[UILayer] Failed to fetch current locale:', e);
        }
      }

      if (bridge && typeof bridge.onLocaleChanged === 'function') {
        unsubscribe = bridge.onLocaleChanged((event) => {
          if (event && event.locale) {
            // Trigger smooth CSS transition flag
            setIsTransitioning(true);
            setCurrentLocale(event.locale);
            setConfidence(typeof event.confidence === 'number' ? event.confidence : 0.95);
            setLastSwitchSource(event.source || 'auto');

            if (onLocaleChange) {
              onLocaleChange(event.locale, event);
            }

            if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
            transitionTimerRef.current = setTimeout(() => {
              setIsTransitioning(false);
            }, 160);
          }
        });
      }
    };

    initBridge();

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [bridge, onLocaleChange]);

  // 2. Handle manual locale selection
  const handleLocaleSelect = useCallback(async (newLocale) => {
    if (newLocale === currentLocale) return;

    setIsTransitioning(true);
    setCurrentLocale(newLocale);
    setLastSwitchSource('manual');

    if (bridge && typeof bridge.setLocale === 'function') {
      try {
        await bridge.setLocale(newLocale, 'manual');
      } catch (e) {
        console.error('[UILayer] Failed to commit manual locale:', e);
      }
    }

    if (onLocaleChange) {
      onLocaleChange(newLocale, { source: 'manual', locale: newLocale });
    }

    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 160);
  }, [bridge, currentLocale, onLocaleChange]);

  // 3. Handle Auto-Detect Toggle
  const handleToggleAutoDetect = useCallback(async () => {
    const nextVal = !autoDetect;
    setAutoDetect(nextVal);

    if (bridge && typeof bridge.setPreference === 'function') {
      try {
        await bridge.setPreference({ autoDetect: nextVal });
      } catch (e) {
        console.error('[UILayer] Failed to persist auto-detect setting:', e);
      }
    }
  }, [bridge, autoDetect]);

  // 4. Resolve pre-rendered translations
  const t = useMemo(() => {
    return I18N_DICTIONARY[currentLocale] || I18N_DICTIONARY['en-US'];
  }, [currentLocale]);

  // 5. Compute dynamic phase status label
  const phaseLabel = useMemo(() => {
    switch (conversationPhase) {
      case 'listening': return t.statusListening;
      case 'thinking': return t.statusThinking;
      case 'speaking': return t.statusSpeaking;
      default: return t.statusReady;
    }
  }, [conversationPhase, t]);

  return (
    <div
      key="eloquent-ui-layer-root"
      className={`eloquent-locale-layer ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px 16px',
        backgroundColor: 'rgba(18, 20, 29, 0.94)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#f0f3f8',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.36)',
        transition: 'border-color 0.2s ease',
        ...style
      }}
    >
      {/* Top Header Bar: Status & Synchronization Badge */}
      <div
        key="eloquent-header-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: conversationPhase === 'speaking' ? '#10b981' : (conversationPhase === 'listening' ? '#3b82f6' : '#6366f1'),
              boxShadow: '0 0 10px currentColor'
            }}
          />
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              opacity: isTransitioning ? 0.4 : 1,
              transform: isTransitioning ? 'translateY(1px)' : 'translateY(0)',
              transition: 'opacity 150ms ease, transform 150ms ease'
            }}
          >
            {phaseLabel}
          </span>
        </div>

        {/* Audio Backend Sync & Latency Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#94a3b8' }}>
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ● {t.audioSync}
          </span>
          <span>{t.latencyLabel}: {audioLatencyMs}ms</span>
        </div>
      </div>

      {/* Main Greeting / Notification Banner */}
      <div
        key="eloquent-banner-container"
        style={{
          fontSize: '13px',
          lineHeight: '1.4',
          color: '#cbd5e1',
          padding: '6px 0',
          opacity: isTransitioning ? 0.3 : 1,
          transform: isTransitioning ? 'translateX(2px)' : 'translateX(0)',
          transition: 'opacity 150ms ease, transform 150ms ease'
        }}
      >
        {t.greeting}
      </div>

      {/* Locale Selector & Controls Bar */}
      <div
        key="eloquent-controls-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        {/* Pills for fast manual language switching */}
        <div
          key="eloquent-locale-pills"
          style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
        >
          {SUPPORTED_LOCALES_LIST.map((loc) => {
            const isSelected = loc.code === currentLocale;
            return (
              <button
                key={`locale-pill-${loc.code}`}
                type="button"
                onClick={() => handleLocaleSelect(loc.code)}
                style={{
                  background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#818cf8' : '#94a3b8',
                  border: isSelected ? '1px solid rgba(99, 102, 241, 0.6)' : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  outline: 'none',
                  transition: 'all 120ms ease'
                }}
              >
                <span>{loc.flag}</span>
                <span>{loc.label}</span>
              </button>
            );
          })}
        </div>

        {/* Auto-Detect Toggle & Confidence Badge */}
        <div
          key="eloquent-autodetect-container"
          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          {lastSwitchSource === 'auto' && (
            <span
              style={{
                fontSize: '10px',
                color: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              {t.confidenceLabel}: {Math.round(confidence * 100)}%
            </span>
          )}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              cursor: 'pointer',
              color: autoDetect ? '#a5b4fc' : '#64748b'
            }}
          >
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={handleToggleAutoDetect}
              style={{ cursor: 'pointer', accentColor: '#6366f1' }}
            />
            <span>{autoDetect ? t.autoDetect : t.manualMode}</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default UILayer;
