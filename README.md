# VoicyClone (Electron Version)

Voice-to-text macOS application with AI-powered grammar correction - **No Xcode Required!**

## Prerequisites

1. **Node.js** - Install via Homebrew:
   ```bash
   brew install node
   ```

2. **SoX** (Sound eXchange) - For audio recording:
   ```bash
   brew install sox
   ```

3. **Groq API Key** - Get free at https://console.groq.com

## Installation

```bash
cd VoicyCloneElectron
npm install
```

## Configuration

Edit `main.js` and add your Groq API key:
```javascript
const CONFIG = {
  apiKey: 'gsk_your_api_key_here',
  language: 'en'
};
```

Or configure it in the Dashboard Settings after running the app.

## Running

```bash
npm start
```

## Usage

- **⌥D (Option + D)** - Start/stop standard transcription
- **⌥⇧D (Option + Shift + D)** - Start/stop with AI grammar correction
- **Esc** - Cancel recording

## Features

- 🎤 Voice-to-text transcription using Groq Whisper API
- ✨ AI-powered grammar correction (Rewrite Mode)
- 📋 Auto-paste to active application
- 🎨 Beautiful glass-morphic overlay
- 🌙 Dark mode support

## Building for Distribution

```bash
npm run build
```

Output: `dist/VoicyClone-1.0.0.dmg`
