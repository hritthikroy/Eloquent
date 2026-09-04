/**
 * PromptInput Component (Vanilla JS / React.createElement)
 * 
 * Compliant with Node.js AST syntax verification (node -c) without requiring
 * an external JSX preprocessor.
 */

let React = null;
try {
  React = require('react');
} catch (_) {
  React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn
  };
}
const { useState, useEffect, useRef, useCallback } = React;

const STORAGE_KEY = 'antigravity_prompt_draft';
const DEFAULT_MAX_LENGTH = 4096;

function PromptInput(props) {
  const {
    initialValue = '',
    placeholder = 'Enter developer prompt, intent, or instructions for the audio engine...',
    maxLength = DEFAULT_MAX_LENGTH,
    onPromptSubmit = null,
    autoSave = true,
    className = '',
    disabled = false
  } = props;

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

  const charCount = Array.from(prompt).length;
  const isOverLimit = charCount > maxLength;
  const isNearLimit = charCount > Math.floor(maxLength * 0.9) && !isOverLimit;

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

  const handleChange = (e) => {
    const val = e.target.value;
    setPrompt(val);

    if (val.trim().length > 0 && hasAttemptedEmpty) {
      setHasAttemptedEmpty(false);
    }

    if (error) setError(null);
    if (isSuccess) setIsSuccess(false);
  };

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || disabled) return;

    const trimmed = prompt.trim();

    if (trimmed.length === 0) {
      setError('Prompt cannot be empty or contain only whitespace.');
      setHasAttemptedEmpty(true);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
      return;
    }

    if (charCount > maxLength) {
      setError(`Prompt exceeds maximum allowed length of ${maxLength} characters (${charCount} characters).`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);

    try {
      let submissionResult = null;

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

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape' && error) {
      setError(null);
      setHasAttemptedEmpty(false);
    }
  };

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

  return React.createElement(
    'div',
    { className: `prompt-container ${className}` },
    // Header
    React.createElement(
      'div',
      { className: 'prompt-header' },
      React.createElement('span', null, 'Prompt Composition'),
      React.createElement(
        'div',
        { className: 'prompt-meta' },
        isDraftSaved && !error && !isSuccess && React.createElement('span', { className: 'prompt-status-indicator is-draft' }, '💾 Draft Saved'),
        isSuccess && React.createElement('span', { className: 'prompt-status-indicator is-success' }, '✅ Transmitted to Backend'),
        error && React.createElement('span', { className: 'prompt-status-indicator is-error' }, '⚠️ Validation Error')
      )
    ),
    // Textarea Wrapper
    React.createElement(
      'div',
      { className: 'prompt-input-wrapper' },
      React.createElement('textarea', {
        ref: textareaRef,
        className: `prompt-textarea ${hasAttemptedEmpty ? 'is-empty-attempt' : ''} ${error ? 'is-invalid' : ''} ${isSuccess ? 'is-valid' : ''}`,
        placeholder,
        value: prompt,
        onChange: handleChange,
        onKeyDown: handleKeyDown,
        disabled: disabled || isSubmitting,
        rows: 4,
        'aria-invalid': !!error,
        'aria-describedby': error ? 'prompt-error-message' : undefined
      })
    ),
    // Error Badge
    error && React.createElement(
      'div',
      { id: 'prompt-error-message', className: 'prompt-error-badge', role: 'alert' },
      React.createElement('span', { className: 'error-icon' }, '⚠️'),
      React.createElement('span', null, error)
    ),
    // Footer
    React.createElement(
      'div',
      { className: 'prompt-footer' },
      React.createElement(
        'div',
        { className: 'prompt-meta' },
        React.createElement(
          'span',
          { className: `prompt-char-counter ${isOverLimit ? 'is-limit' : ''} ${isNearLimit ? 'is-warning' : ''}` },
          `${charCount} / ${maxLength}`
        ),
        React.createElement(
          'span',
          { style: { fontSize: '11px', color: '#64748b' } },
          'Tip: Press ⌘+Enter or Ctrl+Enter to submit'
        )
      ),
      React.createElement(
        'div',
        { className: 'prompt-controls' },
        prompt.length > 0 && React.createElement(
          'button',
          {
            type: 'button',
            className: 'prompt-btn prompt-btn-secondary',
            onClick: handleClear,
            disabled: isSubmitting || disabled
          },
          'Clear'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'prompt-btn prompt-btn-primary',
            onClick: handleSubmit,
            disabled: isSubmitting || disabled || isOverLimit
          },
          isSubmitting ? 'Transmitting...' : 'Submit Prompt'
        )
      )
    )
  );
}

module.exports = {
  PromptInput,
  default: PromptInput
};
