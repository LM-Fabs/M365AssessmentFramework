"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGraphApiService = exports.GraphApiService = void 0;
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const identity_1 = require("@azure/identity");
/**
 * Microsoft Graph API Service for Azure AD app registration management
 * Uses managed identity for authentication and implements proper error handling
 * Follows Azure best practices for Microsoft Graph API interactions
 */
class GraphApiService {
    constructor() {
        this.isInitialized = false;
        // Use managed identity for authentication (Azure best practice)
        const credential = new identity_1.DefaultAzureCredential();
        // Initialize Microsoft Graph client with managed identity
        this.graphClient = microsoft_graph_client_1.Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    const tokenResponse = await credential.getToken("https://graph.microsoft.com/.default");
                    return tokenResponse?.token || "";
                }
            }
        });
    }
    /**
     * Create Azure AD App Registration for customer
     * Implements proper permissions and security configuration
     */
    async createAppRegistration(customerData) {
        try {
            // Create the app registration
            const appName = `M365-Assessment-${customerData.tenantName.replace(/\s+/g, '-')}`;
            const applicationRequest = {
                displayName: appName,
                description: `M365 Security Assessment Application for ${customerData.tenantName}`,
                signInAudience: "AzureADMultipleOrgs",
                web: {
                    redirectUris: [
                        `${process.env.FRONTEND_URL || 'https://localhost:3000'}/auth/callback`,
                        `${process.env.BACKEND_URL || 'https://localhost:7071'}/api/auth/callback`
                    ],
                    implicitGrantSettings: {
                        enableAccessTokenIssuance: false,
                        enableIdTokenIssuance: true
                    }
                },
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000",
                        resourceAccess: [
                            {
                                id: "7ab1d382-f21e-4acd-a863-ba3e13f7da61",
                                type: "Role"
                            },
                            {
                                id: "dc5007c0-2d7d-4c42-879c-2dab87571379",
                                type: "Role"
                            },
                            {
                                id: "246dd0d5-5bd0-4def-940b-0421030a5b68",
                                type: "Role"
                            },
                            {
                                id: "498476ce-e0fe-48b0-b801-37ba7e2685c6",
                                type: "Role"
                            },
                            {
                                id: "19dbc75e-c2e2-444c-a770-ec69d8559fc7",
                                type: "Role"
                            }
                        ]
                    }
                ],
                tags: [
                    "M365Assessment",
                    "SecurityAssessment",
                    customerData.tenantDomain
                ]
            };
            // Create the application
            const application = await this.graphClient
                .api('/applications')
                .post(applicationRequest);
            if (!application.appId || !application.id) {
                throw new Error('Failed to create application - missing required IDs');
            }
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
            // Generate client secret
            const passwordCredential = {
                displayName: `${appName}-Secret-${new Date().getTime()}`,
                endDateTime: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString() // 1 year expiry
            };
            const secretResponse = await this.graphClient
                .api(`/applications/${application.id}/addPassword`)
                .post(passwordCredential);
            return {
                applicationId: application.id,
                clientId: application.appId,
                servicePrincipalId: servicePrincipal.id || '',
                clientSecret: secretResponse.secretText
            };
        }
        catch (error) {
            throw new Error(`Failed to create app registration: ${error.message}`);
        }
    }
    /**
     * Update app registration permissions
     * Used when customer requirements change
     */
    async updateAppPermissions(applicationId, permissions) {
        try {
            const permissionMap = {
                'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
                'SecurityEvents.Read.All': 'dc5007c0-2d7d-4c42-879c-2dab87571379',
                'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
                'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
                'Directory.ReadWrite.All': '19dbc75e-c2e2-444c-a770-ec69d8559fc7'
            };
            const resourceAccess = permissions.map(permission => ({
                id: permissionMap[permission],
                type: "Role"
            })).filter(ra => ra.id); // Filter out unmapped permissions
            const updateRequest = {
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000",
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
exports.getGraphApiService = getGraphApiService;
//# sourceMappingURL=graphApiService.js.map