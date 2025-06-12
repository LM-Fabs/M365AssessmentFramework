"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMultiTenantAppHandler = void 0;
const functions_1 = require("@azure/functions");
const identity_1 = require("@azure/identity");
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const azureTokenCredentials_1 = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const keyVaultService_1 = require("../shared/keyVaultService");
exports.createMultiTenantAppHandler = functions_1.app.http('createMultiTenantApp', {
    methods: ['POST'],
    authLevel: 'anonymous', // Changed to allow cross-tenant access
    route: 'enterprise-app/multi-tenant',
    handler: async (request, context) => {
        context.log('CreateMultiTenantApp function processing request');
        try {
            // Enhanced request validation
            const requestData = await request.json();
            if (!requestData?.targetTenantId) {
                return {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    jsonBody: {
                        error: "Target tenant ID is required",
                        expectedFormat: "{ targetTenantId: string, targetTenantDomain?: string }"
                    }
                };
            }
            const { targetTenantId, targetTenantDomain, assessmentName = "M365 Security Assessment", requiredPermissions = [
                "Organization.Read.All",
                "Reports.Read.All",
                "Directory.Read.All",
                "Policy.Read.All",
                "SecurityEvents.Read.All",
                "IdentityRiskyUser.Read.All",
                "DeviceManagementManagedDevices.Read.All"
            ] } = requestData;
            context.log(`Creating multi-tenant app for tenant: ${targetTenantId} (${targetTenantDomain || 'domain unknown'})`);
            // Enhanced app registration with multi-tenant capabilities
            const appRegistration = {
                displayName: `${assessmentName} - ${targetTenantDomain || targetTenantId}`,
                signInAudience: "AzureADMultipleOrgs", // Multi-tenant support
                description: `Security assessment application for tenant ${targetTenantDomain || targetTenantId}`,
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000", // Microsoft Graph
                        resourceAccess: [
                            // Security and compliance permissions
                            { id: "df021288-bdef-4463-88db-98f22de89214", type: "Role" }, // Organization.Read.All
                            { id: "230c1aed-a721-4c5d-9cb4-a90514e508ef", type: "Role" }, // Reports.Read.All
                            { id: "7ab1d382-f21e-4acd-a863-ba3e13f7da61", type: "Role" }, // Directory.Read.All
                            { id: "246dd0d5-5bd0-4def-940b-0421030a5b68", type: "Role" }, // Policy.Read.All
                            { id: "bf394140-e372-4bf9-a898-299cfc7564e5", type: "Role" }, // SecurityEvents.Read.All
                            { id: "dc5007c0-2d7d-4c42-879c-2dab87571379", type: "Role" }, // IdentityRiskyUser.Read.All
                            { id: "2f51be20-0bb4-4fed-bf7b-db946066c75e", type: "Role" }, // DeviceManagementManagedDevices.Read.All
                            // Additional security-specific permissions
                            { id: "ee928332-e9d2-4747-91b6-7c2c54de8c51", type: "Role" }, // ThreatIndicators.Read.All
                            { id: "b0afded3-3588-46d8-8b3d-9842eff778da", type: "Role" }, // AuditLog.Read.All
                        ]
                    }
                ],
                web: {
                    redirectUris: [
                        process.env.ASSESSMENT_REDIRECT_URI || "https://localhost:3000/auth/callback",
                        process.env.PRODUCTION_REDIRECT_URI || "https://your-swa-domain.azurestaticapps.net/auth/callback"
                    ],
                    implicitGrantSettings: {
                        enableIdTokenIssuance: true,
                        enableAccessTokenIssuance: false // Use authorization code flow for security
                    }
                },
                spa: {
                    redirectUris: [
                        process.env.ASSESSMENT_REDIRECT_URI || "https://localhost:3000/auth/callback",
                        process.env.PRODUCTION_REDIRECT_URI || "https://your-swa-domain.azurestaticapps.net/auth/callback"
                    ]
                },
                publicClient: {
                    redirectUris: [
                        "msal://redirect" // For mobile apps if needed
                    ]
                }
            };
            // Get administrative credentials from Key Vault
            const keyVaultService = (0, keyVaultService_1.getKeyVaultService)();
            const adminCredentialsJson = await keyVaultService.getApiConfiguration('graph-admin-credentials');
            const adminCredentials = JSON.parse(adminCredentialsJson);
            const { tenantId: adminTenantId, clientId: adminClientId, clientSecret: adminClientSecret } = adminCredentials;
            if (!adminTenantId || !adminClientId || !adminClientSecret) {
                throw new Error('Failed to retrieve administrative credentials from Key Vault');
            }
            // Create credentials for Microsoft Graph API (using admin tenant for app creation)
            const credential = new identity_1.ClientSecretCredential(adminTenantId, adminClientId, adminClientSecret);
            const authProvider = new azureTokenCredentials_1.TokenCredentialAuthenticationProvider(credential, {
                scopes: ['https://graph.microsoft.com/.default']
            });
            const graphClient = microsoft_graph_client_1.Client.initWithMiddleware({
                authProvider: authProvider
            });
            // Create the application registration
            context.log('Creating application registration...');
            const application = await graphClient.api('/applications')
                .post(appRegistration);
            // Create service principal in the admin tenant
            context.log('Creating service principal...');
            const servicePrincipal = await graphClient.api('/servicePrincipals')
                .post({
                appId: application.appId,
                displayName: application.displayName,
                notes: `Multi-tenant assessment app for ${targetTenantDomain || targetTenantId}`
            });
            // Generate authentication URLs for the target tenant
            const baseAuthUrl = `https://login.microsoftonline.com/${targetTenantId}/oauth2/v2.0/authorize`;
            const consentUrl = `https://login.microsoftonline.com/${targetTenantId}/adminconsent`;
            const redirectUri = appRegistration.web.redirectUris[0];
            const authParams = new URLSearchParams({
                client_id: application.appId,
                response_type: 'code',
                redirect_uri: redirectUri,
                scope: 'https://graph.microsoft.com/.default',
                state: targetTenantId,
                prompt: 'consent'
            });
            const consentParams = new URLSearchParams({
                client_id: application.appId,
                state: targetTenantId,
                redirect_uri: redirectUri
            });
            const response = {
                applicationId: application.id,
                clientId: application.appId,
                servicePrincipalId: servicePrincipal.id,
                tenantId: targetTenantId,
                authUrl: `${baseAuthUrl}?${authParams.toString()}`,
                consentUrl: `${consentUrl}?${consentParams.toString()}`,
                redirectUri: redirectUri,
                permissions: requiredPermissions
            };
            context.log('Successfully created multi-tenant application:', {
                clientId: application.appId,
                targetTenant: targetTenantId,
                permissions: requiredPermissions.length
            });
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                jsonBody: response
            };
        }
        catch (error) {
            context.error('Error creating multi-tenant application:', error);
            // Enhanced error handling with specific error types
            let statusCode = 500;
            let errorMessage = 'An error occurred while creating the multi-tenant application';
            if (error.code === 'Request_BadRequest') {
                statusCode = 400;
                errorMessage = 'Invalid tenant ID or configuration';
            }
            else if (error.code === 'Forbidden') {
                statusCode = 403;
                errorMessage = 'Insufficient permissions to create application in target tenant';
            }
            else if (error.code === 'ThrottledRequest') {
                statusCode = 429;
                errorMessage = 'Request throttled, please retry after some time';
            }
            return {
                status: statusCode,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    error: errorMessage,
                    details: error.message || error.toString(),
                    code: error.code || 'UnknownError',
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
});
//# sourceMappingURL=index.js.map