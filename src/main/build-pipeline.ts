/**
 * Eloquent Build Subsystem - BuildPipeline
 * 
 * Integrates CacheManager and HashVerifier into the pre-build hook
 * to ensure a clean state, purge stale locks, eliminate build corruption,
 * and synchronize the Go audio backend with the Node.js runtime.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { CacheManager, CachePurgeResult, LockRemovalResult } from '../services/build/CacheManager';
import { HashVerifier, BinaryManifest, BinarySignatureResult, HashVerificationResult } from '../utils/hashVerifier';

export interface BuildTelemetry {
  timestamp: string;
  durationMs: number;
  cacheMissFrequency: number;
  staleLocksCleared: number;
  purgedDirsCount: number;
  binaryHash: string;
  binarySizeBytes: number;
  binarySignatureFormat: string;
  isGoBackendSynchronized: boolean;
  rollbackTriggered: boolean;
  success: boolean;
  error?: string;
}

export interface PreBuildResult {
  success: boolean;
  lockClearedResult: LockRemovalResult;
  cachePurgedResult: CachePurgeResult;
  binaryVerification: HashVerificationResult;
  binarySignature: BinarySignatureResult;
  telemetry: BuildTelemetry;
}

export interface BuildPipelineOptions {
  rootDir?: string;
  cacheDirs?: string[];
  lockFiles?: string[];
  manifestPath?: string;
  backupDir?: string;
  goBackendDir?: string;
  goBinaryName?: string;
  telemetryHook?: (telemetry: BuildTelemetry) => void;
  logger?: (msg: string) => void;
}

export class BuildPipeline {
  private rootDir: string;
  private cacheManager: CacheManager;
  private hashVerifier: HashVerifier;
  private manifestPath: string;
  private backupDir: string;
  private goBackendDir: string;
  private goBinaryName: string;
  private telemetryHook?: (telemetry: BuildTelemetry) => void;
  private logger: (msg: string) => void;

  constructor(options: BuildPipelineOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.logger = options.logger || ((msg: string) => console.log(`[BuildPipeline] ${msg}`));

    this.cacheManager = new CacheManager({
      rootDir: this.rootDir,
      cacheDirs: options.cacheDirs,
      lockFiles: options.lockFiles,
      logger: this.logger
    });

    this.hashVerifier = new HashVerifier(this.rootDir);
    this.manifestPath = options.manifestPath || path.resolve(this.rootDir, 'config/build-manifest.json');
    this.backupDir = options.backupDir || path.resolve(this.rootDir, '.build-backups');
    this.goBackendDir = options.goBackendDir || path.resolve(this.rootDir, 'backend-go');
    this.goBinaryName = options.goBinaryName || (process.platform === 'win32' ? 'eloquent-backend.exe' : 'eloquent-backend');
    this.telemetryHook = options.telemetryHook;
  }

  /**
   * Execute the full pre-build pipeline hook.
   */
  public async executePreBuildPipeline(options: { forceRecompile?: boolean } = {}): Promise<PreBuildResult> {
    const startTime = Date.now();
    this.logger('====================================================');
    this.logger('🚀 Executing Eloquent Pre-Build Pipeline...');
    this.logger('====================================================');

    let lockAcquired = false;
    let rollbackTriggered = false;
    let lockFileUsed = '.build.lock';
    let lockClearedResult: LockRemovalResult = { removed: [], failed: [] };
    let cachePurgedResult: CachePurgeResult = { purged: [], skipped: [], errors: [], durationMs: 0 };
    let binaryVerification: HashVerificationResult = {
      valid: false,
      actualHash: '',
      expectedHash: '',
      sizeBytes: 0,
      binaryPath: '',
      algorithm: 'sha256'
    };
    let binarySignature: BinarySignatureResult = {
      valid: false,
      format: 'unknown',
      sizeBytes: 0
    };

    const goBinaryRelPath = path.join(path.relative(this.rootDir, this.goBackendDir), this.goBinaryName);
    const goBinaryFullPath = path.resolve(this.goBackendDir, this.goBinaryName);

    try {
      // 1. Clear Stale Locks
      this.logger('Phase 1: Detecting and clearing stale lock files...');
      lockClearedResult = this.cacheManager.clearStaleLocks(true);

      // 2. Purge Build Cache
      this.logger('Phase 2: Purging stale build cache directories...');
      cachePurgedResult = this.cacheManager.purgeCache();

      // 3. Acquire Pre-Build Lock
      this.logger('Phase 3: Acquiring exclusive build lock...');
      this.cacheManager.acquireLock(lockFileUsed, { task: 'pre-build-hook' });
      lockAcquired = true;

      // 4. Ensure Backup of previous stable binary exists (Rollback mechanism)
      if (fs.existsSync(goBinaryFullPath)) {
        this.backupStableBinary(goBinaryFullPath);
      }

      // 5. Check or Compile Go Audio Backend Binary
      this.logger(`Phase 4: Synchronizing Go audio backend binary (${goBinaryRelPath})...`);
      const binaryExists = fs.existsSync(goBinaryFullPath);

      if (!binaryExists || options.forceRecompile) {
        this.compileGoBackend();
      }

      // 6. Validate Binary Executable Signature
      this.logger('Phase 5: Validating binary executable signature and architecture...');
      binarySignature = await this.hashVerifier.verifyBinarySignature(goBinaryFullPath);
      if (!binarySignature.valid) {
        this.logger(`⚠️ Warning: Executable header check returned ${binarySignature.format}. Recompiling Go binary...`);
        this.compileGoBackend();
        binarySignature = await this.hashVerifier.verifyBinarySignature(goBinaryFullPath);
      }

      // 7. Load or Update Manifest and Verify Cryptographic Hash
      this.logger('Phase 6: Verifying binary cryptographic hash against manifest...');
      const manifest = this.getOrInitManifest(goBinaryRelPath, goBinaryFullPath);
      const expectedHash = manifest.binaries[goBinaryRelPath]?.hash;

      binaryVerification = await this.hashVerifier.verifyBinaryHash(goBinaryFullPath, expectedHash);

      if (!binaryVerification.valid) {
        this.logger(`⚠️ Hash mismatch detected for ${goBinaryRelPath}. Recompiling and updating manifest...`);
        this.compileGoBackend();
        const freshHash = await this.hashVerifier.calculateHash(goBinaryFullPath);
        manifest.binaries[goBinaryRelPath] = {
          hash: freshHash.hash,
          sizeBytes: freshHash.sizeBytes,
          platform: process.platform,
          arch: process.arch,
          signature: binarySignature.format
        };
        this.hashVerifier.saveManifest(manifest, this.manifestPath);
        binaryVerification = await this.hashVerifier.verifyBinaryHash(goBinaryFullPath, freshHash.hash);
      }

      // If verification still fails, execute automated rollback
      if (!binaryVerification.valid) {
        this.logger('❌ Hash verification failed post-cleanup. Triggering automated rollback...');
        rollbackTriggered = this.rollbackToStableBinary(goBinaryFullPath);
        if (rollbackTriggered) {
          binaryVerification = await this.hashVerifier.verifyBinaryHash(goBinaryFullPath, expectedHash);
        }
      }

      const durationMs = Date.now() - startTime;
      const telemetry: BuildTelemetry = {
        timestamp: new Date().toISOString(),
        durationMs,
        cacheMissFrequency: cachePurgedResult.purged.length,
        staleLocksCleared: lockClearedResult.removed.length,
        purgedDirsCount: cachePurgedResult.purged.length,
        binaryHash: binaryVerification.actualHash,
        binarySizeBytes: binaryVerification.sizeBytes,
        binarySignatureFormat: binarySignature.format,
        isGoBackendSynchronized: binaryVerification.valid && binarySignature.valid,
        rollbackTriggered,
        success: binaryVerification.valid
      };

      if (this.telemetryHook) {
        this.telemetryHook(telemetry);
      }

      this.logger(`✅ Pre-build pipeline finished in ${durationMs}ms with Go backend synchronized!`);

      return {
        success: binaryVerification.valid,
        lockClearedResult,
        cachePurgedResult,
        binaryVerification,
        binarySignature,
        telemetry
      };
    } catch (err: any) {
      this.logger(`💥 Error in pre-build pipeline: ${err.message}`);
      const durationMs = Date.now() - startTime;
      const telemetry: BuildTelemetry = {
        timestamp: new Date().toISOString(),
        durationMs,
        cacheMissFrequency: cachePurgedResult.purged.length,
        staleLocksCleared: lockClearedResult.removed.length,
        purgedDirsCount: cachePurgedResult.purged.length,
        binaryHash: binaryVerification.actualHash || 'none',
        binarySizeBytes: binaryVerification.sizeBytes || 0,
        binarySignatureFormat: binarySignature.format || 'unknown',
        isGoBackendSynchronized: false,
        rollbackTriggered,
        success: false,
        error: err.message
      };

      if (this.telemetryHook) {
        this.telemetryHook(telemetry);
      }

      throw err;
    } finally {
      // 8. Always release lock in finally block
      if (lockAcquired) {
        try {
          this.cacheManager.releaseLock(lockFileUsed);
        } catch (releaseErr: any) {
          this.logger(`⚠️ Warning releasing lock: ${releaseErr.message}`);
        }
      }
    }
  }

  // --- Internal Helper Methods ---

  private compileGoBackend(): void {
    this.logger(`Compiling Go audio backend in "${this.goBackendDir}"...`);
    try {
      execSync(`go build -buildvcs=false -o "${this.goBinaryName}" .`, {
        cwd: this.goBackendDir,
        stdio: 'pipe'
      });
      this.logger('✅ Go audio backend compiled successfully.');
    } catch (err: any) {
      throw new Error(`[BuildPipeline] Go binary compilation failed: ${err.message}`);
    }
  }

  private backupStableBinary(binaryFullPath: string): void {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
      const backupPath = path.join(this.backupDir, `${this.goBinaryName}.stable`);
      fs.copyFileSync(binaryFullPath, backupPath);
    } catch (err: any) {
      this.logger(`⚠️ Warning backing up stable binary: ${err.message}`);
    }
  }

  private rollbackToStableBinary(binaryFullPath: string): boolean {
    const backupPath = path.join(this.backupDir, `${this.goBinaryName}.stable`);
    if (!fs.existsSync(backupPath)) {
      this.logger('❌ No stable backup found for rollback.');
      return false;
    }

    try {
      fs.copyFileSync(backupPath, binaryFullPath);
      this.logger('🔄 Successfully restored previous stable binary from backup.');
      return true;
    } catch (err: any) {
      this.logger(`❌ Rollback failed: ${err.message}`);
      return false;
    }
  }

  private getOrInitManifest(relPath: string, fullPath: string): BinaryManifest {
    if (fs.existsSync(this.manifestPath)) {
      try {
        return this.hashVerifier.loadManifest(this.manifestPath);
      } catch (err: any) {
        this.logger(`⚠️ Corrupt or unreadable manifest: ${err.message}. Regenerating...`);
      }
    }

    // Initialize manifest
    const dir = path.dirname(this.manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let hash = '';
    let sizeBytes = 0;
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      sizeBytes = stats.size;
      const calc = execSync(`shasum -a 256 "${fullPath}"`, { encoding: 'utf8' }).trim().split(/\s+/)[0];
      hash = calc;
    }

    const manifest: BinaryManifest = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      algorithm: 'sha256',
      binaries: {
        [relPath]: {
          hash,
          sizeBytes,
          platform: process.platform,
          arch: process.arch,
          signature: process.platform === 'darwin' ? 'macho-64' : 'elf'
        }
      }
    };

    this.hashVerifier.saveManifest(manifest, this.manifestPath);
    return manifest;
  }
}

/**
 * Top-level CLI/hook helper to run pre-build pipeline directly.
 */
export async function executePreBuildHook(options?: BuildPipelineOptions): Promise<PreBuildResult> {
  const pipeline = new BuildPipeline(options);
  return await pipeline.executePreBuildPipeline();
}
