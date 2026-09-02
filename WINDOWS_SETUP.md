# Eloquent for Windows - Setup Guide

## 🎤 Welcome to Eloquent

Eloquent is a professional voice-to-text desktop application with AI-powered transcription and smart rewriting. This guide will help you set up and use Eloquent on Windows.

## 📋 Prerequisites

### Required
- **Windows 10 or later** (64-bit)
- **Node.js 16+** - Download from [nodejs.org](https://nodejs.org/)
- **Groq API Key** - Get free at [console.groq.com](https://console.groq.com/)

### Optional (for best experience)
- **Sox for Windows** - For audio recording
  - Option 1: Using Chocolatey: `choco install sox`
  - Option 2: Download from [SourceForge](https://sourceforge.net/projects/sox/)
  
> **Note:** Eloquent includes fallback audio recording methods if Sox is not installed.

## 🚀 Installation

### Option 1: Download Pre-built Installer (Recommended)

1. Download the latest Windows installer from [GitHub Releases](https://github.com/hritthikroy/Eloquent/releases)
2. Run `Eloquent-2.1.0-win-x64.exe`
3. Follow the installation wizard
4. Launch Eloquent from Start Menu or Desktop

### Option 2: Build from Source

```bash
# 1. Clone the repository
git clone https://github.com/hritthikroy/Eloquent.git
cd Eloquent/EloquentElectron

# 2. Install dependencies
npm install

# 3. Create .env file
copy .env.example .env

# 4. Edit .env and add your API keys
notepad .env

# 5. Run in development mode
npm run dev

# 6. Or build for Windows
npm run build:win
```

## ⚙️ Configuration

### 1. Environment Variables

Create a `.env` file in the EloquentElectron directory:

```env
# Groq API Key (Required)
GROQ_API_KEY=your_groq_api_key_here

# Supabase Configuration (Optional - for cloud features)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend API URL (Optional)
ELOQUENT_API_URL=your_backend_url

# AI Settings
AI_MODE=auto
LANGUAGE=en
AUTO_GRAMMAR_FIX=true
PRESERVE_CLIPBOARD=false
```

### 2. Get a Groq API Key

1. Visit [console.groq.com](https://console.groq.com/)
2. Sign up for a free account
3. Navigate to API Keys
4. Create a new API key
5. Copy and paste it into your `.env` file

## 🎯 Features

### Standard Recording (Alt+Space)
- Press `Alt+Space` to start recording
- Speak naturally
- Press `Esc` to stop and transcribe
- Text is automatically pasted at your cursor position

### AI Rewrite Mode (Alt+Shift+Space)
- Press `Alt+Shift+Space` to start AI rewrite recording
- Speak your rough thoughts or notes
- Press `Esc` to stop
- AI will enhance and rewrite your text professionally

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Space` | Start/Stop standard recording |
| `Alt+Shift+Space` | Start AI rewrite mode |
| `Esc` | Stop recording |
| `Ctrl+Shift+D` | Open Dashboard |

## 🔧 Windows-Specific Features

### Auto-Paste
Eloquent automatically pastes transcribed text at your cursor position on Windows using:
- **RobotJS** - Direct keyboard simulation
- **PowerShell SendKeys** - Fallback method

If auto-paste doesn't work, text is always copied to clipboard. Press `Ctrl+V` to paste manually.

### Sound Feedback
Windows system sounds are used for:
- Start recording
- Success (transcription complete)
- Error notifications

### Audio Recording
Three methods are attempted in order:
1. **node-record-lpcm16** with Sox (best quality)
2. **node-record-lpcm16** without Sox (good quality)
3. **PowerShell audio** (fallback)

## 📝 Usage Tips

### Best Practices
1. **Speak clearly** at a normal pace
2. **Use punctuation commands**: "period", "comma", "question mark"
3. **Pause briefly** before starting and after finishing
4. **Use AI Rewrite mode** for quick note-taking - it cleans up filler words

### AI Modes
Eloquent supports two AI enhancement modes:

#### Auto Mode (Default)
- Intelligently detects content type
- Applies appropriate level of enhancement
- Removes filler words (um, uh, like)
- Fixes grammar and punctuation

#### Grammar Mode
- Light touch correction only
- Preserves your speaking style
- Fixes spelling and grammar
- Adds proper punctuation

Change mode in Dashboard > Settings

## 🐛 Troubleshooting

### Recording doesn't start
1. **Check microphone permissions**: Settings > Privacy > Microphone
2. **Install Sox**: `choco install sox` or download from SourceForge
3. **Check console**: Press `Ctrl+Shift+I` in Eloquent to see error messages

### Auto-paste doesn't work
1. Text is always copied to clipboard - press `Ctrl+V` to paste
2. Try running Eloquent as Administrator
3. Check if other apps are blocking keyboard input

### No sound feedback
1. Check Windows sound settings
2. Ensure system sounds are not muted
3. This is normal - sound is optional

### API Key errors
1. Verify your Groq API key is correct in `.env`
2. Check your Groq account has credits
3. Ensure no extra spaces in the API key

### Build errors
If you encounter build errors when installing dependencies:

```bash
# Install Windows Build Tools
npm install --global windows-build-tools

# Or install Visual Studio Build Tools manually
# Download from: https://visualstudio.microsoft.com/downloads/

# Then reinstall dependencies
npm install
```

## 🏗️ Building for Distribution

### Create Windows Installer

```bash
# Build NSIS installer and portable exe
npm run build:win

# Output files in dist/ folder:
# - Eloquent-2.1.0-win-x64.exe (NSIS installer)
# - Eloquent-2.1.0-win-x64-portable.exe (Portable)
```

### Build Options

```bash
# x64 (64-bit) - Default
npm run build:win-x64

# ARM64 (for ARM Windows devices)
npm run build:win-arm64

# Both macOS and Windows
npm run build:all
```

## 🔐 Privacy & Security

- **All audio processing** happens locally on your device
- **Transcription** is sent to Groq's servers (encrypted HTTPS)
- **AI rewriting** uses Groq's Llama model (also encrypted)
- **No audio files** are stored permanently
- **No data** is shared with third parties
- **Optional cloud features** require Supabase account

## 📊 System Requirements

### Minimum
- Windows 10 (64-bit)
- 2 GB RAM
- 500 MB disk space
- Internet connection (for API calls)

### Recommended
- Windows 11 (64-bit)
- 4 GB RAM
- 1 GB disk space
- Broadband internet

## 🆘 Support

- **GitHub Issues**: [Report a bug](https://github.com/hritthikroy/Eloquent/issues)
- **Documentation**: Check README.md for more details
- **Email**: Contact the developer through GitHub

## 📜 License

MIT License - See LICENSE file for details

## 🙏 Credits

- Created by [Hritthik Roy](https://github.com/hritthikroy)
- Powered by [Groq](https://groq.com/) - Lightning-fast AI inference
- Built with [Electron](https://www.electronjs.org/)
- Icons and design inspired by macOS

---

**Happy Transcribing! 🎤✨**
