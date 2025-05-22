import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

interface CreateEnterpriseAppRequest {
    targetTenantId: string;
}

export const createEnterpriseAppHandler = app.http('createEnterpriseApp', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        try {
            const requestData = await request.json();
            if (!requestData || typeof requestData !== 'object' || !('targetTenantId' in requestData)) {
                return {
                    status: 400,
                    jsonBody: { error: "Invalid request body. Expected { targetTenantId: string }" }
                };
            }
            
            const { targetTenantId } = requestData as CreateEnterpriseAppRequest;
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
                process.env.react_app_client_id!, // Updated to use the same env var as staticwebapp.config.json
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
                jsonBody: {
                    applicationId: application.id,
                    applicationObjectId: application.id,
                    clientId: application.appId,
                    servicePrincipalId: servicePrincipal.id,
                    tenantId: targetTenantId
                }
            };
        } catch (error: any) {
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