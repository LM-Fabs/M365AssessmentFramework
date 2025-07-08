#!/bin/bash

# Backend Service Validation Script
# Checks if the backend is properly configured for automatic app registration

echo "🔍 Backend Service Validation for Automatic App Registration"
echo "==========================================================="

# Check if we're in the right directory
if [ ! -f "api/index.ts" ]; then
    echo "❌ Error: Run this script from the m365-assessment-framework directory"
    exit 1
fi

echo ""
echo "1. Checking TypeScript compilation..."

# Check for TypeScript errors
cd api
npm run build > /dev/null 2>&1
build_result=$?

if [ $build_result -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    echo "   Run 'npm run build' in the api directory to see errors"
fi

echo ""
echo "2. Checking required imports and services..."

# Check for required imports in index.ts
if grep -q "KeyVaultService" index.ts; then
    echo "✅ KeyVaultService imported"
else
    echo "❌ KeyVaultService not imported"
fi

if grep -q "getKeyVaultService" index.ts; then
    echo "✅ KeyVaultService getter imported"
else
    echo "❌ KeyVaultService getter not imported"
fi

if grep -q "createMultiTenantAppRegistration" index.ts; then
    echo "✅ App registration method referenced"
else
    echo "❌ App registration method not found"
fi

echo ""
echo "3. Checking GraphApiService implementation..."

# Check GraphApiService
if [ -f "shared/graphApiService.ts" ]; then
    echo "✅ GraphApiService file exists"
    
    if grep -q "createMultiTenantAppRegistration" shared/graphApiService.ts; then
        echo "✅ createMultiTenantAppRegistration method exists"
    else
        echo "❌ createMultiTenantAppRegistration method missing"
    fi
    
    if grep -q "secretText" shared/graphApiService.ts; then
        echo "✅ Client secret extraction implemented"
    else
        echo "❌ Client secret extraction missing"
    fi
else
    echo "❌ GraphApiService file missing"
fi

echo ""
echo "4. Checking KeyVaultService implementation..."

# Check KeyVaultService
if [ -f "shared/keyVaultService.ts" ]; then
    echo "✅ KeyVaultService file exists"
    
    if grep -q "storeClientSecret" shared/keyVaultService.ts; then
        echo "✅ storeClientSecret method exists"
    else
        echo "❌ storeClientSecret method missing"
    fi
    
    if grep -q "get isInitialized" shared/keyVaultService.ts; then
        echo "✅ isInitialized getter exists"
    else
        echo "❌ isInitialized getter missing"
    fi
else
    echo "❌ KeyVaultService file missing"
fi

echo ""
echo "5. Checking environment variable handling..."

# Check for environment variable validation
if grep -q "AZURE_CLIENT_ID" index.ts && grep -q "AZURE_CLIENT_SECRET" index.ts; then
    echo "✅ Azure environment variables validated"
else
    echo "❌ Azure environment variables not validated"
fi

if grep -q "KEY_VAULT_URL" shared/keyVaultService.ts; then
    echo "✅ Key Vault URL configuration exists"
else
    echo "❌ Key Vault URL configuration missing"
fi

echo ""
echo "6. Checking error handling..."

# Check for proper error handling
if grep -q "requiredPermissions" index.ts | grep -A 5 -B 5 "catch"; then
    echo "✅ Error handling with permissions exists"
else
    echo "⚠️  Check error handling implementation"
fi

if grep -q "troubleshooting" index.ts; then
    echo "✅ Troubleshooting information included"
else
    echo "❌ Troubleshooting information missing"
fi

echo ""
echo "7. Checking package dependencies..."

# Check package.json for required dependencies
if [ -f "package.json" ]; then
    if grep -q "@azure/identity" package.json; then
        echo "✅ Azure Identity package included"
    else
        echo "❌ Azure Identity package missing"
    fi
    
    if grep -q "@azure/keyvault-secrets" package.json; then
        echo "✅ Key Vault Secrets package included"
    else
        echo "❌ Key Vault Secrets package missing"
    fi
    
    if grep -q "@azure/msal-node" package.json; then
        echo "✅ MSAL Node package included"
    else
        echo "❌ MSAL Node package missing"
    fi
else
    echo "❌ package.json not found"
fi

cd ..

echo ""
echo "8. Checking test files..."

if [ -f "test-automatic-app-registration.sh" ]; then
    echo "✅ Automatic app registration test script exists"
    if [ -x "test-automatic-app-registration.sh" ]; then
        echo "✅ Test script is executable"
    else
        echo "⚠️  Test script needs execute permission"
    fi
else
    echo "❌ Test script missing"
fi

echo ""
echo "9. Checking documentation..."

if [ -f "AUTOMATIC-APP-REGISTRATION.md" ]; then
    echo "✅ Documentation exists"
else
    echo "❌ Documentation missing"
fi

echo ""
echo "=== VALIDATION SUMMARY ==="

# Count issues
issues=0

# Basic checks
[ $build_result -ne 0 ] && issues=$((issues + 1))
[ ! -f "api/shared/graphApiService.ts" ] && issues=$((issues + 1))
[ ! -f "api/shared/keyVaultService.ts" ] && issues=$((issues + 1))

if [ $issues -eq 0 ]; then
    echo "🎉 All checks passed! Backend ready for automatic app registration"
    echo ""
    echo "Next steps:"
    echo "1. Deploy the backend changes"
    echo "2. Set environment variables (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)"
    echo "3. Test with: ./test-automatic-app-registration.sh"
    echo "4. Grant service principal Application.ReadWrite.All permission"
else
    echo "⚠️  Found $issues issue(s) that need attention"
    echo ""
    echo "Please resolve the issues above before deploying"
fi

echo ""
