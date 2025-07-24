import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// Simple test function to verify function discovery works
app.http('enterprise-app-test', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'enterprise-app-test',
    handler: enterpriseAppTestHandler
});

async function enterpriseAppTestHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🧪 Enterprise App Test function called');

    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({ 
            message: 'Enterprise App Test function is working!',
            timestamp: new Date().toISOString()
        })
    };
}
