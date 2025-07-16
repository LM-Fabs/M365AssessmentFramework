import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export default async function httpTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('HTTP trigger function processed a request.');
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
    }
    
    // Set CORS headers and return response
    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        jsonBody: {
            success: true,
            message: "Traditional function.json test endpoint is working!",
            timestamp: new Date().toISOString(),
            method: request.method,
            query: request.query,
            environment: process.env.NODE_ENV || 'production'
        }
    };
}
