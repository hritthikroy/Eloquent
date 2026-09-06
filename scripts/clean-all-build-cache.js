#!/usr/bin/env node
/**
 * @file clean-all-build-cache.js
 * @description Master script to deeply purge all obsolete build caches,
 * compiled intermediates, runtime caches, and orphaned process locks
 * across Electron, Node.js, and Go backend subsystems without touching living memory.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('🧹 MASTER BUILD & RUNTIME CACHE PURGE PIPELINE');
console.log('================================================================\n');

const stats = {
  purgedDirs: [],
  skippedDirs: [],
  removedFiles: [],
  goCleaned: [],
  persistedVerified: []
};

// 1. Critical persistent files that MUST NOT be touched
const protectedPaths = [
  'userData/agent-brain-memory.json',
  'userData/history.json',
  'userData/jarvis-config.json',
  'userData/admin-config.json',
  'userData/dynamic-directives.json',
  'userData/shared-milestones.json',
  'userData/sounds',
  '.env',
  '.env.example'
];

// 2. Cache directories to purge
const targetCacheDirs = [
  'dist-ts',
  'dist',
  'dist-webpack',
  'electron-cache',
  '.cache',
  '.turbo',
  'build-cache',
  'userData/Cache',
  'userData/Code Cache',
  'userData/DawnGraphiteCache',
  'userData/DawnWebGPUCache',
  'userData/GPUCache',
  'userData/blob_storage'
];

console.log('--- Phase 1: Purging Volatile Build & Runtime Directories ---');
for (const relDir of targetCacheDirs) {
  const fullPath = path.resolve(rootDir, relDir);
  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      stats.purgedDirs.push(relDir);
      console.log(`  🗑️  Purged directory: "${relDir}"`);
    } catch (err) {
      try {
        fs.chmodSync(fullPath, 0o777);
        fs.rmSync(fullPath, { recursive: true, force: true });
        stats.purgedDirs.push(relDir);
        console.log(`  🗑️  Purged directory (chmod retry): "${relDir}"`);
      } catch (retryErr) {
        console.error(`  ❌ Failed to remove "${relDir}": ${retryErr.message}`);
      }
    }
  } else {
    stats.skippedDirs.push(relDir);
  }
}

console.log('\n--- Phase 2: Removing Orphaned Locks & Singleton Symlinks ---');
// Clear root lock files
const lockFiles = ['.build.lock', 'build.lock', '.dist.lock'];
for (const lock of lockFiles) {
  const fullPath = path.resolve(rootDir, lock);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      stats.removedFiles.push(lock);
      console.log(`  🧹 Removed lock: "${lock}"`);
    } catch (err) {
      console.warn(`  ⚠️ Could not remove lock "${lock}": ${err.message}`);
    }
  }
}

// Clear userData/Singleton* orphaned symlinks
const userDataDir = path.resolve(rootDir, 'userData');
if (fs.existsSync(userDataDir)) {
  try {
    const entries = fs.readdirSync(userDataDir);
    for (const entry of entries) {
      if (entry.startsWith('Singleton')) {
        const fullPath = path.join(userDataDir, entry);
        try {
          fs.unlinkSync(fullPath);
          stats.removedFiles.push(`userData/${entry}`);
          console.log(`  🧹 Removed orphaned symlink: "userData/${entry}"`);
        } catch (e) {
          console.warn(`  ⚠️ Could not remove "userData/${entry}": ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.warn(`  ⚠️ Error reading userData directory: ${e.message}`);
  }
}

console.log('\n--- Phase 3: Purging Go Backend Build & Test Caches ---');
const goDirs = ['backend-go', 'go-backend', 'go'];
for (const gDir of goDirs) {
  const fullGoDir = path.resolve(rootDir, gDir);
  if (fs.existsSync(fullGoDir)) {
    try {
      execSync('go clean -cache -testcache', {
        cwd: fullGoDir,
        stdio: 'pipe',
        timeout: 10000
      });
      stats.goCleaned.push(gDir);
      console.log(`  🧹 Cleared Go build & test cache: "${gDir}"`);
    } catch (err) {
      console.warn(`  ⚠️ Warning clearing Go cache in "${gDir}": ${err.message}`);
    }
  }
}

// Remove old Go binary if present
const goBinPath = path.resolve(rootDir, 'backend-go/eloquent-backend');
if (fs.existsSync(goBinPath)) {
  try {
    fs.unlinkSync(goBinPath);
    stats.removedFiles.push('backend-go/eloquent-backend');
    console.log('  🧹 Removed compiled Go binary: "backend-go/eloquent-backend"');
  } catch (e) {
    console.warn(`  ⚠️ Warning removing Go binary: ${e.message}`);
  }
}

console.log('\n--- Phase 4: Cleaning Stray System Artifacts & Truncating Error Logs ---');
// Clean .DS_Store in root and EloquentElectron
const dsStores = [
  path.resolve(rootDir, '.DS_Store'),
  path.resolve(rootDir, 'userData/.DS_Store')
];
for (const ds of dsStores) {
  if (fs.existsSync(ds)) {
    try {
      fs.unlinkSync(ds);
      stats.removedFiles.push(path.relative(rootDir, ds));
      console.log(`  🧹 Removed system artifact: "${path.relative(rootDir, ds)}"`);
    } catch (e) {
      /* ignore */
    }
  }
}

// Clean/truncate oversized eye_error.log if > 10KB
const eyeErrorLog = path.resolve(rootDir, 'logs/eye_error.log');
if (fs.existsSync(eyeErrorLog)) {
  try {
    const logStat = fs.statSync(eyeErrorLog);
    if (logStat.size > 10240) {
      fs.writeFileSync(eyeErrorLog, '');
      console.log(`  🧹 Truncated oversized debug log: "logs/eye_error.log" (${Math.round(logStat.size / 1024)} KB -> 0 KB)`);
    }
  } catch (e) {
    /* ignore */
  }
}

// Sweep duplicate collision files (e.g., 'filename 2' created by macOS copy collisions)
const collisionDirs = ['dist-ts', 'backend-go', 'userData'];
for (const cDir of collisionDirs) {
  const fullCDir = path.resolve(rootDir, cDir);
  if (fs.existsSync(fullCDir)) {
    try {
      const items = fs.readdirSync(fullCDir);
      for (const item of items) {
        if (item.includes(' 2')) {
          const itemPath = path.join(fullCDir, item);
          fs.rmSync(itemPath, { recursive: true, force: true });
          stats.removedFiles.push(`${cDir}/${item}`);
          console.log(`  🧹 Removed collision duplicate: "${cDir}/${item}"`);
        }
      }
    } catch (e) {
      /* ignore */
    }
  }
}

console.log('\n--- Phase 5: Verifying Integrity of Persistent Living Memory ---');
let allProtectedPresent = true;
for (const relPath of protectedPaths) {
  const fullPath = path.resolve(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    stats.persistedVerified.push(relPath);
    console.log(`  ✅ Verified intact: "${relPath}"`);
  } else {
    allProtectedPresent = false;
    console.warn(`  ⚠️ Warning: Protected path missing: "${relPath}"`);
  }
}

console.log('\n--- Phase 6: Fresh Recompilation & AST Validation ---');
try {
  console.log('  🔨 Recompiling TypeScript (tsc)...');
  execSync('npm run build:ts', { cwd: rootDir, stdio: 'inherit' });
  console.log('  ✅ TypeScript compilation succeeded (fresh dist-ts created).');
} catch (err) {
  console.error('  ❌ TypeScript compilation failed:', err.message);
  process.exit(1);
}

try {
  console.log('  🔍 Validating AST across all source modules...');
  execSync('npm run validate:ast', { cwd: rootDir, stdio: 'inherit' });
  console.log('  ✅ AST validation 100% clean (0 syntax errors).');
} catch (err) {
  console.error('  ❌ AST validation failed:', err.message);
  process.exit(1);
}

console.log('\n================================================================');
console.log('🎉 BUILD CACHE PURGE & REBUILD COMPLETED SUCCESSFULLY!');
console.log('================================================================');
console.log(`  • Purged Cache Directories: ${stats.purgedDirs.length}`);
console.log(`  • Removed Locks & Files:    ${stats.removedFiles.length}`);
console.log(`  • Go Backend Caches Purged: ${stats.goCleaned.length}`);
console.log(`  • Living Memory Intact:     ${stats.persistedVerified.length}/${protectedPaths.length}`);
console.log('================================================================\n');

process.exit(0);
