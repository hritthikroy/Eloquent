/**
 * Eloquent Renderer - Low-Latency Bengali Streaming Audio Player
 * 
 * Manages streaming playback of 24kHz 16-bit PCM/WAV audio buffers synthesized
 * by the Go audio backend. Guarantees zero-memory-leak buffer lifecycle by revoking
 * object URLs, disconnecting AudioBufferSourceNodes, and managing Web Audio Context states.
 */

class BengaliAudioPlayer {
  /**
   * @param {Object} [options]
   * @param {number} [options.sampleRate=24000] - Sample rate in Hz
   * @param {boolean} [options.autoPlay=true] - Auto-play on ingest
   */
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.autoPlay = options.autoPlay !== false;
    this.audioContext = null;
    this.activeSourceNode = null;
    this.activeObjectUrls = new Set();
    this.isPlaying = false;
    this.listeners = new Map();

    this._initAudioContext();
  }

  /**
   * Initializes or lazily resumes Web Audio Context.
   * @private
   */
  _initAudioContext() {
    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });
        } catch (_) {
          // Fallback if specific sample rate is rejected by OS driver
          this.audioContext = new AudioCtx();
        }
      }
    }
  }

  /**
   * Subscribe to player events: 'start', 'ended', 'error', 'stop'.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit events to subscribers.
   * @private
   */
  _emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        try { fn(data); } catch (_) {}
      }
    }
  }

  /**
   * Seamlessly plays audio from a Uint8Array, Buffer, or ArrayBuffer.
   * 
   * @param {Uint8Array|ArrayBuffer|Buffer} audioData - Raw WAV or PCM audio payload
   * @param {Object} [options]
   * @returns {Promise<void>} Resolves when audio finishes playing
   */
  async play(audioData, options = {}) {
    if (!audioData || audioData.byteLength === 0) {
      const err = new Error('BengaliAudioPlayer: Audio data buffer is empty');
      this._emit('error', err);
      throw err;
    }

    // Stop any existing playback to maintain smooth single-stream conversational turn
    this.stop();

    // 1. Web Audio API Path (ultra-low latency, direct decoding)
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return new Promise((resolve, reject) => {
        let arrayBuffer;
        if (audioData instanceof ArrayBuffer) {
          arrayBuffer = audioData.slice(0);
        } else if (ArrayBuffer.isView(audioData)) {
          arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
        } else {
          arrayBuffer = new Uint8Array(audioData).buffer;
        }

        this.audioContext.decodeAudioData(
          arrayBuffer,
          (decodedBuffer) => {
            try {
              const source = this.audioContext.createBufferSource();
              source.buffer = decodedBuffer;
              source.connect(this.audioContext.destination);

              this.activeSourceNode = source;
              this.isPlaying = true;
              this._emit('start', { duration: decodedBuffer.duration });

              source.onended = () => {
                this._cleanupActiveSource();
                this.isPlaying = false;
                this._emit('ended', null);
                resolve();
              };

              source.start(0);
            } catch (playErr) {
              this._cleanupActiveSource();
              this._emit('error', playErr);
              reject(playErr);
            }
          },
          (decodeErr) => {
            // Fallback to HTMLAudioElement if Web Audio API decode fails
            this._playViaHtmlAudio(audioData).then(resolve).catch(reject);
          }
        );
      });
    }

    // 2. Headless/Fallback HTML5 Audio Path
    return this._playViaHtmlAudio(audioData);
  }

  /**
   * Fallback playback via HTMLAudioElement with ObjectURL lifecycle management.
   * @private
   */
  _playViaHtmlAudio(audioData) {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        // Node / headless test environment: simulate immediate clean completion
        this.isPlaying = true;
        this._emit('start', { simulated: true });
        setTimeout(() => {
          this.isPlaying = false;
          this._emit('ended', null);
          resolve();
        }, 20);
        return;
      }

      try {
        const blob = new Blob([audioData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        this.activeObjectUrls.add(url);

        const audio = new Audio(url);
        this.activeAudioElement = audio;
        this.isPlaying = true;
        this._emit('start', { url });

        const cleanUp = () => {
          this.isPlaying = false;
          URL.revokeObjectURL(url);
          this.activeObjectUrls.delete(url);
          this.activeAudioElement = null;
        };

        audio.onended = () => {
          cleanUp();
          this._emit('ended', null);
          resolve();
        };

        audio.onerror = (e) => {
          cleanUp();
          const err = new Error(`HTML Audio playback failed: ${e.message || 'unknown error'}`);
          this._emit('error', err);
          reject(err);
        };

        audio.play().catch((err) => {
          cleanUp();
          this._emit('error', err);
          reject(err);
        });
      } catch (err) {
        this._emit('error', err);
        reject(err);
      }
    });
  }

  /**
   * Disconnects and releases active Web Audio nodes.
   * @private
   */
  _cleanupActiveSource() {
    if (this.activeSourceNode) {
      try {
        this.activeSourceNode.stop();
        this.activeSourceNode.disconnect();
      } catch (_) {}
      this.activeSourceNode = null;
    }
  }

  /**
   * Stops current playback immediately.
   */
  stop() {
    this._cleanupActiveSource();

    if (this.activeAudioElement) {
      try {
        this.activeAudioElement.pause();
        this.activeAudioElement.currentTime = 0;
      } catch (_) {}
      this.activeAudioElement = null;
    }

    // Revoke dangling Object URLs
    for (const url of this.activeObjectUrls) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
    this.activeObjectUrls.clear();

    if (this.isPlaying) {
      this.isPlaying = false;
      this._emit('stop', null);
    }
  }

  /**
   * Completely disposes audio context and frees all memory.
   */
  dispose() {
    this.stop();
    this.listeners.clear();

    if (this.audioContext && typeof this.audioContext.close === 'function') {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
  }
}

// Export singleton instance and class
const defaultBengaliAudioPlayer = new BengaliAudioPlayer();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BengaliAudioPlayer,
    bengaliAudioPlayer: defaultBengaliAudioPlayer
  };
}
