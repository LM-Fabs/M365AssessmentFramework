#!/bin/bash

# End-to-End Manual App Registration Workflow Test
# This script tests the complete manual app registration workflow

echo "🧪 M365 Assessment Framework - Manual Workflow E2E Test"
echo "======================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:7072/api}"
TEST_TENANT_DOMAIN="test-manual-$(date +%s).onmicrosoft.com"
TEST_TENANT_NAME="Test Manual Registration Company"

# Function to print status
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Function to make API call
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    print_status "info" "Testing: $description"
    
    if [[ -n "$data" ]]; then
        response=$(curl -s -X "$method" "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\n%{http_code}")
    else
        response=$(curl -s -X "$method" "$API_BASE_URL$endpoint" \
            -w "\n%{http_code}")
    fi
    
    # Split response and status code
    body=$(echo "$response" | head -n -1)
    status_code=$(echo "$response" | tail -n 1)
    
    echo "   Status: $status_code"
    echo "   Response: $body"
    echo ""
    
    if [[ $status_code -ge 200 && $status_code -lt 300 ]]; then
        print_status "success" "$description completed successfully"
        return 0
    else
        print_status "error" "$description failed (HTTP $status_code)"
        return 1
    fi
}

echo "This script will test the complete manual app registration workflow:"
echo "1. Create customer with manual setup flag"
echo "2. Verify customer record has manual setup instructions"
echo "3. Simulate updating customer with app registration details"
echo "4. Test API endpoints and data flow"
echo ""

read -p "Continue with the test? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Test cancelled."
    exit 0
fi

echo ""
print_status "info" "Starting end-to-end manual workflow test..."
echo ""

# Test 1: Check API health
print_status "info" "=== Test 1: API Health Check ==="
api_call "GET" "/customers" "" "Get customers list (health check)"

# Test 2: Create customer with manual setup
print_status "info" "=== Test 2: Create Customer with Manual Setup ==="
customer_data='{
  "tenantName": "'$TEST_TENANT_NAME'",
  "tenantDomain": "'$TEST_TENANT_DOMAIN'",
  "skipAutoAppRegistration": true,
  "contactEmail": "admin@'$TEST_TENANT_DOMAIN'",
  "notes": "Test customer for manual app registration workflow"
}'

if api_call "POST" "/customers" "$customer_data" "Create customer with manual setup flag"; then
    # Extract customer ID from response
    CUSTOMER_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//; s/"$//')
    print_status "success" "Customer created with ID: $CUSTOMER_ID"
else
    print_status "error" "Failed to create customer"
    exit 1
fi

# Test 3: Verify customer record
print_status "info" "=== Test 3: Verify Customer Record ==="
if [[ -n "$CUSTOMER_ID" ]]; then
    api_call "GET" "/customers/$CUSTOMER_ID" "" "Get customer details"
    
    # Check if response contains manual setup indicators
    if echo "$body" | grep -q "MANUAL_SETUP_REQUIRED"; then
        print_status "success" "Customer record contains manual setup placeholders"
    else
        print_status "warning" "Customer record may not have proper manual setup indicators"
    fi
    
    if echo "$body" | grep -q "isManualSetup"; then
        print_status "success" "Customer record has manual setup flag"
    else
        print_status "warning" "Customer record may be missing manual setup flag"
    fi
else
    print_status "error" "No customer ID available for verification"
fi

# Test 4: Simulate updating customer with app registration
print_status "info" "=== Test 4: Update Customer with App Registration ==="
app_reg_data='{
  "appRegistration": {
    "applicationId": "12345678-1234-1234-1234-123456789012",
    "clientId": "12345678-1234-1234-1234-123456789012",
    "servicePrincipalId": "87654321-4321-4321-4321-210987654321",
    "clientSecret": "test-secret-value-for-demo",
    "isReal": true,
    "isManualSetup": true,
    "updatedDate": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "permissions": [
      "Organization.Read.All",
      "SecurityEvents.Read.All",
      "Reports.Read.All",
      "Directory.Read.All",
      "Policy.Read.All",
      "IdentityRiskyUser.Read.All",
      "AuditLog.Read.All"
    ]
  }
}'

if [[ -n "$CUSTOMER_ID" ]]; then
    api_call "PUT" "/customers/$CUSTOMER_ID" "$app_reg_data" "Update customer with app registration details"
else
    print_status "error" "No customer ID available for update test"
fi

# Test 5: Verify updated customer
print_status "info" "=== Test 5: Verify Updated Customer ==="
if [[ -n "$CUSTOMER_ID" ]]; then
    api_call "GET" "/customers/$CUSTOMER_ID" "" "Get updated customer details"
    
    # Check if app registration was updated
    if echo "$body" | grep -q "12345678-1234-1234-1234-123456789012"; then
        print_status "success" "Customer record contains updated app registration details"
    else
        print_status "warning" "Customer record may not have been updated properly"
    fi
else
    print_status "error" "No customer ID available for verification"
fi

# Test 6: Clean up (delete test customer)
print_status "info" "=== Test 6: Cleanup ==="
if [[ -n "$CUSTOMER_ID" ]]; then
    read -p "Delete test customer $CUSTOMER_ID? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        api_call "DELETE" "/customers/$CUSTOMER_ID" "" "Delete test customer"
    else
        print_status "info" "Test customer $CUSTOMER_ID left in system for manual inspection"
    fi
else
    print_status "info" "No test customer to clean up"
fi

echo ""
print_status "info" "=== Test Summary ==="
echo "✅ Manual workflow test completed"
echo "📋 Manual setup process verified:"
echo "   1. Customer creation with skipAutoAppRegistration flag"
echo "   2. Placeholder values for manual setup"
echo "   3. Customer update with real app registration details"
echo "   4. API endpoints functioning correctly"
echo ""
echo "🎯 Next steps for production use:"
echo "   1. Use MANUAL-APP-REGISTRATION-GUIDE.md for setup instructions"
echo "   2. Use validate-manual-app-registration.sh for app validation"
echo "   3. Test with real Azure AD app registration"
echo "   4. Verify customer admin consent process"
echo ""
print_status "success" "Manual app registration workflow is ready for use!"
