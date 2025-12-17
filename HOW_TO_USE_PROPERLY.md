# How to Use Eloquent Properly

## ⚠️ Common Issue: "Recording too short"

### Why This Happens
You're pressing Esc too quickly! The app needs at least **1-2 seconds** of audio to transcribe.

## ✅ Correct Workflow

### Step-by-Step:

#### 1. Start Recording
```
Press: Alt+Space (Standard) or Alt+Shift+Space (AI)
Result: Recorder window opens with waveform
```

#### 2. WAIT and Speak (IMPORTANT!)
```
Wait: At least 2-3 seconds
Speak: Say your text clearly
Example: "This is a test of the voice recording system"
Watch: The timer shows 0:01, 0:02, 0:03...
```

#### 3. Stop Recording
```
Press: Esc
Result: Shows "Processing..."
Wait: 2-5 seconds for transcription
Result: Text pastes automatically!
```

## 🎯 Example Recording

### Good Example (Works!):
```
1. Press Alt+Space
2. Wait for recorder to open
3. Speak: "Hello world, this is a test" (3 seconds)
4. Press Esc
5. ✅ Text pastes: "Hello world, this is a test"
```

### Bad Example (Too Short!):
```
1. Press Alt+Space
2. Press Esc immediately (0.5 seconds)
3. ❌ Error: "Recording too short. Please speak longer."
4. ❌ No text pasted
```

## ⏱️ Timing Guide

### Minimum Recording Time:
- **Absolute minimum:** 1 second
- **Recommended:** 2-3 seconds
- **Optimal:** 3-5 seconds

### Why?
- Audio needs time to capture
- File needs to be written
- Whisper API needs enough audio to transcribe

## 🎤 Recording Tips

### 1. Watch the Timer
```
Timer shows: 0:00 → 0:01 → 0:02 → 0:03
Wait until at least 0:02 before pressing Esc
```

### 2. Watch the Waveform
```
Waveform should be animating
Bars should be moving up and down
This means audio is being captured
```

### 3. Speak Clearly
```
✅ Good: "This is a test"
✅ Good: "Hello world"
✅ Good: "Testing one two three"
❌ Bad: "Test" (too short)
❌ Bad: Pressing Esc immediately
```

## 🔧 Troubleshooting

### Issue 1: "Recording too short"
**Solution:** Speak for at least 2-3 seconds before pressing Esc

**Test:**
```
1. Press Alt+Space
2. Count: "One Mississippi, Two Mississippi, Three Mississippi"
3. Press Esc
4. Should work!
```

### Issue 2: "No API keys configured"
**Solution:** Add API key in Settings

**Steps:**
```
1. Open Dashboard
2. Click Settings
3. Add Groq API key (get free at console.groq.com)
4. Click Save Settings
5. Try recording again
```

### Issue 3: Text not pasting
**Solution:** Check Accessibility permissions

**Steps:**
```
1. System Settings → Privacy & Security
2. Accessibility
3. Enable Electron/Eloquent
4. Try recording again
```

## 📊 What You Should See

### During Recording:
```
Overlay Window:
- Timer: 0:00 → 0:01 → 0:02 → 0:03
- Waveform: Animating bars
- Recording pulse: Red dot pulsing
- Time left: Shows remaining time
```

### When Pressing Esc:
```
Overlay Window:
- Timer: "Processing..." (cyan color)
- Waveform: Stops
- Window: Stays open during processing
```

### After Processing:
```
Success:
- Text pastes in active app
- Success sound plays (Glass)
- Overlay closes
- Console: "✅ Recording completed successfully"

Error:
- Error dialog appears
- Error sound plays (Basso)
- Overlay closes after 2 seconds
- Console: "🔴 Recording error: ..."
```

## 🎯 Quick Reference

### Minimum Requirements:
- ✅ Speak for at least 2 seconds
- ✅ Have API key configured
- ✅ Have Accessibility permission
- ✅ Have Microphone permission

### Shortcuts:
- `Alt+Space` - Start Standard mode
- `Alt+Shift+Space` - Start AI Rewrite mode
- `Esc` - Stop recording (after 2+ seconds)

### Timing:
- Minimum: 1 second
- Recommended: 2-3 seconds
- Optimal: 3-5 seconds

## 💡 Pro Tips

### Tip 1: Count in Your Head
```
Press Alt+Space
Count: "One, two, three"
Press Esc
Works every time!
```

### Tip 2: Watch the Timer
```
Don't press Esc until timer shows at least 0:02
```

### Tip 3: Speak Naturally
```
Don't rush
Speak at normal pace
Let the audio capture properly
```

### Tip 4: Test First
```
Try a test recording:
"This is a test of the voice recording system"
This gives you 3-4 seconds of audio
Perfect for testing!
```

## ✅ Success Checklist

Before recording:
- [ ] API key configured in Settings
- [ ] Microphone permission granted
- [ ] Accessibility permission granted
- [ ] Know what you want to say

During recording:
- [ ] Recorder window opened
- [ ] Timer is counting (0:01, 0:02, 0:03...)
- [ ] Waveform is animating
- [ ] Spoke for at least 2-3 seconds

After pressing Esc:
- [ ] Saw "Processing..." message
- [ ] Waited for processing to complete
- [ ] Text pasted in active app
- [ ] Success sound played

## 🎉 Summary

**The Key:** Wait at least 2-3 seconds before pressing Esc!

**Workflow:**
1. Press shortcut → Start
2. Speak 2-3 seconds → Record
3. Press Esc → Stop
4. Wait → Process
5. Text pastes → Success!

**Remember:** The app needs time to capture audio. Don't rush!

---

**Version:** 2.3
**Date:** December 17, 2024
**Tip:** Speak for 2-3 seconds before pressing Esc!

