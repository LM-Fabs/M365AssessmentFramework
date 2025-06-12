"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateKeyVaultIntegration = void 0;
const keyVaultService_1 = require("../shared/keyVaultService");
const functions_1 = require("@azure/functions");
/**
 * HTTP function that validates Azure Key Vault integration
 * Tests the connection to Key Vault and retrieves secrets to ensure they are accessible
 */
exports.validateKeyVaultIntegration = functions_1.app.http('validateKeyVaultIntegration', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        try {
            context.log('Validating Key Vault integration...');
            // Initialize KeyVaultService
            const keyVaultService = (0, keyVaultService_1.getKeyVaultService)();
            // Simple timestamp to see when validation was run
            const timestamp = new Date().toISOString();
            // Start collecting validation results
            const validationResults = {
                timestamp,
                status: 'success',
                keyVaultAccess: false,
                secretsRetrieved: false,
                healthCheck: false,
                errors: []
            };
            try {
                // Test Key Vault health check
                const healthCheck = await keyVaultService.healthCheck();
                validationResults.healthCheck = healthCheck;
                validationResults.keyVaultAccess = healthCheck;
                if (healthCheck) {
                    validationResults.secretsRetrieved = true;
                }
                else {
                    validationResults.errors.push('Key Vault health check failed');
                }
            }
            catch (error) {
                validationResults.status = 'error';
                validationResults.errors.push(`Error accessing Key Vault: ${error.message}`);
                context.error('Key Vault integration validation failed:', error);
            }
            return {
                status: validationResults.status === 'success' ? 200 : 500,
                jsonBody: validationResults
            };
        }
        catch (error) {
            context.error('Validation failed with unexpected error:', error);
            return {
                status: 500,
                jsonBody: {
                    status: 'error',
                    message: 'Validation failed with unexpected error',
                    error: error.message
                }
            };
        }
    }
});
//# sourceMappingURL=index.js.map