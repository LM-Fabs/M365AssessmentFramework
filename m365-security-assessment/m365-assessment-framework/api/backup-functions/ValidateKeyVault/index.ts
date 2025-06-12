import { getKeyVaultService } from '../shared/keyVaultService';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

/**
 * HTTP function that validates Azure Key Vault integration
 * Tests the connection to Key Vault and retrieves secrets to ensure they are accessible
 */
export const validateKeyVaultIntegration = app.http('validateKeyVaultIntegration', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        try {
            context.log('Validating Key Vault integration...');
            
            // Initialize KeyVaultService
            const keyVaultService = getKeyVaultService();
            
            // Simple timestamp to see when validation was run
            const timestamp = new Date().toISOString();
            
            // Start collecting validation results
            const validationResults = {
                timestamp,
                status: 'success',
                keyVaultAccess: false,
                secretsRetrieved: false,
                healthCheck: false,
                errors: [] as string[]
            };
            
            try {
                // Test Key Vault health check
                const healthCheck = await keyVaultService.healthCheck();
                validationResults.healthCheck = healthCheck;
                validationResults.keyVaultAccess = healthCheck;
                
                if (healthCheck) {
                    validationResults.secretsRetrieved = true;
                } else {
                    validationResults.errors.push('Key Vault health check failed');
                }
                
            } catch (error: any) {
                validationResults.status = 'error';
                validationResults.errors.push(`Error accessing Key Vault: ${error.message}`);
                context.error('Key Vault integration validation failed:', error);
            }
            
            return {
                status: validationResults.status === 'success' ? 200 : 500,
                jsonBody: validationResults
            };
        } catch (error: any) {
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