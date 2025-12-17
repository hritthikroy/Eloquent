# Testing Guide - Voice Recognition Improvements

## Quick Start

### 1. Install/Update Dependencies
```bash
cd VoicyCloneElectron
npm install
```

### 2. Verify Sox Installation
```bash
# Check if sox is installed
which sox

# If not installed:
brew install sox
```

### 3. Run the Application
```bash
npm start
```

## Testing Scenarios

### Test 1: Basic Recognition
**Goal:** Verify basic transcription works

1. Press `D` twice quickly (double-tap)
2. Say: "Hello, this is a test of the voice recognition system"
3. Press `D` twice to stop
4. **Expected:** Text appears with proper capitalization and punctuation

### Test 2: Common Error Words
**Goal:** Test post-processing corrections

1. Start recording (double-tap `D`)
2. Say: "Can you make this recognizer very smooth and recognize voice perfectly"
3. Stop recording
4. **Expected:** All words correctly spelled (not "recognigar", "vary", "parfectly")

### Test 3: Grammar Fix
**Goal:** Test auto grammar correction

1. Ensure `autoGrammarFix` is enabled in settings
2. Start recording
3. Say: "um like you know this is uh basically a test"
4. Stop recording
5. **Expected:** Filler words removed, proper grammar

### Test 4: Incomplete Sentences
**Goal:** Test sentence completion

1. Enable auto grammar fix
2. Start recording
3. Say: "if has some sentence missing fix properly"
4. Stop recording
5. **Expected:** "If it has some sentences missing, fix it properly."

### Test 5: Rewrite Mode
**Goal:** Test AI enhancement

1. Press `⌥D` (Option+D)
2. Say: "make the voice recognition work better and fix all the errors"
3. Stop recording
4. **Expected:** Professional, polished output

### Test 6: Technical Terms
**Goal:** Test custom dictionary

1. Open Dashboard → Settings
2. Add to custom dictionary: "API, database, authentication, React, TypeScript"
3. Start recording
4. Say: "I need to authenticate the API using React and TypeScript"
5. Stop recording
6. **Expected:** All technical terms correctly capitalized

### Test 7: Long Recording
**Goal:** Test extended recording

1. Start recording
2. Speak for 30+ seconds continuously
3. Stop recording
4. **Expected:** Complete transcription with proper punctuation

### Test 8: Quiet Speech
**Goal:** Test audio enhancement

1. Start recording
2. Speak quietly/softly
3. Stop recording
4. **Expected:** Still recognizes words (audio normalization working)

### Test 9: Fast Speech
**Goal:** Test with rapid speech

1. Start recording
2. Speak quickly without pauses
3. Stop recording
4. **Expected:** Accurate transcription despite speed

### Test 10: Accented Speech
**Goal:** Test with different accents

1. Start recording
2. Speak with your natural accent
3. Stop recording
4. **Expected:** Accurate recognition regardless of accent

## Troubleshooting Tests

### If Recognition is Poor:

**Test A: Check Audio Quality**
```bash
# Record a test file manually
rec -r 16000 -c 1 -b 16 test.wav

# Play it back
play test.wav

# Should sound clear and loud enough
```

**Test B: Check API Key**
1. Open Dashboard → Settings
2. Verify API key is valid
3. Check API usage (should show requests)

**Test C: Check Microphone Permission**
1. System Settings → Privacy & Security → Microphone
2. Ensure Electron/VoicyClone is enabled

**Test D: Test with Different Modes**
- Standard mode (double-tap D): Fast, basic
- Rewrite mode (⌥D): Slower, better quality
- With auto grammar: Medium speed, good quality

## Performance Benchmarks

### Expected Timings:
- **Recording start:** Instant
- **Recording stop:** Instant
- **Transcription:** 1-3 seconds
- **Post-processing:** <100ms
- **Auto grammar fix:** +2-3 seconds
- **Rewrite mode:** +3-5 seconds

### Expected Accuracy:
- **Clear speech:** 95-98%
- **Casual speech:** 90-95%
- **With grammar fix:** 98-99%
- **Rewrite mode:** 99%+

## Comparison Test

### Before vs After:
Record the same phrase twice and compare:

**Test Phrase:**
"Can you make this recognizer very smooth and recognize voice perfectly if it has some sentences missing fix it properly"

**Before improvements:**
- Likely errors: recognigar, vary, parfectly, tha, sentance
- Missing punctuation
- No capitalization

**After improvements:**
- All words correct
- Proper punctuation
- Proper capitalization
- Complete sentences

## Advanced Testing

### Test Custom Dictionary:
1. Add problematic words to dictionary
2. Record using those words
3. Verify they're recognized correctly

### Test Different Languages:
1. Change language in settings
2. Record in that language
3. Verify transcription

### Test API Key Rotation:
1. Add multiple API keys
2. Make several recordings
3. Verify it switches keys automatically

## Reporting Issues

If you find issues, note:
1. What you said
2. What was transcribed
3. What you expected
4. Which mode you used
5. Any error messages

## Success Criteria

✅ All 10 basic tests pass
✅ Accuracy >95% for clear speech
✅ No crashes or errors
✅ Fast response time (<5 seconds total)
✅ Proper punctuation and capitalization
✅ Common errors automatically fixed

## Next Steps

After testing:
1. Adjust settings based on your needs
2. Add your common words to dictionary
3. Choose preferred mode (standard vs rewrite)
4. Enable/disable auto grammar fix
5. Enjoy improved voice recognition!
