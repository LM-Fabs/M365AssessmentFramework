#!/bin/bash

echo "🔍 Debugging Customer Update in Azure Table Storage"
echo "=================================================="

# Get current customer records
echo ""
echo "📋 Current customers in database:"
cd m365-security-assessment/m365-assessment-framework
npm run build > /dev/null 2>&1

# Create a test script to inspect the actual table storage data
cat > debug-table-storage.js << 'EOF'
const { TableClient } = require("@azure/data-tables");

async function debugTableStorage() {
    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
        console.log('🔗 Using connection:', connectionString.includes('UseDevelopmentStorage') ? 'Local Emulator' : 'Azure Storage');
        
        const customersTable = TableClient.fromConnectionString(connectionString, 'customers');
        
        console.log('\n📊 Raw customer entities from Table Storage:');
        console.log('===========================================');
        
        const entities = customersTable.listEntities();
        for await (const entity of entities) {
            console.log('\n🔍 Entity:', entity.rowKey);
            console.log('   - Tenant Name:', entity.tenantName);
            console.log('   - Tenant Domain:', entity.tenantDomain);
            console.log('   - Status:', entity.status);
            console.log('   - App Registration (raw):', entity.appRegistration);
            
            if (entity.appRegistration) {
                try {
                    const parsed = JSON.parse(entity.appRegistration);
                    console.log('   - App Registration (parsed):');
                    console.log('     * Application ID:', parsed.applicationId);
                    console.log('     * Client ID:', parsed.clientId);
                    console.log('     * Service Principal ID:', parsed.servicePrincipalId);
                    console.log('     * Permissions:', parsed.permissions?.join(', ') || 'None');
                } catch (e) {
                    console.log('   - App Registration (parse error):', e.message);
                }
            }
            console.log('   - Created:', entity.createdDate);
            console.log('   - Last Assessment:', entity.lastAssessmentDate);
        }
        
    } catch (error) {
        console.error('❌ Error accessing table storage:', error.message);
    }
}

debugTableStorage();
EOF

echo ""
echo "🔍 Raw Table Storage Data:"
node debug-table-storage.js

echo ""
echo "🧪 Testing customer update via API..."

# Test customer update via API
CUSTOMER_ID="test-customer-$(date +%s)"

# Create test customer first
echo "📝 Creating test customer: $CUSTOMER_ID"
curl -s -X POST http://localhost:7071/api/customers \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantName\": \"Test Customer for Update\",
    \"tenantDomain\": \"testupdate.onmicrosoft.com\",
    \"contactEmail\": \"test@testupdate.com\",
    \"manual\": true
  }" | jq '.'

echo ""
echo "⏱️ Waiting 2 seconds for creation to complete..."
sleep 2

echo ""
echo "📊 Customer after creation:"
node debug-table-storage.js | grep -A 15 "$CUSTOMER_ID" || echo "Customer not found in raw data"

echo ""
echo "🔄 Updating customer with real app registration..."
curl -s -X PUT "http://localhost:7071/api/customers/$CUSTOMER_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"appRegistration\": {
      \"applicationId\": \"real-app-12345\",
      \"clientId\": \"real-client-67890\",
      \"servicePrincipalId\": \"real-sp-abcdef\",
      \"permissions\": [\"User.Read\", \"Directory.Read.All\"],
      \"clientSecret\": \"real-secret-xyz\",
      \"consentUrl\": \"https://real-consent-url.com\",
      \"redirectUri\": \"https://real-redirect.com\"
    }
  }" | jq '.'

echo ""
echo "⏱️ Waiting 2 seconds for update to complete..."
sleep 2

echo ""
echo "📊 Customer after update:"
node debug-table-storage.js | grep -A 15 "$CUSTOMER_ID" || echo "Customer not found in raw data"

echo ""
echo "🧹 Cleaning up test customer..."
curl -s -X DELETE "http://localhost:7071/api/customers/$CUSTOMER_ID" > /dev/null

# Clean up
rm -f debug-table-storage.js

echo ""
echo "✅ Debug complete!"
