#!/bin/bash

# Simple Customer Analysis Script
API_BASE="https://victorious-pond-069956e03.6.azurestaticapps.net/api"

echo "🔍 Analyzing Customer App Registrations"
echo "====================================="

response=$(curl -s "$API_BASE/customers")
echo ""
echo "Raw API Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo "=== ANALYSIS ==="
echo ""

# Check if response has data
if echo "$response" | jq '.data' >/dev/null 2>&1; then
    customer_count=$(echo "$response" | jq '.data | length' 2>/dev/null)
    echo "Total customers found: $customer_count"
    
    if [ "$customer_count" -gt 0 ]; then
        echo ""
        echo "Customer Details:"
        echo "$response" | jq -r '.data[] | "- Name: \(.tenantName // "Unknown") | Domain: \(.tenantDomain // "Unknown") | ClientID: \(.appRegistration.clientId // "None")"' 2>/dev/null
        
        echo ""
        echo "Looking for problematic app registrations..."
        
        # Check each customer's app registration
        echo "$response" | jq -r '.data[] | 
        if (.appRegistration.clientId // "") | test("^pending-") then
            "❌ PROBLEM: \(.tenantName) has placeholder clientId: \(.appRegistration.clientId)"
        elif (.appRegistration.clientId // "") == "" then
            "⚠️  WARNING: \(.tenantName) has empty clientId"
        elif (.appRegistration.clientId // "") | test("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$") then
            "✅ GOOD: \(.tenantName) has valid GUID clientId: \(.appRegistration.clientId)"
        else
            "❓ UNKNOWN: \(.tenantName) has unusual clientId: \(.appRegistration.clientId)"
        end' 2>/dev/null
    else
        echo "No customers found in the response"
    fi
else
    echo "No data field found in response, or API error occurred"
fi

echo ""
echo "=== SOLUTION FOR 'pending-1751980236314' ERROR ==="
echo ""
echo "The error indicates you're trying to assess a customer with a placeholder app registration."
echo "The application identifier 'pending-1751980236314' is not a real Azure AD app."
echo ""
echo "To fix this:"
echo ""
echo "1. IMMEDIATE FIX - Delete and recreate the problematic customer:"
echo ""
echo "   # First, identify the customer with this clientId"
echo "   curl -s '$API_BASE/customers' | jq '.data[] | select(.appRegistration.clientId == \"pending-1751980236314\")'"
echo ""
echo "   # Delete the customer (replace CUSTOMER_ID with actual ID)"
echo "   curl -X DELETE '$API_BASE/customers/CUSTOMER_ID'"
echo ""
echo "   # Recreate using the updated Assessment page 'Add New Customer' feature"
echo "   # This will trigger automatic app registration creation"
echo ""
echo "2. VERIFY THE FIX:"
echo "   - New customer should have a GUID clientId (not starting with 'pending-')"
echo "   - You'll receive a consent URL for admin approval"
echo "   - After admin consent, assessments should work with real data"
echo ""
echo "3. USE THE UPDATED UI:"
echo "   - The Assessment page now properly creates customers with real app registrations"
echo "   - It will warn you if a customer has placeholder app registration"
echo "   - Manual entry now triggers the automatic app registration process"
echo ""
