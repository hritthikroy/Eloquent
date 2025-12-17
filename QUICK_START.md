# VoicyClone - Quick Start Guide

## ✅ What's Fixed

1. **Audio recording now works properly** - Files are 300KB+ instead of 44 bytes
2. **Recording duration is accurate** - Shows actual time (e.g., "10618ms" for 10 seconds)
3. **Regex error fixed** - Post-processing no longer crashes
4. **No more duplicate processing** - Single Esc press works correctly

## 🎤 How to Use

### Simple 3-Step Process:

1. **Press `Alt+Space`** - Start recording (you'll see a small overlay window)
2. **Speak clearly** - Talk for 3-10 seconds
3. **Press `Esc`** - Stop and transcribe

The transcribed text will be automatically pasted where your cursor is!

### Two Modes:

- **`Alt+Space`** - Standard mode (fast, direct transcription)
- **`Alt+Shift+Space`** - AI Rewrite mode (slower, enhanced with grammar fixes)

## 🔧 Requirements

1. **Sox installed**: `brew install sox` (already done ✅)
2. **Microphone permission**: Granted ✅
3. **Accessibility permission**: Granted ✅
4. **API Key**: Configure in dashboard settings

## 📊 What You Should See

When recording works correctly:
```
🎤 Starting standard mode
📁 Audio file path: /var/folders/.../voicy-1765989724646.wav
🎵 Recording started
🛑 Stopping recording (Esc pressed)
⏱️ Recording duration: 10618ms
📊 Audio file size: 322026 bytes  ← Should be 100KB+
⏱️ Estimated duration: 10 seconds
🎤 Transcribing audio...
✅ Raw transcription: "..."
📋 Pasted text: "..."
```

## 🐛 Troubleshooting

### If text doesn't paste:
- Make sure you have a text field focused (cursor blinking)
- Check Accessibility permission in System Settings
- Try clicking in a text field first, then record

### If recording is empty:
- Check microphone input level in System Settings
- Speak louder and closer to the mic
- Make sure no other app is using the microphone

### If you see old test data:
- Open the dashboard
- Click "Clear History" to remove old test entries
- Or manually delete: `~/Library/Application Support/eloquent/history.json`

## 💡 Tips

1. **Speak naturally** - No need to shout or speak slowly
2. **Record 3-10 seconds** - Too short (<1s) will error, too long uses more API credits
3. **Use Standard mode** - It's faster and works great for most cases
4. **Check your cursor** - Make sure you're focused in a text field before recording

## 🎯 Next Steps

1. Configure your Groq API key in the dashboard
2. Test with a simple phrase: "This is a test of voice recording"
3. Try it in different apps: Notes, Messages, Email, etc.

## 📝 Notes

- Sox warning about sample rate (16000 → 48000) is normal and doesn't affect recording
- The app runs in the menu bar - look for the microphone icon
- History is saved automatically and syncs with the dashboard
