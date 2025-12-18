#!/bin/bash

# Eloquent Development Startup Script

echo "🚀 Starting Eloquent Development Environment..."

# Check if .env files exist
if [ ! -f ".env" ]; then
    echo "📋 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your API keys"
fi

if [ ! -f "backend-go/.env" ]; then
    echo "📋 Creating backend .env from template..."
    cp backend-go/.env.example backend-go/.env
    echo "⚠️  Please edit backend-go/.env with your credentials"
fi

# Check environment
echo "🔍 Checking environment..."
npm run check-env

# Start backend in background
echo "🔧 Starting Go backend..."
cd backend-go
go run main.go &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start Electron app
echo "🖥️  Starting Electron app..."
npm run dev

# Cleanup: Kill backend when Electron exits
echo "🧹 Cleaning up..."
kill $BACKEND_PID 2>/dev/null
echo "✅ Development session ended"