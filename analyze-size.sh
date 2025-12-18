#!/bin/bash

# Eloquent App Size Analysis Script
# Analyzes what's taking up space in your Electron app

echo "🔍 Eloquent App Size Analysis"
echo "============================"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_section() {
    echo -e "\n${BLUE}$1${NC}"
    echo "$(printf '=%.0s' {1..50})"
}

print_item() {
    echo -e "${GREEN}•${NC} $1"
}

# Check current build sizes
print_section "📦 Current Build Sizes"
if [ -d "dist" ]; then
    ls -lh dist/*.dmg dist/*.zip 2>/dev/null | while read line; do
        print_item "$line"
    done
else
    echo "No dist folder found. Run 'npm run build' first."
fi

# Analyze node_modules size
print_section "📚 Dependencies Analysis"
if [ -d "node_modules" ]; then
    NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)
    print_item "node_modules total size: $NODE_MODULES_SIZE"
    
    echo -e "\n${YELLOW}Top 10 largest dependencies:${NC}"
    du -sh node_modules/* 2>/dev/null | sort -hr | head -10 | while read size dir; do
        echo "  $size - $(basename "$dir")"
    done
else
    echo "No node_modules found. Run 'npm install' first."
fi

# Analyze app bundle if it exists
print_section "🏗️ App Bundle Analysis"
if [ -d "dist/Eloquent.app" ]; then
    print_item "App bundle contents:"
    du -sh dist/Eloquent.app/Contents/* 2>/dev/null | sort -hr | while read size dir; do
        echo "  $size - $(basename "$dir")"
    done
    
    echo -e "\n${YELLOW}Largest files in app bundle:${NC}"
    find dist/Eloquent.app -type f -size +1M -exec ls -lh {} \; 2>/dev/null | head -5 | while read line; do
        echo "  $line"
    done
else
    echo "No app bundle found. Build the app first."
fi

# Check source code size
print_section "📝 Source Code Analysis"
SOURCE_SIZE=$(du -sh *.js *.html *.json assets/ 2>/dev/null | tail -1 | cut -f1)
print_item "Total source code size: $SOURCE_SIZE"

echo -e "\n${YELLOW}Source files breakdown:${NC}"
ls -lh *.js *.html *.json 2>/dev/null | while read line; do
    echo "  $line"
done

if [ -d "assets" ]; then
    echo -e "\n${YELLOW}Assets:${NC}"
    du -sh assets/* 2>/dev/null | while read size file; do
        echo "  $size - $(basename "$file")"
    done
fi

# Optimization recommendations
print_section "💡 Optimization Recommendations"

echo -e "${YELLOW}Quick wins (Easy):${NC}"
print_item "Build single architecture instead of universal (-40-50MB)"
print_item "Enable maximum compression (-10-15MB)"
print_item "Remove unused dependencies (-5-10MB)"

echo -e "\n${YELLOW}Medium effort:${NC}"
print_item "Minify JavaScript files (-2-5MB)"
print_item "Optimize assets (SVG, images) (-1-3MB)"
print_item "Clean build process (-5-10MB)"

echo -e "\n${YELLOW}Advanced:${NC}"
print_item "Use V8 snapshot compilation (-10-20MB)"
print_item "Custom Electron build (-5-15MB)"
print_item "Switch to Tauri (Rust) for 3-10MB apps"

print_section "🚀 Next Steps"
print_item "Run './build-optimized.sh' for automatic optimization"
print_item "Or manually update package.json with optimized settings"
print_item "Consider separate Intel/ARM builds for distribution"

echo -e "\n${GREEN}Target: Reduce from ~150MB to 80-100MB${NC}"
echo