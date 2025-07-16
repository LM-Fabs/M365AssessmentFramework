import { AzureFunction, Context, HttpRequest } from "@azure/functions";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('HTTP trigger function processed a request.');
    
    // Set CORS headers
    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: {
            message: "Test endpoint is working!",
            timestamp: new Date().toISOString(),
            method: req.method,
            query: req.query,
            environment: process.env.NODE_ENV || 'production'
        }
    };
};

export default httpTrigger;
