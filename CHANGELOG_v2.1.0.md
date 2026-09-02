# Changelog - Version 2.1.0

## 🎉 Major Release: Full Windows Support & Cross-Platform Compatibility

**Release Date:** January 2025  
**Build:** v2.1.0

---

## 🌟 What's New

### ✅ Full Windows Support
Eloquent now works natively on Windows 10/11 with all features fully functional!

**Windows-Specific Features:**
- Native audio recording using `node-record-lpcm16`
- Auto-paste using RobotJS with PowerShell fallback
- Windows system sounds for feedback
- NSIS installer with one-click setup
- Portable executable option

### 🤖 AI Rewrite Mode Enhanced
The AI Rewrite feature has been verified and enhanced:
- Keyboard shortcut: `Alt+Shift+Space`
- Powered by Groq's Llama 3.3-70b-versatile
- Two modes: Auto (intelligent) and Grammar (light touch)
- Removes filler words (um, uh, like, you know)
- Fixes grammar and punctuation
- Professional text enhancement

### 🔧 Cross-Platform Utilities
New modular architecture for better maintainability:
- **AudioRecorder** - Cross-platform audio recording
- **PasteHelper** - Cross-platform auto-paste
- **SoundPlayer** - Cross-platform sound feedback

### 🐧 Linux Support
Added experimental Linux support:
- Sox-based audio recording
- xdotool auto-paste support
- ALSA/PulseAudio sound playback

---

## 🔨 Technical Improvements

### Architecture
- ✅ Modular cross-platform utilities
- ✅ Improved error handling with platform detection
- ✅ Automatic fallback mechanisms
- ✅ Better logging and debugging

### Performance
- ⚡ Reduced recording delay: 200ms → 100ms
- ⚡ Faster overlay creation with pre-calculation
- ⚡ Optimized API timeouts (20s for Groq)
- ⚡ Non-blocking sound playback

### Dependencies
```json
{
  "node-record-lpcm16": "^1.0.1",  // Windows audio recording
  "robotjs": "^0.6.0",              // Windows keyboard automation
  "node-wav": "^0.0.2"              // WAV file handling
}
```

---

## 🆕 New Features

### 1. Windows Native Recording
- Primary: node-record-lpcm16 with Sox
- Fallback 1: node-record-lpcm16 without Sox
- Fallback 2: PowerShell audio recording
- Automatic quality detection

### 2. Cross-Platform Auto-Paste
**Windows:**
- RobotJS (Ctrl+V simulation)
- PowerShell SendKeys (fallback)

**macOS:**
- AppleScript with Accessibility
- cliclick (fallback)

**Linux:**
- xdotool (primary)
- xte (fallback)

**All Platforms:**
- Clipboard fallback always available

### 3. Smart Sound System
**Windows:** PowerShell system sounds + console beep  
**macOS:** afplay with system sounds (existing)  
**Linux:** aplay (ALSA) / paplay (PulseAudio)

### 4. Enhanced Error Messages
- Platform-specific installation instructions
- Helpful setup guides
- Clear fallback notifications
- Debug logging for troubleshooting

---

## 📚 New Documentation

### User Documentation
- **WINDOWS_SETUP.md** - Comprehensive Windows setup guide
- **QUICK_START.md** - 5-minute quick start for all platforms
- **DEPLOYMENT_CHECKLIST.md** - Complete deployment guide

### Technical Documentation
- **CROSS_PLATFORM_FIXES_SUMMARY.md** - Implementation details
- **test-platform-support.js** - Automated testing script

---

## 🐛 Bug Fixes

### Audio Recording
- ✅ Fixed macOS recording buffer issues
- ✅ Added proper cleanup for temp audio files
- ✅ Improved recording duration calculation
- ✅ Better error handling for missing Sox

### Auto-Paste
- ✅ Fixed clipboard preservation option
- ✅ Improved permission checking on macOS
- ✅ Better fallback behavior
- ✅ Added platform-specific paste delays

### AI Rewrite
- ✅ Verified keyboard shortcut registration
- ✅ Fixed mode passing through overlay creation
- ✅ Improved error handling for API failures
- ✅ Better logging for debugging

### General
- ✅ Fixed sound playback on non-macOS platforms
- ✅ Improved tray menu accessibility check
- ✅ Better notification messages
- ✅ Fixed memory leaks in audio recording

---

## 📦 Build System

### New Build Commands
```bash
npm run build:win-x64       # Windows 64-bit
npm run build:win-arm64     # Windows ARM64
npm run build:mac-arm64     # macOS Apple Silicon
npm run build:mac-x64       # macOS Intel
npm run build:all           # All platforms
```

### Build Outputs
**Windows:**
- `Eloquent-2.1.0-win-x64.exe` (NSIS installer)
- `Eloquent-2.1.0-win-x64-portable.exe` (Portable)

**macOS:**
- `Eloquent-2.1.0-mac-arm64.dmg` (Installer)
- `Eloquent-2.1.0-mac-arm64.zip` (Zip archive)

---

## ⚠️ Breaking Changes

### None
This release maintains backward compatibility with v2.0.x.

Existing macOS users can upgrade without any changes to their setup.

---

## 🔄 Migration Guide

### From v2.0.x to v2.1.0

**No migration needed!** Just install the new version.

**Optional improvements:**
1. Update `.env` file if you want to use new features
2. Enable auto-paste on Windows for best experience
3. Install Sox on Windows for better audio quality

---

## 📊 Statistics

- **Files Changed:** 8
- **New Files:** 6
- **Lines Added:** ~2,500
- **Lines Removed:** ~200
- **Dependencies Added:** 3
- **Platforms Supported:** 3 (Windows, macOS, Linux)

---

## 🙏 Acknowledgments

### Contributors
- Development and Windows port
- Testing on multiple platforms
- Documentation improvements

### Technologies Used
- **Electron** - Cross-platform framework
- **Groq API** - Lightning-fast AI inference
- **node-record-lpcm16** - Windows audio recording
- **RobotJS** - Keyboard automation
- **Sox** - Audio processing

---

## 🔜 What's Next (v2.2.0)

### Planned Features
- [ ] Custom keyboard shortcuts
- [ ] Multiple language support for UI
- [ ] Offline transcription mode
- [ ] Voice commands for formatting
- [ ] Custom dictionary improvements
- [ ] Better Linux support
- [ ] ARM builds for Linux

### Community Requests
- [ ] Dark mode for dashboard
- [ ] Batch file transcription
- [ ] Export history to formats
- [ ] API usage statistics
- [ ] Custom AI prompts

---

## 📥 Download

### GitHub Releases
https://github.com/hritthikroy/Eloquent/releases/tag/v2.1.0

### Direct Downloads
- **Windows (x64):** [Eloquent-2.1.0-win-x64.exe](https://github.com/hritthikroy/Eloquent/releases/download/v2.1.0/Eloquent-2.1.0-win-x64.exe)
- **macOS (ARM64):** [Eloquent-2.1.0-mac-arm64.dmg](https://github.com/hritthikroy/Eloquent/releases/download/v2.1.0/Eloquent-2.1.0-mac-arm64.dmg)

---

## 🐛 Known Issues

### Windows
- RobotJS requires Visual Studio Build Tools for compilation
- Some antivirus software may flag the installer (false positive)
- Auto-paste may require running as Administrator on some systems

### macOS
- Accessibility permission required for auto-paste
- First launch may be slow due to system verification

### Linux
- Experimental support - some features may not work perfectly
- xdotool required for auto-paste

**Workarounds available in documentation.**

---

## 📞 Support

- **GitHub Issues:** https://github.com/hritthikroy/Eloquent/issues
- **Documentation:** README.md, WINDOWS_SETUP.md, QUICK_START.md
- **Email:** Contact via GitHub profile

---

## 📜 License

MIT License - See LICENSE file for details

---

**Full Changelog:** https://github.com/hritthikroy/Eloquent/compare/v2.0.0...v2.1.0

**Release Notes:** https://github.com/hritthikroy/Eloquent/releases/tag/v2.1.0

---

*Thank you for using Eloquent! 🎤✨*
