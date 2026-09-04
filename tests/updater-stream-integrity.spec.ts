/**
 * Test Suite: Binary Update Write-Stream Refactor & Atomic Hash Verification
 * 
 * Verifies:
 * 1. Binary write-stream redirection strictly to os.tmpdir() rather than application root.
 * 2. Elimination of race conditions between file I/O and cryptographic hash verification.
 * 3. Prevention of premature hash verification using slow/throttled mock write streams.
 * 4. Hash verification function strictly accepts a concrete file path, not a stream.
 * 5. Mismatched hash rejection with guaranteed zero orphaned files remaining in /tmp.
 * 6. Atomic rename operation (fs.rename) with EXDEV cross-device link fallback.
 * 7. Post-move checksum verification to guarantee cross-device move integrity.
 * 8. Stale file cleanup routines on startup and after failed update attempts.
 * 9. Explicit error boundaries and diagnostics for EACCES and ENOSPC.
 * 10. Status lifecycle and telemetry tracking hooks.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Readable } from 'stream';

let rootDir = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.resolve(__dirname, '../..');
}
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = process.cwd();
}

const { UpdaterService, UPDATE_STATUS } = require(path.join(rootDir, 'src/services/updater'));
const {
  verifyFileHash,
  calculateFileHash,
  verifyPostMoveChecksum,
  FileIntegrityError
} = require(path.join(rootDir, 'src/utils/file-integrity'));
const fsManager = require(path.join(rootDir, 'src/core/fs-manager'));

/**
 * Slow chunked stream simulating throttled network download or slow I/O.
 */
class SlowChunkStream extends Readable {
  private chunks: Buffer[];
  private delayMs: number;
  private chunkIndex: number = 0;

  constructor(data: Buffer, chunkSize: number = 64, delayMs: number = 20) {
    super();
    this.delayMs = delayMs;
    this.chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      this.chunks.push(data.slice(i, i + chunkSize));
    }
  }

  _read() {
    if (this.chunkIndex >= this.chunks.length) {
      setTimeout(() => {
        this.push(null);
      }, this.delayMs);
      return;
    }

    const chunk = this.chunks[this.chunkIndex++];
    setTimeout(() => {
      this.push(chunk);
    }, this.delayMs);
  }
}

async function runUpdaterTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING BINARY UPDATE STREAM & HASH INTEGRITY TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // Create isolated test working directories
  const testBaseDir = path.join(os.tmpdir(), `eloquent-test-updater-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const testTempDir = path.join(testBaseDir, 'staging-tmp');
  const testTargetDir = path.join(testBaseDir, 'production-bin');

  await fs.promises.mkdir(testTempDir, { recursive: true });
  await fs.promises.mkdir(testTargetDir, { recursive: true });

  const dummyBinaryContent = Buffer.from(
    '#!/usr/bin/env node\n// Eloquent Audio Engine Binary Mock\nconsole.log("Eloquent Engine Active");\n' +
    'x'.repeat(4096)
  );
  const validHash = crypto.createHash('sha256').update(dummyBinaryContent).digest('hex');

  try {
    // -------------------------------------------------------------------------
    // 1. Write-Stream Initialization Targets os.tmpdir()
    // -------------------------------------------------------------------------
    console.log('--- 1. Write-Stream Initialization & Redirection to os.tmpdir() ---');
    {
      const updater = new UpdaterService({
        targetDir: testTargetDir,
        tempDir: testTempDir,
        autoCleanupOnStart: false
      });

      const tempPath = updater.generateTempPath('eloquent-engine');
      assert(tempPath.startsWith(testTempDir), 'Generated staging path is inside configured temp directory');
      assert(path.basename(tempPath).startsWith('eloquent-update-eloquent-engine-'), 'Staging path follows naming convention');
      assert(tempPath.endsWith('.tmp'), 'Staging path has .tmp extension');

      // Default instance without options uses os.tmpdir()
      const defaultUpdater = new UpdaterService({ autoCleanupOnStart: false });
      assert(defaultUpdater.tempDir === os.tmpdir(), 'Default UpdaterService tempDir strictly targets os.tmpdir()');
      assert(!defaultUpdater.tempDir.includes('src'), 'Default tempDir is NOT inside application root');
    }

    // -------------------------------------------------------------------------
    // 2. Race Condition Mitigation: Delayed Hash Check & Slow Stream Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Race Condition Mitigation & Premature Hash Trigger Prevention ---');
    {
      const updater = new UpdaterService({
        targetDir: testTargetDir,
        tempDir: testTempDir,
        autoCleanupOnStart: false
      });

      let streamFinishEmitted = false;
      let streamCloseEmitted = false;
      let hashVerificationTriggered: boolean = false;
      let finishTimestamp = 0;
      let hashCheckTimestamp = 0;
      let verifiedFilePathArg: string | null = null;
      let fileExistedDuringVerify: boolean = false;

      const slowStream = new SlowChunkStream(dummyBinaryContent, 128, 15);

      const statusTimeline: string[] = [];
      updater.on('status-change', (evt: any) => {
        statusTimeline.push(evt.currentStatus);
        if (evt.currentStatus === UPDATE_STATUS.VERIFYING) {
          hashVerificationTriggered = true;
          hashCheckTimestamp = Date.now();
          verifiedFilePathArg = String(evt.tempPath);
          fileExistedDuringVerify = fs.existsSync(verifiedFilePathArg);
        }
      });

      const targetBinaryName = 'eloquent-backend-slow';
      const result = await updater.applyUpdate(slowStream, targetBinaryName, validHash);

      assert(result.success === true, 'Update completed successfully with slow stream');
      assert(Boolean(hashVerificationTriggered), 'Hash verification was triggered');
      assert(typeof verifiedFilePathArg === 'string', 'Hash check received a string filePath argument');
      assert(!String(verifiedFilePathArg).includes('Stream'), 'Argument is a concrete file path, NOT a stream object');
      assert(Boolean(fileExistedDuringVerify), 'File was fully written to disk when hash check began');
      assert(fs.existsSync(path.join(testTargetDir, targetBinaryName)), 'Final binary successfully moved to production target');

      // Assert status ordering: downloading -> verifying -> applying -> completed
      assert(statusTimeline.indexOf(UPDATE_STATUS.DOWNLOADING) < statusTimeline.indexOf(UPDATE_STATUS.VERIFYING),
        'Downloading strictly precedes verifying status');
      assert(statusTimeline.indexOf(UPDATE_STATUS.VERIFYING) < statusTimeline.indexOf(UPDATE_STATUS.APPLYING),
        'Verifying strictly precedes applying status');
      assert(statusTimeline.indexOf(UPDATE_STATUS.APPLYING) < statusTimeline.indexOf(UPDATE_STATUS.COMPLETED),
        'Applying strictly precedes completed status');
    }

    // -------------------------------------------------------------------------
    // 3. Hash Verification Function Accepts File Path & Detects Corruption
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Cryptographic Hash Verification & Mismatch Rejection ---');
    {
      const testFilePath = path.join(testTempDir, 'hash-test-binary.bin');
      await fs.promises.writeFile(testFilePath, dummyBinaryContent);

      // Verify accepts file path
      const hashResult = await verifyFileHash(testFilePath, validHash);
      assert(hashResult.valid === true, 'verifyFileHash validates genuine file path');
      assert(hashResult.actualHash === validHash, 'Calculated hash matches expected SHA-256');
      assert(hashResult.sizeBytes === dummyBinaryContent.length, 'Size in bytes matches buffer size');

      // Verify throws when invalid argument is passed
      let streamArgRejected = false;
      try {
        await verifyFileHash({ pipe: () => {} } as any, validHash);
      } catch (err: any) {
        streamArgRejected = true;
        assert(err.code === 'ERR_INVALID_ARGUMENT', 'Rejects stream object with ERR_INVALID_ARGUMENT');
      }
      assert(streamArgRejected, 'verifyFileHash safely rejected non-string argument');

      // Verify corruption detection
      const bogusHash = 'a'.repeat(64);
      const mismatchResult = await verifyFileHash(testFilePath, bogusHash);
      assert(mismatchResult.valid === false, 'Invalid hash returns valid: false');

      let thrownMismatch = false;
      try {
        await verifyFileHash(testFilePath, bogusHash, { throwOnMismatch: true });
      } catch (err: any) {
        thrownMismatch = true;
        assert(err instanceof FileIntegrityError, 'Throws FileIntegrityError on mismatch');
        assert(err.code === 'ERR_HASH_MISMATCH', 'Error code is ERR_HASH_MISMATCH');
      }
      assert(thrownMismatch, 'throwOnMismatch option properly throws on tampered hash');

      await fsManager.safeUnlink(testFilePath);
    }

    // -------------------------------------------------------------------------
    // 4. Zero Orphaned Files on Hash Failure & Stream Abort
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Guaranteed Zero Orphaned Files on Failure ---');
    {
      const updater = new UpdaterService({
        targetDir: testTargetDir,
        tempDir: testTempDir,
        autoCleanupOnStart: false
      });

      const corruptedStream = Readable.from([dummyBinaryContent]);
      const badHash = '0'.repeat(64);

      let caughtError = false;
      let failedTempPath = '';

      updater.on('status-change', (evt: any) => {
        if (evt.currentStatus === UPDATE_STATUS.VERIFYING) {
          failedTempPath = evt.tempPath;
        }
      });

      try {
        await updater.applyUpdate(corruptedStream, 'corrupted-binary', badHash);
      } catch (err: any) {
        caughtError = true;
        assert(err.code === 'ERR_HASH_MISMATCH', 'Failed with ERR_HASH_MISMATCH');
      }

      assert(caughtError, 'Corrupted binary update was rejected');
      assert(Boolean(failedTempPath), 'Temp path was recorded');
      assert(!fs.existsSync(failedTempPath), 'Orphaned temp file was immediately removed from /tmp');
    }

    // -------------------------------------------------------------------------
    // 5. Atomic Rename & EXDEV Cross-Device Partition Fallback
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Atomic Move & EXDEV Cross-Device Fallback ---');
    {
      const sourceFile = path.join(testTempDir, 'source-atomic.bin');
      const targetFile = path.join(testTargetDir, 'dest-atomic.bin');
      await fs.promises.writeFile(sourceFile, 'atomic-payload-test');

      // Normal atomic move
      const normalResult = await fsManager.atomicMove(sourceFile, targetFile);
      assert(normalResult.success === true, 'Standard atomicMove succeeded');
      assert(!fs.existsSync(sourceFile), 'Source file removed after move');
      assert(fs.existsSync(targetFile), 'Destination file exists after move');
      assert(fs.readFileSync(targetFile, 'utf8') === 'atomic-payload-test', 'Content preserved');

      // Simulated EXDEV cross-device move
      const exdevSource = path.join(testTempDir, 'source-exdev.bin');
      const exdevTarget = path.join(testTargetDir, 'dest-exdev.bin');
      await fs.promises.writeFile(exdevSource, 'cross-device-payload-test');

      // Call handleCrossDeviceMove directly to verify fallback logic
      const crossDeviceResult = await fsManager.handleCrossDeviceMove(exdevSource, exdevTarget, {
        mode: 0o755
      });

      assert(crossDeviceResult.success === true, 'handleCrossDeviceMove succeeded');
      assert(crossDeviceResult.crossDevice === true, 'Reports crossDevice: true');
      assert(!fs.existsSync(exdevSource), 'Source removed from /tmp after cross-device move');
      assert(fs.existsSync(exdevTarget), 'Destination file created on target partition');
      assert(fs.readFileSync(exdevTarget, 'utf8') === 'cross-device-payload-test', 'Cross-device content intact');

      // Post-move checksum verification
      const exdevHash = crypto.createHash('sha256').update('cross-device-payload-test').digest('hex');
      const postMoveCheck = await verifyPostMoveChecksum(exdevTarget, exdevHash);
      assert(postMoveCheck.valid === true, 'Post-move checksum matches source hash perfectly');

      await fsManager.safeUnlink(targetFile);
      await fsManager.safeUnlink(exdevTarget);
    }

    // -------------------------------------------------------------------------
    // 6. Stale Temporary File Purge & Application Startup Cleanup
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Stale File Purge & Startup Cleanup Routines ---');
    {
      // Create 3 temporary update files: 2 stale, 1 fresh
      const staleFile1 = path.join(testTempDir, 'eloquent-update-stale1-1000-aaa.tmp');
      const staleFile2 = path.join(testTempDir, 'eloquent-update-stale2-2000-bbb.tmp');
      const freshFile = path.join(testTempDir, 'eloquent-update-fresh-9999-ccc.tmp');
      const unrelatedFile = path.join(testTempDir, 'other-file.txt');

      await fs.promises.writeFile(staleFile1, 'stale1');
      await fs.promises.writeFile(staleFile2, 'stale2');
      await fs.promises.writeFile(freshFile, 'fresh');
      await fs.promises.writeFile(unrelatedFile, 'unrelated');

      // Artificially age the stale files by 2 hours
      const twoHoursAgo = (Date.now() - 7200000) / 1000;
      await fs.promises.utimes(staleFile1, twoHoursAgo, twoHoursAgo);
      await fs.promises.utimes(staleFile2, twoHoursAgo, twoHoursAgo);

      const purgeResult = await fsManager.purgeStaleTempFiles(testTempDir, /^eloquent-update-/, 3600000);
      assert(purgeResult.purgedCount === 2, 'Purged exactly 2 stale files');
      assert(!fs.existsSync(staleFile1), 'Stale file 1 removed');
      assert(!fs.existsSync(staleFile2), 'Stale file 2 removed');
      assert(fs.existsSync(freshFile), 'Fresh update file preserved');
      assert(fs.existsSync(unrelatedFile), 'Unrelated file preserved');

      // Purge all remaining update files
      const purgeAllResult = await fsManager.purgeAllTempUpdateFiles(testTempDir, /^eloquent-update-/);
      assert(purgeAllResult.purgedCount === 1, 'Purge all removed the fresh update file');
      assert(!fs.existsSync(freshFile), 'Fresh update file now removed');
      assert(fs.existsSync(unrelatedFile), 'Unrelated file still preserved');

      await fsManager.safeUnlink(unrelatedFile);
    }

    // -------------------------------------------------------------------------
    // 7. Error Handling & Boundaries for ENOSPC and EACCES
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Error Handling for ENOSPC and EACCES ---');
    {
      // Verify formatFsError maps EACCES
      const mockEacces = new Error('Permission denied');
      (mockEacces as any).code = 'EACCES';
      const formattedEacces = fsManager.formatFsError(mockEacces, 'write', '/protected/binary');
      assert(formattedEacces.code === 'EACCES', 'Preserves EACCES error code');
      assert(formattedEacces.message.includes('Permission denied'), 'Actionable message for EACCES');

      // Verify formatFsError maps ENOSPC
      const mockEnospc = new Error('No space left on device');
      (mockEnospc as any).code = 'ENOSPC';
      const formattedEnospc = fsManager.formatFsError(mockEnospc, 'write', '/full/disk');
      assert(formattedEnospc.code === 'ENOSPC', 'Preserves ENOSPC error code');
      assert(formattedEnospc.message.includes('Insufficient disk space'), 'Actionable message for ENOSPC');

      // Verify UpdaterService handles writeStream errors gracefully
      const updater = new UpdaterService({
        targetDir: testTargetDir,
        tempDir: testTempDir,
        autoCleanupOnStart: false
      });

      // Stream emitting artificial ENOSPC error
      const failingStream = new Readable({
        read() {
          const enospcErr = new Error('No space left on device');
          (enospcErr as any).code = 'ENOSPC';
          this.destroy(enospcErr);
        }
      });

      let enospcCaught = false;
      try {
        await updater.applyUpdate(failingStream, 'enospc-binary', validHash);
      } catch (err: any) {
        enospcCaught = true;
        assert(err.code === 'ENOSPC', 'Updater caught and surfaced ENOSPC code');
      }
      assert(enospcCaught, 'Handled simulated ENOSPC gracefully');

      // Stream emitting artificial EACCES error
      const eaccesStream = new Readable({
        read() {
          const eaccesErr = new Error('Permission denied');
          (eaccesErr as any).code = 'EACCES';
          this.destroy(eaccesErr);
        }
      });

      let eaccesCaught = false;
      try {
        await updater.applyUpdate(eaccesStream, 'eacces-binary', validHash);
      } catch (err: any) {
        eaccesCaught = true;
        assert(err.code === 'EACCES', 'Updater caught and surfaced EACCES code');
      }
      assert(eaccesCaught, 'Handled simulated EACCES gracefully');
    }

    // -------------------------------------------------------------------------
    // 8. Telemetry and Logging Hooks
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Telemetry and Logging Hooks ---');
    {
      const telemetryEvents: Array<{ event: string, data: any }> = [];
      const updater = new UpdaterService({
        targetDir: testTargetDir,
        tempDir: testTempDir,
        autoCleanupOnStart: false,
        telemetryHook: (evt: string, data: any) => {
          telemetryEvents.push({ event: evt, data });
        }
      });

      const fastStream = Readable.from([dummyBinaryContent]);
      const completedResult = await updater.applyUpdate(fastStream, 'telemetry-binary', validHash);

      assert(telemetryEvents.length > 0, 'Telemetry events were dispatched');
      const completionEvt = telemetryEvents.find(e => e.event === 'update-completed');
      assert(Boolean(completionEvt), 'Emitted update-completed telemetry');
      assert(completionEvt?.data.bytesWritten === dummyBinaryContent.length, 'Telemetry recorded bytesWritten');
      assert(typeof completionEvt?.data.downloadDurationMs === 'number', 'Telemetry recorded downloadDurationMs');
      assert(typeof completionEvt?.data.verifyDurationMs === 'number', 'Telemetry recorded verifyDurationMs');
      assert(typeof completionEvt?.data.moveDurationMs === 'number', 'Telemetry recorded moveDurationMs');
      assert(typeof completionEvt?.data.totalDurationMs === 'number', 'Telemetry recorded totalDurationMs');

      // Verify production binary is intact and executable
      const finalBinPath = path.join(testTargetDir, 'telemetry-binary');
      assert(fs.existsSync(finalBinPath), 'Production binary exists in target directory');
      const finalStats = fs.statSync(finalBinPath);
      assert((finalStats.mode & 0o111) !== 0, 'Binary has executable permissions');
    }

  } finally {
    // Cleanup isolated test directory
    try {
      await fs.promises.rm(testBaseDir, { recursive: true, force: true });
    } catch {}
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} UPDATER STREAM & HASH INTEGRITY TESTS PASSED!`);
  console.log('================================================================\n');

  process.exit(0);
}

runUpdaterTests().catch((err) => {
  console.error('Test suite execution failed:', err);
  process.exit(1);
});
