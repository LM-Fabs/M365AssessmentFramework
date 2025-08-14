/**
 * Test script to debug conditional access policy detection
 * This script helps identify issues with CA policy reporting
 */

const { MultiTenantGraphService } = require('./api/shared/multiTenantGraphService');

async function testConditionalAccessPolicies() {
    console.log('🔐 Testing conditional access policy detection...');
    
    // Check required environment variables
    const requiredVars = ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_TENANT_ID'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('❌ Missing environment variables:', missingVars.join(', '));
        console.log('Please ensure these are set in your Azure Static Web App configuration:');
        missingVars.forEach(varName => {
            console.log(`  - ${varName}`);
        });
        return;
    }
    
    console.log('✅ Environment variables found');
    console.log('🔧 Client ID:', process.env.AZURE_CLIENT_ID?.substring(0, 8) + '...');
    
    // You'll need to provide a test tenant ID here
    const testTenantId = process.env.TEST_TENANT_ID || 'your-customer-tenant-id';
    
    if (!testTenantId || testTenantId === 'your-customer-tenant-id') {
        console.log('⚠️ Please set TEST_TENANT_ID environment variable with a customer tenant ID to test');
        console.log('Usage: TEST_TENANT_ID=customer-tenant-id node test-conditional-access.js');
        return;
    }
    
    try {
        console.log('🏢 Initializing MultiTenantGraphService for tenant:', testTenantId);
        const graphService = new MultiTenantGraphService(testTenantId);
        
        console.log('🔐 Fetching conditional access policies...');
        const policies = await graphService.getConditionalAccessPolicies();
        
        console.log('✅ Results:');
        console.log(`   📊 Found ${policies.length} conditional access policies`);
        
        if (policies.length > 0) {
            console.log('   📋 Policy details:');
            policies.forEach((policy, index) => {
                console.log(`     ${index + 1}. ${policy.displayName || policy.name || 'Unnamed Policy'}`);
                console.log(`        State: ${policy.state || 'Unknown'}`);
                console.log(`        ID: ${policy.id || 'No ID'}`);
            });
        } else {
            console.log('   ⚠️ No conditional access policies detected');
            console.log('   🔍 This could indicate:');
            console.log('     - Admin consent not granted for Policy.Read.All');
            console.log('     - No conditional access policies configured in tenant');
            console.log('     - Insufficient permissions in the customer tenant');
            console.log('     - Premium license required (Azure AD Premium P1/P2)');
        }
        
        // Additional tests
        console.log('\n🧪 Additional diagnostic tests:');
        
        try {
            console.log('   🔍 Testing direct Graph API access...');
            const directTest = await graphService.graphClient.api('/identity/conditionalAccess/policies').get();
            console.log(`   ✅ Direct API call successful: ${directTest.value?.length || 0} policies`);
        } catch (directError) {
            console.log('   ❌ Direct API call failed:', directError.message);
            
            if (directError.message.includes('Forbidden')) {
                console.log('   💡 Solution: Missing Policy.Read.All permission');
                console.log('      Ensure admin consent includes this permission');
            } else if (directError.message.includes('Unauthorized')) {
                console.log('   💡 Solution: Authentication issue');
                console.log('      Check app registration and admin consent');
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing conditional access policies:', error.message);
        
        if (error.message.includes('AADSTS700016')) {
            console.log('💡 Solution: Customer admin needs to consent to the application');
            console.log('   Generate admin consent URL and have customer admin approve it');
        } else if (error.message.includes('AADSTS650057')) {
            console.log('💡 Solution: Check app registration configuration');
            console.log('   Verify AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are correct');
        } else if (error.message.includes('Forbidden')) {
            console.log('💡 Solution: Missing Policy.Read.All permission');
            console.log('   Ensure admin consent includes this permission');
        }
    }
}

testConditionalAccessPolicies().catch(console.error);
