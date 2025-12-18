#!/bin/bash

echo "🔍 Verifying Heroku deployment..."

# Get app name from user
read -p "Enter your Heroku app name: " APP_NAME

if [ -z "$APP_NAME" ]; then
    echo "❌ App name is required"
    exit 1
fi

APP_URL="https://$APP_NAME.herokuapp.com"

echo "🌐 Testing API endpoints for: $APP_URL"
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" "$APP_URL/health")
HTTP_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed (HTTP $HTTP_CODE)"
fi

echo ""

# Test CORS headers
echo "2. Testing CORS configuration..."
CORS_RESPONSE=$(curl -s -I -H "Origin: app://eloquent" "$APP_URL/health")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ CORS headers present"
else
    echo "❌ CORS headers missing"
fi

echo ""

# Check environment variables
echo "3. Checking environment variables..."
heroku config --app $APP_NAME | grep -E "(SUPABASE_URL|GROQ_API_KEY|STRIPE_SECRET_KEY)" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Required environment variables are set"
else
    echo "❌ Some required environment variables may be missing"
    echo "Run: heroku config --app $APP_NAME"
fi

echo ""

# Check dyno status
echo "4. Checking dyno status..."
DYNO_STATUS=$(heroku ps --app $APP_NAME | grep "web.1")

if echo "$DYNO_STATUS" | grep -q "up"; then
    echo "✅ Web dyno is running"
else
    echo "❌ Web dyno is not running"
    echo "Check logs: heroku logs --tail --app $APP_NAME"
fi

echo ""
echo "🎉 Verification complete!"
echo "📱 Your API is available at: $APP_URL"
echo "📊 View logs: heroku logs --tail --app $APP_NAME"
echo "⚙️  Manage app: https://dashboard.heroku.com/apps/$APP_NAME"