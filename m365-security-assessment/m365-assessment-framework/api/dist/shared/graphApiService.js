"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphApiService = void 0;
exports.getGraphApiService = getGraphApiService;
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const identity_1 = require("@azure/identity");
/**
 * Microsoft Graph API Service for Azure AD app registration management
 * Uses managed identity for authentication and implements proper error handling
 * Follows Azure best practices for Microsoft Graph API interactions
 *
 * References:
 * - Microsoft Graph SDK: https://docs.microsoft.com/en-us/graph/sdks/sdks-overview
 * - App Registration API: https://docs.microsoft.com/en-us/graph/api/application-post-applications
 * - Service Principal API: https://docs.microsoft.com/en-us/graph/api/serviceprincipal-post-serviceprincipals
 */
class GraphApiService {
    constructor() {
        this.isInitialized = false;
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
            const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}. Please configure these in your Azure Static Web App settings.`;
            console.error('❌ GraphApiService:', errorMsg);
            throw new Error(errorMsg);
        }
        // Use service principal credentials for authentication
        const credential = new identity_1.ClientSecretCredential(process.env.AZURE_TENANT_ID, process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET);
        console.log('✅ GraphApiService: Using service principal authentication');
        console.log('🔧 GraphApiService: Tenant ID:', process.env.AZURE_TENANT_ID);
        console.log('🔧 GraphApiService: Client ID:', process.env.AZURE_CLIENT_ID?.substring(0, 8) + '...');
        // Initialize Microsoft Graph client with proper authentication
        this.graphClient = microsoft_graph_client_1.Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    try {
                        const tokenResponse = await credential.getToken("https://graph.microsoft.com/.default");
                        if (!tokenResponse?.token) {
                            throw new Error('Failed to obtain access token - empty response');
                        }
                        console.log('✅ GraphApiService: Access token obtained successfully');
                        return tokenResponse.token;
                    }
                    catch (error) {
                        console.error('❌ GraphApiService: Failed to get access token:', error);
                        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : error}. Check your service principal configuration.`);
                    }
                }
            }
        });
    }
    /**
     * Create multi-tenant Azure AD App Registration for customer tenant authentication
     * Creates app in our tenant that can be consented to by customer tenants
     *
     * @param customerData Customer information for app naming and configuration
     * @returns App registration details including consent URL
     */
    async createMultiTenantAppRegistration(customerData) {
        try {
            console.log('🏢 GraphApiService: Creating multi-tenant app for:', customerData.tenantName);
            // Define required permissions for security assessment (read-only)
            const permissions = customerData.requiredPermissions || [
                'Organization.Read.All',
                'Reports.Read.All',
                'Directory.Read.All',
                'Policy.Read.All',
                'SecurityEvents.Read.All',
                'IdentityRiskyUser.Read.All',
                'DeviceManagementManagedDevices.Read.All',
                'AuditLog.Read.All',
                'ThreatIndicators.Read.All'
            ];
            // Create the app registration with multi-tenant configuration
            const appName = `M365-Security-Assessment-${customerData.tenantName.replace(/\s+/g, '-')}`;
            // Use a default redirect URI for multi-tenant apps (Azure portal standard)
            const redirectUri = process.env.REDIRECT_URI || "https://portal.azure.com/";
            const applicationRequest = {
                displayName: appName,
                description: `M365 Security Assessment Application for ${customerData.tenantName} (${customerData.tenantDomain})`,
                signInAudience: "AzureADMultipleOrgs", // Multi-tenant application
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000", // Microsoft Graph
                        resourceAccess: permissions.map(permission => ({
                            id: this.getPermissionId(permission),
                            type: "Role" // Application permissions (not delegated)
                        }))
                    }
                ],
                tags: [
                    "M365Assessment",
                    "SecurityAssessment",
                    customerData.tenantDomain,
                    customerData.targetTenantId
                ]
            };
            console.log('📝 GraphApiService: Creating application with config:', JSON.stringify(applicationRequest, null, 2));
            // Create the application
            const application = await this.graphClient
                .api('/applications')
                .post(applicationRequest);
            if (!application.appId || !application.id) {
                throw new Error('Failed to create application - missing required IDs in response');
            }
            console.log('✅ GraphApiService: Application created:', application.appId);
            // Create service principal for the application
            const servicePrincipalRequest = {
                appId: application.appId,
                displayName: appName,
                tags: [
                    "WindowsAzureActiveDirectoryIntegratedApp",
                    "M365Assessment"
                ]
            };
            const servicePrincipal = await this.graphClient
                .api('/servicePrincipals')
                .post(servicePrincipalRequest);
            console.log('✅ GraphApiService: Service principal created:', servicePrincipal.id);
            // Generate client secret with 2-year expiry
            const passwordCredential = {
                displayName: `${appName}-Secret-${new Date().getTime()}`,
                endDateTime: new Date(Date.now() + (2 * 365 * 24 * 60 * 60 * 1000)).toISOString() // 2 years
            };
            const secretResponse = await this.graphClient
                .api(`/applications/${application.id}/addPassword`)
                .post(passwordCredential);
            console.log('✅ GraphApiService: Client secret generated');
            // Generate admin consent URL for the target tenant
            const consentUrl = this.generateConsentUrl(application.appId, customerData.targetTenantId, permissions, redirectUri);
            const result = {
                applicationId: application.id,
                clientId: application.appId,
                servicePrincipalId: servicePrincipal.id || '',
                clientSecret: secretResponse.secretText,
                consentUrl,
                redirectUri: redirectUri,
                permissions
            };
            console.log('🎉 GraphApiService: Multi-tenant app created successfully');
            return result;
        }
        catch (error) {
            console.error('❌ GraphApiService: Failed to create app registration:', error);
            // Handle specific Graph API errors
            if (error.code === 'Request_ResourceNotFound') {
                throw new Error('Invalid tenant ID or insufficient permissions to create app registration');
            }
            if (error.code === 'Authorization_RequestDenied') {
                throw new Error('Insufficient permissions to create app registration. Ensure Application.ReadWrite.All permission is granted.');
            }
            if (error.code === 'Request_BadRequest') {
                throw new Error(`Invalid app registration request: ${error.message}`);
            }
            throw new Error(`Failed to create app registration: ${error.message || error}`);
        }
    }
    /**
     * Get secure score data from Microsoft Graph for a customer tenant
     * Uses the customer's consented app credentials
     */
    async getSecureScore(tenantId, clientId, clientSecret) {
        try {
            console.log('🛡️ GraphApiService: Fetching secure score for tenant:', tenantId);
            // Create client for customer tenant using their credentials
            const customerCredential = new identity_1.ClientSecretCredential(tenantId, clientId, clientSecret);
            const customerGraphClient = microsoft_graph_client_1.Client.initWithMiddleware({
                authProvider: {
                    getAccessToken: async () => {
                        const tokenResponse = await customerCredential.getToken("https://graph.microsoft.com/.default");
                        return tokenResponse?.token || "";
                    }
                }
            });
            // Fetch secure scores (latest first)
            const secureScoresResponse = await customerGraphClient
                .api('/security/secureScores')
                .top(1)
                .orderby('createdDateTime desc')
                .get();
            if (!secureScoresResponse.value || secureScoresResponse.value.length === 0) {
                throw new Error('No secure score data available for this tenant');
            }
            const latestScore = secureScoresResponse.value[0];
            // Fetch secure score control profiles for detailed breakdown
            const controlProfilesResponse = await customerGraphClient
                .api('/security/secureScoreControlProfiles')
                .get();
            const controlScores = controlProfilesResponse.value?.map((control) => ({
                controlName: control.title || control.controlName || 'Unknown Control',
                category: control.controlCategory || 'General',
                currentScore: control.score || 0,
                maxScore: control.maxScore || 0,
                implementationStatus: control.implementationStatus || 'Not Implemented'
            })) || [];
            const result = {
                currentScore: latestScore.currentScore || 0,
                maxScore: latestScore.maxScore || 0,
                percentage: Math.round(((latestScore.currentScore || 0) / (latestScore.maxScore || 1)) * 100),
                controlScores,
                lastUpdated: new Date(latestScore.createdDateTime)
            };
            console.log('✅ GraphApiService: Secure score retrieved successfully');
            return result;
        }
        catch (error) {
            console.error('❌ GraphApiService: Failed to fetch secure score:', error);
            if (error.code === 'Forbidden') {
                throw new Error('Insufficient permissions to read secure score. Ensure SecurityEvents.Read.All permission is granted and consented.');
            }
            if (error.code === 'Unauthorized') {
                throw new Error('Authentication failed. Please verify the app registration has been consented to by the customer tenant admin.');
            }
            throw new Error(`Failed to fetch secure score: ${error.message || error}`);
        }
    }
    /**
     * Get license information from Microsoft Graph for a customer tenant
     */
    async getLicenseInfo(tenantId, clientId, clientSecret) {
        try {
            console.log('📄 GraphApiService: Fetching license info for tenant:', tenantId);
            // Create client for customer tenant
            const customerCredential = new identity_1.ClientSecretCredential(tenantId, clientId, clientSecret);
            const customerGraphClient = microsoft_graph_client_1.Client.initWithMiddleware({
                authProvider: {
                    getAccessToken: async () => {
                        const tokenResponse = await customerCredential.getToken("https://graph.microsoft.com/.default");
                        return tokenResponse?.token || "";
                    }
                }
            });
            // Fetch subscribedSkus (license information)
            const licensesResponse = await customerGraphClient
                .api('/subscribedSkus')
                .get();
            const licenseDetails = licensesResponse.value?.map((sku) => ({
                skuId: sku.skuId,
                skuPartNumber: sku.skuPartNumber,
                servicePlanName: sku.servicePlans?.[0]?.servicePlanName || sku.skuPartNumber,
                totalUnits: sku.prepaidUnits?.enabled || 0,
                assignedUnits: sku.consumedUnits || 0,
                consumedUnits: sku.consumedUnits || 0,
                capabilityStatus: sku.capabilityStatus || 'Unknown'
            })) || [];
            const totalLicenses = licenseDetails.reduce((sum, license) => sum + license.totalUnits, 0);
            const assignedLicenses = licenseDetails.reduce((sum, license) => sum + license.assignedUnits, 0);
            const result = {
                totalLicenses,
                assignedLicenses,
                availableLicenses: totalLicenses - assignedLicenses,
                licenseDetails
            };
            console.log('✅ GraphApiService: License info retrieved successfully');
            return result;
        }
        catch (error) {
            console.error('❌ GraphApiService: Failed to fetch license info:', error);
            if (error.code === 'Forbidden') {
                throw new Error('Insufficient permissions to read license information. Ensure Organization.Read.All permission is granted and consented.');
            }
            if (error.code === 'Unauthorized') {
                throw new Error('Authentication failed. Please verify the app registration has been consented to by the customer tenant admin.');
            }
            throw new Error(`Failed to fetch license information: ${error.message || error}`);
        }
    }
    /**
     * Generate admin consent URL for multi-tenant app
     */
    generateConsentUrl(clientId, tenantId, permissions, redirectUri) {
        // For admin consent, we use the standard admin consent endpoint
        return `https://login.microsoftonline.com/${tenantId}/adminconsent` +
            `?client_id=${clientId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }
    /**
     * Map permission names to Graph API permission IDs
     */
    getPermissionId(permissionName) {
        const permissionMap = {
            'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
            'Reports.Read.All': '230c1aed-a721-4c5d-9cb4-a90514e508ef',
            'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
            'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
            'SecurityEvents.Read.All': 'bf394140-e372-4bf9-a898-299cfc7564e5',
            'IdentityRiskyUser.Read.All': 'dc5007c0-2d7d-4c42-879c-2dab87571379',
            'DeviceManagementManagedDevices.Read.All': '2f51be20-0bb4-4fed-bf7b-db946066c75e',
            'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da',
            'ThreatIndicators.Read.All': 'ee928332-e9d2-4747-91b6-7c2c54de8c51'
        };
        const permissionId = permissionMap[permissionName];
        if (!permissionId) {
            throw new Error(`Unknown permission: ${permissionName}`);
        }
        return permissionId;
    }
    /**
     * Update app permissions for an existing application
     */
    async updateAppPermissions(applicationId, permissions) {
        try {
            // Permission ID mapping for Microsoft Graph (consistent with getPermissionId)
            const permissionMap = {
                'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
                'Reports.Read.All': '230c1aed-a721-4c5d-9cb4-a90514e508ef',
                'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
                'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
                'SecurityEvents.Read.All': 'bf394140-e372-4bf9-a898-299cfc7564e5',
                'IdentityRiskyUser.Read.All': 'dc5007c0-2d7d-4c42-879c-2dab87571379',
                'DeviceManagementManagedDevices.Read.All': '2f51be20-0bb4-4fed-bf7b-db946066c75e',
                'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da',
                'ThreatIndicators.Read.All': 'ee928332-e9d2-4747-91b6-7c2c54de8c51',
                'Directory.ReadWrite.All': '19dbc75e-c2e2-444c-a770-ec69d8559fc7'
            };
            const resourceAccess = permissions.map(permission => ({
                id: permissionMap[permission],
                type: "Role"
            })).filter(ra => ra.id); // Filter out unmapped permissions
            const updateRequest = {
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000", // Microsoft Graph
                        resourceAccess
                    }
                ]
            };
            await this.graphClient
                .api(`/applications/${applicationId}`)
                .patch(updateRequest);
        }
        catch (error) {
            throw new Error(`Failed to update app permissions: ${error.message}`);
        }
    }
    /**
     * Clean up - delete app registration (for development/testing)
     */
    async deleteAppRegistration(applicationId) {
        try {
            await this.graphClient.api(`/applications/${applicationId}`).delete();
            console.log('🗑️ GraphApiService: App registration deleted:', applicationId);
        }
        catch (error) {
            console.error('❌ GraphApiService: Failed to delete app registration:', error);
            throw new Error(`Failed to delete app registration: ${error.message || error}`);
        }
    }
    /**
     * Rotate client secret for security
     * Should be called periodically for security best practices
     */
    async rotateClientSecret(applicationId, oldSecretKeyId) {
        try {
            // Generate new client secret
            const passwordCredential = {
                displayName: `Rotated-Secret-${new Date().getTime()}`,
                endDateTime: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString() // 1 year expiry
            };
            const secretResponse = await this.graphClient
                .api(`/applications/${applicationId}/addPassword`)
                .post(passwordCredential);
            // Remove old secret if provided (after new one is successfully created)
            if (oldSecretKeyId) {
                try {
                    await this.graphClient
                        .api(`/applications/${applicationId}/removePassword`)
                        .post({ keyId: oldSecretKeyId });
                }
                catch (removeError) {
                    console.warn('Failed to remove old secret, but new secret was created successfully');
                }
            }
            return secretResponse.secretText;
        }
        catch (error) {
            throw new Error(`Failed to rotate client secret: ${error.message}`);
        }
    }
    /**
     * Get application details
     * Used for validation and monitoring
     */
    async getApplication(applicationId) {
        try {
            const application = await this.graphClient
                .api(`/applications/${applicationId}`)
                .get();
            return application;
        }
        catch (error) {
            if (error.code === 'Request_ResourceNotFound') {
                return null;
            }
            throw new Error(`Failed to get application: ${error.message}`);
        }
    }
    /**
     * Delete application registration
     * Used when customer is removed
     */
    async deleteApplication(applicationId) {
        try {
            await this.graphClient
                .api(`/applications/${applicationId}`)
                .delete();
        }
        catch (error) {
            if (error.code !== 'Request_ResourceNotFound') {
                throw new Error(`Failed to delete application: ${error.message}`);
            }
        }
    }
    /**
     * Grant admin consent for application permissions
     * Note: This requires admin privileges in the target tenant
     */
    async grantAdminConsent(servicePrincipalId) {
        try {
            // This would typically be done through the Azure portal or PowerShell
            // by the customer's admin, but we can provide the URL for them
            const consentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${servicePrincipalId}`;
            // Log the consent URL for customer admin to use
            console.log(`Admin consent required. Direct customer to: ${consentUrl}`);
            // In a real implementation, you might send this URL via email or store it for later retrieval
        }
        catch (error) {
            throw new Error(`Failed to initiate admin consent: ${error.message}`);
        }
    }
    /**
     * Validate application permissions
     * Used to ensure app has required permissions for assessment
     */
    async validatePermissions(applicationId, requiredPermissions) {
        try {
            const application = await this.getApplication(applicationId);
            if (!application) {
                throw new Error('Application not found');
            }
            const grantedPermissions = application.requiredResourceAccess?.[0]?.resourceAccess?.map(ra => this.getPermissionName(ra.id || '')).filter(Boolean) || [];
            const missingPermissions = requiredPermissions.filter(permission => !grantedPermissions.includes(permission));
            return {
                hasAllPermissions: missingPermissions.length === 0,
                missingPermissions
            };
        }
        catch (error) {
            throw new Error(`Failed to validate permissions: ${error.message}`);
        }
    }
    /**
     * Helper method to map permission IDs to names
     */
    getPermissionName(permissionId) {
        const permissionMap = {
            '7ab1d382-f21e-4acd-a863-ba3e13f7da61': 'Directory.Read.All',
            'dc5007c0-2d7d-4c42-879c-2dab87571379': 'SecurityEvents.Read.All',
            '246dd0d5-5bd0-4def-940b-0421030a5b68': 'Policy.Read.All',
            '498476ce-e0fe-48b0-b801-37ba7e2685c6': 'Organization.Read.All',
            '19dbc75e-c2e2-444c-a770-ec69d8559fc7': 'Directory.ReadWrite.All'
        };
        return permissionMap[permissionId] || '';
    }
    /**
     * Health check for Microsoft Graph API connectivity
     */
    async healthCheck() {
        try {
            // Simple query to test connectivity
            await this.graphClient.api('/me').get();
            return true;
        }
        catch (error) {
            console.error('Microsoft Graph API health check failed:', error);
            return false;
        }
    }
}
exports.GraphApiService = GraphApiService;
// Singleton instance for reuse across functions
let graphApiServiceInstance;
function getGraphApiService() {
    if (!graphApiServiceInstance) {
        graphApiServiceInstance = new GraphApiService();
    }
    return graphApiServiceInstance;
}
//# sourceMappingURL=graphApiService.js.map