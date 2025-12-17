#!/bin/bash

echo "🔐 VoicyClone Permission Fixer"
echo "=============================="
echo ""
echo "This script will open macOS System Settings to grant permissions."
echo ""
echo "Please grant these permissions to 'Electron' or 'VoicyClone':"
echo ""
echo "  1. ✅ Microphone     - Required for voice recording"
echo "  2. ✅ Accessibility  - Required for text pasting"
echo "  3. ⚠️  Screen Recording - Optional (for overlay window)"
echo ""
echo "Press Enter to continue..."
read

# Open Microphone settings
echo ""
echo "📱 Opening Microphone settings..."
echo "   → Look for 'Electron' or 'VoicyClone' and toggle it ON"
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
sleep 3

# Open Accessibility settings
echo ""
echo "♿ Opening Accessibility settings..."
echo "   → Click the lock icon to unlock"
echo "   → Click '+' button if app not listed"
echo "   → Add Electron and toggle it ON"
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
sleep 3

# Open Screen Recording settings
echo ""
echo "🖥️  Opening Screen Recording settings (optional)..."
echo "   → Add Electron if you want overlay to work perfectly"
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"

echo ""
echo "✅ System Settings opened!"
echo ""
echo "After granting permissions:"
echo "  1. Close System Settings"
echo "  2. Quit VoicyClone if running (Cmd+Q)"
echo "  3. Run: npm start"
echo "  4. Test with: ⌥D (Option + D)"
echo ""
echo "If app still doesn't work, run: npm run reset-permissions"
