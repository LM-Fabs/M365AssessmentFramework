const { app } = require('@azure/functions');
const { GraphApiService } = require('../shared/graphApiService');

app.http('enterprise-app', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'enterprise-app/{action?}',
    handler: async (request, context) => {
        context.log('🏢 Enterprise App API called');

        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            };
        }

        try {
            const action = request.params.action || '';
            context.log(`🎯 Action: ${action}`);

            if (action === 'multi-tenant' && request.method === 'POST') {
                return await handleCreateMultiTenantApp(request, context);
            }

            return {
                status: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Not found',
                    message: `Action '${action}' not supported` 
                })
            };

        } catch (error) {
            context.log.error('❌ Enterprise App API error:', error);
            return {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Internal server error',
                    message: error.message 
                })
            };
        }
    }
});

async function handleCreateMultiTenantApp(request, context) {
    try {
        const body = await request.json();
        context.log('📋 Request body:', body);

        const { 
            targetTenantId, 
            targetTenantDomain, 
            tenantName, 
            contactEmail, 
            assessmentName, 
            requiredPermissions 
        } = body;

        // Validate required fields
        if (!targetTenantId || !targetTenantDomain || !tenantName) {
            return {
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Missing required fields',
                    message: 'targetTenantId, targetTenantDomain, and tenantName are required'
                })
            };
        }

        const graphService = GraphApiService.getInstance();
        
        // Create multi-tenant app registration
        const result = await graphService.createMultiTenantAppRegistration({
            tenantId: targetTenantId,
            tenantDomain: targetTenantDomain,
            tenantName: tenantName,
            contactEmail: contactEmail,
            assessmentName: assessmentName || `M365 Security Assessment - ${tenantName}`,
            requiredPermissions: requiredPermissions || [
                'Organization.Read.All',
                'SecurityEvents.Read.All'
            ]
        });

        context.log('✅ Multi-tenant app created successfully');

        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                data: result
            })
        };

    } catch (error) {
        context.log.error('❌ Error creating multi-tenant app:', error);
        
        return {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                appRegistrationError: error.details || null
            })
        };
    }
}
