import { AzureFunction, Context, HttpRequest } from "@azure/functions";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('Diagnostics function processed a request.');
    
    const method = req.method;
    
    switch (method) {
        case 'GET':
            // Get diagnostics information
            context.res = {
                status: 200,
                body: {
                    message: "Diagnostics endpoint - GET",
                    status: "healthy",
                    timestamp: new Date().toISOString(),
                    version: "1.0.0"
                }
            };
            break;
            
        case 'OPTIONS':
            // CORS preflight
            context.res = {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
            };
            break;
            
        default:
            context.res = {
                status: 405,
                body: { error: "Method not allowed" }
            };
    }
};

export default httpTrigger;
