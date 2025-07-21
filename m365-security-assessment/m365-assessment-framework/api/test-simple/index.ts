import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders } from "../shared/utils";

/**
 * Azure Functions v4 - Simple test endpoint
 * No dependencies, should always work if Functions runtime is operational
 */
export default async function (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🧪 test-simple function called');
    
    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        // Handle HEAD request for API warmup
        if (request.method === 'HEAD') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }
        
        const response = {
            success: true,
            message: "Simple test works! Functions v4 is operational",
            method: request.method,
            url: request.url,
            timestamp: new Date().toISOString(),
            functionVersion: process.env.FUNCTIONS_EXTENSION_VERSION || 'unknown'
        };

        context.log('✅ test-simple completed successfully');
        
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: response
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
