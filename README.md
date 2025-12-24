# Eloquent

Professional voice-to-text desktop application with AI-powered transcription and smart rewriting.

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🎤 **Voice Recording** - High-quality audio capture with one-click recording
- 🤖 **AI Transcription** - Powered by Groq's Whisper API for accurate speech-to-text
- ✨ **Smart Rewrite** - AI-powered text enhancement and grammar correction
- 📋 **Auto-Paste** - Automatically paste transcribed text to any application
- 🔐 **Google OAuth** - Secure authentication with Google accounts
- 💳 **Subscription Plans** - Free, Pro, and Enterprise tiers
- 🌐 **Cloud Backend** - Reliable Go backend hosted on Heroku
- 🖥️ **Cross-Platform** - Available for macOS (Apple Silicon) and Windows

## Download

Download the latest release from [GitHub Releases](https://github.com/hritthikroy/Eloquent/releases).

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `Eloquent-2.1.0-mac-arm64.dmg` |
| Windows 10/11 | `Eloquent-2.1.0-win-x64.exe` |

## Requirements

### macOS
- macOS 10.15 (Catalina) or later
- Apple Silicon (M1/M2/M3) Mac
- [Sox](https://sox.sourceforge.net/) for audio recording: `brew install sox`

### Windows
- Windows 10 or later (64-bit)
- Sox for audio recording (included in installer or install separately)

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
| `Alt+Shift+Space` | Start AI rewrite mode |
| `ESC` | Stop recording |

## Development Setup

```bash
# Clone the repository
git clone https://github.com/hritthikroy/Eloquent.git
cd Eloquent

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
```

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
