module.exports = async function (context, req) {
    // CORS headers
    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    context.log('Enterprise app multi-tenant endpoint called');

    try {
        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: ''
            };
            return;
        }

        if (req.method === 'POST') {
            context.log('Creating multi-tenant app registration...');
            
            // Get request data
            const requestData = req.body;
            context.log('Request data:', JSON.stringify(requestData, null, 2));

            // Extract required fields
            const { 
                targetTenantId, 
                targetTenantDomain, 
                tenantName, 
                assessmentName = "M365 Security Assessment",
                contactEmail,
                requiredPermissions = [
                    'Organization.Read.All',
                    'SecurityEvents.Read.All'
                ]
            } = requestData;

            // Validate required fields
            if (!targetTenantId && !targetTenantDomain) {
                context.res = {
                    status: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        error: "Target tenant ID or domain is required",
                        expectedFormat: "{ targetTenantId?: string, targetTenantDomain?: string, tenantName?: string }"
                    })
                };
                return;
            }

            // Determine the final tenant identifier
            let finalTenantId = targetTenantId;
            if (!finalTenantId && targetTenantDomain) {
                finalTenantId = targetTenantDomain.toLowerCase();
            }

            // Check Azure environment variables
            const azureClientId = process.env.AZURE_CLIENT_ID;
            const azureClientSecret = process.env.AZURE_CLIENT_SECRET;
            const azureTenantId = process.env.AZURE_TENANT_ID;

            context.log('Azure environment check:');
            context.log('  - AZURE_CLIENT_ID:', azureClientId ? 'SET' : 'NOT SET');
            context.log('  - AZURE_CLIENT_SECRET:', azureClientSecret ? 'SET' : 'NOT SET');
            context.log('  - AZURE_TENANT_ID:', azureTenantId ? 'SET' : 'NOT SET');

            if (!azureClientId || !azureClientSecret || !azureTenantId) {
                context.res = {
                    status: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        error: "Azure configuration is incomplete",
                        message: "Missing required environment variables for Azure AD app registration",
                        missingVariables: [
                            ...(!azureClientId ? ['AZURE_CLIENT_ID'] : []),
                            ...(!azureClientSecret ? ['AZURE_CLIENT_SECRET'] : []),
                            ...(!azureTenantId ? ['AZURE_TENANT_ID'] : [])
                        ],
                        troubleshooting: [
                            "Check that AZURE_CLIENT_ID is set in your configuration",
                            "Check that AZURE_CLIENT_SECRET is set in your configuration", 
                            "Check that AZURE_TENANT_ID is set in your configuration",
                            "Ensure the service principal has Application.ReadWrite.All permission"
                        ]
                    })
                };
                return;
            }

            // TODO: Implement real Azure AD app registration using Microsoft Graph API
            // This requires implementing the GraphApiService for Azure Functions v3
            context.res = {
                status: 501,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: "Azure AD app registration not implemented",
                    message: "Real Azure AD integration is not yet implemented for this endpoint",
                    requiredImplementation: {
                        service: "GraphApiService integration for Azure Functions v3",
                        permissions: [
                            "Application.ReadWrite.All",
                            "Directory.Read.All"
                        ],
                        endpoints: [
                            "POST /applications",
                            "POST /servicePrincipals"
                        ]
                    },
                    recommendation: "Use manual Azure AD app registration process until this feature is implemented"
                })
            };
        } else {
            context.res = {
                status: 405,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: "Method not allowed"
                })
            };
        }
    } catch (error) {
        context.log.error('Error in enterprise-app multi-tenant endpoint:', error);
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
                message: 'Failed to create multi-tenant app registration'
            })
        };
    }
};
