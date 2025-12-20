#!/bin/bash

echo "🧪 Testing Complete Payment System"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_field=$5
    
    echo -e "${YELLOW}Testing: $name${NC}"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer dev-token" \
            -d "$data")
    else
        response=$(curl -s -X GET "$url" \
            -H "Authorization: Bearer dev-token")
    fi
    
    if echo "$response" | jq -e ".$expected_field" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "Response: $response"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Test 1: Get supported coins
test_endpoint "Get Supported Coins" \
    "GET" \
    "http://localhost:3000/api/payments/crypto/coins" \
    "" \
    "coins"

# Test 2: Get estimate for starter plan
test_endpoint "Get Estimate (Starter Plan)" \
    "GET" \
    "http://localhost:3000/api/payments/crypto/estimate?plan_id=starter&interval=monthly" \
    "" \
    "estimate"

# Test 3: Create payment for starter plan
echo -e "${YELLOW}Testing: Create Payment (Starter Plan)${NC}"
payment_response=$(curl -s -X POST "http://localhost:3000/api/payments/crypto/create" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer dev-token" \
    -d '{"plan_id": "starter", "coin": "usdt_bep20", "interval": "monthly"}')

order_id=$(echo "$payment_response" | jq -r '.order_id')
payment_address=$(echo "$payment_response" | jq -r '.payment_address')
qr_code=$(echo "$payment_response" | jq -r '.qr_code_url')

if [ "$order_id" != "null" ] && [ "$payment_address" != "null" ] && [ "$qr_code" != "null" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    echo "  Order ID: $order_id"
    echo "  Payment Address: $payment_address"
    echo "  QR Code: $qr_code"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAILED${NC}"
    echo "Response: $payment_response"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4: Get order status
test_endpoint "Get Order Status" \
    "GET" \
    "http://localhost:3000/api/payments/crypto/status/$order_id" \
    "" \
    "order"

# Test 5: Simulate webhook callback (pending)
echo -e "${YELLOW}Testing: Webhook Callback (Pending)${NC}"
webhook_response=$(curl -s -X POST "http://localhost:3000/api/payments/crypto/webhook?order_id=$order_id&address_in=$payment_address&txid_in=0xtest123&confirmations=0&value_coin=3.00&pending=1")

if [ "$webhook_response" = "*ok*" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAILED${NC}"
    echo "Response: $webhook_response"
    ((TESTS_FAILED++))
fi
echo ""

# Test 6: Check order status after pending webhook
echo -e "${YELLOW}Testing: Order Status After Pending Webhook${NC}"
status_response=$(curl -s -X GET "http://localhost:3000/api/payments/crypto/status/$order_id" \
    -H "Authorization: Bearer dev-token")

status=$(echo "$status_response" | jq -r '.order.status')

if [ "$status" = "confirming" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    echo "  Status: $status"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAILED${NC}"
    echo "  Expected: confirming, Got: $status"
    ((TESTS_FAILED++))
fi
echo ""

# Test 7: Simulate webhook callback (completed)
echo -e "${YELLOW}Testing: Webhook Callback (Completed)${NC}"
webhook_response=$(curl -s -X POST "http://localhost:3000/api/payments/crypto/webhook?order_id=$order_id&address_in=$payment_address&txid_in=0xtest123&confirmations=1&value_coin=3.00&pending=0")

if [ "$webhook_response" = "*ok*" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAILED${NC}"
    echo "Response: $webhook_response"
    ((TESTS_FAILED++))
fi
echo ""

# Test 8: Check order status after completed webhook
echo -e "${YELLOW}Testing: Order Status After Completed Webhook${NC}"
status_response=$(curl -s -X GET "http://localhost:3000/api/payments/crypto/status/$order_id" \
    -H "Authorization: Bearer dev-token")

status=$(echo "$status_response" | jq -r '.order.status')
paid_at=$(echo "$status_response" | jq -r '.order.paid_at')

if [ "$status" = "completed" ] && [ "$paid_at" != "null" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    echo "  Status: $status"
    echo "  Paid At: $paid_at"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAILED${NC}"
    echo "  Expected: completed, Got: $status"
    ((TESTS_FAILED++))
fi
echo ""

# Test 9: Get user orders
test_endpoint "Get User Orders" \
    "GET" \
    "http://localhost:3000/api/payments/crypto/orders" \
    "" \
    "orders"

# Test 10: Create payment for pro plan (yearly)
test_endpoint "Create Payment (Pro Plan - Yearly)" \
    "POST" \
    "http://localhost:3000/api/payments/crypto/create" \
    '{"plan_id": "pro", "coin": "usdt_bep20", "interval": "yearly"}' \
    "order_id"

# Summary
echo "=================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo "=================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
