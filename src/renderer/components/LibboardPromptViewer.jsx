import React, { useState, useEffect } from 'react';

/**
 * LibboardPromptViewer Component
 * Renders the generated Libboard execution prompt in the Electron UI,
 * provides one-click clipboard copying, and surfaces parsing errors gracefully.
 */
export const LibboardPromptViewer = ({ conversationData = null, onPromptCopied = null }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchPrompt = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      // Access Electron IPC via contextBridge or global electron
      const ipc = window.electron?.ipcRenderer || (window.require ? window.require('electron').ipcRenderer : null);

      if (!ipc) {
        throw new Error('Electron IPC bridge is unavailable in this environment');
      }

      const response = await ipc.invoke('generate-libboard-prompt', {
        conversationData,
        copyToClipboard: false
      });

      if (response && response.success) {
        setPrompt(response.prompt);
      } else {
        const errorMsg = response?.error || 'Unable to generate Libboard prompt: conversation data invalid';
        setError(errorMsg);
        setPrompt('');
      }
    } catch (err) {
      setError(err.message || 'Unable to generate Libboard prompt: conversation data invalid');
      setPrompt('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompt();
  }, [conversationData]);

  const handleCopy = async () => {
    if (!prompt) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
      } else if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.invoke('generate-libboard-prompt', {
          conversationData,
          copyToClipboard: true
        });
      }
      setCopied(true);
      if (onPromptCopied) onPromptCopied(prompt);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  return (
    <div style={styles.container} className="libboard-prompt-viewer">
      <div style={styles.header}>
        <div style={styles.titleArea}>
          <span style={styles.badge}>LIBBOARD PROMPT</span>
          <h3 style={styles.heading}>Generated Action Directives</h3>
        </div>
        <div style={styles.actions}>
          <button
            style={styles.refreshBtn}
            onClick={fetchPrompt}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Refresh'}
          </button>
          <button
            style={{
              ...styles.copyBtn,
              backgroundColor: copied ? '#10b981' : '#3b82f6'
            }}
            onClick={handleCopy}
            disabled={!prompt || loading}
          >
            {copied ? '✓ Copied to Clipboard!' : '📋 Copy to Clipboard'}
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {loading && !prompt && (
        <div style={styles.loadingState}>
          <span>Parsing conversation turns and synthesizing directives...</span>
        </div>
      )}

      {prompt && !error && (
        <div style={styles.promptContainer}>
          <pre style={styles.promptText}>{prompt}</pre>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '16px',
    color: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    border: '1px solid #1e293b',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  titleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  badge: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  heading: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '600',
    color: '#e2e8f0'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  refreshBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  copyBtn: {
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px'
  },
  errorIcon: {
    fontSize: '14px'
  },
  loadingState: {
    padding: '20px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '12px'
  },
  promptContainer: {
    backgroundColor: '#020617',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #1e293b',
    maxHeight: '320px',
    overflowY: 'auto'
  },
  promptText: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '1.6',
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace'
  }
};

export default LibboardPromptViewer;
