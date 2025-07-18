import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";

const httpTrigger = async function (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Processing current assessment request');

    // Handle preflight OPTIONS request immediately
    if (req.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    // Handle HEAD request for API warmup
    if (req.method === 'HEAD') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Initialize data service
        await initializeDataService(context);

        if (req.method === 'GET') {
            // Get query parameters
            const url = new URL(req.url);
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
};

export default httpTrigger;
