#!/bin/bash

echo "🔍 Testing Production Configuration..."
echo "=================================="

# Check frontend .env
echo "📱 Frontend Configuration:"
echo "  FORCE_DEV_MODE: $(grep FORCE_DEV_MODE .env | cut -d'=' -f2)"
echo "  FORCE_QUICK_SIGNIN: $(grep FORCE_QUICK_SIGNIN .env | cut -d'=' -f2)"
echo "  ELOQUENT_API_URL: $(grep ELOQUENT_API_URL .env | cut -d'=' -f2)"

# Check backend .env
echo ""
echo "🖥️  Backend Configuration:"
echo "  ENVIRONMENT: $(grep ENVIRONMENT backend-go/.env | cut -d'=' -f2)"
echo "  PORT: $(grep PORT backend-go/.env | cut -d'=' -f2)"

# Validate configuration
echo ""
echo "✅ Configuration Validation:"

# Check if FORCE_QUICK_SIGNIN is false
if grep -q "FORCE_QUICK_SIGNIN=false" .env; then
    echo "  ✅ FORCE_QUICK_SIGNIN correctly set to false"
else
    echo "  ❌ FORCE_QUICK_SIGNIN should be false for production"
fi

# Check if backend environment is production
if grep -q "ENVIRONMENT=production" backend-go/.env; then
    echo "  ✅ Backend ENVIRONMENT correctly set to production"
else
    echo "  ❌ Backend ENVIRONMENT should be production"
fi

# Check if FORCE_DEV_MODE is false
if grep -q "FORCE_DEV_MODE=false" .env; then
    echo "  ✅ FORCE_DEV_MODE correctly set to false"
else
    echo "  ❌ FORCE_DEV_MODE should be false for production"
fi

# Check Supabase configuration
if grep -q "apphxfvhpqogsquqlaol.supabase.co" .env; then
    echo "  ✅ Supabase URL configured"
else
    echo "  ❌ Supabase URL not configured"
fi

echo ""
echo "🎯 Production Mode Status:"
dev_mode=$(grep FORCE_DEV_MODE .env | cut -d'=' -f2)
quick_signin=$(grep FORCE_QUICK_SIGNIN .env | cut -d'=' -f2)
backend_env=$(grep ENVIRONMENT backend-go/.env | cut -d'=' -f2)

if [ "$dev_mode" = "false" ] && [ "$quick_signin" = "false" ] && [ "$backend_env" = "production" ]; then
    echo "  🎉 TRUE PRODUCTION MODE - All settings correct!"
    echo "  🔐 Real Google OAuth will be used"
    echo "  🖥️  Backend in production mode"
else
    echo "  ⚠️  HYBRID MODE - Some settings need adjustment"
    if [ "$dev_mode" != "false" ]; then
        echo "     - Set FORCE_DEV_MODE=false"
    fi
    if [ "$quick_signin" != "false" ]; then
        echo "     - Set FORCE_QUICK_SIGNIN=false"
    fi
    if [ "$backend_env" != "production" ]; then
        echo "     - Set ENVIRONMENT=production in backend-go/.env"
    fi
fi

echo ""
echo "🚀 Next Steps:"
echo "  1. Restart frontend: npm start"
echo "  2. Restart backend: cd backend-go && go run main.go"
echo "  3. Test Google OAuth authentication"
echo "  4. Verify admin access with real authentication"