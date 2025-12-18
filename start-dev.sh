#!/bin/bash

# Eloquent Development Startup Script
# This script starts both the Go backend and Electron frontend

echo "🚀 Starting Eloquent Development Environment..."

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+ first."
    echo "   Visit: https://golang.org/dl/"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Check if Go dependencies are installed
cd backend-go
if [ ! -f "go.sum" ]; then
    echo "📦 Installing Go dependencies..."
    go mod tidy
fi

# Start the Go backend in the background
echo "🔧 Starting Go backend on port 3000..."
go run main.go &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Go back to main directory
cd ..

# Start Electron frontend
echo "🖥️  Starting Electron frontend..."
npm run dev &
FRONTEND_PID=$!

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down development environment..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Cleanup complete"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

echo ""
echo "✅ Development environment started!"
echo "   🔧 Backend: http://localhost:3000"
echo "   🖥️  Frontend: Electron app should open"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for processes to finish
wait $BACKEND_PID $FRONTEND_PID