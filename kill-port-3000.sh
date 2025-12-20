#!/bin/bash

# Kill any process using port 3000

echo "🔍 Checking for processes on port 3000..."

PID=$(lsof -ti:3000)

if [ -z "$PID" ]; then
    echo "✅ Port 3000 is free"
else
    echo "⚠️  Found process $PID using port 3000"
    echo "🔪 Killing process..."
    kill -9 $PID
    echo "✅ Process killed. Port 3000 is now free"
fi
