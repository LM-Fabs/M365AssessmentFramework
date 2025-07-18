import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";

const httpTrigger = async function (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Processing ${req.method} request for customer assessments`);

    // Handle preflight OPTIONS request immediately
    if (req.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Initialize data service
        await initializeDataService(context);

        const customerId = req.params.customerId;
        if (!customerId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "customerId parameter is required"
                }
            };
        }

        if (req.method === 'GET') {
            // Get limit from query parameters
            const url = new URL(req.url);
            const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
            
            context.log(`Getting assessments for customer ${customerId} with limit: ${limit}`);
            
            const assessments = await dataService.getAssessmentHistory({ customerId, limit });
            
            // Transform assessments to match frontend interface
            const transformedAssessments = assessments.map((assessment: any) => ({
                ...assessment,
                assessmentDate: assessment.assessmentDate,
                lastModified: assessment.lastModified
            }));

            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: transformedAssessments,
                    count: transformedAssessments.length
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
        context.error('Error in customer assessments handler:', error);
        
        if (error instanceof Error && error.message.includes('not found')) {
            return {
                status: 404,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer not found"
                }
            };
        }
        
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
