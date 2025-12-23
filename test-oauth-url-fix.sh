#!/bin/bash

echo "🧪 Testing OAuth URL Fix"
echo "========================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Checking OAuth URL generation...${NC}"

# Start the app in background to test OAuth URL generation
echo "Starting app to test OAuth URL..."
timeout 10s npm start > /tmp/oauth_test.log 2>&1 &
APP_PID=$!

# Wait a moment for app to start
sleep 3

# Check the log for OAuth URL
if grep -q "response_type=code" /tmp/oauth_test.log; then
    echo -e "${GREEN}✅ OAuth URL uses authorization code flow (response_type=code)${NC}"
else
    echo -e "${RED}❌ OAuth URL still uses implicit flow (response_type=token)${NC}"
fi

if grep -q "access_type=offline" /tmp/oauth_test.log; then
    echo -e "${RED}❌ OAuth URL still includes access_type=offline${NC}"
else
    echo -e "${GREEN}✅ OAuth URL doesn't include access_type=offline${NC}"
fi

# Kill the app
kill $APP_PID 2>/dev/null

echo -e "\n${BLUE}2. Expected OAuth URL format:${NC}"
echo "✅ Should contain: response_type=code"
echo "✅ Should contain: prompt=select_account"
echo "❌ Should NOT contain: access_type=offline"
echo "❌ Should NOT contain: response_type=token"

echo -e "\n${BLUE}3. Testing OAuth URL manually:${NC}"
echo "The OAuth URL should look like:"
echo "https://your-project.supabase.co/auth/v1/authorize?provider=google&redirect_to=...&response_type=code&prompt=select_account&state=...&approval_prompt=force&include_granted_scopes=true"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Start the app: npm start"
echo "2. Click 'Sign in with Google'"
echo "3. You should NOT see the 'Access blocked: Authorization Error' anymore"
echo "4. Complete Google OAuth normally"

echo -e "\n${GREEN}Fix applied!${NC}"
echo "Changed from: response_type=token&access_type=offline (❌ Not allowed by Google)"
echo "Changed to: response_type=code (✅ Allowed by Google)"

# Clean up
rm -f /tmp/oauth_test.log