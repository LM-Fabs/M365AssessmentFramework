#!/bin/bash

# Test script to debug app registration issues
API_BASE="https://victorious-pond-069956e03.6.azurestaticapps.net/api"

echo "🔧 M365 Assessment Framework - App Registration Debug Tool"
echo "=========================================================="

# Test 1: Check Azure configuration
echo ""
echo "1. Testing Azure configuration..."
CONFIG_RESPONSE=$(curl -s "$API_BASE/azure-config")
echo "Azure Config Response:"
echo "$CONFIG_RESPONSE" | jq '.'

GRAPH_API_STATUS=$(echo "$CONFIG_RESPONSE" | jq -r '.data.services.graphApi // false')
echo "GraphAPI Service Status: $GRAPH_API_STATUS"

if [ "$GRAPH_API_STATUS" != "true" ]; then
    echo "❌ GraphAPI service is not working properly!"
    GRAPH_ERROR=$(echo "$CONFIG_RESPONSE" | jq -r '.data.graphApiError // "Unknown error"')
    echo "GraphAPI Error: $GRAPH_ERROR"
    exit 1
fi

# Test 2: Test app registration with sample data
echo ""
echo "2. Testing app registration with sample data..."

APP_REG_DATA='{
    "tenantName": "Test Tenant",
    "targetTenantDomain": "modernworkplace.tips",
    "contactEmail": "test@example.com"
}'

echo "Sending app registration request with data:"
echo "$APP_REG_DATA" | jq '.'

APP_REG_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$APP_REG_DATA" \
    "$API_BASE/enterprise-app/multi-tenant")

HTTP_STATUS=$(echo "$APP_REG_RESPONSE" | sed -n 's/.*HTTP_STATUS:\([0-9]*\)$/\1/p')
RESPONSE_BODY=$(echo "$APP_REG_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq '.'

if [ "$HTTP_STATUS" != "200" ]; then
    echo ""
    echo "❌ App registration failed with status $HTTP_STATUS"
    echo "Error details:"
    echo "$RESPONSE_BODY" | jq -r '.error // "No error message"'
    echo "Error details:"
    echo "$RESPONSE_BODY" | jq -r '.details // "No details"'
    echo "Original error:"
    echo "$RESPONSE_BODY" | jq -r '.originalError // "No original error"'
else
    echo "✅ App registration succeeded!"
fi

echo ""
echo "🔍 Debug complete. Check the logs above for details."
