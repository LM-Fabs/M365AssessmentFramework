import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

interface ICreateAppRequest {
  targetTenantId: string;
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    try {
        const { targetTenantId } = req.body as ICreateAppRequest;

        if (!targetTenantId) {
            context.res = {
                status: 400,
                body: { error: "Target tenant ID is required" }
            };
            return;
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

        // Initialize Graph client with managed identity
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

        // Create the application
        const application = await graphClient.api('/applications')
            .post(appRegistration);

        // Create service principal for the application
        const servicePrincipal = await graphClient.api('/servicePrincipals')
            .post({
                appId: application.appId,
                displayName: application.displayName
            });

        context.res = {
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
        context.res = {
            status: 500,
            body: {
                error: error.message || 'An error occurred while creating the enterprise application'
            }
        };
    }
};

export default httpTrigger;