#!/bin/bash

# Test script for the chat API
# Usage: ./test-api.sh [userId]

API_URL="${API_URL:-http://localhost:3000/api/chat}"
USER_ID="${1:-test-user-123}"

echo "Testing Chat API at: $API_URL"
echo "Using userId: $USER_ID"
echo ""

# Test 1: General chat
echo "Test 1: General chat"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"message\": \"Hello, how are you?\"
  }" | jq '.' || echo "Response received (jq not installed, showing raw)"

echo ""
echo "---"
echo ""

# Test 2: Outfit generation
echo "Test 2: Outfit generation request"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"message\": \"What should I wear for a date tonight?\"
  }" | jq '.' || echo "Response received (jq not installed, showing raw)"

echo ""
echo "---"
echo ""

# Test 3: Color analysis
echo "Test 3: Color analysis request"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"message\": \"What colors work best for me?\"
  }" | jq '.' || echo "Response received (jq not installed, showing raw)"

echo ""
echo "Done!"

