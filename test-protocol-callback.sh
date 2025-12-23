#!/bin/bash

echo "🧪 Testing Protocol Callback"
echo "============================"

echo "1. Testing if eloquent:// protocol is registered..."
if command -v osascript >/dev/null 2>&1; then
    echo "   Using AppleScript to test protocol..."
    osascript -e 'tell application "System Events" to open location "eloquent://auth/success?access_token=test123&refresh_token=refresh456"'
    echo "   ✅ Protocol test command sent"
else
    echo "   ❌ AppleScript not available"
fi

echo ""
echo "2. If the protocol test worked, you should see logs in the Electron app console"
echo "3. Look for: '📱 Received protocol URL: eloquent://auth/success?access_token=test123...'"
echo ""
echo "If you don't see the logs, the protocol isn't registered properly."