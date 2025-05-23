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
            const keyVaultService = keyVaultService_1.KeyVaultService.getInstance();
            // Simple timestamp to see when validation was run
            const timestamp = new Date().toISOString();
            // Start collecting validation results
            const validationResults = {
                timestamp,
                status: 'success',
                keyVaultAccess: false,
                secretsRetrieved: false,
                secrets: {
                    tenantId: false,
                    clientId: false,
                    clientSecret: false
                },
                graphCredentials: false,
                errors: []
            };
            try {
                // Test accessing a simple secret first
                const tenantId = await keyVaultService.getSecret('AZURE-TENANT-ID');
                validationResults.keyVaultAccess = true;
                validationResults.secrets.tenantId = !!tenantId;
                // Get all graph credentials
                const clientId = await keyVaultService.getSecret('AZURE-CLIENT-ID');
                const clientSecret = await keyVaultService.getSecret('AZURE-CLIENT-SECRET');
                validationResults.secrets.clientId = !!clientId;
                validationResults.secrets.clientSecret = !!clientSecret;
                // Test getGraphCredentials method
                const credentials = await keyVaultService.getGraphCredentials();
                validationResults.graphCredentials = !!credentials.tenantId &&
                    !!credentials.clientId &&
                    !!credentials.clientSecret;
                validationResults.secretsRetrieved = validationResults.graphCredentials;
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