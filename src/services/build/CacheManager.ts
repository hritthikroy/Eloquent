/**
 * Eloquent Build Subsystem - CacheManager
 * 
 * Provides robust cache invalidation, lock-file lifecycle management,
 * and permission-resilient file system operations for the build pipeline.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface LockMetadata {
  pid: number;
  createdAt: string;
  hostname: string;
  task?: string;
  version?: string;
  [key: string]: any;
}

export interface StaleLockInfo {
  file: string;
  fullPath: string;
  ageMs: number;
  pid?: number;
  isStale: boolean;
  reason: string;
}

export interface LockRemovalResult {
  removed: string[];
  failed: Array<{
    file: string;
    error: string;
    code?: string;
    isPermissionError: boolean;
  }>;
}

export interface CachePurgeResult {
  purged: string[];
  skipped: string[];
  errors: Array<{
    dir: string;
    error: string;
    code?: string;
    isPermissionError: boolean;
  }>;
  durationMs: number;
}

export interface CacheManagerOptions {
  rootDir?: string;
  cacheDirs?: string[];
  lockFiles?: string[];
  staleLockThresholdMs?: number; // default 5 minutes
  logger?: (msg: string) => void;
}

export interface CacheTelemetrySnapshot {
  cacheMissCount: number;
  lastPurgeDurationMs: number;
  staleLocksClearedCount: number;
  permissionErrorsCount: number;
  totalPurgesExecuted: number;
}

export class CacheManager {
  private rootDir: string;
  private cacheDirs: string[];
  private lockFiles: string[];
  private staleLockThresholdMs: number;
  private logger: (msg: string) => void;
  private telemetry: CacheTelemetrySnapshot;

  constructor(options: CacheManagerOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.cacheDirs = options.cacheDirs || [
      'dist',
      'dist-webpack',
      'electron-cache',
      '.cache',
      '.turbo',
      'build-cache'
    ];
    this.lockFiles = options.lockFiles || [
      '.build.lock',
      'build.lock',
      '.dist.lock'
    ];
    this.staleLockThresholdMs = options.staleLockThresholdMs ?? (5 * 60 * 1000); // 5 minutes
    this.logger = options.logger || ((msg: string) => console.log(`[CacheManager] ${msg}`));
    this.telemetry = {
      cacheMissCount: 0,
      lastPurgeDurationMs: 0,
      staleLocksClearedCount: 0,
      permissionErrorsCount: 0,
      totalPurgesExecuted: 0
    };
  }

  /**
   * Acquire a build lock atomically.
   */
  public acquireLock(lockFileName: string = '.build.lock', metadata: Partial<LockMetadata> = {}): string {
    const lockPath = path.resolve(this.rootDir, lockFileName);

    // If lock exists and active, cannot acquire
    if (this.isLockActive(lockFileName)) {
      throw new Error(`[CacheManager] Lock file "${lockFileName}" is actively held by process`);
    }

    // If stale, remove it first
    if (fs.existsSync(lockPath)) {
      this.forceRemoveLock(lockFileName);
    }

    const payload: LockMetadata = {
      pid: process.pid,
      createdAt: new Date().toISOString(),
      hostname: os.hostname(),
      task: metadata.task || 'build-pipeline',
      ...metadata
    };

    try {
      // Use wx flag for exclusive atomic creation
      fs.writeFileSync(lockPath, JSON.stringify(payload, null, 2), { flag: 'wx', mode: 0o644 });
      this.logger(`Acquired lock "${lockFileName}" (PID: ${process.pid})`);
      return lockPath;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        throw new Error(`[CacheManager] Collision: Lock file "${lockFileName}" was acquired concurrently.`);
      }
      throw this.formatPermissionError(err, lockPath, 'acquire lock');
    }
  }

  /**
   * Release an acquired lock.
   */
  public releaseLock(lockFileName: string = '.build.lock'): boolean {
    const lockPath = path.resolve(this.rootDir, lockFileName);
    if (!fs.existsSync(lockPath)) {
      return false;
    }

    try {
      fs.unlinkSync(lockPath);
      this.logger(`Released lock "${lockFileName}"`);
      return true;
    } catch (err: any) {
      this.handlePermissionOrThrow(err, lockPath, 'release lock');
      return false;
    }
  }

  /**
   * Inspect whether a lock exists and its owning process is active.
   */
  public isLockActive(lockFileName: string = '.build.lock'): boolean {
    const lockPath = path.resolve(this.rootDir, lockFileName);
    if (!fs.existsSync(lockPath)) {
      return false;
    }

    const info = this.inspectLock(lockFileName);
    return info ? !info.isStale : false;
  }

  /**
   * Inspect a lock file and determine if it is stale.
   */
  public isLockStale(lockFileName: string = '.build.lock'): boolean {
    const lockPath = path.resolve(this.rootDir, lockFileName);
    if (!fs.existsSync(lockPath)) {
      return false;
    }

    const info = this.inspectLock(lockFileName);
    return info ? info.isStale : true;
  }

  /**
   * Get detailed inspection of a lockfile.
   */
  public inspectLock(lockFileName: string): StaleLockInfo | null {
    const lockPath = path.resolve(this.rootDir, lockFileName);
    if (!fs.existsSync(lockPath)) {
      return null;
    }

    try {
      const stats = fs.statSync(lockPath);
      const now = Date.now();
      const ageMs = now - stats.mtimeMs;

      let pid: number | undefined;
      let parsedCreatedAt: number | undefined;

      try {
        const content = fs.readFileSync(lockPath, 'utf8');
        const meta = JSON.parse(content) as LockMetadata;
        pid = meta.pid;
        if (meta.createdAt) {
          parsedCreatedAt = new Date(meta.createdAt).getTime();
        }
      } catch {
        // Unparseable metadata is considered stale
        return {
          file: lockFileName,
          fullPath: lockPath,
          ageMs,
          isStale: true,
          reason: 'Malformed or empty lock file content'
        };
      }

      // Check process liveness if PID is provided
      if (typeof pid === 'number') {
        const alive = this.isPidAlive(pid);
        if (!alive) {
          return {
            file: lockFileName,
            fullPath: lockPath,
            ageMs,
            pid,
            isStale: true,
            reason: `Owning process PID ${pid} is no longer running`
          };
        }
      }

      // Check age threshold
      const effectiveAgeMs = parsedCreatedAt ? (now - parsedCreatedAt) : ageMs;
      if (effectiveAgeMs > this.staleLockThresholdMs) {
        return {
          file: lockFileName,
          fullPath: lockPath,
          ageMs: effectiveAgeMs,
          pid,
          isStale: true,
          reason: `Lock age (${Math.round(effectiveAgeMs / 1000)}s) exceeds stale threshold (${Math.round(this.staleLockThresholdMs / 1000)}s)`
        };
      }

      return {
        file: lockFileName,
        fullPath: lockPath,
        ageMs: effectiveAgeMs,
        pid,
        isStale: false,
        reason: 'Lock is active and owned by running process'
      };
    } catch (err: any) {
      this.logger(`⚠️ Warning inspecting lock "${lockFileName}": ${err.message}`);
      return null;
    }
  }

  /**
   * Get configured and dynamically discovered lock files in rootDir.
   */
  public getDiscoveredLockFiles(customFiles?: string[]): string[] {
    const discovered = new Set<string>(customFiles && customFiles.length > 0 ? customFiles : this.lockFiles);
    try {
      if (fs.existsSync(this.rootDir)) {
        const entries = fs.readdirSync(this.rootDir);
        for (const entry of entries) {
          if (entry.endsWith('.lock') || entry.startsWith('.lock')) {
            discovered.add(entry);
          }
        }
      }
    } catch {}
    return Array.from(discovered);
  }

  /**
   * Detect all stale lock files configured or discovered.
   */
  public detectStaleLocks(targetFiles?: string[]): StaleLockInfo[] {
    const staleLocks: StaleLockInfo[] = [];
    const filesToScan = this.getDiscoveredLockFiles(targetFiles);

    for (const lockFile of filesToScan) {
      const info = this.inspectLock(lockFile);
      if (info && info.isStale) {
        staleLocks.push(info);
      }
    }

    return staleLocks;
  }

  /**
   * Remove all stale lock files with strict permission handling.
   */
  public clearStaleLocks(force: boolean = false, targetFiles?: string[]): LockRemovalResult {
    const result: LockRemovalResult = {
      removed: [],
      failed: []
    };

    const filesToScan = this.getDiscoveredLockFiles(targetFiles);

    for (const lockFile of filesToScan) {
      const lockPath = path.resolve(this.rootDir, lockFile);
      if (!fs.existsSync(lockPath)) {
        continue;
      }

      const info = this.inspectLock(lockFile);
      if (!info) continue;

      if (info.isStale || force) {
        try {
          this.forceRemoveLock(lockFile);
          result.removed.push(lockFile);
          this.telemetry.staleLocksClearedCount++;
          this.logger(`🧹 Cleared stale lock: "${lockFile}" (${info.reason})`);
        } catch (err: any) {
          this.telemetry.permissionErrorsCount++;
          result.failed.push({
            file: lockFile,
            error: err.message,
            code: err.code,
            isPermissionError: this.isPermissionError(err)
          });
          this.logger(`❌ Failed removing lock "${lockFile}": ${err.message}`);
        }
      }
    }

    return result;
  }

  /**
   * Purge local build cache directories.
   * Recreates empty directory if configured, handling permission errors cleanly.
   */
  public purgeCache(targetDirs?: string[]): CachePurgeResult {
    const startTime = Date.now();
    const dirsToPurge = targetDirs || this.cacheDirs;
    const result: CachePurgeResult = {
      purged: [],
      skipped: [],
      errors: [],
      durationMs: 0
    };

    for (const dirName of dirsToPurge) {
      const dirPath = path.resolve(this.rootDir, dirName);

      if (!fs.existsSync(dirPath)) {
        result.skipped.push(dirName);
        continue;
      }

      try {
        // Attempt recursive removal
        fs.rmSync(dirPath, { recursive: true, force: true });
        result.purged.push(dirName);
        this.logger(`🗑️ Purged cache directory: "${dirName}"`);
      } catch (err: any) {
        // Try permission repair with chmod if EACCES/EPERM
        let resolved = false;
        if (this.isPermissionError(err)) {
          try {
            fs.chmodSync(dirPath, 0o777);
            fs.rmSync(dirPath, { recursive: true, force: true });
            result.purged.push(dirName);
            resolved = true;
            this.logger(`🗑️ Purged cache directory "${dirName}" after chmod permissions repair`);
          } catch (retryErr: any) {
            this.telemetry.permissionErrorsCount++;
            result.errors.push({
              dir: dirName,
              error: retryErr.message,
              code: retryErr.code,
              isPermissionError: true
            });
          }
        }

        if (!resolved && !result.errors.some(e => e.dir === dirName)) {
          result.errors.push({
            dir: dirName,
            error: err.message,
            code: err.code,
            isPermissionError: this.isPermissionError(err)
          });
        }
      }
    }

    result.durationMs = Date.now() - startTime;
    this.telemetry.lastPurgeDurationMs = result.durationMs;
    this.telemetry.totalPurgesExecuted++;
    if (result.purged.length > 0) {
      this.telemetry.cacheMissCount += result.purged.length;
    }

    return result;
  }

  /**
   * Run full pre-build cleanup: clear stale locks + purge build caches.
   */
  public cleanAll(options: { forceLocks?: boolean; targetDirs?: string[] } = {}): {
    locks: LockRemovalResult;
    cache: CachePurgeResult;
    success: boolean;
  } {
    this.logger('Starting comprehensive pre-build cleanup...');
    const locks = this.clearStaleLocks(options.forceLocks);
    const cache = this.purgeCache(options.targetDirs);

    const hasPermissionErrors = locks.failed.some(f => f.isPermissionError) ||
                                cache.errors.some(e => e.isPermissionError);

    const success = locks.failed.length === 0 && cache.errors.length === 0;

    return {
      locks,
      cache,
      success: success && !hasPermissionErrors
    };
  }

  /**
   * Get active telemetry snapshot.
   */
  public getTelemetry(): CacheTelemetrySnapshot {
    return { ...this.telemetry };
  }

  // --- Helper Methods ---

  private isPidAlive(pid: number): boolean {
    if (pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (err: any) {
      return err.code === 'EPERM'; // Process exists but owned by different user
    }
  }

  private forceRemoveLock(lockFileName: string): void {
    const lockPath = path.resolve(this.rootDir, lockFileName);
    if (!fs.existsSync(lockPath)) return;

    try {
      fs.unlinkSync(lockPath);
    } catch (err: any) {
      if (this.isPermissionError(err)) {
        try {
          fs.chmodSync(lockPath, 0o666);
          fs.unlinkSync(lockPath);
          return;
        } catch {
          // fall through to formatted throw
        }
      }
      throw this.formatPermissionError(err, lockPath, 'remove lock file');
    }
  }

  private isPermissionError(err: any): boolean {
    return err && (err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EROFS');
  }

  private handlePermissionOrThrow(err: any, targetPath: string, action: string): void {
    const formatted = this.formatPermissionError(err, targetPath, action);
    this.telemetry.permissionErrorsCount++;
    throw formatted;
  }

  private formatPermissionError(err: any, targetPath: string, action: string): Error {
    const isPerm = this.isPermissionError(err);
    const code = err.code || 'UNKNOWN';
    const message = isPerm
      ? `[CacheManager:PermissionDenied] Failed to ${action} at "${targetPath}" (${code}). Check file ownership and permissions.`
      : `[CacheManager:${code}] Failed to ${action} at "${targetPath}": ${err.message}`;

    const customErr = new Error(message) as any;
    customErr.code = code;
    customErr.isPermissionError = isPerm;
    customErr.targetPath = targetPath;
    return customErr;
  }
}
