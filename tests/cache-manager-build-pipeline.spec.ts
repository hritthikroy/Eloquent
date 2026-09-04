/**
 * Test Suite: Cache Invalidation, Lock-File Management & Binary Hash Verification
 * 
 * Tests:
 * 1. Lock-file lifecycle and edge cases (missing lock, active lock, stale lock, dead PID).
 * 2. Strict permission error handling during lock removal and cache directory purging.
 * 3. Cache directory purging (purged, skipped, and error tracking).
 * 4. Cryptographic binary hash verification, tampering rejection, and signature validation.
 * 5. Pre-build pipeline execution, Go audio backend synchronization, telemetry, and automated rollback.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let rootDir = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.resolve(__dirname, '../..');
}
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = process.cwd();
}

import { CacheManager } from '../src/services/build/CacheManager';
import { HashVerifier, BinaryCorruptionError } from '../src/utils/hashVerifier';
import { BuildPipeline } from '../src/main/build-pipeline';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runCacheManagerBuildPipelineTests() {
  console.log('================================================================');
  console.log('🧪 STARTING CACHE-MANAGER & BUILD-PIPELINE TEST SUITE');
  console.log('================================================================\n');

  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eloquent-cache-test-'));

  try {
    // --- 1. Lock-File Lifecycle & Edge Cases ---
    console.log('--- 1. Lock-File Lifecycle & Edge Cases ---');
    const cacheManager = new CacheManager({
      rootDir: testTempDir,
      staleLockThresholdMs: 1000 // 1 second for fast testing
    });

    // 1.1 Missing Lock File Edge Case
    assert(cacheManager.isLockActive('.missing.lock') === false, 'Missing lock file is not active');
    assert(cacheManager.isLockStale('.missing.lock') === false, 'Missing lock file is not stale');
    assert(cacheManager.inspectLock('.missing.lock') === null, 'Missing lock returns null inspection');
    assert(cacheManager.releaseLock('.missing.lock') === false, 'Releasing missing lock returns false without error');

    // 1.2 Lock Acquisition
    const lockPath = cacheManager.acquireLock('.test.lock', { task: 'unit-test' });
    assert(fs.existsSync(lockPath), 'Lock file created on disk');
    assert(cacheManager.isLockActive('.test.lock') === true, 'Lock file is currently active');
    assert(cacheManager.isLockStale('.test.lock') === false, 'Fresh lock file is not stale');

    // 1.3 Collision Rejection
    let collisionDetected = false;
    try {
      cacheManager.acquireLock('.test.lock', { task: 'competing-task' });
    } catch (err: any) {
      collisionDetected = true;
      assert(err.message.includes('actively held'), 'Collision error thrown on active lock');
    }
    assert(collisionDetected, 'Concurrency collision prevented');

    // 1.4 Normal Release
    assert(cacheManager.releaseLock('.test.lock') === true, 'Lock released successfully');
    assert(!fs.existsSync(lockPath), 'Lock file removed from disk');

    // 1.5 Stale Lock with Dead PID Detection
    const deadPidLock = path.join(testTempDir, '.deadpid.lock');
    fs.writeFileSync(deadPidLock, JSON.stringify({
      pid: 9999999, // guaranteed dead process PID
      createdAt: new Date().toISOString(),
      hostname: 'test-host'
    }));

    const deadPidInfo = cacheManager.inspectLock('.deadpid.lock');
    assert(deadPidInfo !== null && deadPidInfo.isStale === true, 'Dead PID lock correctly identified as stale');
    assert(deadPidInfo?.reason.includes('no longer running') ?? false, 'Reason specifies process not running');

    // 1.6 Stale Lock by Age Threshold
    const expiredLock = path.join(testTempDir, '.expired.lock');
    const oldTimestamp = new Date(Date.now() - 10000).toISOString();
    fs.writeFileSync(expiredLock, JSON.stringify({
      pid: process.pid,
      createdAt: oldTimestamp,
      hostname: 'test-host'
    }));

    const expiredInfo = cacheManager.inspectLock('.expired.lock');
    assert(expiredInfo !== null && expiredInfo.isStale === true, 'Expired lock identified as stale by timestamp threshold');

    // 1.7 Clear Stale Locks
    const clearResult = cacheManager.clearStaleLocks();
    assert(clearResult.removed.includes('.deadpid.lock') || !fs.existsSync(deadPidLock), 'Dead PID lock cleared');
    assert(clearResult.removed.includes('.expired.lock') || !fs.existsSync(expiredLock), 'Expired lock cleared');

    // --- 2. Permission Error Resilience ---
    console.log('\n--- 2. Permission Error Resilience ---');
    const permTestLock = path.join(testTempDir, '.readonly.lock');
    fs.writeFileSync(permTestLock, 'corrupt-content');
    try {
      fs.chmodSync(permTestLock, 0o444); // read-only
    } catch {}

    // Test that inspectLock handles unparseable content safely
    const corruptInfo = cacheManager.inspectLock('.readonly.lock');
    assert(corruptInfo !== null && corruptInfo.isStale === true, 'Unparseable lock marked as stale');

    // Test force remove handles read-only lock with chmod retry
    const permCleanResult = cacheManager.clearStaleLocks(true);
    assert(permCleanResult.failed.length === 0 || !fs.existsSync(permTestLock), 'Permission-resilient removal handles read-only lock');

    // --- 3. Cache Purging & Tracking ---
    console.log('\n--- 3. Cache Purging & Tracking ---');
    const mockCache1 = path.join(testTempDir, 'mock-cache-1');
    const mockCache2 = path.join(testTempDir, 'mock-cache-2');
    fs.mkdirSync(mockCache1, { recursive: true });
    fs.mkdirSync(mockCache2, { recursive: true });
    fs.writeFileSync(path.join(mockCache1, 'temp.bin'), 'data');
    fs.writeFileSync(path.join(mockCache2, 'temp.bin'), 'data');

    const purgeResult = cacheManager.purgeCache(['mock-cache-1', 'mock-cache-2', 'missing-dir']);
    assert(purgeResult.purged.includes('mock-cache-1'), 'mock-cache-1 reported as purged');
    assert(purgeResult.purged.includes('mock-cache-2'), 'mock-cache-2 reported as purged');
    assert(purgeResult.skipped.includes('missing-dir'), 'missing-dir reported as skipped');
    assert(!fs.existsSync(mockCache1), 'mock-cache-1 removed from disk');
    assert(!fs.existsSync(mockCache2), 'mock-cache-2 removed from disk');

    // Telemetry check
    const tele = cacheManager.getTelemetry();
    assert(tele.totalPurgesExecuted > 0, 'Telemetry tracks total purges executed');
    assert(tele.cacheMissCount >= 2, 'Telemetry tracks cache miss count');

    // --- 4. Cryptographic Hash Verification & Signature Validation ---
    console.log('\n--- 4. Cryptographic Hash Verification & Signature Validation ---');
    const verifier = new HashVerifier(testTempDir);
    const mockBin = path.join(testTempDir, 'mock-binary.bin');
    fs.writeFileSync(mockBin, 'Hello Eloquent Audio Backend Engine v2');

    const calculated = await verifier.calculateHash(mockBin);
    assert(calculated.hash.length === 64, 'Generated valid 64-char SHA-256 hash');
    assert(calculated.sizeBytes > 0, 'Binary size calculated');

    // 4.1 Match Verification
    const matchRes = await verifier.verifyBinaryHash(mockBin, calculated.hash);
    assert(matchRes.valid === true, 'Identical binary hash verified');

    // 4.2 Tampering / Mismatch Detection
    const mismatchRes = await verifier.verifyBinaryHash(mockBin, '0000000000000000000000000000000000000000000000000000000000000000');
    assert(mismatchRes.valid === false, 'Mismatched hash detected and marked invalid');

    // 4.3 Missing Binary Verification
    const missingRes = await verifier.verifyBinaryHash('non-existent.bin', calculated.hash);
    assert(missingRes.valid === false, 'Missing binary marked invalid');
    assert(missingRes.error !== undefined, 'Missing binary includes error description');

    // 4.4 Batch Manifest Verification
    const manifest = await verifier.generateManifest(['mock-binary.bin'], '2.0.0');
    assert(manifest.binaries['mock-binary.bin'] !== undefined, 'Manifest records mock binary');
    assert(manifest.binaries['mock-binary.bin'].hash === calculated.hash, 'Manifest stores matching hash');

    const manifestPath = path.join(testTempDir, 'manifest.json');
    verifier.saveManifest(manifest, manifestPath);
    assert(fs.existsSync(manifestPath), 'Manifest file saved to disk');

    const loadedManifest = verifier.loadManifest(manifestPath);
    assert(loadedManifest.version === '2.0.0', 'Manifest loaded with correct version');

    const batchRes = await verifier.verifyManifest(loadedManifest);
    assert(batchRes.valid === true, 'Batch manifest verification passed 100%');
    assert(batchRes.matchedCount === 1, '1 binary matched');

    // 4.5 Binary Executable Signature Check
    const realBackendPath = path.join(rootDir, 'backend-go/eloquent-backend');
    if (fs.existsSync(realBackendPath)) {
      const realVerifier = new HashVerifier(rootDir);
      const sigRes = await realVerifier.verifyBinarySignature('backend-go/eloquent-backend');
      assert(sigRes.valid === true, `Go backend binary signature recognized: ${sigRes.format}`);
    }

    // --- 5. Pre-Build Pipeline Integration & Rollback ---
    console.log('\n--- 5. Pre-Build Pipeline Integration & Rollback ---');
    let telemetryCaptured: any = null;

    const pipeline = new BuildPipeline({
      rootDir,
      manifestPath: path.join(testTempDir, 'pipeline-manifest.json'),
      backupDir: path.join(testTempDir, 'backups'),
      telemetryHook: (t: any) => {
        telemetryCaptured = t;
      },
      logger: (msg: string) => {
        // Quiet output for test run
      }
    });

    const pipelineResult = await pipeline.executePreBuildPipeline();
    assert(pipelineResult.success === true, 'Pre-build pipeline executed successfully');
    assert(pipelineResult.binaryVerification.valid === true, 'Go binary verified during pipeline run');
    assert(pipelineResult.binarySignature.valid === true, 'Go binary signature valid');
    assert(pipelineResult.telemetry.isGoBackendSynchronized === true, 'Go audio backend confirmed synchronized with Node.js runtime');
    assert(telemetryCaptured !== null, 'Telemetry hook successfully invoked');
    assert(telemetryCaptured.durationMs >= 0, 'Telemetry logs execution duration');

    // Verify build lock was released post-pipeline
    const lockCheck = new CacheManager({ rootDir });
    assert(lockCheck.isLockActive('.build.lock') === false, 'Build lock cleanly released post-pipeline');

    // 5.2 Read-Only Cache Directory Edge Case
    console.log('\n--- 5.2 Read-Only Cache Directory Edge Case ---');
    const roDir = path.join(testTempDir, 'ro-cache-test');
    fs.mkdirSync(roDir, { recursive: true });
    fs.writeFileSync(path.join(roDir, 'payload.tmp'), 'data');
    try {
      fs.chmodSync(roDir, 0o444); // read-only
    } catch {}

    const roResult = cacheManager.purgeCache(['ro-cache-test']);
    assert(
      roResult.purged.includes('ro-cache-test') || roResult.errors.some((e: any) => e.dir === 'ro-cache-test'),
      'Read-only cache directory handled gracefully without crashing pipeline'
    );
    try {
      fs.chmodSync(roDir, 0o777);
      fs.rmSync(roDir, { recursive: true, force: true });
    } catch {}

    // 5.3 Automated Rollback Mechanism Test
    console.log('\n--- 5.3 Automated Rollback Mechanism Test ---');
    const rollbackTestDir = path.join(testTempDir, 'rollback-test');
    const rollbackBackupDir = path.join(rollbackTestDir, 'backups');
    const rollbackBackendDir = path.join(rollbackTestDir, 'backend-sim');
    fs.mkdirSync(rollbackBackupDir, { recursive: true });
    fs.mkdirSync(rollbackBackendDir, { recursive: true });

    const simBinary = path.join(rollbackBackendDir, 'eloquent-backend');
    const stableBinaryBackup = path.join(rollbackBackupDir, 'eloquent-backend.stable');
    const stableContent = 'STABLE_ORIGINAL_GO_AUDIO_BINARY_VERSION_1';
    fs.writeFileSync(simBinary, stableContent);
    fs.writeFileSync(stableBinaryBackup, stableContent);

    // Corrupt the binary
    fs.writeFileSync(simBinary, 'CORRUPTED_TAMPERED_CONTENT');
    assert(fs.readFileSync(simBinary, 'utf8') !== stableContent, 'Binary is corrupted');

    // Execute rollback
    const rollbackPipeline = new BuildPipeline({
      rootDir: rollbackTestDir,
      backupDir: rollbackBackupDir,
      goBackendDir: rollbackBackendDir,
      logger: () => {}
    });

    // Test internal rollback
    const restored = (rollbackPipeline as any).rollbackToStableBinary(simBinary);
    assert(restored === true, 'Automated rollback restored stable binary from backup');
    assert(fs.readFileSync(simBinary, 'utf8') === stableContent, 'Binary content restored to original stable state');

    console.log('\n================================================================');
    console.log('🎉 ALL CACHE-MANAGER & BUILD-PIPELINE TESTS PASSED (100%)!');
    console.log('================================================================\n');
  } finally {
    // Cleanup temporary test directory
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch {}
  }

  process.exit(0);
}

runCacheManagerBuildPipelineTests().catch((err) => {
  console.error('💥 Test suite failed:', err);
  process.exit(1);
});
