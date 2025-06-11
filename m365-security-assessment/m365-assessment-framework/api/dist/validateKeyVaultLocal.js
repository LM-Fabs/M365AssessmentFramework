"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Local test script for validating Key Vault integration
const keyVaultService_1 = require("./shared/keyVaultService");
// Immediately invoked async function for testing
(async () => {
    console.log('Starting Key Vault integration validation...');
    try {
        // Get KeyVaultService instance
        const keyVaultService = (0, keyVaultService_1.getKeyVaultService)();
        console.log('KeyVaultService initialized successfully');
        // Test health check
        console.log('Testing Key Vault health check:');
        const healthCheck = await keyVaultService.healthCheck();
        console.log('- Health check:', healthCheck ? 'Passed' : 'Failed');
        if (healthCheck) {
            console.log('Key Vault integration validation completed successfully!');
        }
        else {
            console.log('Key Vault integration validation failed');
        }
    }
    catch (error) {
        console.error('Key Vault integration validation failed with error:', error);
    }
})();
//# sourceMappingURL=validateKeyVaultLocal.js.map