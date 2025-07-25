import { Client } from "@microsoft/microsoft-graph-client";
import { DefaultAzureCredential, ClientSecretCredential } from "@azure/identity";
import { Application, ServicePrincipal } from "@microsoft/microsoft-graph-types";
import * as https from 'https';

/**
 * Microsoft Graph API Service for Azure AD app registration management
 * Uses managed identity for authentication and implements proper error handling
 * Follows Azure best practices for Microsoft Graph API interactions
 */

/**
 * Helper function to make HTTPS requests without external dependencies
 */
function httpsRequest(url: string, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout }, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } else {
                        reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse JSON response: ${parseError}`));
                }
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timed out'));
        });
    });
}

export class GraphApiService {
    private static instance: GraphApiService;
    private graphClient: Client;
    private isInitialized = false;

    constructor() {
        // Check for required environment variables
        const requiredEnvVars = {
            AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
            AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
            AZURE_TENANT_ID: process.env.AZURE_TENANT_ID
        };

        const missingVars = Object.entries(requiredEnvVars)
            .filter(([, value]) => !value)
            .map(([key]) => key);

        if (missingVars.length > 0) {
            const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}. Please configure these in your Azure Static Web App settings or local.settings.json for local development.`;
            console.error('❌ GraphApiService:', errorMsg);
            throw new Error(errorMsg);
        }

        // Use service principal credentials for authentication
        const credential = new ClientSecretCredential(
            process.env.AZURE_TENANT_ID!,
            process.env.AZURE_CLIENT_ID!,
            process.env.AZURE_CLIENT_SECRET!
        );
        
        console.log('✅ GraphApiService: Using service principal authentication');
        console.log('🔧 GraphApiService: Tenant ID:', process.env.AZURE_TENANT_ID);
        console.log('🔧 GraphApiService: Client ID:', process.env.AZURE_CLIENT_ID?.substring(0, 8) + '...');
        
        // Initialize Microsoft Graph client with proper authentication
        this.graphClient = Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    try {
                        const tokenResponse = await credential.getToken(
                            "https://graph.microsoft.com/.default"
                        );
                        if (!tokenResponse?.token) {
                            throw new Error('Failed to obtain access token - empty response');
                        }
                        console.log('✅ GraphApiService: Access token obtained successfully');
                        return tokenResponse.token;
                    } catch (error) {
                        console.error('❌ GraphApiService: Failed to get access token:', error);
                        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : error}. Check your service principal configuration.`);
                    }
                }
            }
        });
    }

    /**
     * Get singleton instance of GraphApiService
     */
    public static getInstance(): GraphApiService {
        if (!GraphApiService.instance) {
            GraphApiService.instance = new GraphApiService();
        }
        return GraphApiService.instance;
    }

    /**
     * Create or verify multi-tenant Azure AD App Registration for customer tenant authentication
     * 
     * CORRECT APPROACH: Instead of creating individual apps per customer, we:
     * 1. Use our existing multi-tenant app (or create one if it doesn't exist)
     * 2. Generate a consent URL for the customer to consent to our app in their tenant
     * 3. After consent, our app gets a service principal in their tenant
     */
    async createMultiTenantAppRegistration(customerData: {
        tenantName: string;
        tenantDomain: string;
        targetTenantId: string;
        contactEmail?: string;
        requiredPermissions?: string[];
    }): Promise<{
        applicationId: string;
        clientId: string;
        appId: string; // Legacy compatibility
        servicePrincipalId: string;
        objectId: string; // Legacy compatibility
        clientSecret: string;
        consentUrl: string;
        redirectUri: string;
        permissions: string[];
        resolvedTenantId: string;
        isNewApp: boolean;
    }> {
        try {
            console.log('🏢 GraphApiService: Preparing multi-tenant app access for:', customerData.tenantName);

            // Validate required input data
            if (!customerData.tenantName?.trim()) {
                throw new Error('Tenant name is required and cannot be empty');
            }
            if (!customerData.tenantDomain?.trim()) {
                throw new Error('Tenant domain is required and cannot be empty');
            }
            if (!customerData.targetTenantId?.trim()) {
                throw new Error('Target tenant ID is required and cannot be empty');
            }

            // Define required permissions for security assessment
            const permissions = customerData.requiredPermissions || [
                'Organization.Read.All',
                'Directory.Read.All',
                'AuditLog.Read.All',
                'SecurityEvents.Read.All'
            ];

            // Use the existing app from environment variables (recommended)
            const existingClientId = process.env.AZURE_CLIENT_ID;
            
            if (existingClientId) {
                console.log('✅ GraphApiService: Using existing multi-tenant app from environment');
                
                // Get the existing application details
                let existingApp;
                try {
                    existingApp = await this.graphClient.api(`/applications`).filter(`appId eq '${existingClientId}'`).get();
                    
                    if (!existingApp.value || existingApp.value.length === 0) {
                        throw new Error(`Application with client ID ${existingClientId} not found`);
                    }
                    
                    existingApp = existingApp.value[0];
                    console.log('✅ GraphApiService: Found existing application:', existingApp.displayName);
                    
                } catch (error) {
                    console.error('❌ GraphApiService: Failed to retrieve existing application:', error);
                    throw new Error(`Failed to retrieve existing application: ${error}`);
                }
                
                // Get the service principal for the existing app
                let servicePrincipal;
                try {
                    const spResponse = await this.graphClient.api('/servicePrincipals').filter(`appId eq '${existingClientId}'`).get();
                    
                    if (!spResponse.value || spResponse.value.length === 0) {
                        // Create service principal if it doesn't exist
                        servicePrincipal = await this.graphClient.api('/servicePrincipals').post({
                            appId: existingClientId
                        });
                    } else {
                        servicePrincipal = spResponse.value[0];
                    }
                    
                    console.log('✅ GraphApiService: Service principal ready:', servicePrincipal.id);
                    
                } catch (error) {
                    console.error('❌ GraphApiService: Failed to handle service principal:', error);
                    throw new Error(`Failed to handle service principal: ${error}`);
                }

                // Generate the admin consent URL for the customer tenant
                const baseUrl = process.env.REDIRECT_URI || "https://portal.azure.com/";
                const scope = permissions.join(' ');
                
                // Create tenant-specific admin consent URL
                const consentUrl = `https://login.microsoftonline.com/${customerData.targetTenantId}/v2.0/adminconsent` +
                    `?client_id=${encodeURIComponent(existingClientId)}` +
                    `&redirect_uri=${encodeURIComponent(baseUrl)}` +
                    `&scope=${encodeURIComponent(scope)}` +
                    `&state=${encodeURIComponent(JSON.stringify({
                        customer_tenant: customerData.targetTenantId,
                        customer_name: customerData.tenantName,
                        customer_domain: customerData.tenantDomain,
                        timestamp: Date.now()
                    }))}`;

                console.log('✅ GraphApiService: Generated consent URL for customer tenant');
                
                return {
                    applicationId: existingApp.id,
                    clientId: existingClientId,
                    appId: existingClientId, // Legacy compatibility
                    servicePrincipalId: servicePrincipal.id,
                    objectId: servicePrincipal.id, // Legacy compatibility
                    clientSecret: "*** Use existing client secret from environment ***",
                    consentUrl: consentUrl,
                    redirectUri: baseUrl,
                    permissions: permissions,
                    resolvedTenantId: customerData.targetTenantId,
                    isNewApp: false
                };
            }

            throw new Error('No existing application found in environment variables');

        } catch (error: any) {
            console.error('❌ GraphApiService: Multi-tenant app setup failed:', error);
            throw new Error(`Multi-tenant app setup failed: ${error.message || error}`);
        }
    }

    /**
     * Map permission names to Graph API permission IDs
     */
    private getPermissionId(permissionName: string): string {
        const permissionMap: Record<string, string> = {
            'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
            'Reports.Read.All': '230c1aed-a721-4c5d-9cb4-a90514e508ef',
            'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
            'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
            'SecurityEvents.Read.All': 'bf394140-e372-4bf9-a898-299cfc7564e5',
            'IdentityRiskyUser.Read.All': 'dc5007c0-2d7d-4c42-879c-2dab87571379',
            'DeviceManagementManagedDevices.Read.All': '2f51be20-0bb4-4fed-bf7b-db946066c75e',
            'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da'
        };

        const permissionId = permissionMap[permissionName];
        if (!permissionId) {
            throw new Error(`Unknown permission: ${permissionName}`);
        }
        return permissionId;
    }

    /**
     * Get organization information
     */
    async getOrganization(): Promise<any> {
        try {
            console.log('🏢 GraphApiService: Fetching organization information...');
            const org = await this.graphClient.api('/organization').get();
            console.log('✅ GraphApiService: Organization data retrieved successfully');
            return org.value && org.value.length > 0 ? org.value[0] : null;
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get organization:', error);
            throw new Error(`Failed to get organization: ${error.message}`);
        }
    }

    /**
     * Get secure score information
     */
    async getSecureScore(): Promise<any> {
        try {
            console.log('🔒 GraphApiService: Fetching secure score...');
            const response = await this.graphClient.api('/security/secureScores').top(1).get();
            console.log('✅ GraphApiService: Secure score retrieved successfully');
            return response.value && response.value.length > 0 ? response.value[0] : null;
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get secure score:', error);
            throw new Error(`Failed to get secure score: ${error.message}`);
        }
    }

    /**
     * Get license information
     */
    async getLicenseDetails(): Promise<any> {
        try {
            console.log('📋 GraphApiService: Fetching license details...');
            const licenses = await this.graphClient.api('/subscribedSkus').get();
            console.log('✅ GraphApiService: License details retrieved successfully');
            return licenses.value || [];
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get license details:', error);
            throw new Error(`Failed to get license details: ${error.message}`);
        }
    }

    /**
     * Get directory roles information
     */
    async getDirectoryRoles(): Promise<any> {
        try {
            console.log('👥 GraphApiService: Fetching directory roles...');
            const roles = await this.graphClient.api('/directoryRoles').get();
            console.log('✅ GraphApiService: Directory roles retrieved successfully');
            return roles.value || [];
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get directory roles:', error);
            throw new Error(`Failed to get directory roles: ${error.message}`);
        }
    }

    /**
     * Get conditional access policies
     */
    async getConditionalAccessPolicies(): Promise<any> {
        try {
            console.log('🔐 GraphApiService: Fetching conditional access policies...');
            const policies = await this.graphClient.api('/identity/conditionalAccess/policies').get();
            console.log('✅ GraphApiService: Conditional access policies retrieved successfully');
            return policies.value || [];
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get conditional access policies:', error);
            throw new Error(`Failed to get conditional access policies: ${error.message}`);
        }
    }

    /**
     * Get authentication methods policy
     */
    async getAuthenticationMethodsPolicy(): Promise<any> {
        try {
            console.log('🔑 GraphApiService: Fetching authentication methods policy...');
            const policy = await this.graphClient.api('/policies/authenticationMethodsPolicy').get();
            console.log('✅ GraphApiService: Authentication methods policy retrieved successfully');
            return policy;
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get authentication methods policy:', error);
            throw new Error(`Failed to get authentication methods policy: ${error.message}`);
        }
    }

    /**
     * Get privileged role assignments
     */
    async getPrivilegedRoleAssignments(): Promise<any> {
        try {
            console.log('👑 GraphApiService: Fetching privileged role assignments...');
            const assignments = await this.graphClient.api('/roleManagement/directory/roleAssignments').expand('principal,roleDefinition').get();
            console.log('✅ GraphApiService: Privileged role assignments retrieved successfully');
            return assignments.value || [];
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get privileged role assignments:', error);
            throw new Error(`Failed to get privileged role assignments: ${error.message}`);
        }
    }

    /**
     * Get audit logs (sign-ins)
     */
    async getSignInLogs(limit: number = 100): Promise<any> {
        try {
            console.log('📊 GraphApiService: Fetching sign-in logs...');
            const logs = await this.graphClient.api('/auditLogs/signIns').top(limit).get();
            console.log('✅ GraphApiService: Sign-in logs retrieved successfully');
            return logs.value || [];
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get sign-in logs:', error);
            throw new Error(`Failed to get sign-in logs: ${error.message}`);
        }
    }

    /**
     * Get risky users
     */
    async getRiskyUsers(): Promise<any> {
        try {
            console.log('⚠️ GraphApiService: Fetching risky users...');
            const riskyUsers = await this.graphClient.api('/identityProtection/riskyUsers').get();
            console.log('✅ GraphApiService: Risky users retrieved successfully');
            return riskyUsers.value || [];
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get risky users:', error);
            throw new Error(`Failed to get risky users: ${error.message}`);
        }
    }

    /**
     * Create enterprise application (legacy method for compatibility)
     * This is a wrapper around createMultiTenantAppRegistration for backward compatibility
     */
    async createEnterpriseApplication(params: {
        displayName: string;
        tenantId: string;
        clientId: string;
        customerData: {
            customerId: string;
            tenantName: string;
            tenantDomain: string;
            contactEmail?: string;
        };
    }): Promise<{
        applicationId: string;
        clientId: string;
        appId: string; // Legacy compatibility
        servicePrincipalId: string;
        objectId: string; // Legacy compatibility
        clientSecret: string;
        consentUrl: string;
        redirectUri: string;
        permissions: string[];
        resolvedTenantId: string;
        isNewApp: boolean;
    }> {
        console.log('🔄 GraphApiService: createEnterpriseApplication called, delegating to createMultiTenantAppRegistration');
        
        return await this.createMultiTenantAppRegistration({
            tenantName: params.customerData.tenantName,
            tenantDomain: params.customerData.tenantDomain,
            targetTenantId: params.tenantId,
            contactEmail: params.customerData.contactEmail
        });
    }

    /**
     * Test Graph API connectivity and permissions
     */
    async testConnection(): Promise<{
        success: boolean;
        organization?: any;
        permissions?: string[];
        error?: string;
    }> {
        try {
            console.log('🔍 GraphApiService: Testing connection and permissions...');
            
            // Test basic connectivity with organization endpoint
            const org = await this.getOrganization();
            
            // Test various endpoints to check permissions
            const permissionTests = [
                { name: 'Organization.Read.All', test: () => this.getOrganization() },
                { name: 'Directory.Read.All', test: () => this.getDirectoryRoles() },
                { name: 'Policy.Read.All', test: () => this.getConditionalAccessPolicies() }
            ];

            const availablePermissions: string[] = [];
            
            for (const test of permissionTests) {
                try {
                    await test.test();
                    availablePermissions.push(test.name);
                    console.log(`✅ GraphApiService: ${test.name} permission available`);
                } catch (error) {
                    console.log(`❌ GraphApiService: ${test.name} permission not available:`, error);
                }
            }

            console.log('✅ GraphApiService: Connection test completed successfully');
            return {
                success: true,
                organization: org,
                permissions: availablePermissions
            };
        } catch (error: any) {
            console.error('❌ GraphApiService: Connection test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Singleton instance for reuse across functions
let graphApiServiceInstance: GraphApiService;

export function getGraphApiService(): GraphApiService {
    if (!graphApiServiceInstance) {
        graphApiServiceInstance = new GraphApiService();
    }
    return graphApiServiceInstance;
}
