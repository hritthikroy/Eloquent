/**
 * Eloquent Main - Electron IPC Multi-Language Bridge
 * 
 * Coordinates zero-latency language detection, active locale state,
 * and audio pipeline auto-switching between the Electron Main process,
 * Renderer windows, and the Go audio backend without blocking the UI thread.
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { LanguageDetector, SUPPORTED_LOCALES, DEFAULT_LOCALE } = require('../i18n/detector');

class ElectronLanguageBridge {
  /**
   * @param {Object} [options]
   * @param {string} [options.storageDir] - Path to userData directory
   * @param {Object} [options.audioBackend] - Optional Go audio backend client or bridge
   */
  constructor(options = {}) {
    this.storageDir = options.storageDir || path.join(process.cwd(), 'userData');
    this.detector = new LanguageDetector({ storageDir: this.storageDir });
    this.audioBackend = options.audioBackend || null;

    const prefs = this.detector.loadPreferences();
    this.activeLocale = prefs.activeLocale || DEFAULT_LOCALE;
    this.autoDetectEnabled = typeof prefs.autoDetect === 'boolean' ? prefs.autoDetect : true;
    this.isRegistered = false;

    // Telemetry tracking
    this.metrics = {
      switchesTotal: 0,
      autoDetections: 0,
      manualSwitches: 0,
      lastSwitchAt: Date.now()
    };
  }

  /**
   * Registers IPC handlers with electron.ipcMain.
   */
  registerHandlers() {
    if (this.isRegistered) return;

    // 1. Language Detection from text
    ipcMain.handle('locale:detect', async (_event, payload) => {
      const text = typeof payload === 'string' ? payload : (payload?.text || '');
      return this.detector.detect(text);
    });

    // 2. Dynamic Locale Change
    ipcMain.handle('locale:change', async (_event, payload) => {
      const targetLocale = typeof payload === 'string' ? payload : (payload?.locale || DEFAULT_LOCALE);
      const source = payload?.source || 'manual';
      const confidence = typeof payload?.confidence === 'number' ? payload.confidence : 1.0;

      return this.setLocale(targetLocale, { source, confidence });
    });

    // 3. Get Current Active Locale
    ipcMain.handle('locale:get-current', async () => {
      return {
        locale: this.activeLocale,
        autoDetect: this.autoDetectEnabled,
        supportedLocales: SUPPORTED_LOCALES,
        metadata: SUPPORTED_LOCALES[this.activeLocale] || SUPPORTED_LOCALES[DEFAULT_LOCALE]
      };
    });

    // 4. Get Preferences & Supported Locales
    ipcMain.handle('locale:get-preferences', async () => {
      return {
        preferences: this.detector.loadPreferences(),
        supportedLocales: SUPPORTED_LOCALES,
        telemetry: this.getTelemetry()
      };
    });

    // 5. Update Preferences (e.g. toggle auto-detect, set default)
    ipcMain.handle('locale:set-preference', async (_event, prefs) => {
      if (prefs && typeof prefs.autoDetect === 'boolean') {
        this.autoDetectEnabled = prefs.autoDetect;
      }
      if (prefs && prefs.activeLocale && SUPPORTED_LOCALES[prefs.activeLocale]) {
        this.activeLocale = prefs.activeLocale;
      }

      this.detector.savePreferences({
        activeLocale: this.activeLocale,
        autoDetect: this.autoDetectEnabled
      });

      this._broadcastLocaleChanged({
        locale: this.activeLocale,
        autoDetect: this.autoDetectEnabled,
        source: 'preference_update'
      });

      return { success: true, activeLocale: this.activeLocale, autoDetect: this.autoDetectEnabled };
    });

    // 6. Get Telemetry Snapshot
    ipcMain.handle('locale:get-telemetry', async () => {
      return this.getTelemetry();
    });

    this.isRegistered = true;
    console.log(`🌐 [ElectronLanguageBridge] Registered multi-language IPC channels (Active: ${this.activeLocale}, AutoDetect: ${this.autoDetectEnabled})`);
  }

  /**
   * Programmatically sets the active locale and synchronizes all subsystems without blocking.
   * @param {string} targetLocale - BCP-47 locale code
   * @param {Object} [options]
   */
  async setLocale(targetLocale, options = {}) {
    const validLocale = SUPPORTED_LOCALES[targetLocale] ? targetLocale : DEFAULT_LOCALE;
    const prevLocale = this.activeLocale;
    const source = options.source || 'programmatic';

    if (validLocale === prevLocale && !options.force) {
      return {
        locale: this.activeLocale,
        changed: false,
        source
      };
    }

    this.activeLocale = validLocale;
    this.metrics.switchesTotal++;
    if (source === 'auto') {
      this.metrics.autoDetections++;
    } else {
      this.metrics.manualSwitches++;
      // If user manually switched, persist their preference
      this.detector.savePreferences({ activeLocale: validLocale, autoDetect: this.autoDetectEnabled });
    }
    this.metrics.lastSwitchAt = Date.now();

    // 1. Asynchronously propagate to Go audio backend (non-blocking)
    setImmediate(() => {
      this._syncToGoBackend(validLocale);
    });

    // 2. Broadcast locale change to all Electron renderers
    this._broadcastLocaleChanged({
      locale: validLocale,
      previousLocale: prevLocale,
      isRomanized: SUPPORTED_LOCALES[validLocale]?.isRomanized || false,
      source,
      confidence: options.confidence || 1.0,
      timestamp: Date.now()
    });

    return {
      locale: validLocale,
      previousLocale: prevLocale,
      changed: true,
      source
    };
  }

  /**
   * Evaluates input speech or text and auto-switches locale if auto-detect is enabled.
   * @param {string} text - Spoken utterance from Whisper or user input
   */
  processSpokenUtterance(text) {
    if (!this.autoDetectEnabled || !text || text.trim().length === 0) {
      return null;
    }

    const trimmed = text.trim();
    // Guard: Prevent language switching on short affirmations, greetings or fragments
    if (/^(?:ok|okay|yeah|yep|sure|cool|nice|yes|no|babe|bro|chief|hi|hello|hey)[.!?]?$/i.test(trimmed)) {
      return { locale: this.activeLocale, confidence: 1.0, isRomanized: false };
    }

    const detection = this.detector.detect(trimmed);
    if (detection && detection.confidence >= 0.80 && detection.locale !== this.activeLocale) {
      console.log(`🌍 [LanguageBridge] Auto-detected language "${detection.locale}" (${detection.confidence * 100}% confidence) -> switching pipeline`);
      this.setLocale(detection.locale, { source: 'auto', confidence: detection.confidence }).catch(err => {
        console.warn('[LanguageBridge] Failed auto-switching locale:', err.message);
      });
      return detection;
    }

    return detection;
  }

  /**
   * Broadcasts locale change event to all active BrowserWindow renderers.
   * @private
   */
  _broadcastLocaleChanged(payload) {
    try {
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (win && !win.isDestroyed() && win.webContents) {
            win.webContents.send('locale:changed', payload);
          }
        }
      }
    } catch (e) {
      console.warn('[LanguageBridge] Failed to broadcast locale change event:', e.message);
    }
  }

  /**
   * Notifies the Go audio backend of dynamic locale change.
   * @private
   */
  _syncToGoBackend(locale) {
    try {
      if (this.audioBackend && typeof this.audioBackend.setLocale === 'function') {
        this.audioBackend.setLocale(locale);
      } else if (this.audioBackend && typeof this.audioBackend.send === 'function') {
        this.audioBackend.send(JSON.stringify({
          action: 'set_locale',
          locale: locale,
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      console.warn('[LanguageBridge] Go backend synchronization notice failed:', e.message);
    }
  }

  /**
   * Retrieves telemetry metrics from detector and bridge.
   */
  getTelemetry() {
    return {
      activeLocale: this.activeLocale,
      autoDetectEnabled: this.autoDetectEnabled,
      switchesTotal: this.metrics.switchesTotal,
      autoDetections: this.metrics.autoDetections,
      manualSwitches: this.metrics.manualSwitches,
      lastSwitchAt: this.metrics.lastSwitchAt,
      detectorTelemetry: this.detector.getTelemetry()
    };
  }
}

// Export singleton instance and class
let globalBridgeInstance = null;

function getLanguageBridge(options = {}) {
  if (!globalBridgeInstance) {
    globalBridgeInstance = new ElectronLanguageBridge(options);
  }
  return globalBridgeInstance;
}

module.exports = {
  ElectronLanguageBridge,
  getLanguageBridge,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE
};
