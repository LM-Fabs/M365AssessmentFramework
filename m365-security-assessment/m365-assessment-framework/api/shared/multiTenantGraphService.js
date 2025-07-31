"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiTenantGraphService = void 0;
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const identity_1 = require("@azure/identity");
/**
 * Multi-Tenant Microsoft Graph API Service
 * Designed for accessing customer tenant data using our multi-tenant app registration
 * Uses customer's tenant ID for authentication while using our app credentials
 */
class MultiTenantGraphService {
    constructor(targetTenantId) {
        this.targetTenantId = targetTenantId;
        // Check for required environment variables
        const requiredEnvVars = {
            AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
            AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
            AZURE_TENANT_ID: process.env.AZURE_TENANT_ID // Our tenant ID for app registration
        };
        const missingVars = Object.entries(requiredEnvVars)
            .filter(([, value]) => !value)
            .map(([key]) => key);
        if (missingVars.length > 0) {
            const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}. Please configure these in your Azure Static Web App settings.`;
            console.error('❌ MultiTenantGraphService:', errorMsg);
            throw new Error(errorMsg);
        }
        if (!targetTenantId || !targetTenantId.trim()) {
            throw new Error('Target tenant ID is required for multi-tenant Graph access');
        }
        console.log('🏢 MultiTenantGraphService: Initializing for customer tenant:', targetTenantId);
        console.log('🔧 MultiTenantGraphService: Using app from tenant:', process.env.AZURE_TENANT_ID);
        console.log('🔧 MultiTenantGraphService: Client ID:', process.env.AZURE_CLIENT_ID?.substring(0, 8) + '...');
        this.initializeGraphClient();
    }
    initializeGraphClient() {
        // For multi-tenant applications, we use the CUSTOMER's tenant ID in the authority URL
        // but still use OUR app's client ID and secret
        const authority = `https://login.microsoftonline.com/${this.targetTenantId}`;
        const credential = new identity_1.ClientSecretCredential(this.targetTenantId, // Customer's tenant ID
        process.env.AZURE_CLIENT_ID, // Our app's client ID
        process.env.AZURE_CLIENT_SECRET // Our app's client secret
        );
        this.graphClient = microsoft_graph_client_1.Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    try {
                        const tokenResponse = await credential.getToken("https://graph.microsoft.com/.default");
                        if (!tokenResponse?.token) {
                            throw new Error('Failed to obtain access token - empty response');
                        }
                        console.log('✅ MultiTenantGraphService: Access token obtained for tenant:', this.targetTenantId);
                        return tokenResponse.token;
                    }
                    catch (error) {
                        console.error('❌ MultiTenantGraphService: Failed to get access token:', error);
                        // Provide helpful error messages for common issues
                        if (error.message?.includes('AADSTS700016')) {
                            throw new Error(`App not found in customer tenant. Customer admin needs to consent to the application first. Error: ${error.message}`);
                        }
                        else if (error.message?.includes('AADSTS650057')) {
                            throw new Error(`Invalid client or client credentials. Check app registration configuration. Error: ${error.message}`);
                        }
                        else if (error.message?.includes('AADSTS70002') || error.message?.includes('AADSTS70008')) {
                            throw new Error(`Invalid client secret. Check AZURE_CLIENT_SECRET configuration. Error: ${error.message}`);
                        }
                        else {
                            throw new Error(`Authentication failed for tenant ${this.targetTenantId}: ${error.message}. Ensure customer has consented to the application.`);
                        }
                    }
                }
            }
        });
    }
    /**
     * Get organization information from the customer tenant
     */
    async getOrganization() {
        try {
            console.log('🏢 MultiTenantGraphService: Fetching organization for tenant:', this.targetTenantId);
            const response = await this.graphClient.api('/organization').get();
            console.log('✅ MultiTenantGraphService: Organization retrieved successfully');
            return response.value && response.value.length > 0 ? response.value[0] : null;
        }
        catch (error) {
            console.error('❌ MultiTenantGraphService: Failed to get organization:', error);
            throw new Error(`Failed to get organization: ${error.message}`);
        }
    }
    /**
     * Get secure score information from the customer tenant
     */
    async getSecureScore() {
        try {
            console.log('🔒 MultiTenantGraphService: Fetching secure score for tenant:', this.targetTenantId);
            const response = await this.graphClient.api('/security/secureScores').top(1).get();
            console.log('✅ MultiTenantGraphService: Secure score retrieved successfully');
            return response.value && response.value.length > 0 ? response.value[0] : null;
        }
        catch (error) {
            console.error('❌ MultiTenantGraphService: Failed to get secure score:', error);
            throw new Error(`Failed to get secure score: ${error.message}`);
        }
    }
    /**
     * Get license information from the customer tenant
     */
    async getLicenseDetails() {
        try {
            console.log('📋 MultiTenantGraphService: Fetching license details for tenant:', this.targetTenantId);
            const licenses = await this.graphClient.api('/subscribedSkus').get();
            console.log('✅ MultiTenantGraphService: License details retrieved successfully');
            return licenses.value || [];
        }
        catch (error) {
            console.error('❌ MultiTenantGraphService: Failed to get license details:', error);
            throw new Error(`Failed to get license details: ${error.message}`);
        }
    }
    /**
     * Get user count from the customer tenant
     */
    async getUserCount() {
        try {
            console.log('👥 MultiTenantGraphService: Fetching user count for tenant:', this.targetTenantId);
            const response = await this.graphClient.api('/users/$count').get();
            console.log('✅ MultiTenantGraphService: User count retrieved successfully');
            return typeof response === 'number' ? response : 0;
        }
        catch (error) {
            console.error('❌ MultiTenantGraphService: Failed to get user count:', error);
            // User count might not be available, don't fail the entire assessment
            return 0;
        }
    }
    /**
     * Get directory roles information from the customer tenant
     */
    async getDirectoryRoles() {
        try {
            console.log('👥 MultiTenantGraphService: Fetching directory roles for tenant:', this.targetTenantId);
            const roles = await this.graphClient.api('/directoryRoles').get();
            console.log('✅ MultiTenantGraphService: Directory roles retrieved successfully');
            return roles.value || [];
        }
        catch (error) {
            console.error('❌ MultiTenantGraphService: Failed to get directory roles:', error);
            throw new Error(`Failed to get directory roles: ${error.message}`);
        }
    }
    /**
     * Get conditional access policies from the customer tenant
     */
    async getConditionalAccessPolicies() {
        try {
            console.log('🔐 MultiTenantGraphService: Fetching conditional access policies for tenant:', this.targetTenantId);
            const policies = await this.graphClient.api('/identity/conditionalAccess/policies').get();
            console.log('✅ MultiTenantGraphService: Conditional access policies retrieved successfully');
            return policies.value || [];
        }
        catch (error) {
            console.error('❌ MultiTenantGraphService: Failed to get conditional access policies:', error);
            throw new Error(`Failed to get conditional access policies: ${error.message}`);
        }
    }
}
exports.MultiTenantGraphService = MultiTenantGraphService;
//# sourceMappingURL=multiTenantGraphService.js.map