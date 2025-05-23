"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Local test script for validating Key Vault integration
const keyVaultService_1 = require("./shared/keyVaultService");
// Immediately invoked async function for testing
(async () => {
    console.log('Starting Key Vault integration validation...');
    try {
        // Get KeyVaultService instance
        const keyVaultService = keyVaultService_1.KeyVaultService.getInstance();
        console.log('KeyVaultService initialized successfully');
        // Test retrieving individual secrets
        console.log('Testing individual secret retrieval:');
        const tenantId = await keyVaultService.getSecret('AZURE-TENANT-ID');
        console.log('- AZURE-TENANT-ID:', tenantId ? 'Retrieved successfully' : 'Failed to retrieve');
        const clientId = await keyVaultService.getSecret('AZURE-CLIENT-ID');
        console.log('- AZURE-CLIENT-ID:', clientId ? 'Retrieved successfully' : 'Failed to retrieve');
        const clientSecret = await keyVaultService.getSecret('AZURE-CLIENT-SECRET');
        console.log('- AZURE-CLIENT-SECRET:', clientSecret ? 'Retrieved successfully' : 'Failed to retrieve');
        // Test retrieving graph credentials
        console.log('\nTesting getGraphCredentials method:');
        const credentials = await keyVaultService.getGraphCredentials();
        console.log('Graph credentials retrieved:', credentials.tenantId && credentials.clientId && credentials.clientSecret ?
            'All credentials retrieved successfully' :
            'Some credentials missing');
        // Test caching
        console.log('\nTesting cache functionality:');
        console.log('Retrieving AZURE-TENANT-ID again (should use cache):');
        const cachedTenantId = await keyVaultService.getSecret('AZURE-TENANT-ID');
        console.log('- Cache hit successful:', cachedTenantId === tenantId);
        // Clear cache and retrieve again
        console.log('\nClearing cache and retrieving again:');
        keyVaultService.clearCache();
        const freshTenantId = await keyVaultService.getSecret('AZURE-TENANT-ID');
        console.log('- Fresh retrieval successful:', freshTenantId === tenantId);
        console.log('\nKey Vault integration validation completed successfully!');
    }
    catch (error) {
        console.error('Key Vault integration validation failed with error:', error);
    }
})();
//# sourceMappingURL=validateKeyVaultLocal.js.map