# Quick Deployment Guide

## 🚀 Deploy to GitHub (Automated)

### One-Command Deployment
```bash
./deploy.sh
```

This script will:
1. Ask you to bump the version (patch/minor/major)
2. Build locally to verify everything works
3. Commit your changes
4. Create a version tag
5. Push to GitHub
6. Trigger automated build on GitHub Actions

### Manual Deployment

If you prefer manual control:

```bash
# 1. Update version
npm version patch  # or minor, or major

# 2. Build locally to test
npm run build:mac

# 3. Commit and push
git add .
git commit -m "Release v2.0.1"
git push origin main

# 4. Create and push tag
git tag v2.0.1
git push origin v2.0.1
```

## 📦 What Gets Built

GitHub Actions will automatically create:
- **DMG file** - Drag-and-drop installer (~80-100 MB)
- **ZIP file** - Portable version (~70-90 MB)
- **GitHub Release** - With download links and release notes

## 🔍 Monitor Build Progress

After pushing a tag, check:
```
https://github.com/YOUR_USERNAME/VoicyClone/actions
```

Build takes ~5-10 minutes.

## 📥 Download Your Build

Once complete, users can download from:
```
https://github.com/YOUR_USERNAME/VoicyClone/releases
```

## 🎯 First Time Setup

### 1. Initialize Git (if not done)
```bash
cd VoicyCloneElectron
git init
git add .
git commit -m "Initial commit"
```

### 2. Create GitHub Repository
1. Go to https://github.com/new
2. Name it "VoicyClone"
3. Don't initialize with README (you already have files)
4. Click "Create repository"

### 3. Connect and Push
```bash
git remote add origin https://github.com/YOUR_USERNAME/VoicyClone.git
git branch -M main
git push -u origin main
```

### 4. Deploy First Release
```bash
./deploy.sh
```

## 🔐 GitHub Token (Optional)

For private repos or advanced features, you may need a GitHub token:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `workflow`
4. Copy the token
5. Add to your repo secrets:
   - Go to repo Settings → Secrets → Actions
   - Add `GH_TOKEN` with your token

## 📊 Build Configuration

All build settings are in `package.json` under the `"build"` section:

```json
{
  "build": {
    "appId": "com.eloquent.voicyclone",
    "productName": "VoicyClone",
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.productivity"
    }
  }
}
```

## 🎨 Customize Build

### Change App Name
Edit `package.json`:
```json
{
  "name": "your-app-name",
  "productName": "Your App Name"
}
```

### Change App ID
Edit `package.json`:
```json
{
  "build": {
    "appId": "com.yourcompany.yourapp"
  }
}
```

### Add App Icon
1. Create 1024x1024 PNG icon
2. Convert to ICNS (see BUILD_GUIDE.md)
3. Place in `build/icon.icns`

## 🐛 Troubleshooting

### Build Fails on GitHub
- Check Actions tab for error logs
- Ensure all dependencies are in `package.json`
- Verify `package-lock.json` is committed

### Can't Push to GitHub
```bash
# Check remote
git remote -v

# If not set, add it
git remote add origin https://github.com/YOUR_USERNAME/VoicyClone.git
```

### Tag Already Exists
```bash
# Delete local tag
git tag -d v2.0.0

# Delete remote tag
git push origin :refs/tags/v2.0.0

# Create new tag
git tag v2.0.0
git push origin v2.0.0
```

## 📝 Version Numbering

Follow semantic versioning:
- **Patch** (2.0.0 → 2.0.1): Bug fixes
- **Minor** (2.0.0 → 2.1.0): New features, backwards compatible
- **Major** (2.0.0 → 3.0.0): Breaking changes

## ✅ Pre-Deployment Checklist

- [ ] All features tested locally
- [ ] `npm start` works
- [ ] `npm run build:mac` succeeds
- [ ] Built app tested
- [ ] Version number updated
- [ ] Changes committed
- [ ] Ready to push!

## 🎉 After Deployment

1. Wait for GitHub Actions to complete (~5-10 min)
2. Check the Releases page
3. Download and test the DMG
4. Share the release link with users!

## 📚 More Info

See `BUILD_GUIDE.md` for detailed build configuration and customization options.
