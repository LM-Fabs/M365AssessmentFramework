"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeyVaultService = exports.KeyVaultService = void 0;
const keyvault_secrets_1 = require("@azure/keyvault-secrets");
const identity_1 = require("@azure/identity");
/**
 * Azure Key Vault Service for secure secrets management
 * Uses managed identity for authentication and implements proper error handling
 * Follows Azure best practices for secrets management
 */
class KeyVaultService {
    constructor() {
        this.isInitialized = false;
        // Use managed identity for authentication (Azure best practice)
        const credential = new identity_1.DefaultAzureCredential();
        // Get Key Vault URL from environment variables
        const keyVaultUrl = process.env.KEY_VAULT_URL;
        if (!keyVaultUrl) {
            throw new Error("KEY_VAULT_URL environment variable is required");
        }
        this.client = new keyvault_secrets_1.SecretClient(keyVaultUrl, credential);
        this.isInitialized = true;
    }
    /**
     * Store client secret for a customer's app registration
     * Uses proper naming convention and metadata
     */
    async storeClientSecret(customerId, tenantDomain, clientSecret) {
        try {
            const secretName = `customer-${customerId}-client-secret`;
            const secretResponse = await this.client.setSecret(secretName, clientSecret, {
                contentType: 'application/x-client-secret',
                tags: {
                    customerId: customerId,
                    tenantDomain: tenantDomain,
                    type: 'client-secret',
                    createdBy: 'M365AssessmentFramework'
                },
                expiresOn: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year expiry
            });
            return secretResponse.name;
        }
        catch (error) {
            throw new Error(`Failed to store client secret: ${error.message}`);
        }
    }
    /**
     * Retrieve client secret for a customer
     * Used during assessment operations
     */
    async getClientSecret(customerId) {
        try {
            const secretName = `customer-${customerId}-client-secret`;
            const secretResponse = await this.client.getSecret(secretName);
            if (!secretResponse.value) {
                throw new Error(`No secret value found for customer ${customerId}`);
            }
            return secretResponse.value;
        }
        catch (error) {
            if (error.code === 'SecretNotFound') {
                throw new Error(`Client secret not found for customer ${customerId}`);
            }
            throw new Error(`Failed to retrieve client secret: ${error.message}`);
        }
    }
    /**
     * Rotate client secret for a customer
     * Updates the stored secret with new value
     */
    async rotateClientSecret(customerId, tenantDomain, newClientSecret) {
        try {
            const secretName = `customer-${customerId}-client-secret`;
            // Update with new secret
            await this.client.setSecret(secretName, newClientSecret, {
                contentType: 'application/x-client-secret',
                tags: {
                    customerId: customerId,
                    tenantDomain: tenantDomain,
                    type: 'client-secret',
                    createdBy: 'M365AssessmentFramework',
                    rotated: 'true',
                    rotatedDate: new Date().toISOString()
                },
                expiresOn: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year expiry
            });
        }
        catch (error) {
            throw new Error(`Failed to rotate client secret: ${error.message}`);
        }
    }
    /**
     * Delete client secret for a customer
     * Used when customer is removed
     */
    async deleteClientSecret(customerId) {
        try {
            const secretName = `customer-${customerId}-client-secret`;
            await this.client.beginDeleteSecret(secretName);
        }
        catch (error) {
            if (error.code !== 'SecretNotFound') {
                throw new Error(`Failed to delete client secret: ${error.message}`);
            }
        }
    }
    /**
     * Store assessment API configuration
     * Used for storing external API keys and configuration
     */
    async storeApiConfiguration(configName, configValue, metadata) {
        try {
            const secretName = `api-config-${configName}`;
            await this.client.setSecret(secretName, configValue, {
                contentType: 'application/x-api-config',
                tags: {
                    type: 'api-configuration',
                    configName: configName,
                    createdBy: 'M365AssessmentFramework',
                    ...metadata
                }
            });
        }
        catch (error) {
            throw new Error(`Failed to store API configuration: ${error.message}`);
        }
    }
    /**
     * Get assessment API configuration
     * Used for retrieving external API keys and configuration
     */
    async getApiConfiguration(configName) {
        try {
            const secretName = `api-config-${configName}`;
            const secretResponse = await this.client.getSecret(secretName);
            if (!secretResponse.value) {
                throw new Error(`No configuration value found for ${configName}`);
            }
            return secretResponse.value;
        }
        catch (error) {
            if (error.code === 'SecretNotFound') {
                throw new Error(`API configuration not found: ${configName}`);
            }
            throw new Error(`Failed to retrieve API configuration: ${error.message}`);
        }
    }
    /**
     * List all secrets for a customer
     * Used for management and auditing
     */
    async listCustomerSecrets(customerId) {
        try {
            const secretNames = [];
            for await (const secretProperties of this.client.listPropertiesOfSecrets()) {
                if (secretProperties.tags?.customerId === customerId) {
                    secretNames.push(secretProperties.name);
                }
            }
            return secretNames;
        }
        catch (error) {
            throw new Error(`Failed to list customer secrets: ${error.message}`);
        }
    }
    /**
     * Health check for Key Vault connectivity
     * Useful for monitoring and diagnostics
     */
    async healthCheck() {
        try {
            // Try to list secret properties (minimal operation)
            const iterator = this.client.listPropertiesOfSecrets();
            await iterator.next();
            return true;
        }
        catch (error) {
            console.error('Key Vault health check failed:', error);
            return false;
        }
    }
    /**
     * Backup customer secrets
     * Creates a backup of all secrets for a customer
     */
    async backupCustomerSecrets(customerId) {
        try {
            const backup = {};
            for await (const secretProperties of this.client.listPropertiesOfSecrets()) {
                if (secretProperties.tags?.customerId === customerId) {
                    // Store metadata only, not the actual secret values for security
                    backup[secretProperties.name] = {
                        name: secretProperties.name,
                        tags: secretProperties.tags,
                        contentType: secretProperties.contentType,
                        createdOn: secretProperties.createdOn,
                        updatedOn: secretProperties.updatedOn,
                        expiresOn: secretProperties.expiresOn
                    };
                }
            }
            return backup;
        }
        catch (error) {
            throw new Error(`Failed to backup customer secrets: ${error.message}`);
        }
    }
}
exports.KeyVaultService = KeyVaultService;
// Singleton instance for reuse across functions
let keyVaultServiceInstance;
function getKeyVaultService() {
    if (!keyVaultServiceInstance) {
        keyVaultServiceInstance = new KeyVaultService();
    }
    return keyVaultServiceInstance;
}
exports.getKeyVaultService = getKeyVaultService;
//# sourceMappingURL=keyVaultService.js.map