#!/bin/bash

# Debug script for M365 Assessment Framework app registration
# Tests API endpoints to validate fixes for warmup and app registration

API_BASE="http://localhost:7071"

echo "🧪 M365 Assessment Framework - Debug App Registration"
echo "=================================================="
echo ""

# Function to test an endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local description="$3"
    local data="$4"
    
    echo "🔍 Testing: $description"
    echo "   $method $endpoint"
    echo ""
    
    if [ "$method" = "GET" ] || [ "$method" = "HEAD" ]; then
        curl -s -X "$method" -w "Status: %{http_code}\nTime: %{time_total}s\n" "$API_BASE$endpoint" | jq -C '.' 2>/dev/null || echo "Response (non-JSON):"
    else
        curl -s -X "$method" -H "Content-Type: application/json" -d "$data" -w "Status: %{http_code}\nTime: %{time_total}s\n" "$API_BASE$endpoint" | jq -C '.' 2>/dev/null || echo "Response (non-JSON):"
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Test warmup endpoints
echo "📊 TESTING WARMUP ENDPOINTS"
echo ""

test_endpoint "GET" "/api/test" "Basic warmup endpoint"
test_endpoint "HEAD" "/api/test" "Basic warmup endpoint (HEAD)"
test_endpoint "GET" "/api/diagnostics" "Diagnostics endpoint"
test_endpoint "HEAD" "/api/diagnostics" "Diagnostics endpoint (HEAD)"

# Test Azure configuration
echo "🔧 TESTING AZURE CONFIGURATION"
echo ""

test_endpoint "GET" "/api/azure/config" "Azure configuration check"

# Test app registration with domain only (this is what we're fixing)
echo "🏢 TESTING APP REGISTRATION (DOMAIN ONLY)"
echo ""

DOMAIN_ONLY_DATA='{
  "tenantName": "Contoso Test",
  "tenantDomain": "contoso.com",
  "contactEmail": "admin@contoso.com"
}'

test_endpoint "POST" "/api/customers/create-multitenant-app" "App registration with domain only" "$DOMAIN_ONLY_DATA"

# Test app registration with tenant ID
echo "🏢 TESTING APP REGISTRATION (WITH TENANT ID)"
echo ""

TENANT_ID_DATA='{
  "tenantName": "Contoso Test",
  "tenantDomain": "contoso.com",
  "targetTenantId": "00000000-0000-0000-0000-000000000000",
  "contactEmail": "admin@contoso.com"
}'

test_endpoint "POST" "/api/customers/create-multitenant-app" "App registration with tenant ID" "$TENANT_ID_DATA"

echo "🏁 Debug tests completed!"
echo ""
echo "💡 Tips for troubleshooting:"
echo "   - Check local.settings.json for required Azure environment variables"
echo "   - Verify Azure service principal has Application.ReadWrite.All permission"
echo "   - Check Azure Functions runtime logs for detailed error messages"
echo "   - Use 'func start' to run the API locally for testing"
echo ""
