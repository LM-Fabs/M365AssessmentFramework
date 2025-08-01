// Script to create an assessment for the test customer with different tenant ID
// This will test the MultiTenantGraphService with proper tenant separation

const testAssessmentData = {
    customerId: "be88c4e6-8943-4e41-88ac-b0ac5fc36537", // Test customer ID from Contoso
    tenantId: "12345678-1234-1234-1234-123456789012", // Different tenant ID (not modernworkplace.tips)
    assessmentName: "Multi-Tenant Test Assessment",
    includedCategories: ["license", "secureScore", "identity"],
    notificationEmail: "admin@contoso.com",
    autoSchedule: false,
    scheduleFrequency: "monthly"
};

console.log('Test Assessment Data for Multi-Tenant Testing:');
console.log(JSON.stringify(testAssessmentData, null, 2));

console.log('\n=== MULTI-TENANT TEST INSTRUCTIONS ===');
console.log('1. This assessment uses Contoso Corporation (different tenant)');
console.log('2. Tenant ID: 12345678-1234-1234-1234-123456789012 (NOT your tenant)');
console.log('3. When posted, MultiTenantGraphService will authenticate to this tenant');
console.log('4. Expected behavior:');
console.log('   - Should get authentication error (tenant does not exist)');
console.log('   - Should NOT show admin consent for modernworkplace.tips');
console.log('   - Error should indicate tenant not found or app not consented');
console.log('5. This proves the multi-tenant authentication is working correctly');

console.log('\n=== CURL COMMAND ===');
console.log('curl -X POST "https://victorious-pond-069956e03.6.azurestaticapps.net/api/assessments" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'' + JSON.stringify(testAssessmentData, null, 2) + '\'');

// Export for potential use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testAssessmentData };
}
