# 🚀 Getting Started with Eloquent

## What is Eloquent?

**Eloquent** is a professional voice-to-text app for Mac that runs silently in your menu bar. Press a shortcut, speak, and your words appear as text!

## ✨ New Name!

Previously called "VoicyClone", now rebranded as **Eloquent** - a cleaner, more professional name that reflects the elegance of voice-to-text.

## 🎯 Quick Setup (3 Steps)

### Step 1: Get Your API Key
1. Go to https://console.groq.com/keys
2. Sign up (free)
3. Create an API key
4. Copy it

### Step 2: Open Dashboard
1. Look for microphone icon 🎤 in menu bar
2. Click it
3. Select "Open Dashboard"

### Step 3: Add API Key
1. Paste your API key in "Key 1" field
2. Click "Save Settings"
3. Close dashboard

**Done!** You're ready to use Eloquent!

## 🎤 How to Use

### Basic Usage
```
1. Click in any text field (Notes, Email, Messages, etc.)
2. Press Alt+Space
3. Speak clearly: "This is a test message"
4. Press Esc
5. Your text appears!
```

### Two Modes

**Standard Mode** (Alt+Space)
- Fast and accurate
- Direct transcription
- Best for most uses

**AI Rewrite Mode** (Alt+Shift+Space)
- Enhanced with AI
- Grammar corrections
- Better for formal writing

## 📱 Finding the Dashboard

### Where is it?

The dashboard is **hidden by default**. This keeps your workspace clean!

### How to Open It

**Method 1: Menu Bar** (Easiest)
```
1. Look at top-right of your screen
2. Find microphone icon 🎤
3. Click it
4. Select "Open Dashboard"
```

**Method 2: First Launch**
- Opens automatically when you first start the app
- After that, stays closed until you need it

### What's in the Dashboard?

```
┌─────────────────────────┐
│  ⚙️ Settings            │
│  - API Keys             │
│  - Language             │
│  - AI Mode              │
│  - Preferences          │
├─────────────────────────┤
│  📊 API Usage           │
│  - Daily limits         │
│  - Time remaining       │
├─────────────────────────┤
│  📝 History             │
│  - Past transcriptions  │
│  - Search & copy        │
├─────────────────────────┤
│  ℹ️ Shortcuts           │
│  - Quick reference      │
└─────────────────────────┘
```

## 🎨 Visual Guide

### Menu Bar Icon
```
┌─────────────────────────────────────┐
│  🔋 🔊 🎤 ⏰                        │  ← Look here!
└─────────────────────────────────────┘
         ↑
    Eloquent icon
```

### Click the Icon
```
┌─────────────────────────────┐
│ 🎤 Eloquent Voice Dictation │
├─────────────────────────────┤
│ Open Dashboard          ⌘D  │  ← Click this!
├─────────────────────────────┤
│ Start AI Rewrite   ⌥⇧Space  │
│ Start Standard     ⌥Space    │
├─────────────────────────────┤
│ 💡 Tip: Press Esc to stop   │
├─────────────────────────────┤
│ Settings                    │
│ Quit Eloquent               │
└─────────────────────────────┘
```

### Dashboard Opens
```
┌──────────────────────────────────────┐
│  Eloquent - Voice to Text       ⊗ ⊖ ⊕│
├──────────────────────────────────────┤
│  [Settings] [API Usage] [History]    │
├──────────────────────────────────────┤
│                                      │
│  ⚙️ API Key Configuration            │
│  ┌────────────────────────────────┐ │
│  │ Key 1: gsk_xxxxxxxxxxxxx       │ │
│  └────────────────────────────────┘ │
│                                      │
│  🌍 Language: [English ▼]           │
│                                      │
│  🤖 AI Mode: [QN - Quick & Natural] │
│                                      │
│  [Save Settings]                     │
│                                      │
└──────────────────────────────────────┘
```

## 🎯 Common Questions

### Q: Where's the dashboard?
**A:** Click the microphone icon 🎤 in your menu bar (top-right), then select "Open Dashboard"

### Q: Do I need to keep the dashboard open?
**A:** No! Close it after setup. The app works from the menu bar.

### Q: How do I use it?
**A:** Press Alt+Space, speak, press Esc. That's it!

### Q: Where does the text go?
**A:** It's pasted wherever your cursor is (any text field)

### Q: Can I see my past transcriptions?
**A:** Yes! Open dashboard → History tab

## 📚 Detailed Guides

- **Dashboard Guide:** See `DASHBOARD_GUIDE.md` for complete dashboard documentation
- **How It Works:** See `HOW_IT_WORKS.md` for detailed usage
- **Quick Start:** See `QUICK_START.md` for technical details
- **Build Guide:** See `BUILD_GUIDE.md` for building from source

## 🎉 You're All Set!

Remember:
1. **Dashboard** = Settings & history (open when needed)
2. **Menu bar** = Always running (invisible)
3. **Alt+Space** = Start recording
4. **Esc** = Stop and paste

Enjoy using Eloquent! 🎤✨

---

## 🆘 Need Help?

### Can't find menu bar icon?
- Look at the very top-right of your screen
- It's a small microphone icon 🎤
- If not visible, restart the app: `npm start`

### Dashboard won't open?
```bash
# Restart the app
1. Click menu bar icon
2. Select "Quit Eloquent"
3. Run: npm start
```

### Text not pasting?
- Make sure you clicked in a text field first
- Check Accessibility permission in System Settings
- Try clicking the text field again before recording

### No audio detected?
- Check microphone permission in System Settings
- Speak louder and closer to mic
- Make sure no other app is using the microphone

---

**Happy voice typing! 🚀**
