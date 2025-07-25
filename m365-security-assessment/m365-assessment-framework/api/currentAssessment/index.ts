// v4 compatible import
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";

// Azure Functions v4 - Individual function self-registration for Static Web Apps
app.http('currentAssessment', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'currentAssessment',
    handler: currentAssessmentHandler
});

async function currentAssessmentHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Processing current assessment request');

    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    // Handle preflight OPTIONS request immediately
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

    try {
        // Initialize data service
        await initializeDataService(context);

        if (request.method === 'GET') {
            // Get query parameters
            const url = new URL(request.url);
            const tenantId = url.searchParams.get('tenantId');
            
            if (!tenantId) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "tenantId query parameter is required"
                    }
                };
            }

            context.log(`Getting current assessment for tenant: ${tenantId}`);
            
            // Get the most recent assessment for the tenant
            const assessments = await dataService.getAssessmentHistory({ 
                tenantId, 
                limit: 1 
            });
            
            if (assessments.length === 0) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "No assessments found for this tenant"
                    }
                };
            }

            const currentAssessment = assessments[0];

            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: currentAssessment,
                    timestamp: new Date().toISOString()
                }
            };
        }

        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Method not allowed"
            }
        };

    } catch (error) {
        context.error('Error in current assessment handler:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
