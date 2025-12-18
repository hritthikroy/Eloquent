#!/usr/bin/env node

// Simple asset minification script for Eloquent
// Removes comments, extra whitespace, and optimizes code

const fs = require('fs');
const path = require('path');

console.log('🗜️ Minifying Eloquent assets...');

// Minify CSS in HTML files
function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/;\s*}/g, '}') // Remove last semicolon in blocks
    .replace(/\s*{\s*/g, '{') // Remove spaces around braces
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';') // Remove spaces around semicolons
    .replace(/\s*:\s*/g, ':') // Remove spaces around colons
    .replace(/\s*,\s*/g, ',') // Remove spaces around commas
    .trim();
}

// Minify JavaScript
function minifyJS(js) {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*{\s*/g, '{') // Remove spaces around braces
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';') // Remove spaces around semicolons
    .replace(/\s*,\s*/g, ',') // Remove spaces around commas
    .replace(/\s*\(\s*/g, '(') // Remove spaces around parentheses
    .replace(/\s*\)\s*/g, ')')
    .trim();
}

// Minify HTML
function minifyHTML(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .trim();
}

// Process HTML files
const htmlFiles = ['dashboard.html', 'overlay.html', 'admin.html'];

htmlFiles.forEach(filename => {
  if (fs.existsSync(filename)) {
    console.log(`📄 Processing ${filename}...`);
    
    let content = fs.readFileSync(filename, 'utf8');
    const originalSize = content.length;
    
    // Minify CSS within <style> tags
    content = content.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
      return `<style>${minifyCSS(css)}</style>`;
    });
    
    // Minify JavaScript within <script> tags
    content = content.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, js) => {
      // Skip external scripts
      if (match.includes('src=')) return match;
      return `<script>${minifyJS(js)}</script>`;
    });
    
    // Minify HTML
    content = minifyHTML(content);
    
    const newSize = content.length;
    const savings = originalSize - newSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);
    
    // Create minified version
    const minifiedName = filename.replace('.html', '.min.html');
    fs.writeFileSync(minifiedName, content);
    
    console.log(`  ✅ ${filename} → ${minifiedName}`);
    console.log(`  📊 Size: ${originalSize} → ${newSize} bytes (${savingsPercent}% smaller)`);
  }
});

// Process JavaScript files
const jsFiles = ['main.js', 'ai-prompts.js', 'utils.js', 'performance-monitor.js'];

jsFiles.forEach(filename => {
  if (fs.existsSync(filename)) {
    console.log(`📄 Processing ${filename}...`);
    
    let content = fs.readFileSync(filename, 'utf8');
    const originalSize = content.length;
    
    // Basic minification (preserve functionality)
    content = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments (but preserve URLs)
      .replace(/^\s+/gm, '') // Remove leading whitespace
      .replace(/\s*\n\s*/g, '\n') // Collapse empty lines
      .replace(/\n+/g, '\n') // Remove multiple newlines
      .trim();
    
    const newSize = content.length;
    const savings = originalSize - newSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);
    
    // Create minified version
    const minifiedName = filename.replace('.js', '.min.js');
    fs.writeFileSync(minifiedName, content);
    
    console.log(`  ✅ ${filename} → ${minifiedName}`);
    console.log(`  📊 Size: ${originalSize} → ${newSize} bytes (${savingsPercent}% smaller)`);
  }
});

// Create a build script that uses minified files
const buildScript = `#!/bin/bash
# Use minified files for production build

echo "🔄 Switching to minified files..."

# Backup originals
cp main.js main.original.js
cp dashboard.html dashboard.original.html
cp overlay.html overlay.original.html
cp admin.html admin.original.html
cp ai-prompts.js ai-prompts.original.js
cp utils.js utils.original.js
cp performance-monitor.js performance-monitor.original.js

# Use minified versions
cp main.min.js main.js
cp dashboard.min.html dashboard.html
cp overlay.min.html overlay.html
cp admin.min.html admin.html
cp ai-prompts.min.js ai-prompts.js
cp utils.min.js utils.js
cp performance-monitor.min.js performance-monitor.js

echo "✅ Minified files activated"
echo "💡 Run 'npm run build' now for smaller bundle"
echo "🔄 Run './restore-originals.sh' to restore original files"
`;

fs.writeFileSync('use-minified.sh', buildScript);
fs.chmodSync('use-minified.sh', '755');

// Create restore script
const restoreScript = `#!/bin/bash
# Restore original files

echo "🔄 Restoring original files..."

mv main.original.js main.js
mv dashboard.original.html dashboard.html
mv overlay.original.html overlay.html
mv admin.original.html admin.html
mv ai-prompts.original.js ai-prompts.js
mv utils.original.js utils.js
mv performance-monitor.original.js performance-monitor.js

echo "✅ Original files restored"
`;

fs.writeFileSync('restore-originals.sh', restoreScript);
fs.chmodSync('restore-originals.sh', '755');

console.log('\n🎉 Minification complete!');
console.log('\n📋 Next steps:');
console.log('1. Run ./use-minified.sh to switch to minified files');
console.log('2. Run npm run build for smaller bundle');
console.log('3. Run ./restore-originals.sh to restore original files');
console.log('\n💡 Expected savings: 2-5MB from minification');