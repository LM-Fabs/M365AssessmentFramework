"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentAssessmentHandler = void 0;
const functions_1 = require("@azure/functions");
exports.getCurrentAssessmentHandler = functions_1.app.http('getCurrentAssessment', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'assessment/current',
    handler: async (request, context) => {
        context.log('GetCurrentAssessment function processing a request');
        try {
            // For now, return a mock assessment since you don't have persistent storage yet
            // In a real implementation, this would query your database for the most recent assessment
            // Check if there's a current assessment (this is a placeholder - you'd query your storage)
            const hasCurrentAssessment = true; // This would be determined by your data storage logic
            if (!hasCurrentAssessment) {
                return {
                    status: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    jsonBody: {
                        message: 'No current assessment found'
                    }
                };
            }
            // Mock current assessment data - replace with actual database query
            const currentAssessment = {
                id: '12345678-1234-1234-1234-123456789abc',
                tenantId: 'current-tenant',
                assessmentDate: new Date().toISOString(),
                assessor: {
                    id: 'user-123',
                    name: 'Current User',
                    email: 'user@example.com'
                },
                metrics: {
                    score: {
                        overall: 75,
                        identity: 80,
                        dataProtection: 70,
                        endpoint: 85,
                        cloudApps: 65,
                        informationProtection: 75,
                        threatProtection: 80
                    },
                    complianceScore: 78,
                    riskLevel: 'Medium',
                    lastUpdated: new Date().toISOString()
                },
                recommendations: [
                    {
                        id: 'rec-1',
                        title: 'Enable Multi-Factor Authentication',
                        category: 'identity',
                        severity: 'high',
                        description: 'Configure MFA for all users to enhance security'
                    }
                ],
                status: 'completed',
                lastModified: new Date().toISOString()
            };
            context.log('Returning current assessment:', JSON.stringify(currentAssessment, null, 2));
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                jsonBody: currentAssessment
            };
        }
        catch (error) {
            context.error('Error retrieving current assessment:', error);
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    error: "Internal server error occurred while retrieving current assessment",
                    details: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
});
//# sourceMappingURL=index.js.map