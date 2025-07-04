#!/bin/bash

# API Endpoint Testing Script
# This script tests the key API endpoints to ensure they respond correctly

API_BASE="https://victorious-pond-069956e03.6.azurestaticapps.net/api"

echo "🔥 Testing M365 Assessment Framework API Endpoints"
echo "=================================================="

# Test 1: Test endpoint (warmup endpoint)
echo ""
echo "1. Testing /api/test endpoint..."
echo "HEAD request (warmup):"
curl -s -I "$API_BASE/test" | head -1
echo "GET request (full):"
curl -s "$API_BASE/test" | jq -r '.message // .error // "No response"'

# Test 2: Diagnostics endpoint
echo ""
echo "2. Testing /api/diagnostics endpoint..."
echo "HEAD request (warmup):"
curl -s -I "$API_BASE/diagnostics" | head -1
echo "GET request (partial):"
curl -s "$API_BASE/diagnostics" | jq -r '.success // .error // "No response"'

# Test 3: Current assessment endpoint (problematic one from logs)
echo ""
echo "3. Testing /api/assessment/current endpoint..."
echo "HEAD request (warmup):"
curl -s -I "$API_BASE/assessment/current" | head -1
echo "GET request (full):"
curl -s "$API_BASE/assessment/current" | jq -r '.success // .error // "No response"'

# Test 4: Customers endpoint
echo ""
echo "4. Testing /api/customers endpoint..."
echo "HEAD request (warmup):"
curl -s -I "$API_BASE/customers" | head -1
echo "GET request (count only):"
curl -s "$API_BASE/customers" | jq -r '.count // .error // "No response"'

# Test 5: Azure Config endpoint
echo ""
echo "5. Testing /api/azure-config endpoint..."
echo "GET request (environment check):"
curl -s "$API_BASE/azure-config" | jq -r '.data.environment.AZURE_CLIENT_ID // .error // "No response"'

echo ""
echo "✅ API endpoint testing complete!"
echo ""
echo "Expected Results:"
echo "- All HEAD requests should return: HTTP/2 200"
echo "- Test endpoint should return: 'M365 Assessment API is working!'"
echo "- Diagnostics should return: true"
echo "- Assessment/current should return: true"
echo "- Customers should return: number (0 or more)"
echo "- Azure config should return: 'SET' or 'NOT SET'"
