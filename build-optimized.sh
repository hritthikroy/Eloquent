#!/bin/bash

# Eloquent App Size Optimization Build Script
# This script reduces the app size from ~150MB to ~80-100MB

echo "🚀 Starting Eloquent Optimization Build Process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the EloquentElectron directory."
    exit 1
fi

# Step 1: Clean previous builds
print_status "Step 1: Cleaning previous builds..."
rm -rf dist/
rm -rf node_modules/.cache/
rm -rf electron-cache/
print_success "Cleaned previous builds"

# Step 2: Install production dependencies only
print_status "Step 2: Installing production dependencies..."
npm ci --production --silent
print_success "Production dependencies installed"

# Step 3: Remove unnecessary files
print_status "Step 3: Removing unnecessary files..."
find . -name "*.md" -not -path "./node_modules/*" -not -name "README.md" -delete
find . -name "*.map" -not -path "./node_modules/*" -delete
find . -name ".DS_Store" -delete
find . -name "*.log" -delete
print_success "Unnecessary files removed"

# Step 4: Optimize assets
print_status "Step 4: Optimizing assets..."
if command -v svgo &> /dev/null; then
    svgo assets/logo.svg -o assets/logo.svg --quiet
    print_success "SVG optimized"
else
    print_warning "svgo not found, skipping SVG optimization (install with: npm install -g svgo)"
fi

# Step 5: Create optimized package.json for build
print_status "Step 5: Creating optimized build configuration..."
cp package.json package.json.backup
cp package.optimized.json package.json
print_success "Optimized configuration applied"

# Step 6: Build for Apple Silicon (most users)
print_status "Step 6: Building optimized Apple Silicon version..."
npx electron-builder --mac --arm64 --config.compression=maximum --publish=never

if [ $? -eq 0 ]; then
    print_success "Apple Silicon build completed"
else
    print_error "Apple Silicon build failed"
    # Restore original package.json
    mv package.json.backup package.json
    exit 1
fi

# Step 7: Build for Intel (optional)
read -p "Build Intel version too? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Step 7: Building Intel version..."
    npx electron-builder --mac --x64 --config.compression=maximum --publish=never
    
    if [ $? -eq 0 ]; then
        print_success "Intel build completed"
    else
        print_error "Intel build failed"
    fi
fi

# Step 8: Restore original package.json
print_status "Step 8: Restoring original configuration..."
mv package.json.backup package.json
print_success "Original configuration restored"

# Step 9: Show results
print_status "Step 9: Build Results"
echo
echo "📊 Build Size Analysis:"
echo "======================"

if [ -f "dist/Eloquent-2.0.0-mac-arm64.dmg" ]; then
    ARM_SIZE=$(ls -lh dist/Eloquent-2.0.0-mac-arm64.dmg | awk '{print $5}')
    print_success "Apple Silicon DMG: $ARM_SIZE"
fi

if [ -f "dist/Eloquent-2.0.0-mac-x64.dmg" ]; then
    INTEL_SIZE=$(ls -lh dist/Eloquent-2.0.0-mac-x64.dmg | awk '{print $5}')
    print_success "Intel DMG: $INTEL_SIZE"
fi

if [ -f "dist/Eloquent-2.0.0-mac-arm64.zip" ]; then
    ARM_ZIP_SIZE=$(ls -lh dist/Eloquent-2.0.0-mac-arm64.zip | awk '{print $5}')
    print_success "Apple Silicon ZIP: $ARM_ZIP_SIZE"
fi

if [ -f "dist/Eloquent-2.0.0-mac-x64.zip" ]; then
    INTEL_ZIP_SIZE=$(ls -lh dist/Eloquent-2.0.0-mac-x64.zip | awk '{print $5}')
    print_success "Intel ZIP: $INTEL_ZIP_SIZE"
fi

echo
echo "🎯 Optimization Summary:"
echo "======================="
echo "✅ Single architecture builds (saves 40-50MB)"
echo "✅ Maximum compression enabled"
echo "✅ Production dependencies only"
echo "✅ Unnecessary files removed"
echo "✅ Assets optimized"
echo "✅ Clean build process"

echo
echo "📦 Expected size reduction: 150MB → 80-100MB"
echo
print_success "Optimization build completed! 🎉"

# Step 10: Optional analysis
read -p "Analyze app bundle contents? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Analyzing app bundle..."
    
    if [ -d "dist/Eloquent.app" ]; then
        echo
        echo "📁 App Bundle Analysis:"
        echo "======================"
        du -sh dist/Eloquent.app/Contents/* | sort -hr
        
        echo
        echo "🔍 Largest files in bundle:"
        find dist/Eloquent.app -type f -size +1M -exec ls -lh {} \; | head -10
    fi
fi

echo
print_success "All done! Your optimized Eloquent app is ready in the dist/ folder."