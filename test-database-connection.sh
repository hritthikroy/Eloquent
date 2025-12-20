#!/bin/bash

# Database Connection Test Script
# This script tests the Supabase database connection and configuration

echo "🔍 Database Connection Test"
echo "============================"
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check Supabase configuration
echo "1️⃣ Checking Supabase Configuration..."
echo "   SUPABASE_URL: ${SUPABASE_URL:-NOT SET}"
echo "   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:20}... (${#SUPABASE_ANON_KEY} chars)"
echo "   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY:0:20}... (${#SUPABASE_SERVICE_KEY} chars)"
echo ""

# Check if service key is placeholder
if [ "$SUPABASE_SERVICE_KEY" = "your-service-key" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "⚠️  WARNING: SUPABASE_SERVICE_KEY is not configured!"
    echo "   Current value: '$SUPABASE_SERVICE_KEY'"
    echo ""
    echo "   To fix this:"
    echo "   1. Go to https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol/settings/api"
    echo "   2. Copy the 'service_role' secret key"
    echo "   3. Update SUPABASE_SERVICE_KEY in your .env file"
    echo ""
fi

# Test Supabase REST API connection
echo "2️⃣ Testing Supabase REST API Connection..."
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        "${SUPABASE_URL}/rest/v1/" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ REST API connection successful (HTTP $HTTP_CODE)"
    else
        echo "   ❌ REST API connection failed (HTTP $HTTP_CODE)"
        echo "   Response: $BODY"
    fi
else
    echo "   ⚠️  Skipping - Supabase URL or Anon Key not set"
fi
echo ""

# Test Supabase Auth API
echo "3️⃣ Testing Supabase Auth API..."
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        "${SUPABASE_URL}/auth/v1/health" \
        -H "apikey: ${SUPABASE_ANON_KEY}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ Auth API connection successful (HTTP $HTTP_CODE)"
    else
        echo "   ❌ Auth API connection failed (HTTP $HTTP_CODE)"
        echo "   Response: $BODY"
    fi
else
    echo "   ⚠️  Skipping - Supabase URL or Anon Key not set"
fi
echo ""

# Check if backend is running
echo "4️⃣ Testing Backend Server..."
BACKEND_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/health 2>/dev/null)
BACKEND_CODE=$(echo "$BACKEND_RESPONSE" | tail -n1)

if [ "$BACKEND_CODE" = "200" ]; then
    echo "   ✅ Backend server is running (HTTP $BACKEND_CODE)"
else
    echo "   ❌ Backend server is not running or not responding"
    echo "   Start it with: cd backend-go && go run main.go"
fi
echo ""

# Test database query through backend
echo "5️⃣ Testing Database Query Through Backend..."
if [ "$BACKEND_CODE" = "200" ]; then
    DB_TEST=$(curl -s -w "\n%{http_code}" \
        http://localhost:3000/api/admin/users \
        -H "Authorization: Bearer dev-token" 2>/dev/null)
    
    DB_CODE=$(echo "$DB_TEST" | tail -n 1)
    DB_BODY=$(echo "$DB_TEST" | sed '$d')
    
    if [ "$DB_CODE" = "200" ]; then
        echo "   ✅ Database query successful (HTTP $DB_CODE)"
        echo "   Users found: $(echo "$DB_BODY" | jq -r '.users | length' 2>/dev/null || echo "unknown")"
    else
        echo "   ⚠️  Database query returned HTTP $DB_CODE"
        echo "   Response: $DB_BODY"
    fi
else
    echo "   ⚠️  Skipping - Backend server not running"
fi
echo ""

# Summary
echo "📊 Summary"
echo "=========="
if [ "$SUPABASE_SERVICE_KEY" = "your-service-key" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Database is NOT properly configured"
    echo "   - Service key is missing or placeholder"
    echo "   - Backend is using MOCK DATA instead of real database"
    echo ""
    echo "🔧 To fix:"
    echo "   1. Get your service key from Supabase dashboard"
    echo "   2. Update SUPABASE_SERVICE_KEY in .env file"
    echo "   3. Restart the backend server"
else
    echo "✅ Database configuration looks good"
    echo "   - All credentials are set"
    echo "   - Backend should be using real database"
fi
echo ""
