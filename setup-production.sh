#!/bin/bash

# Eloquent - Production Mode Setup Script
# This script helps you configure production mode with real Google OAuth

echo "🚀 Eloquent - Production Mode Setup"
echo "===================================="
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production template not found!"
    echo "Please make sure you're in the EloquentElectron directory"
    exit 1
fi

echo "📋 This script will help you set up production mode with real Google OAuth."
echo ""
echo "📚 Before continuing, you need:"
echo "   1. Supabase project created at supabase.com"
echo "   2. Google Cloud Console project with OAuth credentials"
echo "   3. Google OAuth configured in Supabase dashboard"
echo ""

read -p "Do you have all the requirements above? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📖 Please follow the setup guide first:"
    echo "   - Read PRODUCTION_SETUP.md for detailed instructions"
    echo "   - Set up Supabase project"
    echo "   - Configure Google OAuth"
    echo "   - Then run this script again"
    echo ""
    exit 1
fi

echo ""
echo "🔧 Setting up production environment..."

# Backup existing .env if it exists
if [ -f ".env" ]; then
    echo "📁 Backing up existing .env to .env.backup"
    cp .env .env.backup
fi

# Copy production template
echo "📋 Creating .env from production template..."
cp .env.production .env

echo ""
echo "✅ Production template created!"
echo ""
echo "🔑 Now you need to edit .env with your real credentials:"
echo ""
echo "   1. SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co"
echo "   2. SUPABASE_ANON_KEY=eyJ... (from Supabase dashboard)"
echo "   3. SUPABASE_SERVICE_KEY=eyJ... (from Supabase dashboard)"
echo "   4. GROQ_API_KEY_1=gsk_... (your Groq API key)"
echo ""

read -p "Would you like to open .env for editing now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Try to open with common editors
    if command -v code &> /dev/null; then
        echo "📝 Opening .env in VS Code..."
        code .env
    elif command -v nano &> /dev/null; then
        echo "📝 Opening .env in nano..."
        nano .env
    elif command -v vim &> /dev/null; then
        echo "📝 Opening .env in vim..."
        vim .env
    else
        echo "📝 Please edit .env manually with your preferred editor"
    fi
fi

echo ""
echo "🧪 After editing .env, test production mode:"
echo "   npm start"
echo ""
echo "✅ The app should now use real Google OAuth instead of development mode"
echo ""
echo "🔍 Look for these signs of production mode:"
echo "   - No 'Development mode detected' in console"
echo "   - Google sign-in redirects to real Google OAuth"
echo "   - No 'Continue in Development Mode' button needed"
echo ""
echo "📚 For troubleshooting, see PRODUCTION_SETUP.md"