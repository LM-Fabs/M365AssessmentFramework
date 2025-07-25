"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// v4 compatible import
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('currentAssessment', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'currentAssessment',
    handler: currentAssessmentHandler
});
async function currentAssessmentHandler(request, context) {
    context.log('Processing current assessment request');
    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: utils_1.corsHeaders
        };
    }
    // Handle preflight OPTIONS request immediately
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: utils_1.corsHeaders
        };
    }
    // Handle HEAD request for API warmup
    if (request.method === 'HEAD') {
        return {
            status: 200,
            headers: utils_1.corsHeaders
        };
    }
    try {
        // Initialize data service
        await (0, utils_1.initializeDataService)(context);
        if (request.method === 'GET') {
            // Get query parameters
            const url = new URL(request.url);
            const tenantId = url.searchParams.get('tenantId');
            if (!tenantId) {
                return {
                    status: 400,
                    headers: utils_1.corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "tenantId query parameter is required"
                    }
                };
            }
            context.log(`Getting current assessment for tenant: ${tenantId}`);
            // Get the most recent assessment for the tenant
            const assessments = await utils_1.dataService.getAssessmentHistory({
                tenantId,
                limit: 1
            });
            if (assessments.length === 0) {
                return {
                    status: 404,
                    headers: utils_1.corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "No assessments found for this tenant"
                    }
                };
            }
            const currentAssessment = assessments[0];
            return {
                status: 200,
                headers: utils_1.corsHeaders,
                jsonBody: {
                    success: true,
                    data: currentAssessment,
                    timestamp: new Date().toISOString()
                }
            };
        }
        return {
            status: 405,
            headers: utils_1.corsHeaders,
            jsonBody: {
                success: false,
                error: "Method not allowed"
            }
        };
    }
    catch (error) {
        context.error('Error in current assessment handler:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
//# sourceMappingURL=index.js.map