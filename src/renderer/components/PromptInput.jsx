/**
 * PromptInput Component (React JSX)
 * 
 * Robust prompt entry interface for the Antigravity Electron UI.
 * Features:
 * 1. Strict input validation rejecting empty/whitespace-only submissions with immediate UI feedback.
 * 2. Real-time Unicode-safe character counter with warning/limit indicators (up to 4096 chars).
 * 3. Debounced auto-save of prompt drafts to localStorage for crash recovery.
 * 4. Resilient IPC transmission via 'prompt:submit' to Electron main process and Go audio backend.
 * 5. Keyboard shortcuts: Cmd/Ctrl+Enter to submit, Esc to dismiss validation errors.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'antigravity_prompt_draft';
const DEFAULT_MAX_LENGTH = 4096;

export const PromptInput = ({
  initialValue = '',
  placeholder = 'Enter developer prompt, intent, or instructions for the audio engine...',
  maxLength = DEFAULT_MAX_LENGTH,
  onPromptSubmit = null,
  autoSave = true,
  className = '',
  disabled = false
}) => {
  const [prompt, setPrompt] = useState(() => {
    if (initialValue) return initialValue;
    if (autoSave && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(STORAGE_KEY) || '';
      } catch (_) {}
    }
    return '';
  });

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [hasAttemptedEmpty, setHasAttemptedEmpty] = useState(false);

  const textareaRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // Unicode-aware character count calculation
  const charCount = Array.from(prompt).length;
  const isOverLimit = charCount > maxLength;
  const isNearLimit = charCount > Math.floor(maxLength * 0.9) && !isOverLimit;

  // Auto-save draft debounced
  useEffect(() => {
    if (!autoSave || typeof localStorage === 'undefined') return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      try {
        if (prompt.trim()) {
          localStorage.setItem(STORAGE_KEY, prompt);
          setIsDraftSaved(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setIsDraftSaved(false);
        }
      } catch (_) {}
    }, 400);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [prompt, autoSave]);

  // Input change handler
  const handleChange = (e) => {
    const val = e.target.value;
    setPrompt(val);

    // Clear empty-attempt warning once user starts typing
    if (val.trim().length > 0 && hasAttemptedEmpty) {
      setHasAttemptedEmpty(false);
    }

    if (error) {
      setError(null);
    }

    if (isSuccess) {
      setIsSuccess(false);
    }
  };

  // Submission validation and IPC dispatch
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || disabled) return;

    const trimmed = prompt.trim();

    // 1. Validate empty or whitespace-only
    if (trimmed.length === 0) {
      setError('Prompt cannot be empty or contain only whitespace.');
      setHasAttemptedEmpty(true);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
      return;
    }

    // 2. Validate character length limit
    if (charCount > maxLength) {
      setError(`Prompt exceeds maximum allowed length of ${maxLength} characters (${charCount} characters).`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);

    try {
      let submissionResult = null;

      // Access IPC bridge if available in Electron environment
      const ipc = (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.ipcRenderer)
        || (typeof window !== 'undefined' && window.electron && window.electron.ipcRenderer)
        || (typeof window !== 'undefined' && window.ipcRenderer)
        || (typeof window !== 'undefined' && window.require ? window.require('electron').ipcRenderer : null);

      if (ipc && typeof ipc.invoke === 'function') {
        submissionResult = await ipc.invoke('prompt:submit', {
          prompt,
          timestamp: Date.now(),
          charCount
        });
      } else {
        // Fallback for tests or non-Electron browser previews
        submissionResult = {
          success: true,
          prompt,
          forwardedToGo: false,
          fallback: true
        };
      }

      if (submissionResult && submissionResult.success) {
        setIsSuccess(true);
        if (autoSave && typeof localStorage !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
        if (typeof onPromptSubmit === 'function') {
          onPromptSubmit(submissionResult);
        }
        // Auto-dismiss success status after 3s
        setTimeout(() => setIsSuccess(false), 3000);
      } else {
        const errorMsg = submissionResult?.error || 'Failed to transmit prompt to audio backend.';
        setError(errorMsg);
      }
    } catch (err) {
      setError(err.message || 'Transmission error while sending prompt.');
    } finally {
      setIsSubmitting(false);
    }
  }, [prompt, charCount, maxLength, isSubmitting, disabled, onPromptSubmit, autoSave]);

  // Keydown shortcuts (Cmd/Ctrl + Enter to submit, Esc to clear error)
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape' && error) {
      setError(null);
      setHasAttemptedEmpty(false);
    }
  };

  // Clear prompt input
  const handleClear = () => {
    setPrompt('');
    setError(null);
    setHasAttemptedEmpty(false);
    setIsSuccess(false);
    if (autoSave && typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={`prompt-container ${className}`}>
      {/* Header */}
      <div className="prompt-header">
        <span>Prompt Composition</span>
        <div className="prompt-meta">
          {isDraftSaved && !error && !isSuccess && (
            <span className="prompt-status-indicator is-draft">💾 Draft Saved</span>
          )}
          {isSuccess && (
            <span className="prompt-status-indicator is-success">✅ Transmitted to Backend</span>
          )}
          {error && (
            <span className="prompt-status-indicator is-error">⚠️ Validation Error</span>
          )}
        </div>
      </div>

      {/* Input Textarea */}
      <div className="prompt-input-wrapper">
        <textarea
          ref={textareaRef}
          className={`prompt-textarea ${hasAttemptedEmpty ? 'is-empty-attempt' : ''} ${error ? 'is-invalid' : ''} ${isSuccess ? 'is-valid' : ''}`}
          placeholder={placeholder}
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSubmitting}
          rows={4}
          aria-invalid={!!error}
          aria-describedby={error ? 'prompt-error-message' : undefined}
        />
      </div>

      {/* Validation Error Banner */}
      {error && (
        <div id="prompt-error-message" className="prompt-error-badge" role="alert">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Footer Controls & Metrics */}
      <div className="prompt-footer">
        <div className="prompt-meta">
          <span
            className={`prompt-char-counter ${isOverLimit ? 'is-limit' : ''} ${isNearLimit ? 'is-warning' : ''}`}
          >
            {charCount} / {maxLength}
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Tip: Press <code>⌘+Enter</code> or <code>Ctrl+Enter</code> to submit
          </span>
        </div>

        <div className="prompt-controls">
          {prompt.length > 0 && (
            <button
              type="button"
              className="prompt-btn prompt-btn-secondary"
              onClick={handleClear}
              disabled={isSubmitting || disabled}
            >
              Clear
            </button>
          )}

          <button
            type="button"
            className="prompt-btn prompt-btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || disabled || isOverLimit}
          >
            {isSubmitting ? 'Transmitting...' : 'Submit Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptInput;
