#!/bin/bash

# Debug script to test customer loading and consent URL generation

echo "🔍 Testing customer API endpoint..."
echo "================================="

# Test customer endpoint
echo "Testing GET /api/customers:"
curl -s "https://victorious-pond-069956e03.6.azurestaticapps.net/api/customers" | jq .

echo -e "\n🎯 Customer count check:"
CUSTOMER_COUNT=$(curl -s "https://victorious-pond-069956e03.6.azurestaticapps.net/api/customers" | jq '.data | length')
echo "Found $CUSTOMER_COUNT customers"

if [ "$CUSTOMER_COUNT" -gt 0 ]; then
    echo "✅ Customers are available for consent URL generation"
    
    echo -e "\n📋 Customer details:"
    curl -s "https://victorious-pond-069956e03.6.azurestaticapps.net/api/customers" | jq '.data[] | {id, tenantName, tenantId, tenantDomain}'
else
    echo "❌ No customers found - this would cause the consent URL generator to show empty dropdown"
fi

echo -e "\n🔗 Testing consent callback endpoint..."
curl -s -o /dev/null -w "Status: %{http_code}\n" "https://victorious-pond-069956e03.6.azurestaticapps.net/api/consent-callback"

echo -e "\n✅ Debug complete"
echo "If customers are showing as 0, check the customer creation process"
echo "If customers exist but consent URL generator is empty, check Settings.tsx customer loading"
