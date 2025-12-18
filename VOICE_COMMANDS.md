# 🎤 Voice Commands Feature

## Overview
Control Eloquent hands-free using voice commands! Say "come" to start recording and "stop" to stop and paste.

## How to Use

### 1. Enable Voice Commands
Press **⌥V** (Option + V) or click "🎤 Toggle Voice Commands" in the menu bar

You'll see a 🎤 icon in the menu bar when voice commands are active.

### 2. Start Recording
Simply say: **"come"**

The app will start recording your voice automatically.

### 3. Stop Recording
Say: **"stop"**

The recording will stop and the transcribed text will be pasted automatically.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **⌥V** | Toggle voice commands on/off |
| **⌥D** | Manual recording (keyboard) |
| **⌥⇧D** | Manual recording with AI rewrite |

## How It Works

1. **Continuous Listening**: When enabled, the app continuously listens for your voice commands
2. **Smart Detection**: Uses Groq Whisper API to accurately detect "come" and "stop" commands
3. **Low Latency**: Processes commands quickly with minimal delay
4. **Background Operation**: Works in the background while you use other apps

## Customization

You can customize the voice commands in `main.js`:

```javascript
const CONFIG = {
  enableVoiceCommands: true,
  startCommand: 'come',    // Change to your preferred start word
  stopCommand: 'stop',     // Change to your preferred stop word
  commandListenTimeout: 30 // Seconds to listen
};
```

## Tips for Best Results

✅ **Speak clearly** - Enunciate the commands clearly
✅ **Quiet environment** - Works best in low-noise environments
✅ **Wait for confirmation** - The overlay will appear when recording starts
✅ **Natural speech** - No need to pause between command and speech

## Troubleshooting

**Commands not detected?**
- Make sure microphone permission is granted
- Check that voice commands are enabled (🎤 icon visible)
- Speak louder or closer to the microphone
- Try saying the command more clearly

**Recording doesn't start?**
- Wait a moment after saying "come"
- Make sure you're not already recording
- Check the console for error messages

**Recording doesn't stop?**
- Say "stop" clearly and wait a moment
- You can also press ⌥D to manually stop
- Check that the overlay window is visible

## Privacy

- Voice commands are processed using Groq's Whisper API
- Only short audio clips (2-3 seconds) are sent for command detection
- Your full recording is only processed when you say "stop"
- No audio is stored permanently

## API Usage

Voice commands use minimal API credits:
- ~0.1 seconds per command check
- Approximately 1-2 minutes of API time per hour of active listening
- Your 40 min/day limit is more than enough for all-day use

---

**Enjoy hands-free voice transcription! 🎤✨**
