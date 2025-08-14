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

            // Define required permissions for security assessment - COMPLETE SET
            const permissions = customerData.requiredPermissions || [
                'User.Read.All',                    // Read user profiles
                'Directory.Read.All',               // Read directory data
                'Reports.Read.All',                 // Read usage reports
                'Policy.Read.All',                  // Read security policies - CRITICAL for CA policies
                'SecurityEvents.Read.All',          // Read security events
                'IdentityRiskEvent.Read.All',       // Read identity risk events
                'Agreement.Read.All',               // Read terms of use agreements
                'AuditLog.Read.All',                // Read audit logs
                'Organization.Read.All',            // Read organization info
                'RoleManagement.Read.Directory'     // Read role assignments - CRITICAL for privileged roles
            ];

            // Check if we should create individual apps per customer
            // Default to true for individual app creation (better security)
            const createIndividualApps = process.env.CREATE_INDIVIDUAL_APPS !== 'false';
            console.log('🔧 GraphApiService: CREATE_INDIVIDUAL_APPS environment variable:', process.env.CREATE_INDIVIDUAL_APPS);
            console.log('🔧 GraphApiService: Will create individual apps:', createIndividualApps);
            
            if (createIndividualApps) {
                console.log('🏗️ GraphApiService: Creating individual app for customer:', customerData.tenantName);
                return await this.createIndividualAppInOurTenant(customerData, permissions);
            }

            // Use the existing app from environment variables (recommended for multi-tenant)
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
            'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da',
            'User.Read.All': 'df021288-bdef-4463-88db-98f22de89214',
            'IdentityRiskEvent.Read.All': '6e472fd1-ad78-48da-a0f0-97ab2c6b769e',
            'Agreement.Read.All': 'ef4b5d93-3104-4867-9b0b-5cd61b5ffb6f',
            'RoleManagement.Read.Directory': '483bed4a-2ad3-4361-a73b-c83ccdbdc53c'
        };

        const permissionId = permissionMap[permissionName];
        if (!permissionId) {
            throw new Error(`Unknown permission: ${permissionName}`);
        }
        return permissionId;
    }

    /**
     * Map permission names to required resource access format for app registration
     */
    private mapPermissionsToResourceAccess(permissions: string[]): any[] {
        return [{
            resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
            resourceAccess: permissions.map(permission => ({
                id: this.getPermissionId(permission),
                type: 'Role' // Application permissions
            }))
        }];
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

    /**
     * Create a new app registration in OUR tenant for each customer
     * This is more practical than creating apps in customer tenants
     */
    async createIndividualAppInOurTenant(customerData: {
        tenantName: string;
        tenantDomain: string;
        targetTenantId: string;
        contactEmail?: string;
    }, permissions: string[]): Promise<{
        applicationId: string;
        clientId: string;
        appId: string;
        servicePrincipalId: string;
        objectId: string;
        clientSecret: string;
        consentUrl: string;
        redirectUri: string;
        permissions: string[];
        resolvedTenantId: string;
        isNewApp: boolean;
    }> {
        try {
            console.log('🏗️ GraphApiService: Creating new app registration in our tenant for customer:', customerData.tenantName);

            // Create the app registration in our tenant
            const appDisplayName = `M365 Assessment - ${customerData.tenantName} (${customerData.tenantDomain})`;
            const appRegistration = {
                displayName: appDisplayName,
                description: `Dedicated security assessment application for ${customerData.tenantName}`,
                signInAudience: 'AzureADMultipleOrgs', // Multi-tenant so customer can consent
                requiredResourceAccess: this.mapPermissionsToResourceAccess(permissions),
                web: {
                    redirectUris: [
                        `${process.env.REDIRECT_URI || "https://portal.azure.com/"}`,
                        `${process.env.REDIRECT_URI || "https://portal.azure.com/"}/auth/callback`
                    ],
                    implicitGrantSettings: {
                        enableAccessTokenIssuance: false,
                        enableIdTokenIssuance: false
                    }
                },
                api: {
                    acceptMappedClaims: true,
                    knownClientApplications: [],
                    requestedAccessTokenVersion: 2
                },
                tags: [
                    'M365Assessment',
                    `Customer:${customerData.tenantName}`,
                    `TenantId:${customerData.targetTenantId}`,
                    `Domain:${customerData.tenantDomain}`
                ]
            };

            console.log('📝 GraphApiService: Creating app registration in our tenant...');
            const createdApp = await this.graphClient.api('/applications').post(appRegistration);
            
            console.log('✅ GraphApiService: App registration created:', createdApp.appId);

            // Create client secret for the app
            const secretRequest = {
                passwordCredential: {
                    displayName: `${customerData.tenantName} Assessment Key - ${new Date().toISOString().split('T')[0]}`,
                    endDateTime: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString() // 1 year
                }
            };

            const secretResponse = await this.graphClient.api(`/applications/${createdApp.id}/addPassword`).post(secretRequest);
            console.log('🔑 GraphApiService: Client secret created');

            // Create service principal for the app
            const servicePrincipalRequest = {
                appId: createdApp.appId,
                accountEnabled: true,
                displayName: appDisplayName,
                servicePrincipalType: 'Application',
                tags: [
                    'M365Assessment',
                    `Customer:${customerData.tenantName}`,
                    `TenantId:${customerData.targetTenantId}`
                ]
            };

            const servicePrincipal = await this.graphClient.api('/servicePrincipals').post(servicePrincipalRequest);
            console.log('👤 GraphApiService: Service principal created:', servicePrincipal.id);

            const baseUrl = process.env.REDIRECT_URI || "https://portal.azure.com/";
            
            // Create admin consent URL for the customer to consent to this new app
            const scope = permissions.join(' ');
            const consentUrl = `https://login.microsoftonline.com/${customerData.targetTenantId}/v2.0/adminconsent` +
                `?client_id=${encodeURIComponent(createdApp.appId)}` +
                `&redirect_uri=${encodeURIComponent(baseUrl)}` +
                `&scope=${encodeURIComponent(scope)}` +
                `&state=${encodeURIComponent(JSON.stringify({
                    customer_tenant: customerData.targetTenantId,
                    customer_name: customerData.tenantName,
                    customer_domain: customerData.tenantDomain,
                    timestamp: Date.now(),
                    app_type: 'individual',
                    app_id: createdApp.appId
                }))}`;

            console.log('✅ GraphApiService: Individual app created successfully for', customerData.tenantName);

            return {
                applicationId: createdApp.id,
                clientId: createdApp.appId,
                appId: createdApp.appId,
                servicePrincipalId: servicePrincipal.id,
                objectId: servicePrincipal.id,
                clientSecret: secretResponse.secretText,
                consentUrl: consentUrl,
                redirectUri: baseUrl,
                permissions: permissions,
                resolvedTenantId: customerData.targetTenantId,
                isNewApp: true
            };

        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to create individual app:', error);
            
            // Check if it's a permissions error
            if (error.message && error.message.includes('Insufficient privileges')) {
                console.log('⚠️ GraphApiService: Insufficient privileges to create apps. Your service principal needs "Application.ReadWrite.All" permission.');
                console.log('🔄 GraphApiService: Falling back to shared multi-tenant app approach...');
                
                // Fall back to the shared app approach
                const existingClientId = process.env.AZURE_CLIENT_ID;
                if (existingClientId) {
                    try {
                        // Get the existing application details
                        const existingApp = await this.graphClient.api(`/applications`).filter(`appId eq '${existingClientId}'`).get();
                        
                        if (existingApp.value && existingApp.value.length > 0) {
                            const app = existingApp.value[0];
                            
                            // Get the service principal for the existing app
                            const spResponse = await this.graphClient.api('/servicePrincipals').filter(`appId eq '${existingClientId}'`).get();
                            let servicePrincipal;
                            
                            if (!spResponse.value || spResponse.value.length === 0) {
                                servicePrincipal = await this.graphClient.api('/servicePrincipals').post({
                                    appId: existingClientId
                                });
                            } else {
                                servicePrincipal = spResponse.value[0];
                            }
                            
                            const baseUrl = process.env.REDIRECT_URI || "https://portal.azure.com/";
                            const scope = permissions.join(' ');
                            
                            const consentUrl = `https://login.microsoftonline.com/${customerData.targetTenantId}/v2.0/adminconsent` +
                                `?client_id=${encodeURIComponent(existingClientId)}` +
                                `&redirect_uri=${encodeURIComponent(baseUrl)}` +
                                `&scope=${encodeURIComponent(scope)}` +
                                `&state=${encodeURIComponent(JSON.stringify({
                                    customer_tenant: customerData.targetTenantId,
                                    customer_name: customerData.tenantName,
                                    customer_domain: customerData.tenantDomain,
                                    timestamp: Date.now(),
                                    fallback_reason: 'insufficient_privileges'
                                }))}`;
                            
                            console.log('✅ GraphApiService: Using existing shared app as fallback');
                            
                            return {
                                applicationId: app.id,
                                clientId: existingClientId,
                                appId: existingClientId,
                                servicePrincipalId: servicePrincipal.id,
                                objectId: servicePrincipal.id,
                                clientSecret: "*** Use existing client secret from environment ***",
                                consentUrl: consentUrl,
                                redirectUri: baseUrl,
                                permissions: permissions,
                                resolvedTenantId: customerData.targetTenantId,
                                isNewApp: false
                            };
                        }
                    } catch (fallbackError) {
                        console.error('❌ GraphApiService: Fallback also failed:', fallbackError);
                    }
                }
                
                throw new Error(`Cannot create individual apps: Your Azure service principal needs "Application.ReadWrite.All" permission to create app registrations. Please grant this permission in Azure AD or use the shared multi-tenant app approach.`);
            }
            
            throw new Error(`Failed to create individual app: ${error.message || error}`);
        }
    }

    /**
     * Create a new app registration in the customer's tenant
     * This requires admin consent and cross-tenant permissions
     */
    async createIndividualAppForCustomer(customerData: {
        tenantName: string;
        tenantDomain: string;
        targetTenantId: string;
        contactEmail?: string;
    }, permissions: string[]): Promise<{
        applicationId: string;
        clientId: string;
        appId: string;
        servicePrincipalId: string;
        objectId: string;
        clientSecret: string;
        consentUrl: string;
        redirectUri: string;
        permissions: string[];
        resolvedTenantId: string;
        isNewApp: boolean;
    }> {
        try {
            console.log('🏗️ GraphApiService: Creating new app registration in customer tenant:', customerData.tenantName);

            // First, we need to get an access token for the customer's tenant
            // This requires the customer to have already consented to our management app
            const customerGraphClient = await this.getCustomerTenantGraphClient(customerData.targetTenantId);

            // Create the app registration in the customer's tenant
            const appDisplayName = `M365 Security Assessment - ${customerData.tenantName}`;
            const appRegistration = {
                displayName: appDisplayName,
                description: `Security assessment application for ${customerData.tenantName}`,
                signInAudience: 'AzureADMyOrg', // Single tenant (customer's tenant only)
                requiredResourceAccess: this.mapPermissionsToResourceAccess(permissions),
                web: {
                    redirectUris: [
                        `${process.env.REDIRECT_URI || "https://portal.azure.com/"}`,
                        `${process.env.REDIRECT_URI || "https://portal.azure.com/"}/auth/callback`
                    ],
                    implicitGrantSettings: {
                        enableAccessTokenIssuance: false,
                        enableIdTokenIssuance: false
                    }
                },
                api: {
                    acceptMappedClaims: true,
                    knownClientApplications: [],
                    requestedAccessTokenVersion: 2
                }
            };

            console.log('📝 GraphApiService: Creating app registration...');
            const createdApp = await customerGraphClient.api('/applications').post(appRegistration);
            
            console.log('✅ GraphApiService: App registration created:', createdApp.appId);

            // Create client secret for the app
            const secretRequest = {
                passwordCredential: {
                    displayName: `Assessment Key - ${new Date().toISOString().split('T')[0]}`,
                    endDateTime: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString() // 1 year
                }
            };

            const secretResponse = await customerGraphClient.api(`/applications/${createdApp.id}/addPassword`).post(secretRequest);
            console.log('🔑 GraphApiService: Client secret created');

            // Create service principal for the app
            const servicePrincipalRequest = {
                appId: createdApp.appId,
                accountEnabled: true,
                displayName: appDisplayName,
                servicePrincipalType: 'Application'
            };

            const servicePrincipal = await customerGraphClient.api('/servicePrincipals').post(servicePrincipalRequest);
            console.log('👤 GraphApiService: Service principal created:', servicePrincipal.id);

            // Grant admin consent for the required permissions
            try {
                await this.grantAdminConsentForApp(customerGraphClient, servicePrincipal.id, permissions);
                console.log('✅ GraphApiService: Admin consent granted');
            } catch (consentError) {
                console.warn('⚠️ GraphApiService: Could not auto-grant admin consent, manual consent may be required:', consentError);
            }

            const baseUrl = process.env.REDIRECT_URI || "https://portal.azure.com/";
            
            // Create a consent URL (though app is already created, this can be used for re-consent if needed)
            const scope = permissions.join(' ');
            const consentUrl = `https://login.microsoftonline.com/${customerData.targetTenantId}/v2.0/adminconsent` +
                `?client_id=${encodeURIComponent(createdApp.appId)}` +
                `&redirect_uri=${encodeURIComponent(baseUrl)}` +
                `&scope=${encodeURIComponent(scope)}` +
                `&state=${encodeURIComponent(JSON.stringify({
                    customer_tenant: customerData.targetTenantId,
                    customer_name: customerData.tenantName,
                    customer_domain: customerData.tenantDomain,
                    timestamp: Date.now(),
                    app_type: 'individual'
                }))}`;

            return {
                applicationId: createdApp.id,
                clientId: createdApp.appId,
                appId: createdApp.appId,
                servicePrincipalId: servicePrincipal.id,
                objectId: servicePrincipal.id,
                clientSecret: secretResponse.secretText,
                consentUrl: consentUrl,
                redirectUri: baseUrl,
                permissions: permissions,
                resolvedTenantId: customerData.targetTenantId,
                isNewApp: true
            };

        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to create app in customer tenant:', error);
            throw new Error(`Failed to create app in customer tenant: ${error.message || error}`);
        }
    }

    /**
     * Get a Graph client for the customer's tenant
     * This requires appropriate cross-tenant permissions
     */
    async getCustomerTenantGraphClient(targetTenantId: string): Promise<any> {
        try {
            // Use your app's credentials to get access to the customer's tenant
            // This requires the customer to have previously consented to your management app
            const credential = new DefaultAzureCredential();
            
            // Get token for the specific customer tenant
            const tokenResponse = await credential.getToken([
                `https://graph.microsoft.com/.default`
            ], {
                tenantId: targetTenantId
            });

            const customerGraphClient = Client.init({
                authProvider: async () => {
                    return tokenResponse.token;
                }
            });

            return customerGraphClient;

        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to get customer tenant access:', error);
            throw new Error(`Cannot access customer tenant. Customer may need to grant cross-tenant permissions first: ${error.message}`);
        }
    }

    /**
     * Grant admin consent for app permissions
     */
    async grantAdminConsentForApp(graphClient: any, servicePrincipalId: string, permissions: string[]): Promise<void> {
        try {
            // Get Microsoft Graph service principal ID
            const graphServicePrincipal = await graphClient.api('/servicePrincipals')
                .filter("appId eq '00000003-0000-0000-c000-000000000000'")
                .get();

            if (!graphServicePrincipal.value || graphServicePrincipal.value.length === 0) {
                throw new Error('Microsoft Graph service principal not found');
            }

            const graphSpId = graphServicePrincipal.value[0].id;

            // Map permissions to their IDs and grant them
            const permissionMappings = await this.getPermissionIds(graphClient, graphSpId, permissions);

            for (const permission of permissionMappings) {
                const grantRequest = {
                    clientId: servicePrincipalId,
                    consentType: 'AllPrincipals',
                    resourceId: graphSpId,
                    scope: permission.value
                };

                try {
                    await graphClient.api('/oauth2PermissionGrants').post(grantRequest);
                    console.log(`✅ Granted permission: ${permission.value}`);
                } catch (grantError) {
                    console.warn(`⚠️ Could not grant permission ${permission.value}:`, grantError);
                }
            }

        } catch (error: any) {
            console.error('❌ Failed to grant admin consent:', error);
            throw error;
        }
    }

    /**
     * Get permission IDs for the given permission names
     */
    async getPermissionIds(graphClient: any, resourceId: string, permissionNames: string[]): Promise<Array<{value: string, id: string}>> {
        try {
            const servicePrincipal = await graphClient.api(`/servicePrincipals/${resourceId}`).get();
            const oauth2Permissions = servicePrincipal.oauth2PermissionScopes || [];
            const appRoles = servicePrincipal.appRoles || [];

            const mappedPermissions = [];

            for (const permissionName of permissionNames) {
                // Look in OAuth2 permissions (delegated permissions)
                const oauth2Permission = oauth2Permissions.find((p: any) => p.value === permissionName);
                if (oauth2Permission) {
                    mappedPermissions.push({
                        value: oauth2Permission.value,
                        id: oauth2Permission.id
                    });
                    continue;
                }

                // Look in app roles (application permissions)
                const appRole = appRoles.find((p: any) => p.value === permissionName);
                if (appRole) {
                    mappedPermissions.push({
                        value: appRole.value,
                        id: appRole.id
                    });
                }
            }

            return mappedPermissions;

        } catch (error: any) {
            console.error('❌ Failed to get permission IDs:', error);
            return permissionNames.map(name => ({ value: name, id: name }));
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
