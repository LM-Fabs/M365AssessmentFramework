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
        
        // Check customers table
        const customersTable = TableClient.fromConnectionString(connectionString, 'customers');
        console.log('\n📊 Raw customer entities from Table Storage:');
        console.log('===========================================');
        
        const customerEntities = customersTable.listEntities();
        for await (const entity of customerEntities) {
            console.log('\n🔍 Customer Entity:', entity.rowKey);
            console.log('   - Tenant Name:', entity.tenantName);
            console.log('   - Tenant Domain:', entity.tenantDomain);
            console.log('   - Tenant ID:', entity.tenantId);
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

        // Check assessments table
        const assessmentsTable = TableClient.fromConnectionString(connectionString, 'assessments');
        console.log('\n📈 Raw assessment entities from Table Storage:');
        console.log('===============================================');
        
        const assessmentEntities = assessmentsTable.listEntities();
        let assessmentCount = 0;
        for await (const entity of assessmentEntities) {
            assessmentCount++;
            console.log('\n🔍 Assessment Entity:', entity.rowKey);
            console.log('   - Customer ID:', entity.customerId);
            console.log('   - Tenant ID:', entity.tenantId);
            console.log('   - Date:', entity.date);
            console.log('   - Status:', entity.status);
            console.log('   - Score:', entity.score);
            console.log('   - Metrics (size):', entity.metrics ? entity.metrics.length : 'null');
            console.log('   - Recommendations (size):', entity.recommendations ? entity.recommendations.length : 'null');
            
            // Check for chunked data
            if (entity.metrics_isChunked) {
                console.log('   - Metrics is chunked:', entity.metrics_chunkCount, 'chunks');
            }
            if (entity.recommendations_isChunked) {
                console.log('   - Recommendations is chunked:', entity.recommendations_chunkCount, 'chunks');
            }
        }
        
        console.log(`\n📊 Total assessments found: ${assessmentCount}`);
        
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
echo "📝 Creating test customer..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:7071/api/customers \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantName\": \"Test Customer for Update $(date +%s)\",
    \"tenantDomain\": \"testupdate$(date +%s).onmicrosoft.com\",
    \"contactEmail\": \"test@testupdate.com\",
    \"manual\": true
  }")

echo "Create Response:"
echo "$CREATE_RESPONSE" | jq '.'

# Extract the actual customer ID from the response
CUSTOMER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.customer.id // .data.id // .existingCustomerId // "not-found"')
echo "📋 Extracted Customer ID: $CUSTOMER_ID"

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
