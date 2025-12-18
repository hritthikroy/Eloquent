#!/bin/bash

# Generate app icons from SVG for Electron build
# Requires: Inkscape or rsvg-convert (from librsvg)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
SVG_FILE="$BUILD_DIR/icon.svg"
ICONSET_DIR="$BUILD_DIR/icon.iconset"

echo "🎨 Generating Eloquent app icons..."

# Check for conversion tool
if command -v rsvg-convert &> /dev/null; then
    CONVERTER="rsvg"
elif command -v sips &> /dev/null; then
    CONVERTER="sips"
else
    echo "❌ No SVG converter found. Install librsvg: brew install librsvg"
    exit 1
fi

# Create iconset directory
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# Required sizes for macOS iconset
SIZES=(16 32 64 128 256 512 1024)

echo "📐 Converting SVG to PNG at multiple sizes..."

for size in "${SIZES[@]}"; do
    if [ "$CONVERTER" = "rsvg" ]; then
        rsvg-convert -w $size -h $size "$SVG_FILE" -o "$ICONSET_DIR/icon_${size}x${size}.png"
        # Also create @2x versions
        if [ $size -le 512 ]; then
            double=$((size * 2))
            rsvg-convert -w $double -h $double "$SVG_FILE" -o "$ICONSET_DIR/icon_${size}x${size}@2x.png"
        fi
    fi
    echo "  ✓ ${size}x${size}"
done

# Rename files to match Apple's iconset naming convention
cd "$ICONSET_DIR"
mv icon_16x16.png icon_16x16.png 2>/dev/null || true
mv icon_32x32.png icon_32x32.png 2>/dev/null || true
mv icon_64x64.png icon_32x32@2x.png 2>/dev/null || true
mv icon_128x128.png icon_128x128.png 2>/dev/null || true
mv icon_256x256.png icon_256x256.png 2>/dev/null || true
mv icon_512x512.png icon_512x512.png 2>/dev/null || true
mv icon_1024x1024.png icon_512x512@2x.png 2>/dev/null || true

# Handle @2x versions
mv icon_16x16@2x.png icon_16x16@2x.png 2>/dev/null || true
mv icon_128x128@2x.png icon_128x128@2x.png 2>/dev/null || true
mv icon_256x256@2x.png icon_256x256@2x.png 2>/dev/null || true

cd "$SCRIPT_DIR"

# Generate .icns file
echo "🍎 Creating macOS .icns file..."
iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"

# Also create a PNG for Linux/Windows
cp "$ICONSET_DIR/icon_256x256.png" "$BUILD_DIR/icon.png" 2>/dev/null || \
    rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$BUILD_DIR/icon.png"

# Cleanup
rm -rf "$ICONSET_DIR"

echo ""
echo "✅ Icons generated successfully!"
echo "   - build/icon.icns (macOS)"
echo "   - build/icon.png (Linux/Windows)"
echo ""
echo "Now run: npm run build"
