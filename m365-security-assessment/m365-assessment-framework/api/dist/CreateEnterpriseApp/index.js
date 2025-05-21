"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const identity_1 = require("@azure/identity");
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const azureTokenCredentials_1 = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
functions_1.app.http('createEnterpriseApp', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('CreateEnterpriseApp function processed a request.');
        try {
            const requestBody = await request.json();
            const targetTenantId = requestBody.targetTenantId;
            if (!targetTenantId) {
                return {
                    status: 400,
                    jsonBody: { error: "Target tenant ID is required" }
                };
            }
            // App registration configuration
            const appRegistration = {
                displayName: "M365 Assessment Framework",
                signInAudience: "AzureADMyOrg",
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000",
                        resourceAccess: [
                            {
                                id: "df021288-bdef-4463-88db-98f22de89214",
                                type: "Role"
                            },
                            {
                                id: "230c1aed-a721-4c5d-9cb4-a90514e508ef",
                                type: "Role"
                            },
                            {
                                id: "7ab1d382-f21e-4acd-a863-ba3e13f7da61",
                                type: "Role"
                            },
                            {
                                id: "246dd0d5-5bd0-4def-940b-0421030a5b68",
                                type: "Role"
                            }
                        ]
                    }
                ],
                web: {
                    redirectUris: [process.env.REDIRECT_URI || "http://localhost:3000"],
                    implicitGrantSettings: {
                        enableIdTokenIssuance: true,
                        enableAccessTokenIssuance: true
                    }
                }
            };
            // Initialize Graph client with managed identity
            const credential = new identity_1.ClientSecretCredential(process.env.AZURE_TENANT_ID, process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET);
            const authProvider = new azureTokenCredentials_1.TokenCredentialAuthenticationProvider(credential, {
                scopes: ['https://graph.microsoft.com/.default']
            });
            const graphClient = microsoft_graph_client_1.Client.initWithMiddleware({
                authProvider: authProvider
            });
            // Create the application
            const application = await graphClient.api('/applications')
                .post(appRegistration);
            // Create service principal for the application
            const servicePrincipal = await graphClient.api('/servicePrincipals')
                .post({
                appId: application.appId,
                displayName: application.displayName
            });
            const result = {
                applicationId: application.id,
                applicationObjectId: application.id,
                clientId: application.appId,
                servicePrincipalId: servicePrincipal.id,
                tenantId: targetTenantId
            };
            return {
                status: 200,
                jsonBody: result
            };
        }
        catch (error) {
            context.error('Error in createEnterpriseApp:', error);
            return {
                status: 500,
                jsonBody: { error: error.message || "Error creating enterprise application" }
            };
        }
    }
});
//# sourceMappingURL=index.js.map