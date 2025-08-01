// Script to create a test customer with different tenant ID for multi-tenant testing
// This will create a customer that represents a different organization for proper testing

const testCustomerData = {
    tenantName: "Modern Workplace Tips",
    tenantDomain: "modernworkplace.tips", 
    tenantId: "70adb6e8-c6f7-4f25-a75f-9bca098db644", // Your real tenant ID
    contactEmail: "f.sodke@modernworkplace.tips",
    notes: "Real customer tenant for testing with actual Microsoft Graph data",
    skipAutoAppRegistration: false // Allow app registration since this is your tenant
};

console.log('Test Customer Data for Multi-Tenant Testing:');
console.log(JSON.stringify(testCustomerData, null, 2));

console.log('\n=== INSTRUCTIONS ===');
console.log('1. Use this data to create a new customer via POST to /api/customers');
console.log('2. This customer uses your REAL tenant (modernworkplace.tips) for testing with actual data');
console.log('3. When creating assessments, use this customer ID and tenant ID');
console.log('4. The MultiTenantGraphService will authenticate to your tenant: 70adb6e8-c6f7-4f25-a75f-9bca098db644');
console.log('5. Since this is your tenant, you have admin consent and should get REAL Microsoft Graph data');
console.log('6. This will test the multi-tenant system with real license/secure score data');

// Export for potential use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testCustomerData };
}
