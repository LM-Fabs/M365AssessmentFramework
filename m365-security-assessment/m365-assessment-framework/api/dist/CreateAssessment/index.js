"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssessmentHandler = exports.createAssessmentTest = void 0;
const functions_1 = require("@azure/functions");
const crypto_1 = require("crypto"); // Add proper crypto import
// Add a simple GET handler for easier testing and to verify the function is registered
exports.createAssessmentTest = functions_1.app.http('createAssessmentTest', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'assessment/test',
    handler: async (request, context) => {
        context.log('Test endpoint accessed');
        return {
            status: 200,
            jsonBody: {
                message: "API route is accessible",
                timestamp: new Date().toISOString()
            }
        };
    }
});
exports.createAssessmentHandler = functions_1.app.http('createAssessment', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'assessment/create',
    handler: async (request, context) => {
        context.log('CreateAssessment function processing a request');
        try {
            // Cast the request data to the defined interface
            const data = await request.json();
            context.log('Creating assessment with data:', data);
            // Generate a unique ID for the new assessment using proper import
            const assessmentId = (0, crypto_1.randomUUID)();
            // TODO: Implement the actual assessment creation logic here
            // This would typically involve storing the assessment data in a database
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    id: assessmentId,
                    tenantId: data.tenantName || 'default-tenant',
                    assessmentDate: new Date().toISOString(),
                    status: 'draft',
                    categories: data.categories,
                    notificationEmail: data.notificationEmail,
                    scheduling: data.scheduling
                }
            };
        }
        catch (error) {
            context.error('Error creating assessment:', error);
            return {
                status: 500,
                jsonBody: {
                    message: "Error creating assessment",
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
});
//# sourceMappingURL=index.js.map