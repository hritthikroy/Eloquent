# 🚀 Multi-API Key System - 5 Keys = 200 Minutes/Day!

## ✅ Implementation Complete

Your VoicyClone app now supports **5 Groq API keys** for a total of **200 minutes per day** of recording time!

---

## 📊 How It Works

### **Before (Single Key)**
- ❌ 1 API key = 40 minutes/day
- ❌ Limited recording time

### **After (5 Keys)**
- ✅ 5 API keys = 200 minutes/day (40 min × 5)
- ✅ Automatic key rotation
- ✅ Smart usage tracking per key

---

## 🔑 Key Features

### **1. Automatic Key Rotation**
The app automatically switches between your API keys based on usage:
- Uses Key #1 until it hits 40 minutes
- Automatically switches to Key #2
- Continues through all 5 keys
- Resets daily at midnight

### **2. Smart Usage Tracking**
- Tracks time used per key
- Stores data in `api-usage.json`
- Resets automatically every day
- Shows real-time progress in dashboard

### **3. Beautiful Dashboard**
- See total time used across all keys
- Progress bar showing 0-200 minutes
- Color-coded key badges (KEY 1-5)
- Clear indication of daily limits

---

## 📝 How to Add Your API Keys

### **Step 1: Get API Keys**
1. Go to [console.groq.com](https://console.groq.com)
2. Create 5 different API keys
3. Copy each key (starts with `gsk_...`)

### **Step 2: Add to Settings**
1. Open VoicyClone Dashboard
2. Go to **Settings** section
3. Scroll to **🔑 API Configuration**
4. Paste your keys into the 5 input fields:
   - **KEY 1** (Required) - Your first API key
   - **KEY 2-5** (Optional) - Additional keys for more time

### **Step 3: Save**
- Click **Save Settings**
- You'll see a confirmation showing:
  - Number of keys configured
  - Total daily limit (e.g., "200 minutes")

---

## 💡 Usage Example

### **Scenario: You have 3 API keys**
```
KEY 1: gsk_abc123...
KEY 2: gsk_def456...
KEY 3: gsk_ghi789...
KEY 4: (empty)
KEY 5: (empty)
```

**Result:** 3 keys × 40 min = **120 minutes/day**

### **How It Rotates:**
1. **Morning (8 AM):** Use Key #1 for 40 minutes
2. **Afternoon (2 PM):** Key #1 exhausted → Switch to Key #2
3. **Evening (6 PM):** Key #2 exhausted → Switch to Key #3
4. **Night (10 PM):** Key #3 exhausted → All keys used for today
5. **Next Day (12 AM):** All keys reset → Start fresh with 120 minutes

---

## 📈 Dashboard Display

### **Recording Sessions Card**
Shows your daily usage:
```
🎙️ Recording Sessions
Track your daily recording sessions. With 5 API keys, you get 200 minutes/day total recording time.

SESSIONS TODAY: 12
TIME USED: 85 min

Daily Recording Time: 85 / 200 min
[████████░░░░░░░░░░░] 42.5% used
115 minutes remaining

Resets daily at: 12:00 AM (Midnight)
5 API Keys | 40 min each
```

---

## 🔧 Technical Details

### **Files Modified:**
1. **main.js**
   - Added `getActiveAPIKey()` - Selects key with available time
   - Added `trackAPIUsage()` - Tracks time per key
   - Updated all API calls to use dynamic key rotation
   - Changed `CONFIG.apiKey` → `CONFIG.apiKeys` (array)

2. **dashboard.html**
   - Added 5 API key input fields
   - Updated Recording Sessions to show 200 min limit
   - Enhanced save/load functions for multiple keys
   - Added visual key badges (KEY 1-5)

### **Data Storage:**
```json
{
  "date": "2025-12-17",
  "keys": [
    { "key": "gsk_abc123...", "timeUsed": 2400 },
    { "key": "gsk_def456...", "timeUsed": 1800 },
    { "key": "gsk_ghi789...", "timeUsed": 0 },
    { "key": "gsk_jkl012...", "timeUsed": 0 },
    { "key": "gsk_mno345...", "timeUsed": 0 }
  ]
}
```
*Time is stored in seconds (2400 sec = 40 min)*

---

## ⚠️ Important Notes

### **Daily Reset**
- All keys reset at **12:00 AM (Midnight)** local time
- Fresh 200 minutes available each day
- Usage data is stored locally in your app

### **Key Requirements**
- **Minimum:** 1 key required (40 min/day)
- **Maximum:** 5 keys supported (200 min/day)
- All keys must be from Groq API
- Keys can be added/removed anytime

### **Automatic Rotation**
- App automatically picks the key with most time remaining
- No manual switching needed
- Seamless transition between keys
- You won't notice when it switches!

---

## 🎯 Quick Start Checklist

- [ ] Get 5 Groq API keys from console.groq.com
- [ ] Open VoicyClone Dashboard → Settings
- [ ] Paste all 5 keys into the input fields
- [ ] Click "Save Settings"
- [ ] Verify you see "200 minutes" in the confirmation
- [ ] Start recording - enjoy 200 minutes/day! 🎉

---

## 🆘 Troubleshooting

### **Problem: "No API keys configured" error**
**Solution:** Add at least 1 API key in Settings

### **Problem: Still showing 40 minutes limit**
**Solution:** 
1. Make sure you saved settings
2. Restart the app
3. Check that keys are pasted correctly (no extra spaces)

### **Problem: Keys not rotating**
**Solution:**
1. Check `api-usage.json` in app data folder
2. Verify all keys are valid
3. Try restarting the app

---

## 🎊 Success!

You now have **5× more recording time**! 

**Before:** 40 min/day  
**After:** 200 min/day  
**Increase:** 500% 🚀

Enjoy unlimited productivity with VoicyClone!
