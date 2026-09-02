# Eloquent - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
cd EloquentElectron
npm install
```

### Step 2: Get a Groq API Key (Free)
1. Visit [console.groq.com](https://console.groq.com/)
2. Sign up for free account
3. Create API key

### Step 3: Configure Environment
```bash
# Copy example env file
cp .env.example .env

# Edit and add your API key
# Windows: notepad .env
# macOS/Linux: nano .env
```

Add your API key:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### Step 4: Run Eloquent
```bash
npm start
```

## 🎤 How to Use

### Standard Voice-to-Text
1. Press `Alt+Space` (Windows) or `⌥+Space` (macOS)
2. Speak clearly
3. Press `Esc` to stop
4. Text appears at your cursor! ✨

### AI Rewrite Mode (Smart Enhancement)
1. Press `Alt+Shift+Space` (Windows) or `⌥+⇧+Space` (macOS)
2. Speak your rough thoughts (don't worry about grammar)
3. Press `Esc` to stop
4. AI cleans up and rewrites your text professionally! 🤖

## 🎯 Quick Tips

### For Best Results
- Speak at normal conversational pace
- Use quiet environment
- Say punctuation: "period", "comma", "question mark"
- Keep recordings under 2 minutes

### Keyboard Shortcuts
- `Alt+Space` - Start recording
- `Alt+Shift+Space` - Start AI rewrite
- `Esc` - Stop recording
- `Ctrl+Shift+D` (Windows) / `⌘+⇧+D` (macOS) - Open dashboard

## 🔧 Platform-Specific Setup

### Windows
**Optional:** Install Sox for best audio quality
```bash
choco install sox
```
If you don't have Chocolatey:
1. Download Sox from [SourceForge](https://sourceforge.net/projects/sox/)
2. Install and add to PATH

### macOS
**Required:** Install Sox
```bash
brew install sox
```

**Optional:** Enable auto-paste
1. Open System Settings
2. Privacy & Security > Accessibility
3. Add Electron/Eloquent
4. Restart app

### Linux
**Required:** Install Sox
```bash
# Ubuntu/Debian
sudo apt-get install sox

# RedHat/CentOS
sudo yum install sox
```

**Optional:** Install xdotool for auto-paste
```bash
sudo apt-get install xdotool
```

## 🐛 Troubleshooting

### Recording doesn't start
**Check:** Is Sox installed?
```bash
# Windows
sox --version

# macOS/Linux
which sox
```

### No audio captured
**Check:** Microphone permissions
- **Windows:** Settings > Privacy > Microphone
- **macOS:** System Settings > Privacy & Security > Microphone
- **Linux:** Check PulseAudio/ALSA settings

### Auto-paste doesn't work
**Don't worry!** Text is always copied to clipboard.
- **Windows:** Press `Ctrl+V` to paste
- **macOS:** Press `Cmd+V` to paste

### API Key errors
**Check:** 
1. Is your .env file in the correct location?
2. Is there a space before or after the API key?
3. Visit [console.groq.com](https://console.groq.com/) to verify key

## 📦 Building for Distribution

### Build Windows Installer
```bash
npm run build:win
```

### Build macOS App
```bash
npm run build:mac
```

### Build Both
```bash
npm run build:all
```

Output files will be in the `dist/` folder.

## 🆘 Need Help?

### Documentation
- **Full Guide:** `README.md`
- **Windows Setup:** `WINDOWS_SETUP.md`
- **Technical Details:** `CROSS_PLATFORM_FIXES_SUMMARY.md`

### Community
- **Issues:** [GitHub Issues](https://github.com/hritthikroy/Eloquent/issues)
- **Discussions:** Check GitHub Discussions

## 🎉 You're Ready!

Press `Alt+Space` and start talking!

**Pro Tip:** Try AI Rewrite mode (`Alt+Shift+Space`) for taking quick notes or brainstorming. It's like having an AI assistant that cleans up your thoughts!

---

*Made with ❤️ for seamless voice-to-text transcription*
