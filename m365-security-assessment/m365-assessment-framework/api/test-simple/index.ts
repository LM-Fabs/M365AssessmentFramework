import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders } from "../shared/utils";

// Azure Functions v4 - Individual function self-registration
app.http('test-simple', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test-simple',
    handler: testSimpleHandler
});

/**
 * Simple test handler for Azure Functions v4
 */
async function testSimpleHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Processing ${request.method} request for test-simple`);

    try {
        // Handle OPTIONS request for CORS
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        // Handle GET request with environment info
        if (request.method === 'GET') {
            const response = {
                success: true,
                message: "Simple test works! Functions v4 is operational",
                method: request.method,
                url: request.url,
                timestamp: new Date().toISOString(),
                version: "v4-individual-registration"
            };

            context.log('✅ test-simple completed successfully');
            
            return {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                },
                jsonBody: response
            };
        }

        // Method not supported
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: `Method ${request.method} not supported`,
                timestamp: new Date().toISOString()
            }
        };

    } catch (error) {
        context.error('❌ test-simple error:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            }
        };
    }
}
