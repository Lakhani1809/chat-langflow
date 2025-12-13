#!/bin/bash

# Test script for the chat API
# Usage: ./test-api.sh

API_URL="${API_URL:-http://localhost:3000/api/chat}"

echo "Testing Chat API at: $API_URL"
echo ""

# Test 1: General chat
echo "Test 1: General chat"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "message": "Hello, how are you?"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 2: Outfit generation
echo "Test 2: Outfit generation request"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "message": "What should I wear for a date tonight?"
  }' | jq '.'

echo ""
echo "---"
echo ""

# Test 3: Color analysis
echo "Test 3: Color analysis request"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "message": "What colors work best for me?"
  }' | jq '.'

echo ""
echo "Done!"


