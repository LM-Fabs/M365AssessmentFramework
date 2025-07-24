"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Import the GraphApiService class directly
const { GraphApiService } = require("../shared/graphApiService");
// Azure Functions v4 - Enterprise App endpoint for multi-tenant app registration
functions_1.app.http('enterprise-app', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'enterprise-app/{action?}',
    handler: enterpriseAppHandler
});
async function enterpriseAppHandler(request, context) {
    context.log('🏢 Enterprise App API called');
    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        const action = request.params.action || '';
        context.log(`🎯 Action: ${action}`);
        if (action === 'multi-tenant' && request.method === 'POST') {
            return await handleCreateMultiTenantApp(request, context);
        }
        return {
            status: 404,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                error: 'Not found',
                message: `Action '${action}' not supported`
            })
        };
    }
    catch (error) {
        context.log('❌ Enterprise App API error:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
}
async function handleCreateMultiTenantApp(request, context) {
    try {
        const body = await request.json();
        context.log('📋 Request body:', body);
        const { targetTenantId, targetTenantDomain, tenantName, contactEmail, assessmentName, requiredPermissions } = body;
        // Validate required fields
        if (!targetTenantId || !targetTenantDomain || !tenantName) {
            return {
                status: 400,
                headers: utils_1.corsHeaders,
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
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                data: result
            })
        };
    }
    catch (error) {
        context.log('❌ Error creating multi-tenant app:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: error.message,
                appRegistrationError: error.details || null
            })
        };
    }
}
//# sourceMappingURL=index.js.map