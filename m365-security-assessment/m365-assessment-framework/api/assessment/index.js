"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Azure Functions v4 - Individual Assessment endpoint (by ID)
functions_1.app.http('assessment', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/{assessmentId}',
    handler: assessmentHandler
});
async function assessmentHandler(request, context) {
    context.log('📊 Assessment API called (individual assessment by ID)');
    try {
        // Initialize data service (PostgreSQL)
        await (0, utils_1.initializeDataService)(context);
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        const assessmentId = request.params.assessmentId;
        context.log(`🎯 Assessment ID: ${assessmentId}`);
        if (!assessmentId) {
            return {
                status: 400,
                headers: utils_1.corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Bad request',
                    message: 'Assessment ID is required'
                })
            };
        }
        if (request.method === 'GET') {
            return await getAssessmentById(assessmentId, context);
        }
        return {
            status: 405,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Method not allowed',
                message: 'Only GET requests are supported for this endpoint'
            })
        };
    }
    catch (error) {
        context.log('❌ Assessment API error:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: error.message
            })
        };
    }
}
async function getAssessmentById(assessmentId, context) {
    context.log(`📖 Getting assessment by ID: ${assessmentId} from PostgreSQL`);
    try {
        // Get assessment from PostgreSQL
        const assessment = await utils_1.dataService.getAssessmentById(assessmentId);
        if (!assessment) {
            return {
                status: 404,
                headers: utils_1.corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Assessment not found',
                    message: `Assessment with ID '${assessmentId}' does not exist`
                })
            };
        }
        context.log(`✅ Retrieved assessment: ${assessmentId}`);
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                data: assessment,
                message: 'Assessment retrieved successfully'
            })
        };
    }
    catch (error) {
        context.log('❌ Error retrieving assessment:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to retrieve assessment',
                message: error.message
            })
        };
    }
}
//# sourceMappingURL=index.js.map