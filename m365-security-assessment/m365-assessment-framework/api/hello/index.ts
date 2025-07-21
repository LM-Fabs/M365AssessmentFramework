import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export default async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Simple hello function triggered');

    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        jsonBody: {
            message: "Hello from Azure Functions v4!",
            timestamp: new Date().toISOString(),
            success: true
        }
    };
}
