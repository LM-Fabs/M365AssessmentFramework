"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentAssessmentHandler = void 0;
const functions_1 = require("@azure/functions");
const serverGraphService_1 = require("../shared/serverGraphService");
exports.getCurrentAssessmentHandler = functions_1.app.http('getCurrentAssessment', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'assessment/current',
    handler: async (request, context) => {
        context.log('GetCurrentAssessment function processing a request - performing real M365 security assessment');
        try {
            // Initialize the server-side Graph service
            const graphService = new serverGraphService_1.ServerGraphService();
            // Perform real security assessment using Microsoft Graph API
            context.log('Fetching real security data from Microsoft Graph...');
            const assessmentData = await graphService.getSecurityAssessment();
            // Transform the data into the expected assessment format
            const currentAssessment = {
                id: `assessment-${Date.now()}`,
                tenantId: 'real-tenant', // This could be fetched from Graph as well
                assessmentDate: new Date().toISOString(),
                assessor: {
                    id: 'system',
                    name: 'M365 Assessment Framework',
                    email: 'system@assessment'
                },
                metrics: {
                    score: {
                        overall: assessmentData.metrics.secureScore,
                        identity: assessmentData.metrics.identityScore,
                        dataProtection: assessmentData.metrics.dataProtectionScore,
                        endpoint: assessmentData.metrics.deviceComplianceScore,
                        cloudApps: Math.round(assessmentData.metrics.secureScore * 0.9), // Derived from secure score
                        informationProtection: Math.round(assessmentData.metrics.dataProtectionScore * 0.95),
                        threatProtection: Math.max(100 - (assessmentData.metrics.alertsCount * 5), 0) // Based on alert count
                    },
                    complianceScore: Math.round((assessmentData.metrics.secureScore + assessmentData.metrics.deviceComplianceScore) / 2),
                    riskLevel: assessmentData.metrics.alertsCount > 5 ? 'High' :
                        assessmentData.metrics.alertsCount > 2 ? 'Medium' : 'Low',
                    lastUpdated: assessmentData.lastUpdated
                },
                recommendations: assessmentData.recommendations.map(rec => ({
                    id: rec.id,
                    title: rec.title,
                    category: rec.category,
                    severity: rec.severity,
                    description: rec.description,
                    implementationUrl: rec.implementationUrl
                })),
                status: 'completed',
                lastModified: new Date().toISOString()
            };
            context.log('Successfully completed real security assessment:', {
                secureScore: assessmentData.metrics.secureScore,
                identityScore: assessmentData.metrics.identityScore,
                alertsCount: assessmentData.metrics.alertsCount,
                recommendationsCount: assessmentData.recommendations.length
            });
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
            context.error('Error performing real security assessment:', error);
            // Fallback to a basic assessment if Graph API fails
            const fallbackAssessment = {
                id: `assessment-fallback-${Date.now()}`,
                tenantId: 'fallback-tenant',
                assessmentDate: new Date().toISOString(),
                assessor: {
                    id: 'system',
                    name: 'M365 Assessment Framework (Fallback)',
                    email: 'system@assessment'
                },
                metrics: {
                    score: {
                        overall: 0,
                        identity: 0,
                        dataProtection: 0,
                        endpoint: 0,
                        cloudApps: 0,
                        informationProtection: 0,
                        threatProtection: 0
                    },
                    complianceScore: 0,
                    riskLevel: 'Unknown',
                    lastUpdated: new Date().toISOString()
                },
                recommendations: [{
                        id: 'setup-required',
                        title: 'Configure Microsoft Graph API Access',
                        category: 'configuration',
                        severity: 'high',
                        description: 'The assessment framework needs proper Microsoft Graph API permissions to perform real security assessments. Please configure the required permissions and authentication.'
                    }],
                status: 'error',
                lastModified: new Date().toISOString(),
                error: error instanceof Error ? error.message : String(error)
            };
            return {
                status: 200, // Return 200 but with error status in data
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: fallbackAssessment
            };
        }
    }
});
//# sourceMappingURL=index.js.map