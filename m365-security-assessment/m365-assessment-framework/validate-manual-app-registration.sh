#!/bin/bash

# Manual App Registration Validation Script
# This script helps validate a manual app registration setup

echo "🔍 M365 Assessment Framework - Manual App Registration Validation"
echo "==============================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to validate URL format
validate_url() {
    local url=$1
    if [[ $url =~ ^https?:// ]]; then
        return 0
    else
        return 1
    fi
}

# Function to validate GUID format
validate_guid() {
    local guid=$1
    if [[ $guid =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
        return 0
    else
        return 1
    fi
}

echo "This script will help you validate your manual app registration setup."
echo "Please have the following information ready:"
echo "- Customer tenant ID or domain"
echo "- App registration client ID"
echo "- App registration client secret"
echo ""

# Get customer information
read -p "Customer tenant domain (e.g., customer.onmicrosoft.com): " CUSTOMER_DOMAIN
read -p "Customer tenant ID (optional): " CUSTOMER_TENANT_ID
read -p "App registration client ID: " CLIENT_ID
read -s -p "App registration client secret: " CLIENT_SECRET
echo ""
echo ""

# Validation checks
print_status "info" "Starting validation checks..."
echo ""

# 1. Validate customer domain format
if [[ -n "$CUSTOMER_DOMAIN" ]]; then
    if [[ $CUSTOMER_DOMAIN =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$ ]]; then
        print_status "success" "Customer domain format is valid"
    else
        print_status "warning" "Customer domain format may be invalid"
    fi
else
    print_status "error" "Customer domain is required"
    exit 1
fi

# 2. Validate tenant ID format (if provided)
if [[ -n "$CUSTOMER_TENANT_ID" ]]; then
    if validate_guid "$CUSTOMER_TENANT_ID"; then
        print_status "success" "Customer tenant ID format is valid"
    else
        print_status "warning" "Customer tenant ID format may be invalid (expected GUID format)"
    fi
fi

# 3. Validate client ID format
if [[ -n "$CLIENT_ID" ]]; then
    if validate_guid "$CLIENT_ID"; then
        print_status "success" "Client ID format is valid"
    else
        print_status "error" "Client ID format is invalid (expected GUID format)"
        exit 1
    fi
else
    print_status "error" "Client ID is required"
    exit 1
fi

# 4. Validate client secret
if [[ -n "$CLIENT_SECRET" ]]; then
    if [[ ${#CLIENT_SECRET} -ge 32 ]]; then
        print_status "success" "Client secret length appears valid"
    else
        print_status "warning" "Client secret seems too short (may be invalid)"
    fi
else
    print_status "error" "Client secret is required"
    exit 1
fi

echo ""
print_status "info" "Attempting to resolve customer tenant..."

# 5. Try to resolve tenant ID from domain
if [[ -z "$CUSTOMER_TENANT_ID" ]]; then
    print_status "info" "Attempting to resolve tenant ID from domain..."
    
    # Try to get tenant ID from well-known endpoint
    TENANT_RESOLVE_URL="https://login.microsoftonline.com/$CUSTOMER_DOMAIN/.well-known/openid-configuration"
    
    if command -v curl >/dev/null 2>&1; then
        RESOLVED_TENANT=$(curl -s "$TENANT_RESOLVE_URL" 2>/dev/null | grep -o '"issuer":"[^"]*"' | sed 's/"issuer":"https:\/\/login.microsoftonline.com\///; s/\/v2.0"$//')
        
        if [[ -n "$RESOLVED_TENANT" && "$RESOLVED_TENANT" != "null" ]]; then
            print_status "success" "Resolved tenant ID: $RESOLVED_TENANT"
            CUSTOMER_TENANT_ID="$RESOLVED_TENANT"
        else
            print_status "warning" "Could not resolve tenant ID from domain"
        fi
    else
        print_status "warning" "curl not available - cannot resolve tenant ID"
    fi
fi

echo ""
print_status "info" "Testing Microsoft Graph API access..."

# 6. Test Graph API access
if command -v curl >/dev/null 2>&1; then
    # Get access token
    TOKEN_URL="https://login.microsoftonline.com/$CUSTOMER_TENANT_ID/oauth2/v2.0/token"
    
    TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "client_id=$CLIENT_ID" \
        -d "client_secret=$CLIENT_SECRET" \
        -d "scope=https://graph.microsoft.com/.default" \
        -d "grant_type=client_credentials" 2>/dev/null)
    
    if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
        print_status "success" "Successfully obtained access token"
        
        # Extract access token
        ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*"' | sed 's/"access_token":"//; s/"$//')
        
        if [[ -n "$ACCESS_TOKEN" ]]; then
            # Test basic Graph API call
            ORG_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
                "https://graph.microsoft.com/v1.0/organization" 2>/dev/null)
            
            if echo "$ORG_RESPONSE" | grep -q '"@odata.context"'; then
                print_status "success" "Successfully accessed Microsoft Graph API"
                
                # Extract organization name
                ORG_NAME=$(echo "$ORG_RESPONSE" | grep -o '"displayName":"[^"]*"' | head -1 | sed 's/"displayName":"//; s/"$//')
                if [[ -n "$ORG_NAME" ]]; then
                    print_status "info" "Organization: $ORG_NAME"
                fi
            else
                print_status "error" "Failed to access Microsoft Graph API"
                print_status "info" "Response: $ORG_RESPONSE"
            fi
        fi
    else
        print_status "error" "Failed to obtain access token"
        print_status "info" "Response: $TOKEN_RESPONSE"
        
        # Check for common errors
        if echo "$TOKEN_RESPONSE" | grep -q "invalid_client"; then
            print_status "error" "Invalid client credentials - check client ID and secret"
        elif echo "$TOKEN_RESPONSE" | grep -q "unauthorized_client"; then
            print_status "error" "Client not authorized - check app registration configuration"
        elif echo "$TOKEN_RESPONSE" | grep -q "invalid_scope"; then
            print_status "error" "Invalid scope - check API permissions"
        fi
    fi
else
    print_status "warning" "curl not available - cannot test API access"
fi

echo ""
print_status "info" "Validation complete!"

# Summary
echo ""
echo "=== SUMMARY ==="
echo "Customer Domain: $CUSTOMER_DOMAIN"
echo "Customer Tenant ID: ${CUSTOMER_TENANT_ID:-'Not resolved'}"
echo "Client ID: $CLIENT_ID"
echo "Client Secret: [HIDDEN]"

echo ""
echo "=== NEXT STEPS ==="
echo "1. If validation failed, check the following:"
echo "   - Verify client ID and secret are correct"
echo "   - Ensure API permissions are granted with admin consent"
echo "   - Check that the app registration supports multi-tenant access"
echo ""
echo "2. If validation succeeded:"
echo "   - Update the customer record in the M365 Assessment Framework"
echo "   - Provide the admin consent URL to the customer"
echo "   - Test running an assessment"
echo ""
echo "3. Admin consent URL template:"
echo "   https://login.microsoftonline.com/$CUSTOMER_TENANT_ID/oauth2/v2.0/authorize?client_id=$CLIENT_ID&response_type=code&redirect_uri=https%3A//portal.azure.com/&response_mode=query&scope=https://graph.microsoft.com/.default&state=12345&prompt=admin_consent"

echo ""
print_status "info" "For more help, see MANUAL-APP-REGISTRATION-GUIDE.md"
