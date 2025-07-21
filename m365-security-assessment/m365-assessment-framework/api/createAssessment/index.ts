// v3 compatible imports
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";

const httpTrigger = async function (context: any, req: any): Promise<void> {
    context.log('Processing create assessment request');

    // Handle preflight OPTIONS request immediately
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Initialize data service
        await initializeDataService(context);

        if (req.method === 'POST') {
            let assessmentData: any = {};
            
            try {
                assessmentData = await req.json();
            } catch (error) {
                context.res = {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
            }

            context.log('Creating assessment with data:', assessmentData);

            // Validate required fields
            if (!assessmentData.tenantId) {
                context.res = {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "tenantId is required"
                    }
                };
            }

            // Create assessment using the data service
            try {
                const assessment = await dataService.createAssessment(assessmentData);
                
                context.res = {
                    status: 201,
                    headers: corsHeaders,
                    jsonBody: {
                        success: true,
                        data: assessment,
                        message: "Assessment created successfully"
                    }
                };
            } catch (error) {
                context.error('Failed to create assessment:', error);
                context.res = {
                    status: 500,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Failed to create assessment",
                        details: error instanceof Error ? error.message : "Unknown error"
                    }
                };
            }
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
        context.error('Error in create assessment handler:', error);
        
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
