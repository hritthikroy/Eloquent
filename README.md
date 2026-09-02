# Eloquent

Professional voice-to-text desktop application with AI-powered transcription and smart rewriting.

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌐 Website

Visit the official website: **[Eloquent Landing Page](https://hritthikroy.github.io/Eloquent/)**

## Features

- 🎤 **Voice Recording** - High-quality audio capture with one-click recording (Windows/macOS/Linux)
- 🤖 **AI Transcription** - Powered by Groq's Whisper API for accurate speech-to-text
- ✨ **AI Rewrite Mode** - AI-powered text enhancement using Llama 3.3-70b (Alt+Shift+Space)
- 📋 **Auto-Paste** - Automatically paste transcribed text to any application (cross-platform)
- 🔐 **Google OAuth** - Secure authentication with Google accounts
- 💳 **Subscription Plans** - Free, Pro, and Enterprise tiers
- 🌐 **Cloud Backend** - Reliable Go backend hosted on Heroku
- 🖥️ **Cross-Platform** - Fully functional on Windows, macOS, and Linux
- 🎯 **Smart Enhancement** - Removes filler words, fixes grammar, improves clarity
- 🔊 **Sound Feedback** - Cross-platform audio notifications

## Download

Download the latest release from [GitHub Releases](https://github.com/hritthikroy/Eloquent/releases).

| Platform | File | Architecture |
|----------|------|--------------|
| macOS (Apple Silicon) | `Eloquent-2.1.0-mac-arm64.dmg` | ARM64 (M1/M2/M3) |
| Windows 10/11 | `Eloquent-2.1.0-win-x64.exe` | x64 (64-bit) |
| Windows ARM | `Eloquent-2.1.0-win-arm64.exe` | ARM64 |

**New in v2.1.0:**
- ✅ Full Windows support with native audio recording
- ✅ Cross-platform auto-paste (Windows/macOS/Linux)
- ✅ AI Rewrite mode with Llama 3.3-70b
- ✅ Enhanced error handling and platform detection

## Requirements

### Windows
- Windows 10 or later (64-bit)
- **Optional:** Sox for enhanced audio recording - `choco install sox`
- All audio recording methods have automatic fallbacks

### macOS
- macOS 10.15 (Catalina) or later
- Apple Silicon (M1/M2/M3) or Intel Mac
- [Sox](https://sox.sourceforge.net/) for audio recording: `brew install sox`

### Linux
- Any modern Linux distribution
- Sox for audio recording: `sudo apt-get install sox` (Ubuntu/Debian)
- Optional: xdotool for auto-paste: `sudo apt-get install xdotool`

## Quick Start

1. Download the installer for your platform
2. Install the application
3. Sign in with your Google account
4. Press `Alt+Space` to start recording
5. Press `ESC` to stop and transcribe

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Space` | Start/Stop standard recording |
| `Alt+Shift+Space` | Start AI rewrite mode ✨ |
| `ESC` | Stop recording |
| `Ctrl+Shift+D` (Win) / `Cmd+Shift+D` (Mac) | Open Dashboard |

**Note:** On macOS, use `Option` instead of `Alt` and `Command` instead of `Ctrl`

## Quick Start

```bash
# Clone the repository
git clone https://github.com/hritthikroy/Eloquent.git
cd Eloquent/EloquentElectron

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env
# Edit .env with your API keys

# Run in development mode
npm run dev

# Build for production
npm run build:mac-arm64  # macOS Apple Silicon
npm run build:win        # Windows
npm run build:all        # Both platforms
```

**For detailed Windows setup instructions, see [WINDOWS_SETUP.md](WINDOWS_SETUP.md)**

**For a 5-minute quick start, see [QUICK_START.md](QUICK_START.md)**

## Environment Variables

Create a `.env` file with:

```env
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ELOQUENT_API_URL=your_backend_url
```

## Tech Stack

- **Frontend**: Electron, HTML/CSS/JavaScript
- **Backend**: Go (Golang)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with Google OAuth
- **AI**: Groq Whisper API
- **Hosting**: Heroku

## Project Structure

```
EloquentElectron/
├── src/                 # Electron app source
│   ├── main.js         # Main process
│   ├── preload.js      # Preload scripts
│   ├── ui/             # UI components
│   ├── services/       # Business logic
│   └── utils/          # Utilities
├── backend-go/         # Go backend
├── build/              # Build resources (icons)
├── dist/               # Built applications
└── docs/               # Documentation
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Created by [Hritthik Roy](https://github.com/hritthikroy)

---

*Eloquent - Transform your voice into text, effortlessly.*
