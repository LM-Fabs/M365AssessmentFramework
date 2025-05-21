import { app } from '@azure/functions';
import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

export const createEnterpriseAppHandler = app.http('createEnterpriseApp', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        const { targetTenantId } = request.body;
        context.log('CreateEnterpriseApp function processing request for tenant:', targetTenantId);

        try {
            if (!targetTenantId) {
                return {
                    status: 400,
                    body: { error: "Target tenant ID is required" }
                };
            }

            // App registration configuration
            const appRegistration = {
                displayName: "M365 Assessment Framework",
                signInAudience: "AzureADMyOrg",
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000", // Microsoft Graph
                        resourceAccess: [
                            {
                                id: "df021288-bdef-4463-88db-98f22de89214", // Organization.Read.All
                                type: "Role"
                            },
                            {
                                id: "230c1aed-a721-4c5d-9cb4-a90514e508ef", // Reports.Read.All
                                type: "Role"
                            },
                            {
                                id: "7ab1d382-f21e-4acd-a863-ba3e13f7da61", // Directory.Read.All
                                type: "Role"
                            },
                            {
                                id: "246dd0d5-5bd0-4def-940b-0421030a5b68", // Policy.Read.All
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

            const credential = new ClientSecretCredential(
                process.env.AZURE_TENANT_ID!,
                process.env.AZURE_CLIENT_ID!,
                process.env.AZURE_CLIENT_SECRET!
            );

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
                body: {
                    applicationId: application.id,
                    applicationObjectId: application.id,
                    clientId: application.appId,
                    servicePrincipalId: servicePrincipal.id,
                    tenantId: targetTenantId
                }
            };
        } catch (error: any) {
            context.log.error('Error creating enterprise application:', error);
            return {
                status: 500,
                body: {
                    error: error.message || 'An error occurred while creating the enterprise application'
                }
            };
        }
    }
});