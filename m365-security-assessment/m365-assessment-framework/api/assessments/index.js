"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
const serverGraphService_1 = require("../shared/serverGraphService");
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
    context.log('📝 Creating REAL M365 security assessment');
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
        // Get customer information for context
        const customer = await utils_1.dataService.getCustomer(assessmentData.customerId);
        if (!customer) {
            return {
                status: 404,
                headers: utils_1.corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Customer not found',
                    message: `Customer with ID ${assessmentData.customerId} not found`
                })
            };
        }
        context.log('👤 Customer found:', {
            name: customer.tenantName,
            domain: customer.tenantDomain
        });
        // Perform REAL security assessment using Microsoft Graph API
        let realAssessmentData;
        try {
            context.log('🔍 Initializing ServerGraphService for real assessment...');
            const serverGraphService = new serverGraphService_1.ServerGraphService();
            // Perform comprehensive security assessment
            const securityAssessment = await serverGraphService.getSecurityAssessment();
            context.log('✅ Security assessment completed successfully');
            context.log('📊 Assessment metrics:', {
                secureScore: securityAssessment.metrics.secureScore,
                identityScore: securityAssessment.metrics.identityScore,
                deviceComplianceScore: securityAssessment.metrics.deviceComplianceScore,
                recommendationsCount: securityAssessment.recommendations.length
            });
            // Calculate overall score from security metrics
            const overallScore = Math.round((securityAssessment.metrics.secureScore * 0.4) +
                (securityAssessment.metrics.identityScore * 0.3) +
                (securityAssessment.metrics.deviceComplianceScore * 0.3));
            // Create comprehensive assessment data with REAL metrics
            realAssessmentData = {
                customerId: assessmentData.customerId,
                tenantId: assessmentData.tenantId,
                score: overallScore,
                metrics: {
                    // Create structured metrics matching the expected format
                    license: {
                        totalLicenses: 0, // Not available from current ServerGraphService
                        assignedLicenses: 0,
                        utilizationRate: 0,
                        licenseDetails: [],
                        summary: 'License data not available in current assessment scope'
                    },
                    secureScore: {
                        percentage: securityAssessment.metrics.secureScore,
                        currentScore: securityAssessment.metrics.secureScore,
                        maxScore: 100,
                        controlScores: [], // Would need to be extracted from Graph API
                        summary: `Microsoft Secure Score: ${securityAssessment.metrics.secureScore}%`
                    },
                    score: {
                        overall: overallScore,
                        license: 0,
                        secureScore: securityAssessment.metrics.secureScore
                    },
                    lastUpdated: new Date(),
                    realData: {
                        // Structure data the way Reports.tsx expects it
                        secureScore: {
                            currentScore: securityAssessment.metrics.secureScore,
                            maxScore: 100,
                            percentage: securityAssessment.metrics.secureScore,
                            controlScores: [], // Empty for now - would need Graph API Secure Score details
                            summary: `Microsoft Secure Score: ${securityAssessment.metrics.secureScore}%`,
                            lastUpdated: securityAssessment.lastUpdated,
                            unavailable: false
                        },
                        identityMetrics: {
                            totalUsers: 0, // Not available from current ServerGraphService
                            mfaEnabledUsers: 0,
                            mfaCoverage: 0,
                            adminUsers: 0,
                            guestUsers: 0,
                            conditionalAccessPolicies: 0
                        },
                        licenseInfo: {
                            totalLicenses: 0,
                            assignedLicenses: 0,
                            utilization: 0,
                            licenses: [],
                            summary: 'License data not available in current assessment scope'
                        },
                        securityMetrics: securityAssessment.metrics,
                        dataSource: 'Microsoft Graph API via ServerGraphService',
                        lastUpdated: securityAssessment.lastUpdated,
                        tenantInfo: {
                            displayName: customer.tenantName,
                            tenantId: assessmentData.tenantId,
                            domain: customer.tenantDomain
                        },
                        assessmentScope: 'Security Metrics (Identity, Device Compliance, Secure Score)',
                        authenticationMethod: 'Azure Managed Identity'
                    }
                },
                recommendations: securityAssessment.recommendations.map(rec => rec.title || rec.description),
                status: 'completed'
            };
            context.log('🎯 Real assessment data created successfully');
        }
        catch (graphError) {
            context.log('⚠️ Microsoft Graph API assessment failed:', graphError.message);
            // Create assessment with error information but don't fail completely
            realAssessmentData = {
                customerId: assessmentData.customerId,
                tenantId: assessmentData.tenantId,
                score: 0,
                metrics: {
                    license: {
                        totalLicenses: 0,
                        assignedLicenses: 0,
                        utilizationRate: 0,
                        licenseDetails: [],
                        summary: 'License data unavailable - authentication required'
                    },
                    secureScore: {
                        percentage: 0,
                        currentScore: 0,
                        maxScore: 100,
                        controlScores: [],
                        summary: 'Secure score unavailable - authentication or permissions required'
                    },
                    score: {
                        overall: 0,
                        license: 0,
                        secureScore: 0
                    },
                    lastUpdated: new Date(),
                    realData: {
                        // Structure data the way Reports.tsx expects it, even for failed assessments
                        secureScore: {
                            currentScore: 0,
                            maxScore: 100,
                            percentage: 0,
                            controlScores: [],
                            summary: 'Secure score unavailable - authentication or permissions required',
                            lastUpdated: new Date().toISOString(),
                            unavailable: true
                        },
                        identityMetrics: {
                            totalUsers: 0,
                            mfaEnabledUsers: 0,
                            mfaCoverage: 0,
                            adminUsers: 0,
                            guestUsers: 0,
                            conditionalAccessPolicies: 0
                        },
                        licenseInfo: {
                            totalLicenses: 0,
                            assignedLicenses: 0,
                            utilization: 0,
                            licenses: [],
                            summary: 'License data unavailable - authentication required'
                        },
                        error: graphError.message,
                        dataSource: 'Assessment failed - Microsoft Graph API unavailable',
                        lastUpdated: new Date().toISOString(),
                        authenticationRequired: true,
                        tenantInfo: {
                            displayName: customer.tenantName,
                            tenantId: assessmentData.tenantId,
                            domain: customer.tenantDomain
                        },
                        troubleshooting: 'Check Azure AD permissions and Managed Identity configuration'
                    }
                },
                recommendations: [
                    'Configure Azure AD permissions for Microsoft Graph API access',
                    'Verify Managed Identity is properly configured',
                    'Ensure required Graph API permissions are granted',
                    'Contact administrator to complete security assessment setup'
                ],
                status: 'completed_with_errors'
            };
        }
        // Store the assessment in PostgreSQL
        const assessment = await utils_1.dataService.createAssessment(realAssessmentData);
        context.log(`✅ Real security assessment stored: ${assessment.id} for customer ${assessmentData.customerId}`);
        return {
            status: 201,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                data: assessment,
                message: 'Real M365 security assessment completed successfully',
                assessmentType: 'Microsoft Graph API Security Assessment',
                dataSource: realAssessmentData.status === 'completed' ? 'Live Microsoft Graph API' : 'Error fallback',
                stats: {
                    overallScore: assessment.score,
                    secureScore: realAssessmentData.metrics.secureScore.percentage,
                    recommendationsCount: realAssessmentData.recommendations.length,
                    hasRealData: realAssessmentData.status === 'completed'
                }
            })
        };
    }
    catch (error) {
        context.log('❌ Error creating real security assessment:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to create security assessment',
                message: error.message,
                troubleshooting: 'Check Azure configuration and Microsoft Graph API permissions'
            })
        };
    }
}
//# sourceMappingURL=index.js.map