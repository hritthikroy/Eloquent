#!/usr/bin/env node
/**
 * Generate Windows .ico file from SVG
 * Requires: npm install sharp png-to-ico --save-dev
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    // Check if sharp is available
    let sharp;
    try {
      sharp = require('sharp');
    } catch (e) {
      console.log('⚠️  sharp not installed. Installing...');
      const { execSync } = require('child_process');
      execSync('npm install sharp --save-dev', { stdio: 'inherit' });
      sharp = require('sharp');
    }

    // Check if png-to-ico is available
    let pngToIco;
    try {
      const pngToIcoModule = require('png-to-ico');
      pngToIco = pngToIcoModule.default || pngToIcoModule;
    } catch (e) {
      console.log('⚠️  png-to-ico not installed. Installing...');
      const { execSync } = require('child_process');
      execSync('npm install png-to-ico --save-dev', { stdio: 'inherit' });
      const pngToIcoModule = require('png-to-ico');
      pngToIco = pngToIcoModule.default || pngToIcoModule;
    }

    const svgPath = path.join(__dirname, '..', 'build', 'icon.svg');
    const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
    const tempDir = path.join(__dirname, '..', 'build', 'temp-icons');

    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log('🎨 Generating Windows icon from SVG...');

    // Generate PNGs at different sizes for ICO
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngPaths = [];

    for (const size of sizes) {
      const pngPath = path.join(tempDir, `icon-${size}.png`);
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      pngPaths.push(pngPath);
      console.log(`  ✓ Generated ${size}x${size} PNG`);
    }

    // Convert PNGs to ICO
    const pngBuffers = pngPaths.map(p => fs.readFileSync(p));
    const icoBuffer = await pngToIco(pngBuffers);
    fs.writeFileSync(icoPath, icoBuffer);

    console.log('✅ Windows icon generated: build/icon.ico');

    // Cleanup temp files
    for (const pngPath of pngPaths) {
      fs.unlinkSync(pngPath);
    }
    fs.rmdirSync(tempDir);

    console.log('🧹 Cleaned up temporary files');

  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
