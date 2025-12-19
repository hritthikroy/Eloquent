#!/bin/bash

echo "🚀 Starting Eloquent Backend Server..."

# Check if we're in the right directory
if [ ! -d "backend-go" ]; then
    echo "❌ Error: backend-go directory not found"
    echo "Please run this script from the EloquentElectron directory"
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Error: Go is not installed"
    echo "Please install Go from https://golang.org/dl/"
    exit 1
fi

# Navigate to backend directory
cd backend-go

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📋 Creating .env from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "⚠️  Please edit backend-go/.env with your API keys"
    else
        echo "❌ Error: .env.example not found"
        exit 1
    fi
fi

# Check if compiled binary exists
if [ -f "eloquent-backend" ]; then
    echo "🔧 Using compiled binary..."
    ./eloquent-backend
else
    echo "🔧 Compiling and running from source..."
    go run main.go
fi