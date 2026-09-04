/**
 * PromptViewer Component
 * 
 * Displays generated Antigravity developer prompts in the Electron UI.
 * Provides a one-click "Copy to Clipboard" trigger leveraging the copyPrompt utility.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { copyPrompt, setToastHandler } from '../clipboard';

export const PromptViewer = ({
  promptText = '',
  title = 'Generated Antigravity Prompt',
  className = '',
  style = {},
  onCopied = null
}) => {
  const [toastMessage, setToastMessage] = useState(null);
  const [isErrorToast, setIsErrorToast] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bind toast handler from clipboard utility
  useEffect(() => {
    setToastHandler((msg, isErr = false) => {
      setToastMessage(msg);
      setIsErrorToast(isErr);
      setTimeout(() => {
        setToastMessage(null);
      }, 2500);
    });

    return () => {
      setToastHandler(null);
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (!promptText || !promptText.trim()) return;

    try {
      copyPrompt(promptText);
      setCopied(true);
      if (onCopied) onCopied(promptText);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setToastMessage('Clipboard write failed: ' + err.message);
      setIsErrorToast(true);
    }
  }, [promptText, onCopied]);

  return (
    <div
      className={`prompt-viewer-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        borderRadius: '8px',
        border: '1px solid #1e293b',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        ...style
      }}
    >
      {/* Header bar with title and copy action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📋</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
            {title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {toastMessage && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: isErrorToast ? '#f87171' : '#34d399',
                backgroundColor: isErrorToast ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}
            >
              {toastMessage}
            </span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={!promptText || !promptText.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: copied ? '#059669' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: (!promptText || !promptText.trim()) ? 'not-allowed' : 'pointer',
              opacity: (!promptText || !promptText.trim()) ? 0.5 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied' : 'Copy to Clipboard'}</span>
          </button>
        </div>
      </div>

      {/* Prompt preview area */}
      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          backgroundColor: '#020617',
          color: '#e2e8f0',
          fontSize: '12px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          lineHeight: '1.5',
          overflowX: 'auto',
          maxHeight: '350px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {promptText || '// No prompt generated yet. Speak or type intent to synthesize.'}
      </pre>
    </div>
  );
};

export default PromptViewer;
