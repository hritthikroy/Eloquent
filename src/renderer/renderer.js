/**
 * Renderer Process Audio UI Controller
 * Bridges DOM elements and UI event listeners to window.audioAPI
 */

function setupAudioUI(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const win = options.window || (typeof window !== 'undefined' ? window : null);
  if (!doc) return null;

  const playBtn = doc.getElementById('audioPlayBtn') || doc.getElementById('play-btn') || doc.querySelector('[data-action="audio-play"]');
  const stopBtn = doc.getElementById('audioStopBtn') || doc.getElementById('stop-btn') || doc.querySelector('[data-action="audio-stop"]');
  const statusEl = doc.getElementById('audioStatus') || doc.getElementById('status-display') || doc.querySelector('[data-audio-status]');
  const errorEl = doc.getElementById('audioError') || doc.getElementById('error-display') || doc.querySelector('[data-audio-error]');

  const updateStatus = (text) => {
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.setAttribute('data-state', text.toLowerCase());
    }
  };

  const showError = (msg) => {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
  };

  const clearError = () => {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  };

  const getAudioAPI = () => {
    if (win && win.audioAPI) return win.audioAPI;
    return null;
  };

  if (playBtn) {
    playBtn.addEventListener('click', async () => {
      clearError();
      const api = getAudioAPI();
      if (api && typeof api.play === 'function') {
        try {
          updateStatus('Starting playback...');
          const res = await api.play();
          updateStatus(res && res.status ? res.status : 'Playing');
        } catch (err) {
          const errMsg = err && err.message ? err.message : 'Playback failed';
          showError(errMsg);
          updateStatus('Error');
        }
      } else {
        showError('audioAPI.play is not available');
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      clearError();
      const api = getAudioAPI();
      if (api && typeof api.stop === 'function') {
        try {
          updateStatus('Stopping playback...');
          const res = await api.stop();
          updateStatus(res && res.status ? res.status : 'Stopped');
        } catch (err) {
          const errMsg = err && err.message ? err.message : 'Stop failed';
          showError(errMsg);
          updateStatus('Error');
        }
      } else {
        showError('audioAPI.stop is not available');
      }
    });
  }

  // Event subscriptions
  const api = getAudioAPI();
  if (api) {
    if (typeof api.onStatusUpdate === 'function') {
      api.onStatusUpdate((status) => {
        const text = status?.status || (status?.isStreaming ? 'Streaming' : 'Ready');
        updateStatus(text);
      });
    }

    if (typeof api.onError === 'function') {
      api.onError((err) => {
        showError(err && err.message ? err.message : 'Audio device error');
      });
    }

    // Initial status polling
    if (typeof api.status === 'function') {
      api.status()
        .then((res) => {
          updateStatus(res?.status || (res?.isStreaming ? 'Streaming' : 'Ready'));
        })
        .catch((err) => {
          showError(err.message);
        });
    }
  }

  return {
    updateStatus,
    showError,
    clearError,
  };
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setupAudioUI());
  } else {
    setupAudioUI();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { setupAudioUI };
}
