/**
 * Eloquent Core - File System Manager
 * 
 * Provides atomic file moves with cross-device partition (EXDEV) fallback,
 * robust error boundaries with explicit handling for EACCES and ENOSPC,
 * recursive directory creation, safe unlinking, and temporary file purging routines.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class FsManagerError extends Error {
  constructor(message, code, originalError) {
    super(message);
    this.name = 'FsManagerError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Format filesystem errors with explicit codes and actionable diagnostics.
 * @param {Error} err 
 * @param {string} operation 
 * @param {string} targetPath 
 * @returns {FsManagerError}
 */
function formatFsError(err, operation, targetPath) {
  if (err instanceof FsManagerError) {
    return err;
  }

  const code = err.code || 'UNKNOWN';
  let message = `[FsManager] ${operation} failed on "${targetPath}": ${err.message}`;

  if (code === 'EACCES' || code === 'EPERM') {
    message = `[FsManager] Permission denied (${code}) during ${operation} on "${targetPath}". Ensure appropriate user permissions.`;
  } else if (code === 'ENOSPC') {
    message = `[FsManager] Insufficient disk space (ENOSPC) during ${operation} on "${targetPath}". Free up storage space.`;
  } else if (code === 'ENOENT') {
    message = `[FsManager] Path not found (ENOENT) during ${operation} on "${targetPath}".`;
  } else if (code === 'EBUSY') {
    message = `[FsManager] Resource busy or locked (EBUSY) during ${operation} on "${targetPath}".`;
  }

  return new FsManagerError(message, code, err);
}

/**
 * Ensure directory exists recursively.
 * @param {string} dirPath 
 * @returns {Promise<string>}
 */
async function ensureDir(dirPath) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return dirPath;
  } catch (err) {
    throw formatFsError(err, 'mkdir', dirPath);
  }
}

/**
 * Safely delete a file without throwing if it does not exist (idempotent).
 * @param {string} filePath 
 * @returns {Promise<boolean>} true if deleted, false if file did not exist
 */
async function safeUnlink(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }
    throw formatFsError(err, 'unlink', filePath);
  }
}

/**
 * Synchronous safe unlink for immediate teardown in sync exit handlers.
 * @param {string} filePath 
 * @returns {boolean}
 */
function safeUnlinkSync(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }
    return false;
  }
}

/**
 * Check if a file exists and is readable.
 * @param {string} filePath 
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Retrieve file stats with error boundary.
 * @param {string} filePath 
 * @returns {Promise<fs.Stats>}
 */
async function getFileStats(filePath) {
  try {
    return await fs.promises.stat(filePath);
  } catch (err) {
    throw formatFsError(err, 'stat', filePath);
  }
}

/**
 * Atomically moves a file from sourcePath to destPath.
 * Uses fs.promises.rename first. If an EXDEV (cross-device link) error occurs,
 * falls back to copy-then-rename on destination device, followed by source unlink.
 * 
 * @param {string} sourcePath - Path to source file (e.g. in /tmp)
 * @param {string} destPath - Final destination path
 * @param {Object} [options]
 * @param {boolean} [options.overwrite=true] - Overwrite destination if exists
 * @param {number} [options.mode] - File permissions (e.g. 0o755)
 * @returns {Promise<{ success: boolean, crossDevice: boolean, destPath: string }>}
 */
async function atomicMove(sourcePath, destPath, options = {}) {
  const overwrite = options.overwrite !== false;

  // 1. Verify source exists
  const sourceExists = await fileExists(sourcePath);
  if (!sourceExists) {
    throw new FsManagerError(
      `[FsManager] Source file does not exist: "${sourcePath}"`,
      'ENOENT',
      new Error(`ENOENT: no such file or directory, stat '${sourcePath}'`)
    );
  }

  // 2. Ensure target directory exists
  const destDir = path.dirname(destPath);
  await ensureDir(destDir);

  // 3. If destination exists and overwrite is false, error out
  if (!overwrite && await fileExists(destPath)) {
    throw new FsManagerError(
      `[FsManager] Destination file already exists and overwrite is disabled: "${destPath}"`,
      'EEXIST',
      new Error(`EEXIST: file already exists, open '${destPath}'`)
    );
  }

  // 4. Try standard atomic rename
  try {
    await fs.promises.rename(sourcePath, destPath);

    if (options.mode) {
      try {
        await fs.promises.chmod(destPath, options.mode);
      } catch (chmodErr) {
        throw formatFsError(chmodErr, 'chmod', destPath);
      }
    }

    return {
      success: true,
      crossDevice: false,
      destPath
    };
  } catch (err) {
    // 5. Handle EXDEV cross-device link error
    if (err.code === 'EXDEV') {
      return await handleCrossDeviceMove(sourcePath, destPath, options);
    }

    // Standard error handling for EACCES, ENOSPC, etc.
    throw formatFsError(err, 'rename', destPath);
  }
}

/**
 * Handles cross-device rename by copying to a temp file in target directory,
 * atomically replacing destPath, and then unlinking sourcePath.
 * 
 * @param {string} sourcePath 
 * @param {string} destPath 
 * @param {Object} options 
 * @returns {Promise<{ success: boolean, crossDevice: boolean, destPath: string }>}
 */
async function handleCrossDeviceMove(sourcePath, destPath, options = {}) {
  const destDir = path.dirname(destPath);
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const tempDestPath = path.join(destDir, `.${path.basename(destPath)}.tmp.${randomSuffix}`);

  try {
    // Copy source to temporary destination file on the target filesystem
    try {
      await fs.promises.copyFile(sourcePath, tempDestPath);
    } catch (copyErr) {
      throw formatFsError(copyErr, 'copyFile (EXDEV fallback)', tempDestPath);
    }

    // Apply permissions if specified
    if (options.mode) {
      try {
        await fs.promises.chmod(tempDestPath, options.mode);
      } catch (chmodErr) {
        throw formatFsError(chmodErr, 'chmod (EXDEV fallback)', tempDestPath);
      }
    }

    // Atomically rename temporary target file to final target path (guaranteed same device)
    try {
      await fs.promises.rename(tempDestPath, destPath);
    } catch (renameErr) {
      throw formatFsError(renameErr, 'rename (EXDEV target swap)', destPath);
    }

    // Unlink the source file in /tmp
    await safeUnlink(sourcePath);

    return {
      success: true,
      crossDevice: true,
      destPath
    };
  } catch (outerErr) {
    // Ensure the temporary copy on destination device is cleaned up on failure
    await safeUnlink(tempDestPath);
    throw outerErr;
  }
}

/**
 * Scan and purge stale temporary update files from target directory.
 * 
 * @param {string} [tempDir=os.tmpdir()] - Directory to scan
 * @param {RegExp} [pattern=/^eloquent-update-/] - Filename pattern
 * @param {number} [maxAgeMs=3600000] - Max age in ms (default 1 hour)
 * @returns {Promise<{ purgedCount: number, purgedFiles: string[], errors: string[] }>}
 */
async function purgeStaleTempFiles(
  tempDir = os.tmpdir(),
  pattern = /^eloquent-update-/,
  maxAgeMs = 3600000
) {
  const result = {
    purgedCount: 0,
    purgedFiles: [],
    errors: []
  };

  try {
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();

    for (const file of files) {
      if (!pattern.test(file)) {
        continue;
      }

      const fullPath = path.join(tempDir, file);

      try {
        const stats = await fs.promises.stat(fullPath);
        const ageMs = now - stats.mtimeMs;

        if (ageMs >= maxAgeMs) {
          await safeUnlink(fullPath);
          result.purgedCount++;
          result.purgedFiles.push(fullPath);
        }
      } catch (fileErr) {
        if (fileErr.code !== 'ENOENT') {
          result.errors.push(`Failed to inspect/purge "${fullPath}": ${fileErr.message}`);
        }
      }
    }
  } catch (dirErr) {
    result.errors.push(`Failed to readdir "${tempDir}": ${dirErr.message}`);
  }

  return result;
}

/**
 * Purge all matching temporary update files regardless of age (e.g. for complete cleanup).
 * 
 * @param {string} [tempDir=os.tmpdir()]
 * @param {RegExp} [pattern=/^eloquent-update-/]
 * @returns {Promise<{ purgedCount: number, purgedFiles: string[] }>}
 */
async function purgeAllTempUpdateFiles(
  tempDir = os.tmpdir(),
  pattern = /^eloquent-update-/
) {
  return await purgeStaleTempFiles(tempDir, pattern, 0);
}

module.exports = {
  FsManagerError,
  formatFsError,
  ensureDir,
  safeUnlink,
  safeUnlinkSync,
  fileExists,
  getFileStats,
  atomicMove,
  handleCrossDeviceMove,
  purgeStaleTempFiles,
  purgeAllTempUpdateFiles
};
