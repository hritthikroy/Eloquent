#!/bin/bash

# Test Admin Endpoints Script
# This script tests the admin endpoints with different authentication scenarios

BASE_URL="http://localhost:3000"

echo "🧪 Testing Admin Endpoints"
echo "=========================="
echo ""

# Test 1: Using dev-token (should work)
echo "Test 1: GET /api/admin/users with dev-token"
curl -s -X GET "$BASE_URL/api/admin/users" \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" | jq '.' || echo "Failed"
echo ""
echo ""

# Test 2: Get admin stats
echo "Test 2: GET /api/admin/stats with dev-token"
curl -s -X GET "$BASE_URL/api/admin/stats" \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" | jq '.' || echo "Failed"
echo ""
echo ""

# Test 3: Search users
echo "Test 3: GET /api/admin/search?q=test with dev-token"
curl -s -X GET "$BASE_URL/api/admin/search?q=test" \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" | jq '.' || echo "Failed"
echo ""
echo ""

# Test 4: No token (should fail with 401)
echo "Test 4: GET /api/admin/users without token (should fail)"
curl -s -X GET "$BASE_URL/api/admin/users" \
  -H "Content-Type: application/json" | jq '.' || echo "Failed"
echo ""
echo ""

# Test 5: Invalid token (should fail with 401)
echo "Test 5: GET /api/admin/users with invalid token (should fail)"
curl -s -X GET "$BASE_URL/api/admin/users" \
  -H "Authorization: Bearer invalid-token-12345" \
  -H "Content-Type: application/json" | jq '.' || echo "Failed"
echo ""
echo ""

echo "✅ Tests completed!"
