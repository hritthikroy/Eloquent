# Audio Recording Fixes

## Issues Fixed

### 1. **Empty Audio Files (44 bytes)**
**Problem:** Sox was recording but not capturing actual audio, resulting in files with only WAV headers (44 bytes).

**Root Cause:** Missing sample rate parameter in sox command.

**Fix:** Added `-r 16000` parameter to specify 16kHz sample rate (standard for speech recognition).

```javascript
// Before:
recordingProcess = spawn('rec', [
  '-c', '1',
  '-b', '16',
  audioFile,
  'trim', '0'
]);

// After:
recordingProcess = spawn('rec', [
  '-r', '16000',  // ✅ Added sample rate
  '-c', '1',
  '-b', '16',
  audioFile,
  'trim', '0'
]);
```

### 2. **Recording Duration Always 0ms**
**Problem:** Recording duration was always showing as 0ms or very short times.

**Root Cause:** Local variable `recordingStartTime` in `stopRecording()` was shadowing the global variable, so it was measuring from the stop time instead of the start time.

**Fix:** Removed the local variable declaration and used the global `recordingStartTime` that's set in `startRecording()`.

```javascript
// Before:
async function stopRecording() {
  isProcessing = true;
  const recordingStartTime = Date.now();  // ❌ Wrong - creates new variable
  const actualRecordingTime = Date.now() - recordingStartTime;  // Always ~0ms
}

// After:
async function stopRecording() {
  isProcessing = true;
  // Use global recordingStartTime set in startRecording()
  const actualRecordingTime = Date.now() - recordingStartTime;  // ✅ Correct
}
```

### 3. **Multiple "Already Processing" Warnings**
**Problem:** Pressing Esc multiple times caused repeated "Already processing recording" messages.

**Root Cause:** The shortcut handler wasn't checking if recording was already being processed.

**Fix:** Added `isProcessing` check to the stop action handler.

```javascript
// Before:
if (overlayWindow && !overlayWindow.isDestroyed() && recordingProcess) {
  stopRecording();
}

// After:
if (overlayWindow && !overlayWindow.isDestroyed() && recordingProcess && !isProcessing) {
  stopRecording();
} else if (isProcessing) {
  console.log('⚠️ Already processing recording');
}
```

### 4. **File Size Checks Too Lenient**
**Problem:** Files with only headers (44 bytes) or minimal data (< 500 bytes) were being processed, leading to transcription errors.

**Fix:** Increased minimum file size requirement to 10KB to ensure meaningful audio content.

```javascript
// Before:
if (stats.size < 500) {
  throw new Error('No audio detected. Please try again.');
}

// After:
if (stats.size < 10000) {  // ✅ 10KB minimum
  throw new Error('Recording too short or empty. Please speak longer and louder.');
}
```

### 5. **Insufficient Wait Time After Recording**
**Problem:** File was being checked before sox finished writing all audio data.

**Fix:** Increased wait time from 500ms to 1000ms to ensure sox completes file writing.

```javascript
// Before:
await new Promise(r => setTimeout(r, 500));

// After:
await new Promise(r => setTimeout(r, 1000));  // ✅ Longer wait
```

### 6. **Missing isProcessing Reset on Early Return**
**Problem:** If recording was too short, `isProcessing` flag wasn't reset, blocking future recordings.

**Fix:** Added `isProcessing = false` before early returns.

```javascript
if (actualRecordingTime < 1000) {
  // ... error handling ...
  isProcessing = false;  // ✅ Reset flag
  return;
}
```

## Testing Instructions

1. **Start the app:**
   ```bash
   npm start
   ```

2. **Test recording:**
   - Press `Alt+Space` to start recording
   - Speak clearly for 3-5 seconds
   - Press `Esc` to stop

3. **Expected behavior:**
   - Recording duration should show actual time (e.g., "3000ms" for 3 seconds)
   - Audio file should be > 10KB
   - Text should be transcribed and pasted
   - No "Already processing" warnings on single Esc press

4. **Test edge cases:**
   - Very short recording (< 1 second) - should show error
   - Multiple Esc presses - should only process once
   - Rapid start/stop - should be debounced properly

## Additional Notes

- Sox must be installed: `brew install sox`
- Microphone permission must be granted
- Accessibility permission must be granted for pasting
- API key must be configured in settings

## Audio Clipping Warning

If you see "Clip:94" or similar in sox output, it means the audio input is too loud. This doesn't prevent recording but may affect quality. To fix:
- Reduce microphone input volume in System Settings
- Speak at a normal volume, not too close to the mic
- Consider adding volume normalization to sox command if needed
