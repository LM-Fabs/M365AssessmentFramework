"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createAssessment;
const utils_1 = require("../shared/utils");
async function createAssessment(request, context) {
    context.log('Processing create assessment request');
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
        if (request.method === 'POST') {
            let assessmentData = {};
            try {
                assessmentData = await request.json();
            }
            catch (error) {
                return {
                    status: 400,
                    headers: utils_1.corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
            }
            context.log('Creating assessment with data:', assessmentData);
            // Validate required fields
            if (!assessmentData.tenantId) {
                return {
                    status: 400,
                    headers: utils_1.corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "tenantId is required"
                    }
                };
            }
            // Create assessment using the data service
            try {
                const assessment = await utils_1.dataService.createAssessment(assessmentData);
                return {
                    status: 201,
                    headers: utils_1.corsHeaders,
                    jsonBody: {
                        success: true,
                        data: assessment,
                        message: "Assessment created successfully"
                    }
                };
            }
            catch (error) {
                context.error('Failed to create assessment:', error);
                return {
                    status: 500,
                    headers: utils_1.corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Failed to create assessment",
                        details: error instanceof Error ? error.message : "Unknown error"
                    }
                };
            }
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
        context.error('Error in create assessment handler:', error);
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