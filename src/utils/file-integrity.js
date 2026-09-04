/**
 * Eloquent Utils - File Integrity & Cryptographic Verification
 * 
 * Verifies binary checksums post-write stream flush to eliminate I/O race conditions.
 * Accepts concrete file paths rather than streams, ensuring disk flush and descriptor
 * closure before cryptographic hashing.
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class FileIntegrityError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'FileIntegrityError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Format integrity errors with explicit codes.
 * @param {Error} err 
 * @param {string} filePath 
 * @returns {FileIntegrityError}
 */
function formatIntegrityError(err, filePath) {
  if (err instanceof FileIntegrityError) {
    return err;
  }

  const code = err.code || 'ERR_FILE_INTEGRITY';
  let message = `[FileIntegrity] Verification failed for "${filePath}": ${err.message}`;

  if (code === 'ENOENT') {
    message = `[FileIntegrity] File not found for verification (ENOENT): "${filePath}".`;
  } else if (code === 'EACCES' || code === 'EPERM') {
    message = `[FileIntegrity] Permission denied (${code}) reading file for verification: "${filePath}".`;
  }

  return new FileIntegrityError(message, code, { filePath, originalError: err });
}

/**
 * Calculate the cryptographic hash of a file on disk.
 * Accepts a file path argument (string), ensuring the file is fully flushed and closed.
 * 
 * @param {string} filePath - Absolute or relative file path to hash
 * @param {string} [algorithm='sha256'] - Hash algorithm (e.g. 'sha256', 'sha512', 'sha1')
 * @returns {Promise<{ hash: string, sizeBytes: number }>}
 */
async function calculateFileHash(filePath, algorithm = 'sha256') {
  if (!filePath || typeof filePath !== 'string') {
    throw new FileIntegrityError(
      '[FileIntegrity] calculateFileHash expects a valid string filePath argument',
      'ERR_INVALID_ARGUMENT',
      { filePath }
    );
  }

  return new Promise((resolve, reject) => {
    let sizeBytes = 0;
    let hash;

    try {
      hash = crypto.createHash(algorithm);
    } catch (algErr) {
      return reject(new FileIntegrityError(
        `[FileIntegrity] Unsupported hash algorithm: "${algorithm}"`,
        'ERR_UNSUPPORTED_ALGORITHM',
        { algorithm }
      ));
    }

    let stream;
    try {
      stream = fs.createReadStream(filePath);
    } catch (fsErr) {
      return reject(formatIntegrityError(fsErr, filePath));
    }

    stream.on('data', (chunk) => {
      sizeBytes += chunk.length;
      hash.update(chunk);
    });

    stream.on('end', () => {
      const digest = hash.digest('hex');
      resolve({
        hash: digest,
        sizeBytes
      });
    });

    stream.on('error', (err) => {
      reject(formatIntegrityError(err, filePath));
    });
  });
}

/**
 * Verifies a file's hash against an expected hash using constant-time comparison.
 * Must accept a concrete file path rather than a stream.
 * 
 * @param {string} filePath - Path to file on disk
 * @param {string} expectedHash - Expected cryptographic hash hex string
 * @param {Object} [options]
 * @param {string} [options.algorithm='sha256'] - Hash algorithm
 * @param {boolean} [options.throwOnMismatch=false] - Throw FileIntegrityError if mismatched
 * @returns {Promise<{ valid: boolean, actualHash: string, expectedHash: string, algorithm: string, sizeBytes: number }>}
 */
async function verifyFileHash(filePath, expectedHash, options = {}) {
  if (!filePath || typeof filePath !== 'string') {
    throw new FileIntegrityError(
      '[FileIntegrity] verifyFileHash requires a valid string filePath argument',
      'ERR_INVALID_ARGUMENT',
      { filePath }
    );
  }

  if (!expectedHash || typeof expectedHash !== 'string') {
    throw new FileIntegrityError(
      '[FileIntegrity] verifyFileHash requires a valid expectedHash string',
      'ERR_INVALID_HASH',
      { expectedHash }
    );
  }

  const algorithm = options.algorithm || 'sha256';
  const throwOnMismatch = options.throwOnMismatch === true;

  try {
    const { hash: actualHash, sizeBytes } = await calculateFileHash(filePath, algorithm);

    const normalizedExpected = expectedHash.trim().toLowerCase();
    const normalizedActual = actualHash.trim().toLowerCase();

    // Constant-time comparison to prevent timing attacks
    let valid = false;
    if (normalizedExpected.length === normalizedActual.length) {
      try {
        const bufExpected = Buffer.from(normalizedExpected, 'hex');
        const bufActual = Buffer.from(normalizedActual, 'hex');
        valid = bufExpected.length === bufActual.length && crypto.timingSafeEqual(bufExpected, bufActual);
      } catch {
        valid = (normalizedExpected === normalizedActual);
      }
    }

    if (!valid && throwOnMismatch) {
      throw new FileIntegrityError(
        `[FileIntegrity] Hash verification failed for "${filePath}". Expected: ${normalizedExpected}, Actual: ${normalizedActual}`,
        'ERR_HASH_MISMATCH',
        {
          filePath,
          expectedHash: normalizedExpected,
          actualHash: normalizedActual,
          algorithm,
          sizeBytes
        }
      );
    }

    return {
      valid,
      actualHash: normalizedActual,
      expectedHash: normalizedExpected,
      algorithm,
      sizeBytes
    };
  } catch (err) {
    if (err instanceof FileIntegrityError) {
      throw err;
    }
    throw formatIntegrityError(err, filePath);
  }
}

/**
 * Re-verifies checksum of destination file after atomic move/cross-device copy.
 * 
 * @param {string} destPath - Destination file path
 * @param {string} expectedHash - Expected hash
 * @param {string} [algorithm='sha256']
 * @returns {Promise<{ valid: boolean, actualHash: string, expectedHash: string, algorithm: string, sizeBytes: number }>}
 */
async function verifyPostMoveChecksum(destPath, expectedHash, algorithm = 'sha256') {
  return await verifyFileHash(destPath, expectedHash, {
    algorithm,
    throwOnMismatch: true
  });
}

module.exports = {
  FileIntegrityError,
  calculateFileHash,
  verifyFileHash,
  verifyPostMoveChecksum
};
