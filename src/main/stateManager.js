/**
 * Persistent Conversational State Manager Subsystem
 * Enforces atomic disk persistence, thread/process synchronization,
 * and rate-limit recovery across Electron main, renderer, and Go backend.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class StateManager {
  /**
   * @param {string} storageDir - Directory where state.json is persisted.
   * @param {Object} [options] - Optional IPC broadcaster and configuration.
   */
  constructor(storageDir = null, options = {}) {
    this.storageDir = storageDir || path.join(process.cwd(), 'userData');
    this.stateFilePath = path.join(this.storageDir, 'state.json');
    this.options = options;
    this.broadcaster = options.broadcaster || null;

    this.defaultRateLimit = {
      requestsRemaining: 60,
      resetTimestamp: Date.now() + 60000,
      isThrottled: false,
      backoffMs: 0
    };

    this.currentState = this.createDefaultState();
    this.loadState();
  }

  /**
   * Returns singleton instance.
   */
  static getInstance(storageDir = null, options = {}) {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager(storageDir, options);
    }
    return StateManager.instance;
  }

  /**
   * Creates empty initial state compliant with config/stateSchema.json.
   */
  createDefaultState() {
    return {
      turnId: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      participants: ['user', 'Tuk Tuk', 'Vision'],
      lastMessageTimestamp: Date.now(),
      contextBuffer: [],
      rateLimitInfo: { ...this.defaultRateLimit }
    };
  }

  /**
   * Loads state from disk with atomic recovery for missing or corrupted files.
   * Resets rate-limit thresholds if reset window has elapsed.
   * @returns {Object} Loaded state.
   */
  loadState() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      if (!fs.existsSync(this.stateFilePath)) {
        this.currentState = this.createDefaultState();
        this.saveState();
        return this.currentState;
      }

      const raw = fs.readFileSync(this.stateFilePath, 'utf8');
      if (!raw || raw.trim().length === 0) {
        console.warn('⚠️ [StateManager] State file empty. Initializing defaults.');
        this.currentState = this.createDefaultState();
        this.saveState();
        return this.currentState;
      }

      const parsed = JSON.parse(raw);

      // Validate required schema properties
      if (!parsed.turnId || !Array.isArray(parsed.contextBuffer) || !parsed.rateLimitInfo) {
        throw new Error('Invalid state structure in state.json');
      }

      this.currentState = parsed;
      this.checkAndResetRateLimits();
      return this.currentState;
    } catch (err) {
      console.error(`⚠️ [StateManager] Error loading state (${err.message}). Recovering safely.`);
      // Recover safely without crashing
      this.currentState = this.createDefaultState();
      this.saveState();
      return this.currentState;
    }
  }

  /**
   * Atomically writes state to disk (write to tmp file then rename).
   */
  saveState() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      const serialized = JSON.stringify(this.currentState, null, 2);
      const tempPath = path.join(
        this.storageDir,
        `state.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`
      );

      // Atomic write: write to unique temp file first, then atomic rename
      fs.writeFileSync(tempPath, serialized, 'utf8');
      fs.renameSync(tempPath, this.stateFilePath);

      this.broadcastStateChange();
      return true;
    } catch (err) {
      console.error('❌ [StateManager] Atomic save failed:', err.message);
      return false;
    }
  }

  /**
   * Checks if rate limits have expired and resets them if so.
   */
  checkAndResetRateLimits() {
    if (!this.currentState.rateLimitInfo) {
      this.currentState.rateLimitInfo = { ...this.defaultRateLimit };
      return;
    }

    const now = Date.now();
    if (now >= this.currentState.rateLimitInfo.resetTimestamp) {
      this.currentState.rateLimitInfo.isThrottled = false;
      this.currentState.rateLimitInfo.requestsRemaining = 60;
      this.currentState.rateLimitInfo.resetTimestamp = now + 60000;
      this.currentState.rateLimitInfo.backoffMs = 0;
    }
  }

  /**
   * Updates dialogue context and increments the turn.
   * @param {Object} context - Turn context (speaker, text, etc.).
   * @returns {Object} Updated state.
   */
  updateTurn(context) {
    this.checkAndResetRateLimits();

    if (context) {
      const speaker = context.speaker || 'user';
      const text = context.text || '';
      const timestamp = context.timestamp || Date.now();

      // Ensure participant is tracked
      if (!this.currentState.participants.includes(speaker)) {
        this.currentState.participants.push(speaker);
      }

      this.currentState.contextBuffer.push({
        speaker,
        text,
        timestamp,
        metadata: context.metadata || {}
      });

      // Keep recent 50 turns
      if (this.currentState.contextBuffer.length > 50) {
        this.currentState.contextBuffer = this.currentState.contextBuffer.slice(-50);
      }

      this.currentState.lastMessageTimestamp = timestamp;
    }

    // Advance turnId
    this.currentState.turnId = `turn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.saveState();
    return this.currentState;
  }

  /**
   * Returns current active turn data.
   */
  getCurrentTurn() {
    this.checkAndResetRateLimits();
    const lastEntry = this.currentState.contextBuffer[this.currentState.contextBuffer.length - 1] || null;
    return {
      turnId: this.currentState.turnId,
      participants: [...this.currentState.participants],
      lastMessageTimestamp: this.currentState.lastMessageTimestamp,
      lastEntry,
      rateLimitInfo: { ...this.currentState.rateLimitInfo }
    };
  }

  /**
   * Updates rate limit status
   */
  updateRateLimitInfo(info) {
    this.currentState.rateLimitInfo = {
      ...this.currentState.rateLimitInfo,
      ...info
    };
    this.saveState();
  }

  /**
   * Broadcasts state change to Electron IPC listeners
   */
  broadcastStateChange() {
    if (this.broadcaster && typeof this.broadcaster.broadcast === 'function') {
      try {
        this.broadcaster.broadcast('state-updated', this.currentState);
      } catch (e) {}
    }
  }

  setBroadcaster(broadcaster) {
    this.broadcaster = broadcaster;
  }
}

module.exports = {
  StateManager,
  stateManager: StateManager.getInstance()
};
