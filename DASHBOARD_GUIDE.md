# Eloquent Dashboard Guide

## 🎯 What is the Dashboard?

The dashboard is your control center for Eloquent. It's where you:
- Configure your API key
- View transcription history
- Adjust settings
- Monitor API usage

## 📱 How to Open the Dashboard

### Method 1: Menu Bar Icon (Easiest)
1. Look for the **microphone icon** 🎤 in your Mac menu bar (top right)
2. Click the icon
3. Select **"Open Dashboard"**

### Method 2: First Launch
- The dashboard opens automatically the first time you run the app
- After that, it stays closed until you need it

### Method 3: From Tray Menu
1. Click the microphone icon in menu bar
2. Menu appears with options:
   - 🎤 Eloquent Voice Dictation
   - **Open Dashboard** ← Click this
   - Start AI Rewrite (Alt+Shift+Space)
   - Start Standard (Alt+Space)
   - Settings
   - Quit Eloquent

## 🎨 Dashboard Layout

```
┌─────────────────────────────────────────┐
│  Eloquent - Voice to Text              │
├─────────────────────────────────────────┤
│                                         │
│  ⚙️ SETTINGS                            │
│  ├─ API Keys (up to 5)                 │
│  ├─ Language Selection                 │
│  ├─ AI Mode (QN/Code/Grammar)          │
│  ├─ Custom Dictionary                  │
│  └─ Preferences                        │
│                                         │
│  📊 API USAGE                           │
│  ├─ Daily Usage Chart                  │
│  ├─ Time Used per Key                  │
│  └─ Remaining Credits                  │
│                                         │
│  📝 HISTORY                             │
│  ├─ Recent Transcriptions              │
│  ├─ Search & Filter                    │
│  └─ Copy/Delete Options                │
│                                         │
│  ℹ️ SHORTCUTS                           │
│  ├─ Alt+Space - Standard Mode          │
│  ├─ Alt+Shift+Space - AI Rewrite       │
│  └─ Esc - Stop Recording               │
│                                         │
└─────────────────────────────────────────┘
```

## ⚙️ Settings Tab

### 1. API Keys Configuration
**Location:** Top of Settings tab

**What it does:** Configure up to 5 Groq API keys for 200 minutes/day

**How to use:**
```
1. Get API key from: https://console.groq.com/keys
2. Click "Add API Key" or paste in Key 1 field
3. Click "Save Settings"
4. App automatically rotates between keys
```

**Tips:**
- Add multiple keys for more daily usage
- Each key gives 40 minutes/day
- 5 keys = 200 minutes/day total

### 2. Language Selection
**Location:** Below API keys

**Options:**
- English (en) - Default
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- And more...

**How to change:**
```
1. Click language dropdown
2. Select your language
3. Click "Save Settings"
```

### 3. AI Mode
**Location:** Middle of Settings tab

**Options:**
- **QN (Quick & Natural)** - Default, fast and accurate
- **Code** - Optimized for programming
- **Grammar** - Enhanced grammar correction

**When to use:**
- QN: General writing, emails, notes
- Code: Programming, technical docs
- Grammar: Formal writing, reports

### 4. Custom Dictionary
**Location:** Below AI Mode

**What it does:** Helps recognize specialized terms

**Example:**
```
VoicyClone, Eloquent, API, Groq, macOS, SwiftUI
```

**How to use:**
```
1. Type words separated by commas
2. Include: Names, brands, technical terms
3. Click "Save Settings"
```

### 5. Preferences
**Location:** Bottom of Settings tab

**Options:**
- ☐ Preserve Clipboard (slower but safer)
- ☑ Auto Grammar Fix (recommended)
- ☐ Enable Wake Word (experimental)

## 📊 API Usage Tab

### Daily Usage Chart
Shows how much API time you've used today

**Display:**
```
Key 1: ████████░░ 32/40 minutes
Key 2: ██░░░░░░░░ 8/40 minutes
Key 3: ░░░░░░░░░░ 0/40 minutes
```

**What it means:**
- Green bar: Usage for each key
- Numbers: Minutes used / Total available
- Resets daily at midnight

### Usage Statistics
- **Total Used Today:** 40 minutes
- **Remaining:** 160 minutes
- **Recordings Today:** 25
- **Average Length:** 5 seconds

## 📝 History Tab

### View Past Transcriptions
**What you see:**
- Timestamp
- Transcribed text
- Mode used (Standard/AI Rewrite)
- Duration

**Actions:**
```
[Copy] - Copy text to clipboard
[Delete] - Remove from history
[Clear All] - Delete all history
```

### Search & Filter
```
🔍 Search: [Type to search...]

Filter by:
☐ Standard Mode
☐ AI Rewrite Mode
☐ Today
☐ This Week
```

### History Details
Click any entry to see:
- Full transcription
- Original text (before AI processing)
- Timestamp
- Recording duration
- Mode used

## ℹ️ Shortcuts Tab

### Quick Reference
```
Alt+Space
  Start Standard Mode
  Fast transcription

Alt+Shift+Space
  Start AI Rewrite Mode
  Enhanced with grammar fixes

Esc
  Stop Recording
  Process and paste text
```

### Tips & Tricks
- Keep dashboard closed during normal use
- Open only when changing settings
- History syncs automatically
- Settings save instantly

## 🎯 Common Tasks

### Task 1: Add Your First API Key
```
1. Open dashboard (click menu bar icon)
2. Go to Settings tab
3. Paste API key in "Key 1" field
4. Click "Save Settings"
5. Close dashboard
6. Start using Alt+Space!
```

### Task 2: Check How Much Time You Have Left
```
1. Open dashboard
2. Click "API Usage" tab
3. See remaining minutes
4. Close dashboard
```

### Task 3: View Your Recent Transcriptions
```
1. Open dashboard
2. Click "History" tab
3. Scroll through entries
4. Click [Copy] to reuse text
```

### Task 4: Change AI Mode
```
1. Open dashboard
2. Go to Settings tab
3. Select AI Mode dropdown
4. Choose: QN, Code, or Grammar
5. Click "Save Settings"
```

### Task 5: Clear Old History
```
1. Open dashboard
2. Go to History tab
3. Click "Clear All History"
4. Confirm
```

## 🐛 Troubleshooting

### Dashboard Won't Open
**Solution:**
```bash
# Restart the app
1. Click menu bar icon
2. Select "Quit Eloquent"
3. Run: npm start
```

### Settings Not Saving
**Check:**
- API key is valid
- No special characters in dictionary
- Language code is correct

**Fix:**
```
1. Close dashboard
2. Reopen dashboard
3. Re-enter settings
4. Click "Save Settings"
```

### History Not Showing
**Possible causes:**
- No recordings made yet
- History file corrupted

**Fix:**
```bash
# Reset history
rm ~/Library/Application\ Support/eloquent/history.json

# Restart app
npm start
```

### API Usage Not Updating
**Solution:**
```
1. Make a test recording
2. Refresh dashboard (close and reopen)
3. Check API Usage tab
```

## 💡 Pro Tips

### Tip 1: Keep Dashboard Closed
The dashboard is for configuration only. Keep it closed during normal use for a cleaner workflow.

### Tip 2: Multiple API Keys
Add 5 keys for maximum daily usage (200 minutes). The app automatically rotates between them.

### Tip 3: Custom Dictionary
Add names, brands, and technical terms you use frequently for better recognition.

### Tip 4: History Search
Use the search box to quickly find past transcriptions.

### Tip 5: Keyboard Shortcuts
Memorize Alt+Space and Esc - you'll rarely need the dashboard!

## 📱 Dashboard Shortcuts

While dashboard is open:
- **Cmd+W** - Close dashboard
- **Cmd+Q** - Quit app
- **Tab** - Navigate between fields
- **Enter** - Save settings (when in input field)

## 🎨 Dashboard Customization

### Theme
Currently: Light mode only
Future: Dark mode coming soon

### Window Size
- Default: 900x600
- Minimum: 700x500
- Resizable: Yes
- Position: Remembers last position

## 📊 Understanding API Usage

### How It's Calculated
```
1 second of audio = ~1 second of API time
5 second recording = ~5 seconds used
```

### Daily Limits
```
1 API key = 40 minutes/day
2 API keys = 80 minutes/day
3 API keys = 120 minutes/day
4 API keys = 160 minutes/day
5 API keys = 200 minutes/day (maximum)
```

### When It Resets
- Resets at midnight (your local time)
- Usage counter starts at 0
- All keys refresh simultaneously

## 🔐 Privacy & Data

### What's Stored Locally
- API keys (encrypted)
- Transcription history
- Settings preferences
- Usage statistics

### What's Sent to API
- Audio recordings (temporary)
- Language preference
- Model selection

### What's NOT Stored
- Audio files (deleted after transcription)
- Personal information
- Location data

## 📚 Additional Resources

- **Quick Start:** See QUICK_START.md
- **How It Works:** See HOW_IT_WORKS.md
- **Build Guide:** See BUILD_GUIDE.md
- **Deployment:** See DEPLOY.md

## 🎉 You're Ready!

The dashboard is your control center. Open it when you need to:
- ⚙️ Configure settings
- 📊 Check usage
- 📝 View history
- ℹ️ See shortcuts

Otherwise, keep it closed and use Alt+Space for quick voice typing!
