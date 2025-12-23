#!/bin/bash

echo "🧪 Testing Complete OAuth Flow"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Testing backend server health...${NC}"
curl -s http://localhost:3000/health | jq . || echo "❌ Backend not responding"

echo -e "\n${BLUE}2. Testing OAuth success page...${NC}"
curl -s "http://localhost:3000/auth/success#access_token=test_token&refresh_token=test_refresh" | grep -q "Authentication Successful" && echo "✅ OAuth success page loads" || echo "❌ OAuth success page failed"

echo -e "\n${BLUE}3. Testing protocol registration...${NC}"
# Check if protocol is registered (macOS specific)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Check if Eloquent is registered as default handler for eloquent:// protocol
    defaults read com.apple.LaunchServices/com.apple.launchservices.secure | grep -q "eloquent" && echo "✅ Protocol registered" || echo "⚠️ Protocol may not be registered"
fi

echo -e "\n${BLUE}4. Testing protocol URL format...${NC}"
# Test different URL formats
test_urls=(
    "eloquent://auth/success?access_token=test123&refresh_token=refresh456"
    "eloquent://auth/success#access_token=test123&refresh_token=refresh456"
    "eloquent://auth/error?error=access_denied&error_description=User%20denied"
)

for url in "${test_urls[@]}"; do
    echo "Testing: $url"
    # Just validate URL format
    if [[ $url =~ ^eloquent://auth/(success|error) ]]; then
        echo "✅ Valid format"
    else
        echo "❌ Invalid format"
    fi
done

echo -e "\n${BLUE}5. Manual OAuth test...${NC}"
echo "To manually test OAuth:"
echo "1. Start the app: npm start"
echo "2. Click sign in"
echo "3. Complete Google OAuth"
echo "4. Check if you get redirected back to the app"
echo ""
echo "If it fails, try this manual protocol URL:"
echo "eloquent://auth/success?access_token=manual_test&refresh_token=manual_refresh"

echo -e "\n${YELLOW}Debugging tips:${NC}"
echo "- Check browser console on /auth/success page"
echo "- Look for 'No auth data found in page' in app logs"
echo "- Verify protocol registration with: defaults read com.apple.LaunchServices/com.apple.launchservices.secure | grep eloquent"
echo "- Test protocol manually: open 'eloquent://test'"

echo -e "\n${GREEN}Test complete!${NC}"