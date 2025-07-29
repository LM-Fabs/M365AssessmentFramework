"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('assessments', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments',
    handler: assessmentsHandler
});
/**
 * Azure Functions v4 - Assessments endpoint
 * Individual self-registration for Azure Static Web Apps compatibility
 */
async function assessmentsHandler(request, context) {
    context.log('📊 Assessments API called');
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
        if (request.method === 'GET') {
            return await getAssessments(request, context);
        }
        if (request.method === 'POST') {
            return await createAssessment(request, context);
        }
        return {
            status: 405,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: "Method not allowed",
                message: "Only GET and POST methods are supported"
            })
        };
    }
    catch (error) {
        context.log('❌ Assessments API error:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: "Internal server error",
                message: error.message
            })
        };
    }
}
async function getAssessments(request, context) {
    context.log('📖 Getting assessments from PostgreSQL');
    try {
        const result = await utils_1.dataService.getAssessments();
        context.log(`✅ Retrieved ${result.assessments.length} assessments`);
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                data: result.assessments,
                count: result.assessments.length,
                message: 'Assessments retrieved successfully'
            })
        };
    }
    catch (error) {
        context.log('❌ Error retrieving assessments:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to retrieve assessments',
                message: error.message
            })
        };
    }
}
async function createAssessment(request, context) {
    context.log('📝 Creating assessment in PostgreSQL');
    try {
        const assessmentData = await request.json();
        context.log('📋 Assessment data:', {
            customerId: assessmentData.customerId,
            tenantId: assessmentData.tenantId,
            assessmentName: assessmentData.assessmentName,
            categories: assessmentData.includedCategories
        });
        // Validate required fields
        if (!assessmentData.customerId || !assessmentData.tenantId) {
            return {
                status: 400,
                headers: utils_1.corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required fields',
                    message: 'customerId and tenantId are required'
                })
            };
        }
        // Create assessment in PostgreSQL
        const assessment = await utils_1.dataService.createAssessment(assessmentData);
        context.log(`✅ Created assessment: ${assessment.id} for customer ${assessmentData.customerId}`);
        return {
            status: 201,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                data: assessment,
                message: 'Assessment created successfully'
            })
        };
    }
    catch (error) {
        context.log('❌ Error creating assessment:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to create assessment',
                message: error.message
            })
        };
    }
}
//# sourceMappingURL=index.js.map