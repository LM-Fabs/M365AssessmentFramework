import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// Simple individual function for Azure Static Web Apps compatibility test
export default async function (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🧪 Simple individual function test');
    
    // Handle preflight OPTIONS request
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

    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
            success: true,
            message: "Individual function works!",
            timestamp: new Date().toISOString(),
            method: request.method,
            url: request.url
        }
    };
}
