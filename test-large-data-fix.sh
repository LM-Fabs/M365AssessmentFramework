#!/bin/bash

echo "🔍 Testing Large Data Storage Fix"
echo "=================================="

# First, create a customer to use for the test
echo ""
echo "📝 Creating test customer..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:7071/api/customers \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantName\": \"Large Data Test Customer\",
    \"tenantDomain\": \"largedata$(date +%s).onmicrosoft.com\",
    \"contactEmail\": \"test@largedata.com\",
    \"manual\": true
  }")

CUSTOMER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.customer.id // .data.id // "not-found"')
echo "📋 Customer ID: $CUSTOMER_ID"

if [[ "$CUSTOMER_ID" == "not-found" ]]; then
    echo "❌ Failed to create customer"
    exit 1
fi

echo ""
echo "🧪 Testing assessment creation with large data..."

# Create large test data
LARGE_METRICS='{"users":['
for i in {1..1000}; do
    LARGE_METRICS+="{\"id\":\"user$i\",\"name\":\"User $i\",\"email\":\"user$i@test.com\",\"roles\":[\"role1\",\"role2\",\"role3\"],\"lastLogin\":\"2025-07-08T10:00:00Z\",\"permissions\":[\"read\",\"write\",\"admin\"],\"groups\":[\"group1\",\"group2\",\"group3\"],\"metadata\":{\"department\":\"IT\",\"location\":\"Building A\",\"manager\":\"Manager $i\",\"phone\":\"+1234567890\",\"notes\":\"This is a test user with lots of metadata to make the JSON large\"}}"
    if [[ $i -lt 1000 ]]; then
        LARGE_METRICS+=","
    fi
done
LARGE_METRICS+=']}'

LARGE_RECOMMENDATIONS='['
for i in {1..500}; do
    LARGE_RECOMMENDATIONS+="{\"id\":\"rec$i\",\"title\":\"Recommendation $i\",\"description\":\"This is a very detailed recommendation with lots of text to make it large. It includes comprehensive steps, detailed explanations, and extensive guidance for implementation. This recommendation covers security best practices, compliance requirements, and operational improvements.\",\"priority\":\"high\",\"category\":\"security\",\"impact\":\"critical\",\"effort\":\"medium\",\"steps\":[\"Step 1: Review current configuration\",\"Step 2: Identify gaps and issues\",\"Step 3: Implement recommended changes\",\"Step 4: Test and validate changes\",\"Step 5: Monitor and maintain\"],\"resources\":[\"https://docs.microsoft.com/security\",\"https://docs.microsoft.com/compliance\",\"https://docs.microsoft.com/governance\"]}"
    if [[ $i -lt 500 ]]; then
        LARGE_RECOMMENDATIONS+=","
    fi
done
LARGE_RECOMMENDATIONS+=']'

echo "📊 Data sizes:"
echo "  - Metrics: $(echo "$LARGE_METRICS" | wc -c) characters"
echo "  - Recommendations: $(echo "$LARGE_RECOMMENDATIONS" | wc -c) characters"

# Test assessment creation with large data
ASSESSMENT_RESPONSE=$(curl -s -X POST "http://localhost:7071/api/assessments" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"tenantId\": \"largedata.onmicrosoft.com\",
    \"score\": 75,
    \"metrics\": $LARGE_METRICS,
    \"recommendations\": $LARGE_RECOMMENDATIONS
  }")

echo ""
echo "📈 Assessment creation response:"
echo "$ASSESSMENT_RESPONSE" | jq '.'

ASSESSMENT_ID=$(echo "$ASSESSMENT_RESPONSE" | jq -r '.data.id // .id // "not-found"')
echo "📋 Assessment ID: $ASSESSMENT_ID"

if [[ "$ASSESSMENT_ID" != "not-found" ]]; then
    echo "✅ SUCCESS: Large data assessment created successfully!"
    
    echo ""
    echo "🔍 Retrieving assessment to verify data integrity..."
    GET_RESPONSE=$(curl -s "http://localhost:7071/api/assessments?customerId=$CUSTOMER_ID")
    echo "📊 Retrieved assessment:"
    echo "$GET_RESPONSE" | jq '.data.assessments[0].metrics.users | length // "not-found"' | head -1
    echo "$GET_RESPONSE" | jq '.data.assessments[0].recommendations | length // "not-found"' | head -1
    
else
    echo "❌ FAILURE: Assessment creation failed"
    echo "Response details:"
    echo "$ASSESSMENT_RESPONSE"
fi

echo ""
echo "🧹 Cleaning up..."
curl -s -X DELETE "http://localhost:7071/api/customers/$CUSTOMER_ID" > /dev/null

echo ""
echo "✅ Test complete!"
