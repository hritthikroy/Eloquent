#!/bin/bash

# Heroku Configuration Helper
# Use this script to set environment variables for an existing Heroku app

echo "🔧 Heroku Configuration Helper"
echo "============================="
echo ""

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

# List available apps
echo "📱 Available Heroku apps:"
heroku apps --json | grep -o '"name":"[^"]*' | cut -d'"' -f4 | nl

echo ""
read -p "Enter your app name: " APP_NAME

if [ -z "$APP_NAME" ]; then
    echo "❌ App name is required"
    exit 1
fi

# Verify app exists
if ! heroku apps:info "$APP_NAME" &> /dev/null; then
    echo "❌ App '$APP_NAME' not found"
    exit 1
fi

echo "✅ Configuring app: $APP_NAME"
echo ""

# Function to set config var
set_config() {
    local key=$1
    local description=$2
    local example=$3
    
    echo "🔑 $description"
    if [ -n "$example" ]; then
        echo "   Example: $example"
    fi
    read -p "   Value: " value
    
    if [ -n "$value" ]; then
        heroku config:set "$key=$value" --app "$APP_NAME"
        echo "   ✅ Set $key"
    else
        echo "   ⏭️ Skipped $key"
    fi
    echo ""
}

# Set environment variables
echo "Setting up environment variables for $APP_NAME..."
echo ""

set_config "ENVIRONMENT" "Environment (production/staging)" "production"
set_config "SUPABASE_URL" "Supabase Project URL" "https://abc123.supabase.co"
set_config "SUPABASE_ANON_KEY" "Supabase Anon Key" "eyJhbGciOiJIUzI1NiIs..."
set_config "SUPABASE_SERVICE_KEY" "Supabase Service Key" "eyJhbGciOiJIUzI1NiIs..."
set_config "GROQ_API_KEY" "Groq API Key" "gsk_abc123..."

echo "💳 Payment Configuration (Optional)"
echo "=================================="
set_config "STRIPE_SECRET_KEY" "Stripe Secret Key (optional)" "sk_live_..."
set_config "STRIPE_WEBHOOK_SECRET" "Stripe Webhook Secret (optional)" "whsec_..."

echo "🌐 CORS and Security"
echo "==================="
set_config "ALLOWED_ORIGINS" "Allowed CORS Origins" "https://yourdomain.com,https://app.yourdomain.com"
set_config "RATE_LIMIT_REQUESTS" "Rate Limit Requests per Window" "100"
set_config "RATE_LIMIT_WINDOW" "Rate Limit Window (seconds)" "3600"

echo ""
echo "📋 Current Configuration:"
echo "========================"
heroku config --app "$APP_NAME"

echo ""
echo "🚀 Restart app to apply changes:"
echo "   heroku restart --app $APP_NAME"
echo ""
echo "🔍 View logs:"
echo "   heroku logs --tail --app $APP_NAME"
echo ""
echo "🌐 App URL:"
heroku info --app "$APP_NAME" | grep "Web URL" | awk '{print $3}'