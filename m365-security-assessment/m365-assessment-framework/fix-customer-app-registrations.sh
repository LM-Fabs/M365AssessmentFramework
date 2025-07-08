#!/bin/bash

# Customer App Registration Fix Script
# This script helps fix customers with placeholder app registrations

API_BASE="https://victorious-pond-069956e03.6.azurestaticapps.net/api"

echo "🔧 Customer App Registration Fix Tool"
echo "===================================="

# Function to make JSON requests
make_json_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint"
    else
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            "$API_BASE$endpoint"
    fi
}

echo ""
echo "1. Checking current customers..."
response=$(make_json_request "GET" "/customers")
echo "Response: $(echo "$response" | jq -r '.message // .error // "Success"')"

# Show customers with problematic app registrations
echo ""
echo "2. Customers with placeholder app registrations:"
echo "$response" | jq -r '.data[]? | select(.appRegistration.clientId | startswith("pending-")) | "- \(.tenantName) (\(.tenantDomain)) - ClientID: \(.appRegistration.clientId)"'

# Show customers with real app registrations
echo ""
echo "3. Customers with real app registrations:"
echo "$response" | jq -r '.data[]? | select(.appRegistration.clientId | startswith("pending-") | not) | select(.appRegistration.clientId != "") | "- \(.tenantName) (\(.tenantDomain)) - ClientID: \(.appRegistration.clientId)"'

echo ""
echo "=== PROBLEM ANALYSIS ==="

# Count problematic customers
problematic_count=$(echo "$response" | jq -r '[.data[]? | select(.appRegistration.clientId | startswith("pending-"))] | length')
good_count=$(echo "$response" | jq -r '[.data[]? | select(.appRegistration.clientId | startswith("pending-") | not) | select(.appRegistration.clientId != "")] | length')

echo "Customers with placeholder app registrations: $problematic_count"
echo "Customers with real app registrations: $good_count"

if [ "$problematic_count" -gt 0 ]; then
    echo ""
    echo "🔧 FIX INSTRUCTIONS:"
    echo "==================="
    echo ""
    echo "For customers with placeholder app registrations (starting with 'pending-'):"
    echo ""
    echo "Option 1 - Automatic Fix (Recommended):"
    echo "1. Delete the problematic customer(s)"
    echo "2. Use the 'Add New Customer' feature in the Assessment page"
    echo "3. This will create a new customer with automatic app registration"
    echo "4. Grant admin consent when prompted"
    echo ""
    echo "Option 2 - Manual Azure Portal Fix:"
    echo "1. Go to Azure Portal → App registrations"
    echo "2. Create a new multi-tenant app registration"
    echo "3. Add required Microsoft Graph permissions:"
    echo "   - Organization.Read.All"
    echo "   - SecurityEvents.Read.All"
    echo "   - Reports.Read.All"
    echo "   - Directory.Read.All"
    echo "   - Policy.Read.All"
    echo "   - IdentityRiskyUser.Read.All"
    echo "   - AuditLog.Read.All"
    echo "4. Grant admin consent"
    echo "5. Update customer record with real app registration details"
    echo ""
    echo "Option 3 - API Fix (for developers):"
    echo "Use the customer recreation API endpoint to trigger automatic app registration"
    echo ""
    
    # Show specific fix commands
    echo "Specific API commands to fix customers:"
    echo ""
    echo "$response" | jq -r '.data[]? | select(.appRegistration.clientId | startswith("pending-")) | 
    "# Fix customer: \(.tenantName)
curl -X DELETE \"'$API_BASE'/customers/\(.id)\"
curl -X POST \"'$API_BASE'/customers\" \\
  -H \"Content-Type: application/json\" \\
  -d '"'"'{
    \"tenantName\": \"\(.tenantName)\",
    \"tenantDomain\": \"\(.tenantDomain)\",
    \"tenantId\": \"\(.tenantId)\",
    \"contactEmail\": \"\(.contactEmail // "")\",
    \"notes\": \"Recreated to fix app registration\"
  }'"'"'
echo \"Customer \(.tenantName) recreated with automatic app registration\"
echo \"\"
"'
    
else
    echo ""
    echo "✅ All customers have proper app registrations!"
fi

echo ""
echo "=== NEXT STEPS ==="
echo ""
echo "After fixing app registrations:"
echo "1. Verify the clientId is a proper GUID (not starting with 'pending-')"
echo "2. Grant admin consent for the app in the customer's tenant"
echo "3. Re-run assessments to collect real data"
echo "4. Check assessment results no longer show 'pending-' errors"
echo ""
echo "For the current error (Application 'pending-1751980236314' not found):"
echo "This indicates a customer still has placeholder app registration data."
echo "Use the commands above to recreate the customer with proper app registration."
