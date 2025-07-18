#!/bin/bash
# Debug script for ConsentUrlGenerator issues

echo "🔍 Debug: Checking ConsentUrlGenerator Issues"
echo "============================================="

echo ""
echo "1. Checking browser console for errors..."
echo "   Open browser dev tools (F12) and look for:"
echo "   - '🎯 ConsentUrlGenerator initialized:' log"
echo "   - '🔍 generateConsentUrl called:' log"
echo "   - Any red error messages"

echo ""
echo "2. Environment variables to check:"
echo "   REACT_APP_CLIENT_ID = ${REACT_APP_CLIENT_ID:-'NOT SET'}"
echo "   AZURE_CLIENT_ID = ${AZURE_CLIENT_ID:-'NOT SET'}"

echo ""
echo "3. Expected behavior:"
echo "   ✅ Customer dropdown should show customer names"
echo "   ✅ Selecting a customer should trigger URL generation"
echo "   ✅ URL should appear in the gray box below the form"

echo ""
echo "4. Common fixes:"
echo "   a) Ensure customers array is not empty"
echo "   b) Set REACT_APP_CLIENT_ID environment variable"
echo "   c) Check that customer has tenantName or tenantDomain"
echo "   d) Ensure customer is selected before expecting URL"

echo ""
echo "5. Test steps:"
echo "   1. Open ConsentUrlGenerator"
echo "   2. Check browser console logs"
echo "   3. Try selecting a customer from dropdown"
echo "   4. Enter a tenant ID manually if auto-detect fails"
echo "   5. Check if URL appears in gray box"

echo ""
echo "6. If customers dropdown is empty:"
echo "   - Check that customers prop is passed correctly"
echo "   - Verify customerService is returning data"
echo "   - Check API endpoint /api/customers"

echo ""
echo "7. If URL generation fails:"
echo "   - Check clientId is configured properly"
echo "   - Verify customer is selected"
echo "   - Check console for error messages"
echo "   - Try entering tenant ID manually"
