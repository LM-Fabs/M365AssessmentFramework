import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

/**
 * Minimal test function for Azure Static Web Apps compatibility
 */
export default async function (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🧪 Test function called');

    // Simple CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        // Simple GET response
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const testParam = url.searchParams.get('test');

            return {
                status: 200,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    success: true,
                    message: 'Test function is working',
                    method: request.method,
                    testParam: testParam,
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Simple POST response
        if (request.method === 'POST') {
            try {
                const body = await request.text();
                const data = body ? JSON.parse(body) : {};

                return {
                    status: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        success: true,
                        message: 'POST request received',
                        receivedData: data,
                        timestamp: new Date().toISOString()
                    })
                };
            } catch (parseError) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        error: 'Invalid JSON',
                        message: parseError.message
                    })
                };
            }
        }

        // Method not allowed
        return {
            status: 405,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Method not allowed',
                allowedMethods: ['GET', 'POST', 'OPTIONS']
            })
        };

    } catch (error) {
        context.log('Error in test function:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
}
