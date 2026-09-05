/**
 * Eloquent Audio - Go Backend Process Bridge
 * 
 * Manages communication with the Go audio backend binary (./eloquent-audio)
 * for ultra-low-latency Bengali speech synthesis, PCM streaming, and acoustic mastering.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

class GoAudioBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.binaryPath = options.binaryPath || this._resolveBinaryPath();
    this.activeProcesses = new Set();
    this.isDisposed = false;
    this.sampleRate = options.sampleRate || 24000;
    this.channels = options.channels || 1;

    // Register process-level cleanup hooks to prevent file descriptor or zombie process leaks
    this._setupExitHooks();
  }

  /**
   * Resolves the location of the compiled Go audio binary.
   * @private
   */
  _resolveBinaryPath() {
    const rootDir = path.resolve(__dirname, '../../../');
    const candidates = [
      path.join(rootDir, 'eloquent-audio'),
      path.join(rootDir, 'backend/bin/eloquent'),
      path.join(rootDir, 'backend-go/eloquent-backend'),
      path.join(process.cwd(), 'eloquent-audio')
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          fs.accessSync(p, fs.constants.X_OK);
          return p;
        } catch (_) {}
      }
    }
    return path.join(rootDir, 'eloquent-audio');
  }

  /**
   * Hooks Node.js process termination to terminate any active Go child processes.
   * @private
   */
  _setupExitHooks() {
    this._exitHandler = () => {
      this.close();
    };
    process.once('exit', this._exitHandler);
    process.once('SIGINT', this._exitHandler);
    process.once('SIGTERM', this._exitHandler);
  }

  /**
   * Synthesizes Bengali UTF-8 text into 24kHz 16-bit PCM/WAV audio via the Go audio backend.
   * 
   * @param {string} text - UTF-8 Bengali text input
   * @param {Object} [options]
   * @param {number} [options.timeoutMs=5000] - Synthesis timeout in milliseconds
   * @returns {Promise<{ buffer: Buffer, sampleRate: number, channels: number, durationMs: number }>}
   */
  synthesizeBengali(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (this.isDisposed) {
        return reject(new Error('GoAudioBridge has been closed/disposed'));
      }

      // Input validation
      if (!text || typeof text !== 'string' || !text.trim()) {
        return reject(new Error('Bengali TTS Error: text must be a non-empty string'));
      }

      const normalizedText = text.normalize('NFC').trim();
      const timeoutMs = options.timeoutMs || 5000;

      const binaryExists = fs.existsSync(this.binaryPath);
      let child = null;

      if (binaryExists) {
        child = spawn(this.binaryPath, ['-pipe'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } else {
        // Fallback to go run if binary has not been compiled yet
        const rootDir = path.resolve(__dirname, '../../../');
        child = spawn('go', ['run', './go-backend', '-pipe'], {
          cwd: rootDir,
          env: { ...process.env, GOFLAGS: '-buildvcs=false' },
          stdio: ['pipe', 'pipe', 'pipe']
        });
      }

      this.activeProcesses.add(child);

      const chunks = [];
      let stderrOutput = '';
      let isSettled = false;

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this._cleanupChild(child);
          reject(new Error(`Go audio synthesis timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      child.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      child.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          this._cleanupChild(child);
          reject(new Error(`Failed to spawn Go audio backend: ${err.message}`));
        }
      });

      child.on('close', (code) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          this._cleanupChild(child);

          if (code !== 0) {
            return reject(new Error(`Go audio synthesis failed (exit code ${code}): ${stderrOutput || 'Unknown error'}`));
          }

          const fullBuffer = Buffer.concat(chunks);
          if (fullBuffer.length === 0) {
            return reject(new Error('Go audio backend returned empty audio buffer'));
          }

          // Parse WAV header to confirm 24kHz sample rate & duration
          let sampleRate = this.sampleRate;
          let channels = this.channels;
          if (fullBuffer.length >= 44 && fullBuffer.subarray(0, 4).toString() === 'RIFF') {
            channels = fullBuffer.readUInt16LE(22);
            sampleRate = fullBuffer.readUInt32LE(24);
          }

          const pcmDataLength = fullBuffer.length > 44 ? fullBuffer.length - 44 : fullBuffer.length;
          const bytesPerSample = 2; // 16-bit
          const durationMs = Math.round((pcmDataLength / (sampleRate * channels * bytesPerSample)) * 1000);

          resolve({
            buffer: fullBuffer,
            sampleRate,
            channels,
            durationMs,
            byteLength: fullBuffer.length
          });
        }
      });

      // Pipe text to child stdin
      try {
        child.stdin.write(normalizedText, 'utf8');
        child.stdin.end();
      } catch (writeErr) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          this._cleanupChild(child);
          reject(new Error(`Failed to write text to Go audio backend: ${writeErr.message}`));
        }
      }
    });
  }

  /**
   * Safely kills and cleans up child process reference.
   * @private
   */
  _cleanupChild(child) {
    if (!child) return;
    this.activeProcesses.delete(child);
    try {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    } catch (_) {}
  }

  /**
   * Closes all active processes and disposes the bridge.
   */
  close() {
    this.isDisposed = true;
    for (const child of this.activeProcesses) {
      try {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      } catch (_) {}
    }
    this.activeProcesses.clear();

    if (this._exitHandler) {
      process.removeListener('exit', this._exitHandler);
      process.removeListener('SIGINT', this._exitHandler);
      process.removeListener('SIGTERM', this._exitHandler);
      this._exitHandler = null;
    }
  }
}

// Export singleton instance and class
const defaultGoBridge = new GoAudioBridge();
module.exports = {
  GoAudioBridge,
  goBridge: defaultGoBridge
};
