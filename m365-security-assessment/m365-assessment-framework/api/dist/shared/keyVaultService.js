import { SecretClient } from '@azure/keyvault-secrets';
import { ClientSecretCredential } from '@azure/identity';
import { delay } from '@azure/core-util';
/**
 * Utility class for securely accessing Azure Key Vault secrets
 * This follows Azure best practices by keeping credential access in a central location
 */
export class KeyVaultService {
    constructor() {
        this.secretCache = new Map();
        this.cacheTtlMs = 30 * 60 * 1000; // 30 minutes cache TTL
        this.maxRetries = 3;
        this.initialDelayMs = 500;
        try {
            // Prefer environment variables for service principal credentials
            const tenantId = process.env.KV_TENANT_ID;
            const clientId = process.env.KV_CLIENT_ID;
            const clientSecret = process.env.KV_CLIENT_SECRET;
            // Validate required environment variables
            if (!tenantId || !clientId || !clientSecret) {
                throw new Error('Missing required Key Vault access credentials in environment variables');
            }
            // Service principal authentication to Key Vault
            const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
            // Key Vault URL should be in environment variables in production
            const vaultUrl = process.env.KEY_VAULT_URL || 'https://m365assessmentkv.vault.azure.net/';
            this.secretClient = new SecretClient(vaultUrl, credential);
            console.info('KeyVaultService initialized successfully');
        }
        catch (error) {
            console.error('KeyVaultService initialization failed', error);
            throw error; // Re-throw to prevent silent failures
        }
    }
    /**
     * Get singleton instance of KeyVaultService
     */
    static getInstance() {
        if (!KeyVaultService.instance) {
            KeyVaultService.instance = new KeyVaultService();
        }
        return KeyVaultService.instance;
    }
    /**
     * Retrieve a secret from Key Vault with caching, error handling, and retry logic
     * @param secretName Name of the secret to retrieve
     * @param fallbackValue Optional fallback value if secret can't be retrieved
     * @returns Secret value or fallback value
     */
    async getSecret(secretName, fallbackValue) {
        try {
            // Check cache first
            const cached = this.secretCache.get(secretName);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTtlMs) {
                console.debug(`Retrieved secret ${secretName} from cache`);
                return cached.value;
            }
            // Not in cache or expired, retrieve from Key Vault with retry logic
            return await this.getSecretWithRetry(secretName, this.maxRetries, fallbackValue);
        }
        catch (error) {
            console.error(`Error getting secret ${secretName}:`, error);
            return fallbackValue;
        }
    }
    /**
     * Retrieves a secret with exponential backoff retry
     */
    async getSecretWithRetry(secretName, retriesLeft, fallbackValue) {
        try {
            const secret = await this.secretClient.getSecret(secretName);
            // Cache the result
            if (secret.value) {
                this.secretCache.set(secretName, {
                    value: secret.value,
                    timestamp: Date.now()
                });
            }
            return secret.value;
        }
        catch (error) {
            // If we have retries left and it's a recoverable error, retry
            if (retriesLeft > 0 && this.isRetryableError(error)) {
                const delayMs = this.initialDelayMs * Math.pow(2, this.maxRetries - retriesLeft);
                console.warn(`Retrying secret retrieval for ${secretName} after ${delayMs}ms. Retries left: ${retriesLeft}`);
                await delay(delayMs);
                return this.getSecretWithRetry(secretName, retriesLeft - 1, fallbackValue);
            }
            // No retries left or non-retryable error
            throw error;
        }
    }
    /**
     * Determines if an error is retryable
     */
    isRetryableError(error) {
        // Common retryable errors for Key Vault access
        const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
        return error.statusCode && retryableStatusCodes.includes(error.statusCode);
    }
    /**
     * Retrieve Azure credentials from Key Vault for Microsoft Graph operations
     * @returns Object containing tenantId, clientId, and clientSecret
     */
    async getGraphCredentials() {
        const tenantId = await this.getSecret('AZURE-TENANT-ID', process.env.AZURE_TENANT_ID);
        const clientId = await this.getSecret('AZURE-CLIENT-ID', process.env.AZURE_CLIENT_ID);
        const clientSecret = await this.getSecret('AZURE-CLIENT-SECRET', process.env.AZURE_CLIENT_SECRET);
        return {
            tenantId,
            clientId,
            clientSecret
        };
    }
    /**
     * Clear the cache if needed (for testing or critical updates)
     */
    clearCache() {
        this.secretCache.clear();
        console.info('Secret cache cleared');
    }
}
//# sourceMappingURL=keyVaultService.js.map