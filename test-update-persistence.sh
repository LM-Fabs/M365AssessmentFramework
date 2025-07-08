#!/bin/bash

echo "🔍 Testing Customer Update Persistence"
echo "======================================"

# Test customer update via API
TEST_SUFFIX="debug-customer-$(date +%s)"

echo ""
echo "📝 Step 1: Creating test customer: $TEST_SUFFIX"
CREATE_RESPONSE=$(curl -s -X POST http://localhost:7071/api/customers \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantName\": \"Debug Customer\",
    \"tenantDomain\": \"debug.onmicrosoft.com\",
    \"contactEmail\": \"debug@test.com\",
    \"manual\": true
  }")

echo "Create Response:"
echo "$CREATE_RESPONSE" | jq '.'

# Extract the actual customer ID from the response
CUSTOMER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.customer.id // .data.id // "not-found"')
echo "Actual Customer ID: $CUSTOMER_ID"

echo ""
echo "⏱️ Waiting 3 seconds for creation to complete..."
sleep 3

echo ""
echo "📊 Step 2: Getting customer after creation"
GET_AFTER_CREATE=$(curl -s "http://localhost:7071/api/customers/$CUSTOMER_ID")
echo "Customer after creation:"
echo "$GET_AFTER_CREATE" | jq '.data.appRegistration // .appRegistration // "No app registration found"'

echo ""
echo "🔄 Step 3: Updating customer with real app registration..."
UPDATE_RESPONSE=$(curl -s -X PUT "http://localhost:7071/api/customers/$CUSTOMER_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"appRegistration\": {
      \"applicationId\": \"test-real-app-12345\",
      \"clientId\": \"test-real-client-67890\",
      \"servicePrincipalId\": \"test-real-sp-abcdef\",
      \"permissions\": [\"User.Read\", \"Directory.Read.All\"],
      \"clientSecret\": \"test-real-secret-xyz\",
      \"consentUrl\": \"https://test-consent-url.com\",
      \"redirectUri\": \"https://test-redirect.com\"
    }
  }")

echo "Update Response:"
echo "$UPDATE_RESPONSE" | jq '.'

echo ""
echo "⏱️ Waiting 3 seconds for update to complete..."
sleep 3

echo ""
echo "📊 Step 4: Getting customer after update"
GET_AFTER_UPDATE=$(curl -s "http://localhost:7071/api/customers/$CUSTOMER_ID")
echo "Customer after update:"
echo "$GET_AFTER_UPDATE" | jq '.'

echo ""
echo "🔍 Step 5: Checking if app registration was persisted"
APP_REG_AFTER_UPDATE=$(echo "$GET_AFTER_UPDATE" | jq -r '.data.appRegistration.clientId // .appRegistration.clientId // "not-found"')
echo "Client ID after update: $APP_REG_AFTER_UPDATE"

if [[ "$APP_REG_AFTER_UPDATE" == "test-real-client-67890" ]]; then
    echo "✅ SUCCESS: App registration was persisted correctly!"
else
    echo "❌ FAILURE: App registration was not persisted correctly!"
    echo "Expected: test-real-client-67890"
    echo "Got: $APP_REG_AFTER_UPDATE"
fi

echo ""
echo "🧹 Step 6: Cleaning up test customer..."
DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:7071/api/customers/$CUSTOMER_ID")
echo "Delete Response:"
echo "$DELETE_RESPONSE" | jq '.'

echo ""
echo "✅ Debug complete!"
