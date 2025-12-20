#!/bin/bash

echo "🎯 Final QR Code Test - All Methods"
echo "=================================="

# Create payment and get response
response=$(curl -s -X POST http://localhost:3000/api/payments/crypto/create \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer dev-token" \
    -d '{"plan_id": "starter", "coin": "usdt_bep20", "interval": "monthly"}')

echo "📊 QR Code Availability:"
echo "========================"

# Check URL method
qr_url=$(echo "$response" | jq -r '.payment_instructions.qr_code')
if [ "$qr_url" != "null" ] && [ "$qr_url" != "" ]; then
    echo "✅ QR URL: Available (${#qr_url} chars)"
    echo "   $qr_url"
else
    echo "❌ QR URL: Not available"
fi

# Check base64 method
qr_base64=$(echo "$response" | jq -r '.payment_instructions.qr_base64')
if [ "$qr_base64" != "null" ] && [ "$qr_base64" != "" ]; then
    echo "✅ QR Base64: Available (${#qr_base64} chars)"
    echo "   ${qr_base64:0:50}..."
else
    echo "❌ QR Base64: Not available"
fi

# Check fallback method
qr_url_fallback=$(echo "$response" | jq -r '.qr_code_url')
if [ "$qr_url_fallback" != "null" ] && [ "$qr_url_fallback" != "" ]; then
    echo "✅ QR URL Fallback: Available (${#qr_url_fallback} chars)"
else
    echo "❌ QR URL Fallback: Not available"
fi

echo ""
echo "🧪 Testing QR Code Accessibility:"
echo "================================="

# Test URL accessibility
if [ "$qr_url" != "null" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" "$qr_url")
    if [ "$status" = "200" ]; then
        echo "✅ QR URL is accessible (HTTP $status)"
    else
        echo "❌ QR URL failed (HTTP $status)"
    fi
fi

# Test base64 validity
if [ "$qr_base64" != "null" ] && [[ "$qr_base64" == "data:image/png;base64,"* ]]; then
    echo "✅ QR Base64 has correct format"
    
    # Extract and test base64 data
    base64_data=$(echo "$qr_base64" | sed 's/data:image\/png;base64,//')
    if echo "$base64_data" | base64 -d > /dev/null 2>&1; then
        echo "✅ QR Base64 data is valid"
    else
        echo "❌ QR Base64 data is invalid"
    fi
else
    echo "❌ QR Base64 has incorrect format"
fi

echo ""
echo "📋 Frontend Integration Check:"
echo "============================="

# Check what the frontend will receive
echo "Frontend will check for QR code in this order:"
echo "1. paymentInstructions.qr_base64: $([ "$qr_base64" != "null" ] && echo "✅ Available" || echo "❌ Missing")"
echo "2. paymentInstructions.qr_code: $([ "$qr_url" != "null" ] && echo "✅ Available" || echo "❌ Missing")"
echo "3. qr_code_url: $([ "$qr_url_fallback" != "null" ] && echo "✅ Available" || echo "❌ Missing")"

# Determine what will be used
if [ "$qr_base64" != "null" ] && [ "$qr_base64" != "" ]; then
    echo ""
    echo "🎯 Result: Frontend will use BASE64 QR code (best option)"
elif [ "$qr_url" != "null" ] && [ "$qr_url" != "" ]; then
    echo ""
    echo "🎯 Result: Frontend will use URL QR code (good option)"
elif [ "$qr_url_fallback" != "null" ] && [ "$qr_url_fallback" != "" ]; then
    echo ""
    echo "🎯 Result: Frontend will use fallback URL QR code (backup option)"
else
    echo ""
    echo "❌ Result: No QR code available for frontend"
fi

echo ""
echo "🚀 Next Steps:"
echo "============="
echo "1. Restart the Electron app"
echo "2. Open Developer Tools (Cmd+Option+I)"
echo "3. Go to Pricing section and click 'Upgrade'"
echo "4. Check console for debug logs"
echo "5. Verify QR code appears in payment modal"
echo ""
echo "If QR code still doesn't show, check the console logs for:"
echo "- 🔍 QR code check: {condition: true, ...}"
echo "- Any image loading errors"
echo "- CSP or CORS errors"