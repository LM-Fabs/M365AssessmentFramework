import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders } from "../shared/utils";
// Import the GraphApiService class directly
const { GraphApiService } = require("../shared/graphApiService");

// Azure Functions v4 - Enterprise App endpoint for multi-tenant app registration
app.http('enterprise-app', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'enterprise-app/{action?}',
    handler: enterpriseAppHandler
});

async function enterpriseAppHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🏢 Enterprise App API called');

    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        const action = request.params.action || '';
        context.log(`🎯 Action: ${action}`);

        if (action === 'multi-tenant' && request.method === 'POST') {
            return await handleCreateMultiTenantApp(request, context);
        }

        return {
            status: 404,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Not found',
                message: `Action '${action}' not supported` 
            })
        };

    } catch (error: any) {
        context.log('❌ Enterprise App API error:', error);
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
}

async function handleCreateMultiTenantApp(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('⚠️ Individual app creation is disabled - using multi-tenant approach');
    
    try {
        const body = await request.json() as any;
        context.log('📋 Request body (for reference):', body);

        // Return information about the correct multi-tenant approach
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Individual app creation disabled',
                message: 'Multi-tenant approach is now used. Customers consent to your master app via admin consent URL.',
                recommendation: 'Use the Consent URL Generator to create admin consent URLs for customers.',
                multiTenantInfo: {
                    approach: 'One master app registration in your tenant',
                    customerAction: 'Admin consent via generated URL',
                    masterAppId: process.env.AZURE_CLIENT_ID || 'd1cc9e16-9194-4892-92c5-473c9f65dcb3',
                    documentation: 'See MULTI-TENANT-WORKFLOW-GUIDE.md'
                }
            })
        };

    } catch (error: any) {
        context.log('❌ Error in disabled multi-tenant app endpoint:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Individual app creation is disabled',
                message: 'Use the Consent URL Generator for multi-tenant approach'
            })
        };
    }
}
