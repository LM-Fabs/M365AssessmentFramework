import { AzureFunction, Context, HttpRequest } from "@azure/functions";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('Assessments function processed a request.');
    
    const method = req.method;
    
    switch (method) {
        case 'GET':
            // Get assessments
            context.res = {
                status: 200,
                body: {
                    message: "Assessments endpoint - GET",
                    assessments: []
                }
            };
            break;
            
        case 'POST':
            // Create or save assessment
            context.res = {
                status: 200,
                body: {
                    message: "Assessments endpoint - POST",
                    status: "success"
                }
            };
            break;
            
        case 'OPTIONS':
            // CORS preflight
            context.res = {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
