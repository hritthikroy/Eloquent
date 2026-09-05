/**
 * ContentDisplay Component
 * 
 * High-fidelity content viewer for user transcriptions and Tuk Tuk persona responses:
 * 1. Automatically detects Bengali (Bangla) script and initiates IPC normalization
 * 2. Subscribes to 'validate-bangla-text' IPC channel
 * 3. Displays an elegant 'Normalizing...' indicator while linguistic verification runs
 * 4. Ensures zero rendering of unnormalized encoding artifacts (split matras, loose Nuktas)
 * 5. Supports seamless fallback for non-Bengali or offline environments
 */

import React, { useState, useEffect, useRef } from 'react';

export interface ContentDisplayProps {
  content: string;
  speaker?: string;
  language?: string;
  timestamp?: number;
  showSpeaker?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onNormalized?: (normalizedText: string) => void;
  renderCustomIndicator?: () => React.ReactNode;
}

export interface BanglaValidationResult {
  success: boolean;
  text: string;
  original: string;
  modified: boolean;
  error?: string;
}

// In-memory cache to prevent redundant IPC roundtrips for repeated phrases
const normalizationCache = new Map<string, string>();

/**
 * Checks if a string contains Bengali Unicode characters (\u0980 - \u09FF)
 */
export function isBengaliText(text: string): boolean {
  if (!text) return false;
  return /[\u0980-\u09FF]/.test(text);
}

/**
 * Lightweight in-memory fallback normalizer when IPC is unavailable
 */
function localFallbackNormalize(input: string): string {
  if (!input) return '';
  let text = input.normalize('NFC');
  text = text.replace(/\u09A4\u09CD\u200D/g, '\u09CE');
  text = text.replace(/\u09A4\u09CD\u200C/g, '\u09CE');
  text = text.replace(/\u09A4\u09CD(?=[\s।\.,!?;:]|$)/g, '\u09CE');
  text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  text = text.replace(/\u09A1\u09BC/g, '\u09DC');
  text = text.replace(/\u09A2\u09BC/g, '\u09DD');
  text = text.replace(/\u09AF\u09BC/g, '\u09DF');
  text = text.replace(/\u09C7\u09BE/g, '\u09CB');
  text = text.replace(/\u09BE\u09C7/g, '\u09CB');
  text = text.replace(/\u09C7\u09D7/g, '\u09CC');
  text = text.replace(/\u09C7\u09CC/g, '\u09CC');
  text = text.replace(/\u09CC\u09C7/g, '\u09CC');
  text = text.replace(/\u09C7\u09C8/g, '\u09C8');
  text = text.replace(/\u09C8\u09C7/g, '\u09C8');
  text = text.replace(/\u09BE{2,}/g, '\u09BE');
  text = text.replace(/\u09BF{2,}/g, '\u09BF');
  text = text.replace(/\u09C0{2,}/g, '\u09C0');
  text = text.replace(/\u09C1{2,}/g, '\u09C1');
  text = text.replace(/\u09C2{2,}/g, '\u09C2');
  text = text.replace(/\u09C3{2,}/g, '\u09C3');
  text = text.replace(/\u09C7{2,}/g, '\u09C7');
  text = text.replace(/\u09C8{2,}/g, '\u09C8');
  text = text.replace(/\u09CB{2,}/g, '\u09CB');
  text = text.replace(/\u09CC{2,}/g, '\u09CC');
  text = text.replace(/\u09CD{2,}/g, '\u09CD');
  text = text.replace(/\u0981{2,}/g, '\u0981');
  text = text.replace(/\u0982{2,}/g, '\u0982');
  text = text.replace(/\u0983{2,}/g, '\u0983');
  text = text.replace(/[ \t]+\u0964/g, '\u0964');
  text = text.replace(/\u0964([^\s\u0964\.,!?;:\)\]\}])/g, '\u0964 $1');
  text = text.replace(/[ \t]{2,}/g, ' ');
  return text.trim();
}

/**
 * Invoke the main-process 'validate-bangla-text' IPC handler across supported Electron bridges
 */
async function invokeBanglaValidation(rawText: string): Promise<BanglaValidationResult> {
  if (typeof window !== 'undefined') {
    const win = window as any;

    // 1. Direct window.api.validateBanglaText
    if (win.api && typeof win.api.validateBanglaText === 'function') {
      return win.api.validateBanglaText(rawText);
    }

    // 2. Direct window.electronAPI.validateBanglaText
    if (win.electronAPI && typeof win.electronAPI.validateBanglaText === 'function') {
      return win.electronAPI.validateBanglaText(rawText);
    }

    // 3. window.electronInvoke.invoke
    if (win.electronInvoke && typeof win.electronInvoke.invoke === 'function') {
      return win.electronInvoke.invoke('validate-bangla-text', rawText);
    }

    // 4. window.ipcRenderer.invoke
    if (win.ipcRenderer && typeof win.ipcRenderer.invoke === 'function') {
      return win.ipcRenderer.invoke('validate-bangla-text', rawText);
    }

    // 5. window.electron.ipcRenderer.invoke
    if (win.electron?.ipcRenderer && typeof win.electron.ipcRenderer.invoke === 'function') {
      return win.electron.ipcRenderer.invoke('validate-bangla-text', rawText);
    }
  }

  // Fallback if running outside Electron context
  const localNormalized = localFallbackNormalize(rawText);
  return {
    success: true,
    text: localNormalized,
    original: rawText,
    modified: localNormalized !== rawText
  };
}

export const ContentDisplay: React.FC<ContentDisplayProps> = ({
  content,
  speaker = 'Tuk Tuk',
  language,
  timestamp,
  showSpeaker = true,
  className = '',
  style = {},
  onNormalized,
  renderCustomIndicator
}) => {
  const [displayText, setDisplayText] = useState<string>(content || '');
  const [isNormalizing, setIsNormalizing] = useState<boolean>(false);
  const [isBangla, setIsBangla] = useState<boolean>(false);
  const [wasNormalized, setWasNormalized] = useState<boolean>(false);
  const activeRequestId = useRef<number>(0);

  // Normalization effect triggered whenever content or language changes
  useEffect(() => {
    const raw = content || '';
    const needsBanglaCheck = isBengaliText(raw) || language === 'bn' || language === 'bengali';

    setIsBangla(needsBanglaCheck);

    if (!needsBanglaCheck || !raw.trim()) {
      setDisplayText(raw);
      setIsNormalizing(false);
      setWasNormalized(false);
      return;
    }

    // Check fast memory cache first
    if (normalizationCache.has(raw)) {
      const cached = normalizationCache.get(raw)!;
      setDisplayText(cached);
      setIsNormalizing(false);
      setWasNormalized(cached !== raw);
      onNormalized?.(cached);
      return;
    }

    // Increment request ID to cancel stale in-flight responses
    const currentRequestId = ++activeRequestId.current;
    setIsNormalizing(true);

    invokeBanglaValidation(raw)
      .then((res) => {
        if (activeRequestId.current === currentRequestId) {
          const validated = res && res.text ? res.text : raw;
          normalizationCache.set(raw, validated);
          setDisplayText(validated);
          setIsNormalizing(false);
          setWasNormalized(!!res?.modified);
          onNormalized?.(validated);
        }
      })
      .catch((err) => {
        console.warn('⚠️ [ContentDisplay] Bangla normalization error, applying fallback:', err);
        if (activeRequestId.current === currentRequestId) {
          const fallback = localFallbackNormalize(raw);
          normalizationCache.set(raw, fallback);
          setDisplayText(fallback);
          setIsNormalizing(false);
          setWasNormalized(fallback !== raw);
          onNormalized?.(fallback);
        }
      });
  }, [content, language, onNormalized]);

  const isTukTuk = speaker?.toLowerCase().includes('tuk tuk') || speaker?.toLowerCase() === 'ai';

  return (
    <div
      className={`content-display-wrapper ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        margin: '6px 0',
        padding: '10px 14px',
        borderRadius: '10px',
        backgroundColor: isTukTuk ? 'rgba(30, 41, 59, 0.7)' : 'rgba(15, 23, 42, 0.5)',
        border: `1px solid ${isTukTuk ? 'rgba(56, 189, 248, 0.25)' : 'rgba(148, 163, 184, 0.15)'}`,
        boxShadow: isTukTuk ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
        fontFamily: isBangla ? '"Kalpurush", "SolaimanLipi", "Noto Sans Bengali", sans-serif' : 'inherit',
        lineHeight: isBangla ? 1.7 : 1.5,
        ...style
      }}
    >
      {/* Header with Speaker Name & Timestamp */}
      {showSpeaker && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: isTukTuk ? '#38bdf8' : '#94a3b8'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{isTukTuk ? '🤖' : '👤'}</span>
            <span>{speaker}</span>
            {isBangla && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  color: '#7dd3fc',
                  border: '1px solid rgba(56, 189, 248, 0.2)'
                }}
              >
                বাংলা
              </span>
            )}
          </div>

          {timestamp && (
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* Main Body Content & Normalizing Indicator */}
      <div style={{ position: 'relative', fontSize: '14px', color: '#f1f5f9' }}>
        {isNormalizing ? (
          renderCustomIndicator ? (
            renderCustomIndicator()
          ) : (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                color: '#38bdf8',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#38bdf8',
                  animation: 'pulse 1.2s infinite'
                }}
              />
              <span>Normalizing...</span>
            </div>
          )
        ) : (
          <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            {displayText}
          </div>
        )}
      </div>

      {/* Verification footer tag when Bangla normalization was applied */}
      {!isNormalizing && wasNormalized && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '4px',
            fontSize: '10px',
            color: '#10b981',
            opacity: 0.85
          }}
        >
          <span>✓</span>
          <span>Normalized Bangla Orthography</span>
        </div>
      )}
    </div>
  );
};

export default ContentDisplay;
