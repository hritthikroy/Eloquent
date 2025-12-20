#!/bin/bash

echo "🔍 Testing QR Code Generation and Accessibility"
echo "=============================================="

# Create a test payment and extract QR code URL
echo "📡 Creating test payment..."
response=$(curl -s -X POST http://localhost:3000/api/payments/crypto/create \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer dev-token" \
    -d '{"plan_id": "starter", "coin": "usdt_bep20", "interval": "monthly"}')

qr_url=$(echo "$response" | jq -r '.payment_instructions.qr_code')
qr_url_alt=$(echo "$response" | jq -r '.qr_code_url')
payment_address=$(echo "$response" | jq -r '.payment_address')

echo "QR URL from payment_instructions: $qr_url"
echo "QR URL from qr_code_url: $qr_url_alt"
echo "Payment address: $payment_address"
echo ""

# Test QR code accessibility
echo "🔍 Testing QR code URL accessibility..."
if [ "$qr_url" != "null" ]; then
    echo "Testing: $qr_url"
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$qr_url")
    if [ "$status_code" = "200" ]; then
        echo "✅ QR code URL is accessible (HTTP $status_code)"
        
        # Download and check file size
        file_size=$(curl -s "$qr_url" | wc -c)
        echo "📊 QR code file size: $file_size bytes"
        
        if [ "$file_size" -gt 1000 ]; then
            echo "✅ QR code appears to be a valid image"
        else
            echo "❌ QR code file seems too small"
        fi
    else
        echo "❌ QR code URL returned HTTP $status_code"
    fi
else
    echo "❌ No QR code URL found in response"
fi

echo ""
echo "🧪 Testing manual QR code generation..."
manual_qr="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=$payment_address"
echo "Manual QR URL: $manual_qr"

manual_status=$(curl -s -o /dev/null -w "%{http_code}" "$manual_qr")
if [ "$manual_status" = "200" ]; then
    echo "✅ Manual QR code generation works (HTTP $manual_status)"
else
    echo "❌ Manual QR code generation failed (HTTP $manual_status)"
fi

echo ""
echo "📋 Full API Response Structure:"
echo "$response" | jq '{
    success,
    order_id,
    payment_address,
    qr_code_url,
    payment_instructions: {
        qr_code: .payment_instructions.qr_code,
        address: .payment_instructions.address,
        network: .payment_instructions.network
    }
}'