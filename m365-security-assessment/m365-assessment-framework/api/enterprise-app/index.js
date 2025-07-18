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

            // Load the GraphApiService
            const { GraphApiService } = require('../shared/graphApiService');

            // Initialize GraphApiService
            const graphApiService = new GraphApiService();
            
            // Prepare customer data for app creation
            const customerData = {
                tenantName: tenantName || targetTenantDomain || finalTenantId,
                tenantDomain: targetTenantDomain || 'unknown.onmicrosoft.com',
                targetTenantId: finalTenantId,
                contactEmail,
                requiredPermissions
            };

            context.log('🚀 Creating Azure AD app registration using GraphApiService...');
            context.log('📋 Customer data:', JSON.stringify(customerData, null, 2));

            // Create the multi-tenant app registration
            const appRegistration = await graphApiService.createMultiTenantAppRegistration(customerData);
            
            context.log('✅ App registration created successfully:', appRegistration.clientId);

            // Return the app registration details
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    data: {
                        applicationId: appRegistration.applicationId,
                        clientId: appRegistration.clientId,
                        servicePrincipalId: appRegistration.servicePrincipalId,
                        clientSecret: appRegistration.clientSecret,
                        consentUrl: appRegistration.consentUrl,
                        redirectUri: appRegistration.redirectUri,
                        permissions: appRegistration.permissions,
                        resolvedTenantId: appRegistration.resolvedTenantId,
                        isReal: true,
                        createdDate: new Date().toISOString()
                    },
                    message: 'Azure AD app registration created successfully. Admin consent is required in the target tenant.'
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
        context.log.error('❌ Error creating app registration:', error);
        
        // Enhanced error handling with specific error types
        let statusCode = 500;
        let errorMessage = 'Failed to create Azure AD app registration';
        let troubleshootingSteps = [
            'Check Azure service principal configuration',
            'Verify required permissions are granted',
            'Ensure admin consent has been provided'
        ];

        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes('authentication') || errorMsg.includes('credentials')) {
            errorMessage = 'Authentication failed. Check the service principal credentials.';
            statusCode = 401;
            troubleshootingSteps = [
                'Verify the AZURE_CLIENT_ID is correct',
                'Verify the AZURE_CLIENT_SECRET is valid and not expired',
                'Verify the AZURE_TENANT_ID is correct',
                'Check that the service principal exists and is enabled'
            ];
        } else if (errorMsg.includes('permissions') || errorMsg.includes('insufficient')) {
            errorMessage = 'Insufficient permissions to create app registration. Check the service principal permissions.';
            statusCode = 403;
            troubleshootingSteps = [
                'Grant Application.ReadWrite.All permission to the service principal',
                'Ensure admin consent has been granted for the permissions',
                'Check that the service principal is not blocked by conditional access policies'
            ];
        }

        context.res = {
            status: statusCode,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: errorMessage,
                details: errorMsg,
                troubleshooting: troubleshootingSteps,
                timestamp: new Date().toISOString()
            })
        };
    }
};
