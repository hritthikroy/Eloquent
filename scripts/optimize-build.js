#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting build optimization...');

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  execSync('rm -rf dist dist-webpack electron-cache', { stdio: 'inherit' });
} catch (error) {
  console.log('No previous builds to clean');
}

// Remove development dependencies from node_modules for smaller build
console.log('📦 Optimizing dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const prodDeps = Object.keys(packageJson.dependencies || {});

console.log('Production dependencies:', prodDeps);

// Build with optimizations
console.log('🔨 Building optimized version...');
try {
  execSync('npm run build:arm64', { stdio: 'inherit' });
  
  // Check final size
  const stats = execSync('du -sh dist/', { encoding: 'utf8' });
  console.log('📊 Final build size:', stats.trim());
  
  console.log('✅ Build optimization complete!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}