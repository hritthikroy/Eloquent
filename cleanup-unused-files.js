#!/usr/bin/env node

// Cleanup script to remove unused JavaScript files after Go auth migration
const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning Up Unused JavaScript Files');
console.log('=' .repeat(50));

// Files that are now unused after Go migration
const filesToRemove = [
  'src/services/auth-service.js',  // Replaced by auth-bridge.js
  'src/main.js.backup',           // Backup file (optional cleanup)
];

// Files that might be unused (need verification)
const filesToCheck = [
  'src/utils/auth-validator.js',   // Check if still used
  // Note: admin-check.js is still used by main.js for admin functionality
];

// Test and migration files (keep these for now)
const filesToKeep = [
  'test-auth-performance.js',
  'test-go-auth-integration.js',
  'migrate-to-go-auth.js',
  'verify-go-auth-switch.js',
];

function checkFileUsage(filePath) {
  const fileName = path.basename(filePath, '.js');
  const searchPatterns = [
    `require('${filePath}')`,
    `require('./${filePath}')`,
    `require('../${filePath}')`,
    `require('${fileName}')`,
    `from '${filePath}'`,
    `from './${filePath}'`,
    `from '../${filePath}'`,
  ];
  
  // Search in src directory for usage
  const srcDir = path.join(__dirname, 'src');
  let isUsed = false;
  
  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDirectory(fullPath);
        } else if ((item.endsWith('.js') || item.endsWith('.ts')) && !item.includes(fileName)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          for (const pattern of searchPatterns) {
            if (content.includes(pattern)) {
              console.log(`   📍 Used in: ${fullPath}`);
              isUsed = true;
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  scanDirectory(srcDir);
  return isUsed;
}

function removeFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  try {
    // Create backup before removing
    const backupPath = fullPath + '.removed';
    fs.copyFileSync(fullPath, backupPath);
    
    // Remove the file
    fs.unlinkSync(fullPath);
    
    console.log(`✅ Removed: ${filePath}`);
    console.log(`   📁 Backup: ${filePath}.removed`);
    return true;
  } catch (error) {
    console.error(`❌ Error removing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  let removedCount = 0;
  let totalSize = 0;
  
  console.log('🔍 Analyzing files for removal...\n');
  
  // Check files that are definitely unused
  console.log('📋 Files to remove:');
  for (const filePath of filesToRemove) {
    const fullPath = path.join(__dirname, filePath);
    
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      totalSize += stats.size;
      
      console.log(`   - ${filePath} (${sizeKB} KB)`);
    } else {
      console.log(`   - ${filePath} (not found)`);
    }
  }
  
  // Check files that might be unused
  console.log('\n🔍 Checking potentially unused files:');
  for (const filePath of filesToCheck) {
    console.log(`\n📄 Checking: ${filePath}`);
    const isUsed = checkFileUsage(filePath);
    
    if (!isUsed) {
      console.log(`   ✅ Not used - safe to remove`);
      filesToRemove.push(filePath);
      
      const fullPath = path.join(__dirname, filePath);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        totalSize += stats.size;
      }
    } else {
      console.log(`   ⚠️  Still in use - keeping`);
    }
  }
  
  console.log(`\n💾 Total size to be freed: ${(totalSize / 1024).toFixed(2)} KB`);
  
  // Ask for confirmation
  console.log('\n❓ Proceed with cleanup? (y/N)');
  
  // For automated cleanup, uncomment the next line:
  // const proceed = true;
  
  // For interactive cleanup:
  const proceed = process.argv.includes('--yes') || process.argv.includes('-y');
  
  if (!proceed) {
    console.log('💡 Run with --yes flag to proceed automatically');
    console.log('💡 Or manually review and delete files listed above');
    return;
  }
  
  console.log('\n🧹 Starting cleanup...');
  
  // Remove the files
  for (const filePath of filesToRemove) {
    if (removeFile(filePath)) {
      removedCount++;
    }
  }
  
  console.log('\n📊 Cleanup Summary:');
  console.log(`   Files removed: ${removedCount}`);
  console.log(`   Space freed: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`   Backup files created: ${removedCount}`);
  
  if (removedCount > 0) {
    console.log('\n✅ Cleanup completed successfully!');
    console.log('\n📋 What was removed:');
    console.log('   - Old JavaScript auth service (replaced by Go)');
    console.log('   - Backup files from migration');
    console.log('   - Unused utility files');
    
    console.log('\n🔄 Rollback instructions:');
    console.log('   If you need any file back, restore from .removed files:');
    console.log('   mv filename.js.removed filename.js');
    
    console.log('\n🎯 Benefits:');
    console.log('   ✅ Cleaner codebase');
    console.log('   ✅ Reduced bundle size');
    console.log('   ✅ No unused dependencies');
    console.log('   ✅ Easier maintenance');
  } else {
    console.log('\n💡 No files were removed.');
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'check' || command === '--check') {
  console.log('🔍 Checking for unused files (dry run)...\n');
  
  for (const filePath of filesToRemove) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      console.log(`📄 ${filePath} - ${(stats.size / 1024).toFixed(2)} KB`);
    }
  }
  
  for (const filePath of filesToCheck) {
    console.log(`\n🔍 ${filePath}:`);
    const isUsed = checkFileUsage(filePath);
    console.log(`   ${isUsed ? '⚠️  Still used' : '✅ Safe to remove'}`);
  }
  
} else if (command === 'help' || command === '--help' || command === '-h') {
  console.log('Usage:');
  console.log('  node cleanup-unused-files.js           # Interactive cleanup');
  console.log('  node cleanup-unused-files.js --yes     # Automatic cleanup');
  console.log('  node cleanup-unused-files.js check     # Dry run (check only)');
  console.log('  node cleanup-unused-files.js help      # Show this help');
} else {
  main();
}

module.exports = { checkFileUsage, removeFile };