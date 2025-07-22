"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../shared/utils");
async function customerAssessments(request, context) {
    context.log(`Processing ${request.method} request for customer assessments`);
    // Handle preflight OPTIONS request immediately
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: utils_1.corsHeaders
        };
    }
    try {
        // Initialize data service
        await (0, utils_1.initializeDataService)(context);
        const customerId = request.params.customerId;
        if (!customerId) {
            return {
                status: 400,
                headers: utils_1.corsHeaders,
                jsonBody: {
                    success: false,
                    error: "customerId parameter is required"
                }
            };
        }
        if (request.method === 'GET') {
            // Get limit from query parameters
            const url = new URL(request.url);
            const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : undefined;
            context.log(`Getting assessments for customer ${customerId} with limit: ${limit}`);
            const assessments = await utils_1.dataService.getAssessmentHistory({ customerId, limit });
            // Transform assessments to match frontend interface
            const transformedAssessments = assessments.map((assessment) => ({
                ...assessment,
                assessmentDate: assessment.assessmentDate,
                lastModified: assessment.lastModified
            }));
            return {
                status: 200,
                headers: utils_1.corsHeaders,
                jsonBody: {
                    success: true,
                    data: transformedAssessments,
                    count: transformedAssessments.length
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
        context.error('Error in customer assessments handler:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return {
                status: 404,
                headers: utils_1.corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer not found"
                }
            };
        }
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
exports.default = customerAssessments;
//# sourceMappingURL=index.js.map