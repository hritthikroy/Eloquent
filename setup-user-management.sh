#!/bin/bash

# Setup script for User Management System
# This script helps set up the user management system for Eloquent

echo "🚀 Setting up User Management System for Eloquent"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the EloquentElectron directory"
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Error: Go is not installed. Please install Go first."
    echo "   Visit: https://golang.org/doc/install"
    exit 1
fi

echo "✅ Go is installed: $(go version)"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js is installed: $(node --version)"

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Set up Go backend
echo "🔧 Setting up Go backend..."
cd backend-go

# Install Go dependencies
echo "📦 Installing Go dependencies..."
go mod tidy

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file for development..."
    cp .env.example .env
    echo "FORCE_DEV_MODE=true" >> .env
fi

cd ..

# Check if main .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating main .env file for development..."
    cp .env.example .env
    echo "FORCE_DEV_MODE=true" >> .env
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start the backend server:"
echo "   cd backend-go && go run main.go"
echo ""
echo "2. In another terminal, start the Electron app:"
echo "   npm run dev"
echo ""
echo "3. Log in as an admin user (development mode uses mock authentication)"
echo ""
echo "4. Access User Management:"
echo "   - Right-click tray icon → '👥 User Management'"
echo "   - Or press Cmd+Shift+U (macOS)"
echo ""
echo "🧪 To test the system:"
echo "   node test-user-management.js"
echo ""
echo "📚 For more information, see:"
echo "   docs/USER_MANAGEMENT.md"
echo ""
echo "🔧 Development mode is enabled by default."
echo "   To use production mode, configure Supabase credentials in .env"
echo ""

# Make the test script executable
chmod +x test-user-management.js

echo "✅ All done! Happy coding! 🚀"