import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

/**
 * Azure Key Vault Service for secure secrets management
 * Uses managed identity for authentication and implements proper error handling
 * Follows Azure best practices for secrets management
 */
export class KeyVaultService {
    private client: SecretClient;
    private _isInitialized = false;

    constructor() {
        // Use managed identity for authentication (Azure best practice)
        const credential = new DefaultAzureCredential();
        
        // Get Key Vault URL from environment variables
        const keyVaultUrl = process.env.KEY_VAULT_URL;
        if (!keyVaultUrl) {
            throw new Error("KEY_VAULT_URL environment variable is required");
        }

        this.client = new SecretClient(keyVaultUrl, credential);
        this._isInitialized = true;
    }

    /**
     * Check if Key Vault service is properly initialized
     */
    get isInitialized(): boolean {
        return this._isInitialized;
    }

    /**
     * Store client secret for a customer's app registration
     * Uses proper naming convention and metadata
     */
    async storeClientSecret(customerId: string, tenantDomain: string, clientSecret: string): Promise<string> {
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
        } catch (error) {
            throw new Error(`Failed to store client secret: ${(error as Error).message}`);
        }
    }

    /**
     * Retrieve client secret for a customer
     * Used during assessment operations
     */
    async getClientSecret(customerId: string): Promise<string> {
        try {
            const secretName = `customer-${customerId}-client-secret`;
            const secretResponse = await this.client.getSecret(secretName);
            
            if (!secretResponse.value) {
                throw new Error(`No secret value found for customer ${customerId}`);
            }

            return secretResponse.value;
        } catch (error) {
            if ((error as any).code === 'SecretNotFound') {
                throw new Error(`Client secret not found for customer ${customerId}`);
            }
            throw new Error(`Failed to retrieve client secret: ${(error as Error).message}`);
        }
    }

    /**
     * Rotate client secret for a customer
     * Updates the stored secret with new value
     */
    async rotateClientSecret(customerId: string, tenantDomain: string, newClientSecret: string): Promise<void> {
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
        } catch (error) {
            throw new Error(`Failed to rotate client secret: ${(error as Error).message}`);
        }
    }

    /**
     * Delete client secret for a customer
     * Used when customer is removed
     */
    async deleteClientSecret(customerId: string): Promise<void> {
        try {
            const secretName = `customer-${customerId}-client-secret`;
            await this.client.beginDeleteSecret(secretName);
        } catch (error) {
            if ((error as any).code !== 'SecretNotFound') {
                throw new Error(`Failed to delete client secret: ${(error as Error).message}`);
            }
        }
    }

    /**
     * Store assessment API configuration
     * Used for storing external API keys and configuration
     */
    async storeApiConfiguration(configName: string, configValue: string, metadata?: Record<string, string>): Promise<void> {
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
        } catch (error) {
            throw new Error(`Failed to store API configuration: ${(error as Error).message}`);
        }
    }

    /**
     * Get assessment API configuration
     * Used for retrieving external API keys and configuration
     */
    async getApiConfiguration(configName: string): Promise<string> {
        try {
            const secretName = `api-config-${configName}`;
            const secretResponse = await this.client.getSecret(secretName);
            
            if (!secretResponse.value) {
                throw new Error(`No configuration value found for ${configName}`);
            }

            return secretResponse.value;
        } catch (error) {
            if ((error as any).code === 'SecretNotFound') {
                throw new Error(`API configuration not found: ${configName}`);
            }
            throw new Error(`Failed to retrieve API configuration: ${(error as Error).message}`);
        }
    }

    /**
     * Get PostgreSQL password from Key Vault
     * Used for database connections
     */
    async getPostgreSQLPassword(): Promise<string> {
        try {
            const secretResponse = await this.client.getSecret('postgres-password');
            
            if (!secretResponse.value) {
                throw new Error('PostgreSQL password not found in Key Vault');
            }

            return secretResponse.value;
        } catch (error) {
            if ((error as any).code === 'SecretNotFound') {
                throw new Error('PostgreSQL password not found in Key Vault');
            }
            throw new Error(`Failed to retrieve PostgreSQL password: ${(error as Error).message}`);
        }
    }

    /**
     * Store PostgreSQL password in Key Vault
     * Used for secure database password storage
     */
    async storePostgreSQLPassword(password: string): Promise<void> {
        try {
            await this.client.setSecret('postgres-password', password, {
                contentType: 'application/x-database-password',
                tags: {
                    type: 'database-password',
                    database: 'postgresql',
                    createdBy: 'M365AssessmentFramework'
                }
            });
        } catch (error) {
            throw new Error(`Failed to store PostgreSQL password: ${(error as Error).message}`);
        }
    }

    /**
     * List all secrets for a customer
     * Used for management and auditing
     */
    async listCustomerSecrets(customerId: string): Promise<string[]> {
        try {
            const secretNames: string[] = [];
            
            for await (const secretProperties of this.client.listPropertiesOfSecrets()) {
                if (secretProperties.tags?.customerId === customerId) {
                    secretNames.push(secretProperties.name);
                }
            }

            return secretNames;
        } catch (error) {
            throw new Error(`Failed to list customer secrets: ${(error as Error).message}`);
        }
    }

    /**
     * Health check for Key Vault connectivity
     * Useful for monitoring and diagnostics
     */
    async healthCheck(): Promise<boolean> {
        try {
            // Try to list secret properties (minimal operation)
            const iterator = this.client.listPropertiesOfSecrets();
            await iterator.next();
            return true;
        } catch (error) {
            console.error('Key Vault health check failed:', error);
            return false;
        }
    }

    /**
     * Backup customer secrets
     * Creates a backup of all secrets for a customer
     */
    async backupCustomerSecrets(customerId: string): Promise<Record<string, any>> {
        try {
            const backup: Record<string, any> = {};
            
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
        } catch (error) {
            throw new Error(`Failed to backup customer secrets: ${(error as Error).message}`);
        }
    }
}

// Singleton instance for reuse across functions
let keyVaultServiceInstance: KeyVaultService;

export function getKeyVaultService(): KeyVaultService {
    if (!keyVaultServiceInstance) {
        keyVaultServiceInstance = new KeyVaultService();
    }
    return keyVaultServiceInstance;
}