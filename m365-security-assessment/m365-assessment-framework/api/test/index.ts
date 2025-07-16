import { AzureFunction, Context, HttpRequest } from "@azure/functions";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('🧪 Test endpoint called');
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
    
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders
        };
        return;
    }
    
    context.res = {
        status: 200,
        headers: corsHeaders,
        body: {
            success: true,
            message: 'API is working! 🚀',
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url
        }
    };
};

export default httpTrigger;
