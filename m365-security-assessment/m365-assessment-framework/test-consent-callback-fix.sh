#!/bin/bash

echo "🧪 Testing consent callback endpoint after function restructure..."

BASE_URL="https://victorious-pond-069956e03.6.azurestaticapps.net"
ENDPOINT="/api/consent-callback"

echo ""
echo "1️⃣ Testing OPTIONS request (CORS preflight)..."
curl -X OPTIONS "${BASE_URL}${ENDPOINT}" \
  -H "Origin: https://victorious-pond-069956e03.6.azurestaticapps.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i

echo ""
echo ""
echo "2️⃣ Testing GET request with sample consent callback parameters..."

# Sample consent callback URL parameters (URL encoded)
SAMPLE_PARAMS="admin_consent=True&tenant=70adb6e8-c6f7-4f25-a75f-9bca098db644&state=%257B%2522customerId%2522%253A%2522test-customer%2522%252C%2522customerTenant%2522%253A%252270adb6e8-c6f7-4f25-a75f-9bca098db644%2522%252C%2522timestamp%2522%253A1753075189776%252C%2522requestId%2522%253A%2522test123%2522%257D"

curl -X GET "${BASE_URL}${ENDPOINT}?${SAMPLE_PARAMS}" \
  -H "Accept: text/html,application/json" \
  -i

echo ""
echo ""
echo "3️⃣ Testing function deployment status..."
echo "Checking if consent-callback function is properly deployed:"

# Check function list endpoint
curl -X GET "${BASE_URL}/api" \
  -H "Accept: application/json" \
  -i

echo ""
echo ""
echo "✅ Consent callback endpoint testing completed!"
echo "📋 Next steps:"
echo "   - Check if the function is deployed and accessible"
echo "   - Verify CORS headers are properly set"
echo "   - Test with real consent callback parameters"
echo "   - Check Azure portal for function deployment status"
