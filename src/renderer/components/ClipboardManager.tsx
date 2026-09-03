import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Standardized Payload Interfaces
 */
export interface ClipboardPayload {
  text?: string;
  html?: string;
  code?: string;
  language?: string;
  data?: Record<string, any> | any[];
}

export interface ClipboardResult {
  success: boolean;
  format?: string;
  text?: string;
  isEmpty?: boolean;
  error?: string;
}

export interface UseClipboardOptions {
  onCopySuccess?: (result: ClipboardResult) => void;
  onPasteSuccess?: (content: string, format: string) => void;
  onError?: (error: string) => void;
  targetInputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
}

/**
 * Safe accessor for window.clipboard exposed via contextBridge in preload
 */
const getClipboardBridge = () => {
  if (typeof window !== 'undefined' && (window as any).clipboard) {
    return (window as any).clipboard;
  }
  return null;
};

/**
 * Custom React Hook for Bidirectional Clipboard Synchronization
 */
export function useClipboard(options: UseClipboardOptions = {}) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCopiedFormat, setLastCopiedFormat] = useState<string | null>(null);
  const [lastPastedText, setLastPastedText] = useState<string | null>(null);

  // In-flight mutex flag to prevent concurrency race conditions during rapid operations
  const inFlightRef = useRef<boolean>(false);

  /**
   * Copy formatted text, code, or structured JSON data to OS clipboard
   */
  const copy = useCallback(async (payload: string | ClipboardPayload): Promise<ClipboardResult> => {
    if (inFlightRef.current) {
      return { success: false, error: 'Clipboard operation already in progress' };
    }

    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const bridge = getClipboardBridge();
      let result: ClipboardResult;

      if (bridge && typeof bridge.copy === 'function') {
        result = await bridge.copy(payload);
      } else if (navigator.clipboard) {
        // Fallback for standard web environment
        const textToCopy = typeof payload === 'string'
          ? payload
          : (payload.code || payload.text || (payload.data ? JSON.stringify(payload.data, null, 2) : ''));
        await navigator.clipboard.writeText(textToCopy);
        result = { success: true, format: 'text' };
      } else {
        throw new Error('Clipboard API is unavailable in this environment');
      }

      if (result.success) {
        setLastCopiedFormat(result.format || 'text');
        if (options.onCopySuccess) options.onCopySuccess(result);
      } else {
        const errMsg = result.error || 'Failed to copy to clipboard';
        setError(errMsg);
        if (options.onError) options.onError(errMsg);
      }

      return result;
    } catch (err: any) {
      const errMsg = err?.message || 'Unexpected clipboard copy failure';
      setError(errMsg);
      if (options.onError) options.onError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [options]);

  /**
   * Paste external content from OS clipboard into the active state or input
   */
  const paste = useCallback(async (): Promise<ClipboardResult> => {
    if (inFlightRef.current) {
      return { success: false, error: 'Clipboard operation already in progress' };
    }

    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const bridge = getClipboardBridge();
      let result: ClipboardResult;

      if (bridge && typeof bridge.paste === 'function') {
        result = await bridge.paste();
      } else if (navigator.clipboard) {
        // Fallback for standard web environment
        const text = await navigator.clipboard.readText();
        result = {
          success: true,
          text: text,
          isEmpty: text.trim().length === 0,
          format: 'text'
        };
      } else {
        throw new Error('Clipboard API is unavailable in this environment');
      }

      if (result.success && !result.isEmpty && result.text) {
        setLastPastedText(result.text);

        // If a target input ref was provided, insert text at caret position
        if (options.targetInputRef?.current) {
          const input = options.targetInputRef.current;
          const start = input.selectionStart || 0;
          const end = input.selectionEnd || 0;
          const original = input.value;
          input.value = original.substring(0, start) + result.text + original.substring(end);
          input.selectionStart = input.selectionEnd = start + result.text.length;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (options.onPasteSuccess) {
          options.onPasteSuccess(result.text, result.format || 'text');
        }
      } else if (result.isEmpty) {
        setError('Clipboard is empty');
      }

      return result;
    } catch (err: any) {
      const errMsg = err?.message || 'Unexpected clipboard paste failure';
      setError(errMsg);
      if (options.onError) options.onError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [options]);

  return {
    copy,
    paste,
    isLoading,
    error,
    lastCopiedFormat,
    lastPastedText,
    clearError: () => setError(null)
  };
}

export interface ClipboardManagerProps {
  contentToCopy?: string | ClipboardPayload;
  onPasted?: (text: string, format: string) => void;
  enableKeyboardShortcuts?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ClipboardManager UI Component
 * Provides one-click bidirectional copy/paste actions with status badges,
 * keyboard shortcut integration, and loading state management.
 */
export const ClipboardManager: React.FC<ClipboardManagerProps> = ({
  contentToCopy,
  onPasted,
  enableKeyboardShortcuts = false,
  className = '',
  style = {}
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { copy, paste, isLoading, error } = useClipboard({
    onCopySuccess: (res) => {
      setStatusMessage(`✓ Copied (${res.format || 'text'})`);
      setTimeout(() => setStatusMessage(null), 2500);
    },
    onPasteSuccess: (text, format) => {
      setStatusMessage(`✓ Pasted (${format})`);
      if (onPasted) onPasted(text, format);
      setTimeout(() => setStatusMessage(null), 2500);
    },
    onError: (err) => {
      setStatusMessage(`⚠️ ${err}`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  });

  // Optional keyboard shortcut listener
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;

      // Do NOT intercept if user is inside a standard text input/textarea with active selection
      const isEditable = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      // Trigger custom copy only when not in an editable element with selection
      if (isCmdOrCtrl && e.key.toLowerCase() === 'c' && !isEditable && contentToCopy) {
        const selection = window.getSelection()?.toString();
        if (!selection) {
          e.preventDefault();
          copy(contentToCopy);
        }
      }

      // Trigger custom paste only when explicitly targeted
      if (isCmdOrCtrl && e.key.toLowerCase() === 'v' && !isEditable) {
        e.preventDefault();
        paste();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, contentToCopy, copy, paste]);

  return (
    <div
      className={`clipboard-manager ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        ...style
      }}
    >
      <button
        type="button"
        disabled={isLoading || !contentToCopy}
        onClick={() => contentToCopy && copy(contentToCopy)}
        style={{
          backgroundColor: '#2563eb',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: isLoading || !contentToCopy ? 'not-allowed' : 'pointer',
          opacity: isLoading || !contentToCopy ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s ease'
        }}
      >
        <span>📋</span>
        <span>{isLoading ? 'Processing...' : 'Copy'}</span>
      </button>

      <button
        type="button"
        disabled={isLoading}
        onClick={() => paste()}
        style={{
          backgroundColor: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s ease'
        }}
      >
        <span>📥</span>
        <span>Paste</span>
      </button>

      {statusMessage && (
        <span
          style={{
            fontSize: '11px',
            color: error ? '#f87171' : '#34d399',
            fontWeight: 500,
            padding: '2px 8px',
            backgroundColor: error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(52, 211, 153, 0.1)',
            borderRadius: '4px'
          }}
        >
          {statusMessage}
        </span>
      )}
    </div>
  );
};

export default ClipboardManager;
