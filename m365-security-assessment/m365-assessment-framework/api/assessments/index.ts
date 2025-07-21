// v3 compatible imports

const httpTrigger = async function (context: any, req: any): Promise<void> {
    context.log('Processing assessments request');

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Warmup, Cache-Control',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60'
    };

    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // For now, return a simple response until we properly migrate the full logic
        if (req.method === 'GET') {
            context.res = {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: [],
                    message: "Assessments endpoint working - migration in progress"
                }
            };
        }

        if (req.method === 'POST') {
            context.res = {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    message: "Assessment creation endpoint working - migration in progress"
                }
            };
        }

        context.res = {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Method not allowed"
            }
        };

    } catch (error) {
        context.error('Error in assessments handler:', error);
        
        context.res = {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
};

export default httpTrigger;
