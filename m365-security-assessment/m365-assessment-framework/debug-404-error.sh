#!/bin/bash
# Comprehensive API debugging for the 404 error

echo "🚨 Debugging API 404 Error"
echo "========================="

DOMAIN="https://victorious-pond-069956e03.6.azurestaticapps.net"

echo ""
echo "🔍 Testing: $DOMAIN/api/customers"
echo ""

echo "1. Testing with curl (verbose):"
echo "--------------------------------"
curl -v "$DOMAIN/api/customers" 2>&1 | head -20

echo ""
echo "2. Testing just headers:"
echo "------------------------"
curl -I "$DOMAIN/api/customers"

echo ""
echo "3. Testing other API endpoints:"
echo "-------------------------------"
echo "Testing /api/test:"
curl -I "$DOMAIN/api/test"

echo ""
echo "Testing /api/diagnostics:"
curl -I "$DOMAIN/api/diagnostics"

echo ""
echo "4. Quick fixes to try:"
echo "======================"
echo ""
echo "A. Clear browser cache and hard refresh (Ctrl+F5)"
echo "B. Try the URL directly in browser: $DOMAIN/api/customers"
echo "C. Check Azure Portal:"
echo "   - Go to Azure Static Web Apps"
echo "   - Check Functions tab"
echo "   - Look at deployment logs"
echo "D. Check if function is deployed:"
echo "   - Azure Portal → Your Static Web App → Functions"
echo "   - Should see 'customers' function listed"
echo ""
echo "5. If you can browse to the URL manually but the app fails:"
echo "   - This is likely a CORS or HEAD request issue"
echo "   - The fix I made should resolve this"
echo "   - Redeploy your application"
