#!/bin/bash

# Backend Test Script
# Test the Go backend locally before deploying to Heroku

echo "🧪 Testing Eloquent Backend"
echo "==========================="
echo ""

# Check if we're in the right directory
if [ ! -f "backend-go/main.go" ]; then
    echo "❌ Error: Please run this script from the EloquentElectron directory"
    exit 1
fi

# Navigate to backend directory
cd backend-go

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go not found! Please install Go from https://golang.org/dl/"
    exit 1
fi

echo "✅ Go found: $(go version)"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📁 Creating .env from example..."
    cp .env.example .env
    echo "⚠️ Please edit .env with your real credentials before testing"
fi

# Install dependencies
echo "📦 Installing dependencies..."
go mod tidy

# Build the application
echo "🔨 Building application..."
if go build -o eloquent-backend .; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🚀 Starting backend server..."
echo "   Press Ctrl+C to stop"
echo "   Server will run on http://localhost:3000"
echo ""

# Start the server in background
./eloquent-backend &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test health endpoint
echo "🏥 Testing health endpoint..."
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo "✅ Health check passed!"
    
    echo ""
    echo "🌐 Available endpoints:"
    echo "   GET  /health                    - Health check"
    echo "   POST /api/auth/google          - Google authentication"
    echo "   POST /api/auth/validate        - Validate token"
    echo "   POST /api/transcribe/audio     - Transcribe audio"
    echo "   GET  /api/subscriptions/status - Subscription status"
    echo ""
    
    echo "📱 Test with curl:"
    echo "   curl http://localhost:3000/health"
    echo ""
    
    echo "🎯 Ready for Heroku deployment!"
    echo "   Run: ./deploy-heroku.sh"
    
else
    echo "❌ Health check failed"
    echo "📋 Check the logs above for errors"
fi

# Stop the server
echo ""
echo "🛑 Stopping test server..."
kill $SERVER_PID 2>/dev/null

# Cleanup
rm -f eloquent-backend

echo "✅ Test completed"