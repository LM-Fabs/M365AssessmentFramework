"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Azure Functions v4 - Customer Assessments endpoint
functions_1.app.http('customer-assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}/assessments',
    handler: customerAssessmentsHandler
});
async function customerAssessmentsHandler(request, context) {
    context.log('📊 Customer Assessments API called');
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
        const customerId = request.params.customerId;
        context.log(`🎯 Customer ID: ${customerId}`);
        if (!customerId) {
            return {
                status: 400,
                headers: utils_1.corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Bad request',
                    message: 'Customer ID is required'
                })
            };
        }
        if (request.method === 'GET') {
            return await getCustomerAssessments(customerId, context);
        }
        if (request.method === 'POST') {
            return await createCustomerAssessment(request, customerId, context);
        }
        return {
            status: 405,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Method not allowed',
                message: 'Only GET and POST requests are supported for this endpoint'
            })
        };
    }
    catch (error) {
        context.log('❌ Customer Assessments API error:', error);
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
async function getCustomerAssessments(customerId, context) {
    context.log(`📖 Getting assessments for customer: ${customerId} from PostgreSQL`);
    try {
        // Get customer assessments from PostgreSQL
        const result = await utils_1.dataService.getCustomerAssessments(customerId);
        context.log(`✅ Retrieved ${result.assessments.length} assessments for customer ${customerId}`);
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                data: {
                    customerId: customerId,
                    assessments: result.assessments,
                    count: result.assessments.length
                },
                message: 'Customer assessments retrieved successfully'
            })
        };
    }
    catch (error) {
        context.log('❌ Error retrieving customer assessments:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to retrieve customer assessments',
                message: error.message
            })
        };
    }
}
async function createCustomerAssessment(request, customerId, context) {
    context.log(`📝 Creating assessment for customer: ${customerId}`);
    try {
        const assessmentData = await request.json();
        // Ensure customer ID matches the route parameter
        assessmentData.customerId = customerId;
        context.log('📋 Assessment data:', {
            customerId: assessmentData.customerId,
            tenantId: assessmentData.tenantId,
            assessmentName: assessmentData.assessmentName,
            categories: assessmentData.includedCategories
        });
        // Create assessment in PostgreSQL
        const assessment = await utils_1.dataService.createAssessment(assessmentData);
        context.log(`✅ Created assessment: ${assessment.id} for customer ${customerId}`);
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
        context.log('❌ Error creating customer assessment:', error);
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