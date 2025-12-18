#!/bin/bash

# Eloquent Backend - Heroku Deployment Script
# This script automates the deployment process to Heroku

echo "🚀 Eloquent Backend - Heroku Deployment"
echo "======================================="
echo ""

# Check if we're in the right directory
if [ ! -f "backend-go/main.go" ]; then
    echo "❌ Error: Please run this script from the EloquentElectron directory"
    echo "   Current directory should contain backend-go/main.go"
    exit 1
fi

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found!"
    echo "📥 Please install it from: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if logged into Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "🔐 Please log in to Heroku first:"
    heroku login
fi

echo "✅ Heroku CLI found and authenticated"
echo ""

# Navigate to backend directory
cd backend-go

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial backend commit for Heroku deployment"
fi

echo "📋 Heroku App Configuration"
echo "=========================="
echo ""

# Ask for app name
read -p "Enter Heroku app name (or press Enter for auto-generated): " APP_NAME

if [ -z "$APP_NAME" ]; then
    echo "🎲 Creating app with auto-generated name..."
    heroku create
else
    echo "🏗️ Creating app: $APP_NAME"
    heroku create "$APP_NAME"
fi

# Get the actual app name (in case it was auto-generated)
ACTUAL_APP_NAME=$(heroku apps:info --json | grep -o '"name":"[^"]*' | cut -d'"' -f4)
echo "✅ App created: $ACTUAL_APP_NAME"
echo ""

# Set Go buildpack
echo "🔧 Setting Go buildpack..."
heroku buildpacks:set heroku/go

echo ""
echo "🔑 Environment Variables Setup"
echo "============================="
echo ""
echo "You need to provide the following credentials:"
echo ""

# Supabase URL
read -p "Supabase URL (https://your-project.supabase.co): " SUPABASE_URL
if [ -n "$SUPABASE_URL" ]; then
    heroku config:set SUPABASE_URL="$SUPABASE_URL"
fi

# Supabase Anon Key
read -p "Supabase Anon Key (eyJ...): " SUPABASE_ANON_KEY
if [ -n "$SUPABASE_ANON_KEY" ]; then
    heroku config:set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
fi

# Supabase Service Key
read -p "Supabase Service Key (eyJ...): " SUPABASE_SERVICE_KEY
if [ -n "$SUPABASE_SERVICE_KEY" ]; then
    heroku config:set SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
fi

# Groq API Key
read -p "Groq API Key (gsk_...): " GROQ_API_KEY
if [ -n "$GROQ_API_KEY" ]; then
    heroku config:set GROQ_API_KEY="$GROQ_API_KEY"
fi

# Set production environment
heroku config:set ENVIRONMENT=production

echo ""
echo "💳 Payment Configuration (Optional)"
echo "=================================="
read -p "Stripe Secret Key (optional, press Enter to skip): " STRIPE_SECRET_KEY
if [ -n "$STRIPE_SECRET_KEY" ]; then
    heroku config:set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
    
    read -p "Stripe Webhook Secret (whsec_...): " STRIPE_WEBHOOK_SECRET
    if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
        heroku config:set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"
    fi
fi

echo ""
echo "🌐 CORS Configuration"
echo "===================="
read -p "Allowed Origins (comma-separated, or * for all): " ALLOWED_ORIGINS
if [ -n "$ALLOWED_ORIGINS" ]; then
    heroku config:set ALLOWED_ORIGINS="$ALLOWED_ORIGINS"
else
    # Default to allow all for development
    heroku config:set ALLOWED_ORIGINS="*"
fi

echo ""
echo "🚀 Deploying to Heroku..."
echo "========================"

# Deploy
git add .
git commit -m "Deploy to Heroku" --allow-empty
git push heroku main

echo ""
echo "🔍 Checking deployment status..."

# Wait a moment for deployment to complete
sleep 5

# Check if app is running
if heroku ps | grep -q "web.*up"; then
    echo "✅ Deployment successful!"
    
    # Get app URL
    APP_URL=$(heroku info -s | grep web_url | cut -d= -f2)
    echo ""
    echo "🌐 Your API is now live at: $APP_URL"
    echo ""
    
    # Test health endpoint
    echo "🏥 Testing health endpoint..."
    if curl -s "${APP_URL}health" | grep -q "ok"; then
        echo "✅ Health check passed!"
    else
        echo "⚠️ Health check failed - check logs with: heroku logs --tail"
    fi
    
    echo ""
    echo "📱 Update your Electron app configuration:"
    echo "   ELOQUENT_API_URL=$APP_URL"
    echo ""
    echo "🔧 Useful commands:"
    echo "   heroku logs --tail          # View real-time logs"
    echo "   heroku ps                   # Check dyno status"
    echo "   heroku config               # View environment variables"
    echo "   heroku restart              # Restart the app"
    echo ""
    
else
    echo "❌ Deployment may have failed"
    echo "📋 Check logs with: heroku logs --tail"
    echo "🔧 Common issues:"
    echo "   - Missing environment variables"
    echo "   - Build errors"
    echo "   - Port binding issues"
fi

echo ""
echo "📚 For more help, see HEROKU_DEPLOYMENT.md"