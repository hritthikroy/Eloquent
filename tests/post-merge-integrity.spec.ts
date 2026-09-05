/**
 * Post-Merge Verification & Integrity Test Suite
 * 
 * Validates the post-merge integrity of the "Entigravity" codebase:
 * - Dependency lockfiles and build configurations (package.json, electron-builder.yml).
 * - AST syntax integrity across critical JS/TS files.
 * - Cryptographic SHA-256 hash verification using src/utils/file-integrity.js.
 * - Zero hash mismatches across all core merged modules.
 * - Module resolution and import consistency.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

let rootDir = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.resolve(__dirname, '../..');
}
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = process.cwd();
}

const { verifyFileHash, calculateFileHash } = require(path.join(rootDir, 'src/utils/file-integrity'));

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

// Expected SHA-256 cryptographic hashes of core merged modules
const POST_MERGE_HASH_MANIFEST: Record<string, string> = {
  'src/main/audio-bridge.js': 'bffd7e4bfda27e63beb1d54400753634170c386965c33a25af6562bfa85533e7',
  'src/main/legacy-headers.js': '5b50966ee24f9cb7b6d01ce0896f7e0f45a5de208377bb3af99347d0e5f87f42',
  'src/services/updater.js': 'dcfbff462ca2038ce2ccd096943522310a038e6b7e047fe7b7371d68c7eb9b3b',
  'src/utils/file-integrity.js': '1bf846858912b3f22b48277cf91ac5e7e1f2f971a3fdee1ddefd0fac5a8bd8f8',
  'src/core/fs-manager.js': '33d118a7abe780884e6030033659af74df307c8c20bd141ba6df6a197e185c53',
  'config/skills/andrew.json': '104a99ee9125000d15d8b3a5f06b973786cebd29ab295a81323b9b915a0d2885',
  'config/skills/vision.json': '5b762955a04bbc0fc978308a2725fd6119b8e574095ea833319aed78191b4e2c',
  'backend-go/internal/audio/processor.go': 'dc023fc3682179eb2e65b5ed619074e0ab8844f03cd18fd3b628935ee760e076',
  'backend-go/internal/audio/streamer.go': 'dc9742b397905e97158dfc5a72ba1536e6cca9c23413dbe025004bf32898f7ae',
  'backend-go/pkg/bridge/ipc.go': '8575cc1b74b2fd7230cae4338c598af68bcfaf374c078e4a62e7123dcd2d0f00'
};

async function runPostMergeIntegrityTests() {
  console.log('================================================================');
  console.log('🛡️  STARTING POST-MERGE INTEGRITY & DEPLOYMENT VERIFICATION SUITE');
  console.log('================================================================\n');

  // --- 1. Packaging & Configuration Integrity ---
  console.log('--- 1. Packaging & Configuration Integrity ---');
  const pkgPath = path.join(rootDir, 'package.json');
  assert(fs.existsSync(pkgPath), 'package.json exists');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert(pkg.name === 'eloquent', 'package.json name is eloquent');
  assert(pkg.version === '2.1.0', 'package.json version is 2.1.0');
  assert(pkg.build !== undefined, 'package.json contains "build" configuration');
  assert(Array.isArray(pkg.build.files), 'package.json build.files is array');
  assert(pkg.build.files.includes('!backend/**'), 'package.json excludes backend/**');
  assert(pkg.build.files.includes('!backend-go/**'), 'package.json excludes backend-go/**');

  const lockPath = path.join(rootDir, 'package-lock.json');
  assert(fs.existsSync(lockPath), 'package-lock.json exists and is present');

  const builderYmlPath = path.join(rootDir, 'electron-builder.yml');
  assert(fs.existsSync(builderYmlPath), 'electron-builder.yml exists');
  const builderContent = fs.readFileSync(builderYmlPath, 'utf8');
  assert(builderContent.includes('appId: com.eloquent.app'), 'electron-builder.yml defines appId');
  assert(builderContent.includes('!backend/**'), 'electron-builder.yml excludes backend/**');
  assert(builderContent.includes('!backend-go/**'), 'electron-builder.yml excludes backend-go/**');

  // Go module files
  const goModBackend = path.join(rootDir, 'backend', 'go.mod');
  const goModBackendGo = path.join(rootDir, 'backend-go', 'go.mod');
  assert(fs.existsSync(goModBackend), 'backend/go.mod exists');
  assert(fs.existsSync(goModBackendGo), 'backend-go/go.mod exists');

  // --- 2. AST Syntax Verification ---
  console.log('\n--- 2. AST Syntax Verification (node -c) ---');
  const criticalJsFiles = [
    'src/main.js',
    'src/preload.js',
    'src/main/index.js',
    'src/main/audio-bridge.js',
    'src/main/legacy-headers.js',
    'src/services/updater.js',
    'src/utils/file-integrity.js',
    'src/core/fs-manager.js',
    'src/renderer/eyeTracker.js',
    'src/renderer/utils/ipc.js',
    'src/renderer/components/CameraView.js'
  ];

  for (const relFile of criticalJsFiles) {
    const fullPath = path.join(rootDir, relFile);
    assert(fs.existsSync(fullPath), `Target file exists: ${relFile}`);
    try {
      execSync(`node -c "${fullPath}"`, { stdio: 'pipe' });
      assert(true, `AST syntax check passed: ${relFile}`);
    } catch (err: any) {
      assert(false, `AST syntax check failed for ${relFile}: ${err.message}`);
    }
  }

  // --- 3. Cryptographic Hash Verification via file-integrity.js ---
  console.log('\n--- 3. Cryptographic Hash Verification via file-integrity.js ---');
  let mismatchCount = 0;
  let totalChecked = 0;

  for (const [relPath, expectedHash] of Object.entries(POST_MERGE_HASH_MANIFEST)) {
    const fullPath = path.join(rootDir, relPath);
    totalChecked++;
    const result = await verifyFileHash(fullPath, expectedHash, { throwOnMismatch: false });
    
    if (result.valid) {
      console.log(`✅ [PASS] Hash MATCH for ${relPath} [${result.actualHash.slice(0, 16)}...] (${result.sizeBytes} bytes)`);
    } else {
      mismatchCount++;
      console.error(`❌ [MISMATCH] ${relPath}: Expected ${expectedHash} but got ${result.actualHash}`);
    }
    assert(result.valid, `Zero hash mismatch for ${relPath}`);
  }

  assert(totalChecked === Object.keys(POST_MERGE_HASH_MANIFEST).length, `All ${totalChecked} manifest files checked`);
  assert(mismatchCount === 0, `Strict requirement: Zero hash mismatches across merged files (Mismatches: ${mismatchCount})`);

  // --- 4. Subsystem Module Resolution & Sanity ---
  console.log('\n--- 4. Subsystem Module Resolution & Sanity ---');
  const indexJs = require(path.join(rootDir, 'src/main/index'));
  assert(typeof indexJs.registerClipboardHandlers === 'function', 'index.js exports registerClipboardHandlers function');

  const { AudioBridge } = require(path.join(rootDir, 'src/main/audio-bridge'));
  assert(typeof AudioBridge === 'function', 'audio-bridge exports AudioBridge class');

  const { UpdaterService } = require(path.join(rootDir, 'src/services/updater'));
  assert(typeof UpdaterService === 'function', 'updater exports UpdaterService class');

  console.log('\n================================================================');
  console.log('🎉 POST-MERGE INTEGRITY VERIFIED: ZERO HASH MISMATCHES!');
  console.log('🚀 WORKSPACE READY FOR PRODUCTION DEPLOYMENT');
  console.log('================================================================\n');

  process.exit(0);
}

runPostMergeIntegrityTests().catch((err) => {
  console.error('💥 Fatal error in post-merge integrity suite:', err);
  process.exit(1);
});
