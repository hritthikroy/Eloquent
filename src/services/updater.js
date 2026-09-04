/**
 * Eloquent Services - Binary Updater Service
 * 
 * Orchestrates secure binary updates with zero-race write streams,
 * staging all incoming payloads to os.tmpdir() before triggering
 * cryptographic hash verification and atomic promotion to production.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const EventEmitter = require('events');

const fsManager = require('../core/fs-manager');
const { verifyFileHash, verifyPostMoveChecksum, FileIntegrityError } = require('../utils/file-integrity');

const UPDATE_STATUS = Object.freeze({
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  VERIFYING: 'verifying',
  APPLYING: 'applying',
  COMPLETED: 'completed',
  FAILED: 'failed'
});

class UpdaterError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'UpdaterError';
    this.code = code;
    this.details = details;
  }
}

class UpdaterService extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {string} [options.targetDir] - Production directory for binaries
   * @param {string} [options.tempDir] - Temporary staging directory (defaults to os.tmpdir())
   * @param {Object} [options.logger] - Logger interface
   * @param {Function} [options.telemetryHook] - Telemetry reporting function
   * @param {boolean} [options.autoCleanupOnStart=true] - Purge stale updates on initialization
   */
  constructor(options = {}) {
    super();

    this.targetDir = options.targetDir || path.join(process.cwd(), 'bin');
    // Ensure write stream targets os.tmpdir() instead of application root
    this.tempDir = options.tempDir || os.tmpdir();
    this.logger = options.logger || console;
    this.telemetryHook = typeof options.telemetryHook === 'function' ? options.telemetryHook : null;

    this.currentStatus = UPDATE_STATUS.IDLE;
    this.lastTelemetry = null;

    if (options.autoCleanupOnStart !== false) {
      this.cleanupStaleUpdates().catch((err) => {
        this.log('warn', `Startup cleanup failed: ${err.message}`);
      });
    }
  }

  /**
   * Internal logging helper.
   */
  log(level, message, meta) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](`[UpdaterService] ${message}`, meta || '');
    }
  }

  /**
   * Report telemetry data.
   */
  reportTelemetry(event, data = {}) {
    const payload = {
      event,
      timestamp: Date.now(),
      status: this.currentStatus,
      ...data
    };
    this.lastTelemetry = payload;

    if (this.telemetryHook) {
      try {
        this.telemetryHook(event, payload);
      } catch (err) {
        this.log('warn', `Telemetry hook failed: ${err.message}`);
      }
    }

    this.emit('telemetry', payload);
  }

  /**
   * Update internal state and emit status change.
   */
  setStatus(newStatus, meta = {}) {
    const prevStatus = this.currentStatus;
    this.currentStatus = newStatus;
    this.log('info', `Status transition: ${prevStatus} -> ${newStatus}`, meta);
    this.emit('status-change', { prevStatus, currentStatus: newStatus, ...meta });
    this.reportTelemetry('status-change', { prevStatus, currentStatus: newStatus, ...meta });
  }

  /**
   * Allocate unique temporary path within os.tmpdir().
   * @param {string} binaryName 
   * @returns {string}
   */
  generateTempPath(binaryName = 'binary') {
    const sanitizedName = String(binaryName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const randomHex = crypto.randomBytes(6).toString('hex');
    const timestamp = Date.now();
    return path.join(this.tempDir, `eloquent-update-${sanitizedName}-${timestamp}-${randomHex}.tmp`);
  }

  /**
   * Write binary stream to temporary directory (/tmp).
   * Guarantees that the Promise resolves ONLY after the write-stream
   * 'finish' event is emitted and the file descriptor is closed.
   * 
   * @param {import('stream').Readable} readStream - Incoming source stream
   * @param {string} tempPath - Target path in os.tmpdir()
   * @returns {Promise<{ bytesWritten: number, tempPath: string, durationMs: number }>}
   */
  async writeBinaryStream(readStream, tempPath) {
    if (!readStream || typeof readStream.pipe !== 'function') {
      throw new UpdaterError(
        '[UpdaterService] writeBinaryStream requires a readable stream with pipe()',
        'ERR_INVALID_STREAM'
      );
    }

    // Ensure temp directory exists
    await fsManager.ensureDir(path.dirname(tempPath));

    const startTime = Date.now();
    let bytesWritten = 0;

    return new Promise((resolve, reject) => {
      let writeStream;
      let settled = false;

      const cleanupAndReject = async (err, code = 'ERR_STREAM_WRITE') => {
        if (settled) return;
        settled = true;

        this.log('error', `Write stream failed on "${tempPath}": ${err.message}`);

        // Destroy write stream if active
        if (writeStream && !writeStream.destroyed) {
          writeStream.destroy();
        }

        // Clean up temporary file so no orphaned files remain in /tmp
        await fsManager.safeUnlink(tempPath).catch(() => {});

        let finalCode = code;
        if (err.code === 'ENOSPC' || err.code === 'EACCES') {
          finalCode = err.code;
        }

        reject(new UpdaterError(
          `[UpdaterService] Failed writing binary to "${tempPath}": ${err.message}`,
          finalCode,
          { tempPath, originalError: err }
        ));
      };

      try {
        writeStream = fs.createWriteStream(tempPath, { flags: 'w', mode: 0o755 });
      } catch (createErr) {
        return cleanupAndReject(createErr, createErr.code || 'ERR_CREATE_WRITE_STREAM');
      }

      writeStream.on('error', (err) => {
        cleanupAndReject(err, err.code || 'ERR_WRITE_STREAM');
      });

      readStream.on('error', (err) => {
        cleanupAndReject(err, 'ERR_READ_STREAM');
      });

      // Track bytes transferred
      readStream.on('data', (chunk) => {
        bytesWritten += chunk.length;
        this.emit('download-progress', { bytesWritten, tempPath });
      });

      // Crucial: Wait for the 'finish' event to ensure all data has flushed to disk
      writeStream.on('finish', () => {
        this.log('debug', `Write stream finish event emitted for "${tempPath}" (${bytesWritten} bytes)`);
      });

      // Wait for 'close' to guarantee the file descriptor is released
      writeStream.on('close', () => {
        if (settled) return;
        settled = true;

        const durationMs = Date.now() - startTime;
        this.log('info', `Binary write stream fully flushed and closed in ${durationMs}ms (${bytesWritten} bytes)`);

        resolve({
          bytesWritten,
          tempPath,
          durationMs
        });
      });

      // Pipe readable to writable
      readStream.pipe(writeStream);
    });
  }

  /**
   * Execute full binary update workflow:
   * 1. Write stream to temporary directory (/tmp).
   * 2. Await stream 'finish' and file closure.
   * 3. Trigger hash verification on the written file path.
   * 4. Perform atomic move (fs.rename with EXDEV fallback) to final target.
   * 5. Re-verify post-move checksum.
   * 6. Clean up temporary files on failure (zero orphaned files).
   * 
   * @param {import('stream').Readable} readStream - Binary download stream
   * @param {string} binaryName - Name of binary (e.g. 'eloquent-backend')
   * @param {string} expectedHash - Cryptographic checksum (SHA-256)
   * @param {Object} [options]
   * @param {string} [options.algorithm='sha256']
   * @param {string} [options.destinationPath] - Override destination path
   * @returns {Promise<{ success: boolean, targetPath: string, hash: string, bytesWritten: number, totalDurationMs: number }>}
   */
  async applyUpdate(readStream, binaryName, expectedHash, options = {}) {
    const overallStart = Date.now();
    const algorithm = options.algorithm || 'sha256';
    const targetPath = options.destinationPath || path.join(this.targetDir, binaryName);
    const tempPath = this.generateTempPath(binaryName);

    this.log('info', `Starting binary update for "${binaryName}" (staging in ${tempPath})`);

    try {
      // -------------------------------------------------------------
      // Step 1 & 2: Stream Write to /tmp and wait for finish & close
      // -------------------------------------------------------------
      this.setStatus(UPDATE_STATUS.DOWNLOADING, { binaryName, tempPath });

      const writeResult = await this.writeBinaryStream(readStream, tempPath);
      const downloadDurationMs = writeResult.durationMs;

      // -------------------------------------------------------------
      // Step 3: Hash Verification ONLY after write stream has closed
      // Receives file path argument rather than stream
      // -------------------------------------------------------------
      this.setStatus(UPDATE_STATUS.VERIFYING, { binaryName, tempPath, algorithm });

      const verifyStart = Date.now();
      const integrityResult = await verifyFileHash(tempPath, expectedHash, {
        algorithm,
        throwOnMismatch: true
      });
      const verifyDurationMs = Date.now() - verifyStart;

      this.log('info', `Hash verification succeeded for "${tempPath}" in ${verifyDurationMs}ms (${integrityResult.actualHash})`);

      // -------------------------------------------------------------
      // Step 4: Atomic Rename / Move to Production Target Path
      // -------------------------------------------------------------
      this.setStatus(UPDATE_STATUS.APPLYING, { binaryName, targetPath });

      const moveStart = Date.now();
      const moveResult = await fsManager.atomicMove(tempPath, targetPath, {
        overwrite: true,
        mode: 0o755
      });
      const moveDurationMs = Date.now() - moveStart;

      this.log('info', `Atomic move completed in ${moveDurationMs}ms (crossDevice: ${moveResult.crossDevice}) -> "${targetPath}"`);

      // -------------------------------------------------------------
      // Step 5: Post-Move Checksum Validation
      // -------------------------------------------------------------
      await verifyPostMoveChecksum(targetPath, expectedHash, algorithm);
      this.log('info', `Post-move checksum verified at target "${targetPath}"`);

      // -------------------------------------------------------------
      // Step 6: Completion and Telemetry
      // -------------------------------------------------------------
      const totalDurationMs = Date.now() - overallStart;
      this.setStatus(UPDATE_STATUS.COMPLETED, {
        binaryName,
        targetPath,
        bytesWritten: writeResult.bytesWritten,
        totalDurationMs
      });

      const completionPayload = {
        success: true,
        binaryName,
        targetPath,
        hash: integrityResult.actualHash,
        bytesWritten: writeResult.bytesWritten,
        downloadDurationMs,
        verifyDurationMs,
        moveDurationMs,
        totalDurationMs,
        crossDevice: moveResult.crossDevice
      };

      this.emit('update-completed', completionPayload);
      this.reportTelemetry('update-completed', completionPayload);

      return completionPayload;
    } catch (err) {
      // -------------------------------------------------------------
      // Error Boundary & Guaranteed Zero-Orphan Cleanup
      // -------------------------------------------------------------
      this.setStatus(UPDATE_STATUS.FAILED, { binaryName, error: err.message, code: err.code });

      // Clean up orphaned temp file if still present
      await fsManager.safeUnlink(tempPath).catch(() => {});

      const errorPayload = {
        success: false,
        binaryName,
        tempPath,
        targetPath,
        error: err.message,
        code: err.code || 'ERR_UPDATE_FAILED',
        durationMs: Date.now() - overallStart
      };

      this.log('error', `Update failed for "${binaryName}": ${err.message}`, errorPayload);
      this.emit('error', err);
      this.reportTelemetry('update-failed', errorPayload);

      throw err;
    }
  }

  /**
   * Purge stale update artifacts from /tmp directory.
   * @param {number} [maxAgeMs=3600000] - Age threshold (default 1 hour)
   * @returns {Promise<{ purgedCount: number, purgedFiles: string[] }>}
   */
  async cleanupStaleUpdates(maxAgeMs = 3600000) {
    this.log('info', `Scanning for stale update files in "${this.tempDir}" (older than ${maxAgeMs}ms)...`);
    const purgeResult = await fsManager.purgeStaleTempFiles(
      this.tempDir,
      /^eloquent-update-/,
      maxAgeMs
    );

    if (purgeResult.purgedCount > 0) {
      this.log('info', `Purged ${purgeResult.purgedCount} stale update file(s) from ${this.tempDir}`, purgeResult.purgedFiles);
      this.reportTelemetry('stale-cleanup', purgeResult);
    }

    return purgeResult;
  }
}

module.exports = {
  UpdaterService,
  UpdaterError,
  UPDATE_STATUS
};
