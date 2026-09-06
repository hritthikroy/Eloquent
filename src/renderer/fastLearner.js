/**
 * src/renderer/fastLearner.js
 *
 * Core FastLearner Module
 * Provides rapid onboarding, adaptive learning prompts, real-time progress tracking,
 * session persistence, and progress event emission via Electron's ipcRenderer.
 */

class FastLearner {
  constructor() {
    this.isInitialized = false;
    this.isActive = false;
    this.config = {
      learningSpeed: 'normal', // 'slow' | 'normal' | 'fast'
      contentRetention: 0.85,
      autoAdvance: true,
      audioGuidedCues: true,
    };
    this.sessionData = {
      sessionId: null,
      startTime: null,
      completedSteps: 0,
      totalSteps: 10,
      currentPrompt: '',
      progressPercentage: 0,
      score: 0,
    };
    this.listeners = new Set();
    this.toggleDebounceTimer = null;
  }

  /**
   * Accessor for singleton instance.
   */
  static getInstance() {
    if (!FastLearner.instance) {
      FastLearner.instance = new FastLearner();
    }
    return FastLearner.instance;
  }

  /**
   * Initializes the FastLearner core module and loads persisted session config.
   */
  init() {
    if (this.isInitialized) return true;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedConfig = window.localStorage.getItem('fast_learner_config');
        if (savedConfig) {
          try {
            const parsed = JSON.parse(savedConfig);
            if (parsed && typeof parsed === 'object') {
              this.config = { ...this.config, ...parsed };
            }
          } catch (e) {
            console.warn('[FastLearner] Corrupted config found in localStorage, using defaults.');
          }
        }

        const savedSession = window.localStorage.getItem('fast_learner_session');
        if (savedSession) {
          try {
            const parsedSession = JSON.parse(savedSession);
            if (parsedSession && typeof parsedSession === 'object') {
              this.sessionData = { ...this.sessionData, ...parsedSession };
            }
          } catch (e) {
            console.warn('[FastLearner] Corrupted session found in localStorage, resetting.');
          }
        }
      }
    } catch (err) {
      console.warn('[FastLearner] Storage initialization fallback:', err?.message || err);
    }

    this.isInitialized = true;
    return true;
  }

  /**
   * Starts a new rapid onboarding learning session.
   * Handles corrupted config and rapid toggle spamming gracefully.
   *
   * @param {Object} [customConfig]
   * @returns {Object} Session initialization payload
   */
  startSession(customConfig = {}) {
    if (!this.isInitialized) this.init();

    if (this.isActive) {
      return { success: true, alreadyActive: true, session: this.sessionData };
    }

    // Merge custom config safely
    if (customConfig && typeof customConfig === 'object') {
      this.config = {
        ...this.config,
        ...customConfig,
        learningSpeed: ['slow', 'normal', 'fast'].includes(customConfig.learningSpeed)
          ? customConfig.learningSpeed
          : this.config.learningSpeed,
        contentRetention: typeof customConfig.contentRetention === 'number'
          ? Math.max(0.1, Math.min(1.0, customConfig.contentRetention))
          : this.config.contentRetention,
      };
    }

    this.isActive = true;
    this.sessionData = {
      sessionId: `session_${Date.now()}`,
      startTime: Date.now(),
      completedSteps: 0,
      totalSteps: 10,
      currentPrompt: 'Welcome to Eloquent Fast Learner! Let us begin rapid onboarding.',
      progressPercentage: 0,
      score: 100,
    };

    this.persistSession();
    this.emitProgress(this.sessionData);

    // Audio-guided cue handoff
    this.triggerAudioCue(this.sessionData.currentPrompt);

    return { success: true, session: this.sessionData };
  }

  /**
   * Stops the active learning session safely.
   */
  stopSession() {
    if (!this.isActive) {
      return { success: true, alreadyStopped: true };
    }

    this.isActive = false;
    this.sessionData.currentPrompt = 'Session stopped.';
    this.persistSession();
    this.emitProgress(this.sessionData);

    return { success: true, session: this.sessionData };
  }

  /**
   * Returns current session progress snapshot.
   */
  getProgress() {
    return {
      isActive: this.isActive,
      config: { ...this.config },
      session: { ...this.sessionData },
    };
  }

  /**
   * Emits progress events via Electron ipcRenderer and internal listeners.
   *
   * @param {Object} progressPayload
   */
  emitProgress(progressPayload) {
    const payload = {
      timestamp: Date.now(),
      isActive: this.isActive,
      progress: progressPayload || this.sessionData,
    };

    // 1. Internal listener callbacks
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        // Safe swallow
      }
    });

    // 2. Electron ipcRenderer broadcast
    if (typeof window !== 'undefined') {
      const ipcRenderer = window.electron?.ipcRenderer || window.ipcRenderer;
      if (ipcRenderer && typeof ipcRenderer.send === 'function') {
        try {
          ipcRenderer.send('fast-learner:progress', payload);
        } catch (e) {
          // Non-fatal if IPC send fails
        }
      }
    }
  }

  /**
   * Subscribes to progress events.
   * @param {Function} listener
   * @returns {Function} Unsubscribe callback
   */
  onProgress(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Persists session and configuration to localStorage safely.
   */
  persistSession() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('fast_learner_config', JSON.stringify(this.config));
        window.localStorage.setItem('fast_learner_session', JSON.stringify(this.sessionData));
      }
    } catch (e) {
      console.warn('[FastLearner] Failed to persist session data:', e?.message || e);
    }
  }

  /**
   * Triggers audio cues via Go backend or graceful audio API fallback.
   * @param {string} prompt
   */
  triggerAudioCue(prompt) {
    if (!this.config.audioGuidedCues || !prompt) return;

    try {
      if (typeof window !== 'undefined' && window.audioAPI && typeof window.audioAPI.send === 'function') {
        window.audioAPI.send('audio:play-cue', { prompt });
      }
    } catch (err) {
      console.warn('[FastLearner] Audio cue trigger fallback:', err?.message || err);
    }
  }
}

module.exports = { FastLearner };
