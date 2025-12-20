#!/bin/bash

echo "🧪 Testing crypto payment creation with improved timeout handling..."

# Test crypto payment creation
echo "📡 Creating crypto payment..."
curl -X POST http://localhost:3000/api/payments/crypto/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "plan_id": "starter",
    "coin": "usdt_bep20",
    "interval": "monthly"
  }' \
  -w "\n⏱️  Response time: %{time_total}s\n" \
  | jq '.'

echo ""
echo "✅ Test completed!"