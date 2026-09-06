/**
 * src/renderer/components/PromptOutput.tsx
 * 
 * Prompt Output Renderer Component with Cross-Platform Clipboard Sync
 * Triggers IPC channel 'clipboard:sync' and surfaces real-time visual feedback upon copy success.
 */

import React, { useState, useCallback } from 'react';
import { IpcChannels, ClipboardSyncPayload, ClipboardSyncResponse } from '../../shared/types';

declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
      };
    };
  }
}

export interface PromptOutputProps {
  promptText: string;
  sourceTitle?: string;
  onCopySuccess?: (response: ClipboardSyncResponse) => void;
  onCopyError?: (error: string) => void;
}

export const PromptOutput: React.FC<PromptOutputProps> = ({
  promptText,
  sourceTitle = 'Generated Developer Artifact',
  onCopySuccess,
  onCopyError
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCopyToClipboard = useCallback(async () => {
    if (!promptText || promptText.trim().length === 0) {
      setErrorMessage('Nothing to copy (empty content)');
      return;
    }

    setIsCopying(true);
    setErrorMessage(null);

    const payload: ClipboardSyncPayload = {
      content: promptText,
      source: sourceTitle,
      timestamp: Date.now()
    };

    try {
      let response: ClipboardSyncResponse;

      if (window.electron && window.electron.ipcRenderer && typeof window.electron.ipcRenderer.invoke === 'function') {
        response = await window.electron.ipcRenderer.invoke(IpcChannels.CLIPBOARD_SYNC, payload);
      } else {
        // Fallback for browser / non-electron environment testing
        await navigator.clipboard.writeText(promptText);
        response = {
          success: true,
          length: promptText.length,
          timestamp: Date.now()
        };
      }

      if (response.success) {
        setCopied(true);
        if (onCopySuccess) onCopySuccess(response);

        // Reset visual checkmark feedback after 2 seconds
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        const err = response.error || 'Failed to copy to OS clipboard';
        setErrorMessage(err);
        if (onCopyError) onCopyError(err);
      }
    } catch (err: any) {
      const msg = err?.message || 'IPC invocation error';
      setErrorMessage(msg);
      if (onCopyError) onCopyError(msg);
    } finally {
      setIsCopying(false);
    }
  }, [promptText, sourceTitle, onCopySuccess, onCopyError]);

  return (
    <div className="prompt-output-container border rounded-lg p-4 bg-slate-900 text-slate-100 shadow-md">
      <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
        <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">
          {sourceTitle}
        </h3>
        <button
          onClick={handleCopyToClipboard}
          disabled={isCopying || !promptText}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
            copied
              ? 'bg-emerald-600 text-white shadow-emerald-900/50'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/30 active:scale-95'
          } ${isCopying || !promptText ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Copy prompt output to system clipboard"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              <span>{isCopying ? 'Copying...' : 'Copy to Clipboard'}</span>
            </>
          )}
        </button>
      </div>

      <pre className="prompt-output-content text-xs font-mono whitespace-pre-wrap break-words bg-slate-950 p-3 rounded border border-slate-800 text-slate-200 max-h-96 overflow-y-auto">
        {promptText || <span className="text-slate-500 italic">No prompt artifact generated yet.</span>}
      </pre>

      {errorMessage && (
        <div className="mt-2 text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2 rounded">
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
};
