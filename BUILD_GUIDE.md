# VoicyClone - Build & Deployment Guide

## 🚀 Quick Build

### Build for Mac (Universal Binary)
```bash
npm run build:mac
```

This creates:
- `dist/VoicyClone-2.0.0-mac-universal.dmg` - Installer (recommended)
- `dist/VoicyClone-2.0.0-mac-universal.zip` - Portable version

### Build Options

```bash
# Full build (DMG + ZIP, Universal)
npm run build:mac

# DMG only
npm run build:dmg

# ZIP only
npm run build:zip

# All formats
npm run dist
```

## 📦 Build Output

After building, you'll find in the `dist/` folder:

```
dist/
├── VoicyClone-2.0.0-mac-universal.dmg    (~80-100 MB)
├── VoicyClone-2.0.0-mac-universal.zip    (~70-90 MB)
└── mac-universal/
    └── VoicyClone.app                     (The actual app)
```

## 🎯 Optimized Build Features

### Universal Binary
- Supports both Intel and Apple Silicon Macs
- Single download works on all modern Macs
- Optimized for performance on both architectures

### Compression
- Maximum compression enabled
- Smaller download size
- Faster distribution

### Included Files Only
The build only includes essential files:
- `main.js` - Core application logic
- `dashboard.html` - Settings interface
- `overlay.html` - Recording overlay
- `ai-prompts.js` - AI prompt templates
- `utils.js` - Utility functions
- `package.json` - App metadata

**Excluded** (keeps build small):
- All `.md` documentation files
- `node_modules/` (bundled separately)
- Development files
- Test files

## 🔐 Entitlements

The app requests these macOS permissions:
- **Microphone** - For voice recording
- **Automation** - For pasting text via AppleScript
- **JIT** - For Electron runtime

These are configured in `build/entitlements.mac.plist`

## 🌐 GitHub Actions - Automated Builds

### Setup

1. **Push your code to GitHub:**
   ```bash
   cd VoicyCloneElectron
   git add .
   git commit -m "Ready for automated builds"
   git push origin main
   ```

2. **Create a release tag:**
   ```bash
   git tag v2.0.0
   git push origin v2.0.0
   ```

3. **GitHub Actions will automatically:**
   - Build the Mac app
   - Create DMG and ZIP files
   - Upload as release artifacts
   - Create a GitHub Release

### Manual Trigger

You can also trigger builds manually:
1. Go to your GitHub repo
2. Click "Actions" tab
3. Select "Build and Release"
4. Click "Run workflow"

## 📤 Distribution

### Option 1: GitHub Releases (Recommended)
```bash
# Create and push a version tag
git tag v2.0.0
git push origin v2.0.0

# GitHub Actions builds and creates release automatically
# Users download from: https://github.com/yourusername/VoicyClone/releases
```

### Option 2: Manual Distribution
```bash
# Build locally
npm run build:mac

# Share the DMG file
# dist/VoicyClone-2.0.0-mac-universal.dmg
```

### Option 3: Direct App Sharing
```bash
# Build and compress just the app
npm run build:zip

# Share the ZIP file
# dist/VoicyClone-2.0.0-mac-universal.zip
```

## 🔧 Build Requirements

### System Requirements
- macOS 10.15 (Catalina) or later
- Node.js 18 or later
- npm 9 or later

### Dependencies
```bash
# Install build dependencies
npm install --save-dev electron electron-builder
```

## 📝 Version Management

### Update Version
Edit `package.json`:
```json
{
  "version": "2.0.1"
}
```

### Create Release
```bash
# Update version
npm version patch  # 2.0.0 -> 2.0.1
# or
npm version minor  # 2.0.0 -> 2.1.0
# or
npm version major  # 2.0.0 -> 3.0.0

# Push with tags
git push origin main --tags
```

## 🎨 Customization

### App Icon
1. Create a 1024x1024 PNG icon
2. Convert to ICNS:
   ```bash
   # Using iconutil (macOS built-in)
   mkdir icon.iconset
   sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
   sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
   sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
   sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
   sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
   sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
   sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
   sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
   sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
   sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
   iconutil -c icns icon.iconset
   mv icon.icns build/icon.icns
   ```

### DMG Background
1. Create a 540x380 PNG background
2. Save as `build/background.png`

## 🐛 Troubleshooting

### Build Fails
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build:mac
```

### Large Build Size
- Check `package.json` "files" array
- Ensure only necessary files are included
- Remove unused dependencies

### Code Signing Issues
For distribution outside GitHub:
```bash
# Sign the app (requires Apple Developer account)
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
npm run build:mac
```

## 📊 Build Size Optimization

Current optimizations:
- ✅ Universal binary (one file for all Macs)
- ✅ Maximum compression
- ✅ Minimal file inclusion
- ✅ No documentation in build
- ✅ Optimized dependencies

Expected sizes:
- DMG: ~80-100 MB
- ZIP: ~70-90 MB
- Installed: ~200-250 MB

## 🚢 Release Checklist

Before creating a release:

- [ ] Update version in `package.json`
- [ ] Test the app locally (`npm start`)
- [ ] Build locally (`npm run build:mac`)
- [ ] Test the built app
- [ ] Update CHANGELOG.md
- [ ] Commit all changes
- [ ] Create and push version tag
- [ ] Verify GitHub Actions build succeeds
- [ ] Test downloaded release
- [ ] Announce release

## 📚 Additional Resources

- [Electron Builder Docs](https://www.electron.build/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [macOS Code Signing](https://www.electron.build/code-signing)
