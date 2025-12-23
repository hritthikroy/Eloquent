#!/bin/bash

echo "🔍 Testing OAuth Configuration..."
echo "=================================="

# Test 1: Check environment variables
echo "📋 Environment Variables:"
echo "   SUPABASE_URL: ${SUPABASE_URL:-'Not set'}"
echo "   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:20}... (${#SUPABASE_ANON_KEY} chars)"
echo "   OAUTH_REDIRECT_URL: ${OAUTH_REDIRECT_URL:-'Not set'}"
echo "   ELOQUENT_API_URL: ${ELOQUENT_API_URL:-'Not set'}"
echo ""

# Test 2: Check Supabase connection
echo "🔗 Testing Supabase Connection..."
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ]; then
    response=$(curl -s -w "%{http_code}" -o /tmp/supabase_test.json \
        -H "apikey: $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/auth/v1/settings")
    
    if [ "$response" = "200" ]; then
        echo "   ✅ Supabase connection successful"
        google_enabled=$(cat /tmp/supabase_test.json | grep -o '"google":[^,]*' | cut -d':' -f2)
        echo "   📱 Google OAuth enabled: $google_enabled"
    else
        echo "   ❌ Supabase connection failed (HTTP $response)"
    fi
else
    echo "   ⚠️ Supabase credentials not configured"
fi
echo ""

# Test 3: Check backend connection
echo "🖥️ Testing Backend Connection..."
if [ -n "$ELOQUENT_API_URL" ]; then
    response=$(curl -s -w "%{http_code}" -o /dev/null "$ELOQUENT_API_URL/health")
    
    if [ "$response" = "200" ]; then
        echo "   ✅ Backend connection successful"
    else
        echo "   ❌ Backend connection failed (HTTP $response)"
    fi
else
    echo "   ⚠️ Backend URL not configured"
fi
echo ""

# Test 4: Generate OAuth URL
echo "🔗 OAuth URL Generation:"
if [ -n "$SUPABASE_URL" ] && [ -n "$OAUTH_REDIRECT_URL" ]; then
    oauth_url="${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${OAUTH_REDIRECT_URL}&response_type=token&prompt=select_account"
    echo "   📋 OAuth URL: $oauth_url"
    echo "   ✅ OAuth URL generated successfully"
else
    echo "   ❌ Cannot generate OAuth URL - missing configuration"
fi
echo ""

# Test 5: Protocol handler test
echo "🔧 Protocol Handler Test:"
echo "   📋 Test URL: eloquent://test"
echo "   💡 Try running: open 'eloquent://test' (macOS)"
echo ""

echo "🎯 Recommendations:"
echo "   1. If Supabase connection fails, check your .env file"
echo "   2. If backend connection fails, verify the Heroku app is running"
echo "   3. If OAuth URL generation fails, set OAUTH_REDIRECT_URL in .env"
echo "   4. Test the protocol handler by running the test URL above"
echo ""

# Clean up
rm -f /tmp/supabase_test.json

echo "✅ OAuth configuration test complete!"