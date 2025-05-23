"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssessmentHandler = exports.createAssessmentTest = void 0;
const functions_1 = require("@azure/functions");
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
            // Enhanced logging for debugging
            context.log('Request method:', request.method);
            context.log('Request URL:', request.url);
            context.log('Request headers:', JSON.stringify(Object.fromEntries(request.headers.entries())));
            // Check content type
            const contentType = request.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                context.warn('Invalid content type:', contentType);
                return {
                    status: 400,
                    jsonBody: {
                        error: 'Content-Type must be application/json',
                        receivedContentType: contentType
                    }
                };
            }
            // Parse and validate request body
            let data;
            try {
                const requestText = await request.text();
                context.log('Raw request body:', requestText);
                if (!requestText.trim()) {
                    return {
                        status: 400,
                        jsonBody: {
                            error: 'Request body is empty'
                        }
                    };
                }
                data = JSON.parse(requestText);
                context.log('Parsed request data:', JSON.stringify(data, null, 2));
            }
            catch (parseError) {
                context.error('JSON parsing error:', parseError);
                return {
                    status: 400,
                    jsonBody: {
                        error: 'Invalid JSON in request body',
                        details: parseError instanceof Error ? parseError.message : String(parseError)
                    }
                };
            }
            // Validate required fields
            const validationErrors = [];
            if (!data.tenantName || typeof data.tenantName !== 'string') {
                validationErrors.push('tenantName is required and must be a string');
            }
            if (!Array.isArray(data.categories)) {
                validationErrors.push('categories is required and must be an array');
            }
            if (!data.notificationEmail || typeof data.notificationEmail !== 'string') {
                validationErrors.push('notificationEmail is required and must be a string');
            }
            if (validationErrors.length > 0) {
                context.warn('Validation errors:', validationErrors);
                return {
                    status: 400,
                    jsonBody: {
                        error: 'Validation failed',
                        details: validationErrors
                    }
                };
            }
            // Generate a unique ID for the new assessment
            const assessmentId = crypto.randomUUID();
            context.log('Generated assessment ID:', assessmentId);
            // Create the assessment response
            const assessmentResponse = {
                id: assessmentId,
                tenantId: data.tenantName,
                assessmentDate: new Date().toISOString(),
                status: 'draft',
                categories: data.categories,
                notificationEmail: data.notificationEmail,
                scheduling: data.scheduling || { enabled: false, frequency: 'monthly' }
            };
            context.log('Returning assessment response:', JSON.stringify(assessmentResponse, null, 2));
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                jsonBody: assessmentResponse
            };
        }
        catch (error) {
            context.error('Unexpected error in createAssessment:', error);
            context.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    error: "Internal server error occurred while creating assessment",
                    details: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
});
//# sourceMappingURL=index.js.map