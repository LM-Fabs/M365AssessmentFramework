import { app } from '@azure/functions';
import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { KeyVaultService } from '../shared/keyVaultService';
export const createEnterpriseAppHandler = app.http('createEnterpriseApp', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        try {
            const requestData = await request.json();
            if (!requestData || typeof requestData !== 'object' || !('targetTenantId' in requestData)) {
                return {
                    status: 400,
                    jsonBody: { error: "Invalid request body. Expected { targetTenantId: string }" }
                };
            }
            const { targetTenantId } = requestData;
            context.log('CreateEnterpriseApp function processing request for tenant:', targetTenantId);
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
            // Get secrets from Key Vault using the KeyVaultService
            const keyVaultService = KeyVaultService.getInstance();
            const { tenantId, clientId, clientSecret } = await keyVaultService.getGraphCredentials();
            if (!tenantId || !clientId || !clientSecret) {
                throw new Error('Failed to retrieve required credentials from Key Vault');
            }
            // Create credentials for Microsoft Graph API
            const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
            const authProvider = new TokenCredentialAuthenticationProvider(credential, {
                scopes: ['https://graph.microsoft.com/.default']
            });
            const graphClient = Client.initWithMiddleware({
                authProvider: authProvider
            });
            const application = await graphClient.api('/applications')
                .post(appRegistration);
            const servicePrincipal = await graphClient.api('/servicePrincipals')
                .post({
                appId: application.appId,
                displayName: application.displayName
            });
            return {
                status: 200,
                jsonBody: {
                    applicationId: application.id,
                    applicationObjectId: application.id,
                    clientId: application.appId,
                    servicePrincipalId: servicePrincipal.id,
                    tenantId: targetTenantId
                }
            };
        }
        catch (error) {
            context.error('Error creating enterprise application:', error);
            return {
                status: 500,
                jsonBody: {
                    error: error.message || 'An error occurred while creating the enterprise application'
                }
            };
        }
    }
});
//# sourceMappingURL=index.js.map