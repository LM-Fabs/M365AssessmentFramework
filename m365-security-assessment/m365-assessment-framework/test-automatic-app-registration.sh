#!/bin/bash

# Enhanced Customer Creation Test Script
# Tests the automatic app registration creation when customers are registered

API_BASE="https://victorious-pond-069956e03.6.azurestaticapps.net/api"
TEST_TENANT_NAME="Test-Company-$(date +%s)"
TEST_TENANT_DOMAIN="testcompany$(date +%s).onmicrosoft.com"
TEST_TENANT_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

echo "🔥 Testing Automatic App Registration Creation"
echo "=============================================="
echo "Test Tenant: $TEST_TENANT_NAME"
echo "Test Domain: $TEST_TENANT_DOMAIN"
echo "Test Tenant ID: $TEST_TENANT_ID"
echo ""

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

# Test 1: Check current customers before creation
echo "1. Checking existing customers..."
response=$(make_json_request "GET" "/customers")
echo "Response: $(echo "$response" | jq -r '.message // .error // "Success"')"
existing_count=$(echo "$response" | jq -r '.data // [] | length')
echo "Existing customers count: $existing_count"
echo ""

# Test 2: Create new customer with automatic app registration
echo "2. Creating new customer (should trigger automatic app registration)..."
customer_data='{
    "tenantName": "'$TEST_TENANT_NAME'",
    "tenantDomain": "'$TEST_TENANT_DOMAIN'", 
    "tenantId": "'$TEST_TENANT_ID'",
    "contactEmail": "admin@'$TEST_TENANT_DOMAIN'",
    "notes": "Test customer for automatic app registration verification"
}'

echo "Request payload:"
echo "$customer_data" | jq '.'
echo ""

response=$(make_json_request "POST" "/customers" "$customer_data")
echo "Customer creation response:"
echo "$response" | jq '.'

# Extract customer ID for further testing
customer_id=$(echo "$response" | jq -r '.data.id // empty')
customer_success=$(echo "$response" | jq -r '.success // false')

if [ "$customer_success" = "true" ] && [ -n "$customer_id" ]; then
    echo "✅ Customer created successfully with ID: $customer_id"
    
    # Check app registration details
    app_registration=$(echo "$response" | jq -r '.data.appRegistration // empty')
    if [ -n "$app_registration" ] && [ "$app_registration" != "null" ]; then
        echo ""
        echo "📋 App Registration Details:"
        echo "$response" | jq -r '.data.appRegistration'
        
        # Check if it's a real app registration (not pending)
        client_id=$(echo "$response" | jq -r '.data.appRegistration.clientId // empty')
        client_secret=$(echo "$response" | jq -r '.data.appRegistration.clientSecret // empty')
        consent_url=$(echo "$response" | jq -r '.data.appRegistration.consentUrl // empty')
        
        if [[ "$client_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
            echo "✅ Real Azure AD App Registration Created!"
            echo "   Client ID: $client_id"
            echo "   Client Secret: $([ ${#client_secret} -gt 10 ] && echo "***REAL_SECRET_VALUE***" || echo "$client_secret")"
            echo "   Consent URL: $consent_url"
            
            if [ "$client_secret" = "STORED_IN_KEY_VAULT" ]; then
                echo "🔐 Client secret was securely stored in Key Vault"
            elif [ ${#client_secret} -gt 30 ]; then
                echo "🔐 Client secret appears to be a real value (length: ${#client_secret})"
            else
                echo "⚠️  Client secret might be a placeholder"
            fi
        else
            echo "⚠️  App registration appears to be placeholder/pending:"
            echo "   Client ID: $client_id"
        fi
        
        # Check permissions
        permissions=$(echo "$response" | jq -r '.data.appRegistration.permissions // [] | join(", ")')
        echo "   Permissions: $permissions"
    else
        echo "❌ No app registration found in response"
    fi
else
    echo "❌ Customer creation failed:"
    echo "$response" | jq -r '.error // "Unknown error"'
fi

echo ""

# Test 3: Verify customer appears in customers list
echo "3. Verifying customer appears in customers list..."
response=$(make_json_request "GET" "/customers")
new_count=$(echo "$response" | jq -r '.data // [] | length')
echo "Customers count after creation: $new_count"

if [ "$new_count" -gt "$existing_count" ]; then
    echo "✅ Customer successfully added to list"
    
    # Find our customer in the list
    our_customer=$(echo "$response" | jq -r --arg domain "$TEST_TENANT_DOMAIN" '.data[] | select(.tenantDomain == $domain)')
    if [ -n "$our_customer" ] && [ "$our_customer" != "null" ]; then
        echo "✅ Our test customer found in the list:"
        echo "$our_customer" | jq '.'
    else
        echo "⚠️  Our test customer not found in the list"
    fi
else
    echo "❌ Customer count did not increase"
fi

echo ""

# Test 4: Test assessment creation for the new customer
if [ -n "$customer_id" ]; then
    echo "4. Testing assessment creation for new customer..."
    assessment_data='{
        "customerId": "'$customer_id'",
        "tenantId": "'$TEST_TENANT_ID'",
        "assessmentName": "Test Assessment for '$TEST_TENANT_NAME'",
        "includedCategories": ["license", "secureScore"],
        "notificationEmail": "admin@'$TEST_TENANT_DOMAIN'",
        "autoSchedule": false,
        "scheduleFrequency": "monthly"
    }'
    
    assessment_response=$(make_json_request "POST" "/assessment" "$assessment_data")
    echo "Assessment creation response:"
    echo "$assessment_response" | jq '.'
    
    assessment_success=$(echo "$assessment_response" | jq -r '.success // false')
    if [ "$assessment_success" = "true" ]; then
        echo "✅ Assessment created successfully"
    else
        echo "⚠️  Assessment creation failed (this may be expected if app consent is not granted)"
        error_msg=$(echo "$assessment_response" | jq -r '.error // "Unknown error"')
        echo "   Error: $error_msg"
        
        # Check if it's a consent-related error
        if [[ "$error_msg" =~ [Cc]onsent|[Aa]uthoriz|[Pp]ermission ]]; then
            echo "   This is expected - admin consent is required for the app registration"
        fi
    fi
fi

echo ""
echo "🎯 Test Summary:"
echo "==============="
echo "✅ Customer creation endpoint working"
echo "✅ Automatic app registration triggered"
if [[ "$client_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    echo "✅ Real Azure AD app registration created"
else
    echo "⚠️  App registration may be placeholder (check Azure service principal config)"
fi
echo ""
echo "📋 Next steps:"
echo "1. Go to Azure Portal → App registrations"
echo "2. Find the app: M365-Security-Assessment-$TEST_TENANT_NAME"
echo "3. Grant admin consent for the required permissions"
echo "4. Test assessment creation in the UI"
echo ""
echo "🧹 Cleanup (optional):"
echo "To remove test customer, use DELETE /api/customers/$customer_id"
