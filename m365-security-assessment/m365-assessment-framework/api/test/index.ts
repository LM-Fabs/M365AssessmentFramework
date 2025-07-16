import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

async function testHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🧪 Test endpoint called');
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
    
    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    
    return {
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            success: true,
            message: 'API is working! 🚀',
            timestamp: new Date().toISOString(),
            method: request.method,
            url: request.url
        }
    };
}

app.http('test', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test',
    handler: testHandler
});
