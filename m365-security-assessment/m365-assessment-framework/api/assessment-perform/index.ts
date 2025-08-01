import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";
import { GraphApiService } from "../shared/graphApiService";

// Azure Functions v4 - Individual function self-registration for Static Web Apps
app.http('assessment-perform', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-perform',
    handler: performAssessmentHandler
});

/**
 * Azure Functions v4 - Perform actual M365 security assessment
 * This endpoint performs real Microsoft Graph API assessment, not just placeholder creation
 */
async function performAssessmentHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🔍 Perform Assessment API called');

    try {
        // Initialize data service (PostgreSQL)
        await initializeDataService(context);

        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        if (request.method === 'POST') {
            return await performSecurityAssessment(request, context);
        }

        return {
            status: 405,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: "Method not allowed",
                message: "Only POST method is supported"
            })
        };

    } catch (error: any) {
        context.log('❌ Perform Assessment API error:', error);
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: "Internal server error",
                message: error.message
            })
        };
    }
}

async function performSecurityAssessment(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🔍 Performing comprehensive M365 security assessment');
    
    try {
        const requestData = await request.json() as any;
        
        context.log('📋 Assessment request data:', {
            customerId: requestData.customerId,
            tenantId: requestData.tenantId,
            assessmentName: requestData.assessmentName
        });

        // Validate required fields
        if (!requestData.customerId || !requestData.tenantId) {
            return {
                status: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required fields',
                    message: 'customerId and tenantId are required'
                })
            };
        }

        // Get customer information for the assessment
        const customer = await dataService.getCustomer(requestData.customerId);
        if (!customer) {
            return {
                status: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Customer not found',
                    message: `Customer with ID ${requestData.customerId} not found`
                })
            };
        }

        context.log('👤 Customer found:', {
            name: customer.tenantName,
            domain: customer.tenantDomain
        });

        // Initialize Microsoft Graph API service
        const graphService = new GraphApiService();
        
        // Check if we have authentication to access the customer's tenant
        // For now, we'll perform a basic assessment using available APIs
        context.log('🔐 Initializing Graph API service for assessment...');

        try {
            // Get organization profile and license information (these are generally available)
            const orgProfile = await graphService.getOrganization();
            const licenseDetails = await graphService.getLicenseDetails();
            
            context.log('✅ Successfully retrieved organizational data');
            
            // Try to get secure score (requires additional permissions)
            let secureScore = null;
            try {
                secureScore = await graphService.getSecureScore();
                context.log('✅ Successfully retrieved secure score data');
            } catch (secureScoreError) {
                context.log('⚠️ Secure score unavailable (requires additional permissions):', secureScoreError);
            }

            // Calculate license metrics
            const licenseMetrics = calculateLicenseMetrics(licenseDetails);
            
            // Calculate secure score metrics
            const secureScoreMetrics = calculateSecureScoreMetrics(secureScore);
            
            // Generate overall assessment
            const overallScore = calculateOverallScore(licenseMetrics, secureScoreMetrics);
            
            // Generate recommendations based on findings
            const recommendations = generateRecommendations(licenseMetrics, secureScoreMetrics, secureScore);

            // Create comprehensive assessment data
            const assessmentData = {
                customerId: requestData.customerId,
                tenantId: requestData.tenantId,
                score: overallScore,
                metrics: {
                    license: licenseMetrics,
                    secureScore: secureScoreMetrics,
                    realData: {
                        orgProfile,
                        licenseDetails,
                        secureScore,
                        dataSource: 'Microsoft Graph API',
                        lastUpdated: new Date().toISOString(),
                        tenantInfo: {
                            displayName: orgProfile?.displayName,
                            tenantId: requestData.tenantId,
                            verifiedDomains: orgProfile?.verifiedDomains
                        }
                    }
                },
                recommendations: recommendations,
                status: 'completed'
            };

            // Store the assessment in the database
            const assessment = await dataService.createAssessment(assessmentData);
            
            context.log(`✅ Security assessment completed successfully: ${assessment.id}`);
            
            return {
                status: 201,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    data: assessment,
                    message: 'Security assessment completed successfully',
                    stats: {
                        overallScore,
                        licenseUtilization: licenseMetrics.utilizationRate,
                        secureScorePercentage: secureScoreMetrics.percentage,
                        recommendationsCount: recommendations.length
                    }
                })
            };

        } catch (graphError: any) {
            context.log('❌ Graph API error during assessment:', graphError);
            
            // If Graph API fails, create a basic assessment with error information
            const fallbackAssessment = {
                customerId: requestData.customerId,
                tenantId: requestData.tenantId,
                score: 0,
                metrics: {
                    license: {
                        totalLicenses: 0,
                        assignedLicenses: 0,
                        utilizationRate: 0,
                        licenseDetails: [],
                        summary: 'Unable to retrieve license data - authentication required'
                    },
                    secureScore: {
                        percentage: 0,
                        currentScore: 0,
                        maxScore: 0,
                        controlScores: [],
                        summary: 'Unable to retrieve secure score - authentication required'
                    },
                    realData: {
                        error: graphError.message,
                        dataSource: 'Assessment failed',
                        lastUpdated: new Date().toISOString(),
                        authenticationRequired: true
                    }
                },
                recommendations: [
                    'Complete admin consent to enable full security assessment',
                    'Ensure proper Microsoft Graph API permissions are granted',
                    'Contact support if authentication issues persist'
                ],
                status: 'completed_with_errors'
            };

            const assessment = await dataService.createAssessment(fallbackAssessment);
            
            return {
                status: 201,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    data: assessment,
                    message: 'Assessment created but data collection failed - authentication required',
                    warning: 'Complete admin consent to enable full security assessment capabilities'
                })
            };
        }

    } catch (error: any) {
        context.log('❌ Error performing security assessment:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to perform security assessment',
                message: error.message
            })
        };
    }
}

/**
 * Calculate license utilization metrics from Graph API data
 */
function calculateLicenseMetrics(licenseDetails: any[]): any {
    if (!licenseDetails || licenseDetails.length === 0) {
        return {
            totalLicenses: 0,
            assignedLicenses: 0,
            utilizationRate: 0,
            licenseDetails: [],
            summary: 'No license data available'
        };
    }

    let totalLicenses = 0;
    let assignedLicenses = 0;
    const processedDetails: any[] = [];

    licenseDetails.forEach(sku => {
        const prepaidUnits = sku.prepaidUnits || {};
        const total = prepaidUnits.enabled || 0;
        const consumed = sku.consumedUnits || 0;

        totalLicenses += total;
        assignedLicenses += consumed;

        processedDetails.push({
            skuPartNumber: sku.skuPartNumber,
            skuDisplayName: sku.skuDisplayName || sku.skuPartNumber,
            totalLicenses: total,
            assignedLicenses: consumed
        });
    });

    const utilizationRate = totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0;

    return {
        totalLicenses,
        assignedLicenses,
        utilizationRate,
        licenseDetails: processedDetails,
        summary: `${utilizationRate}% license utilization (${assignedLicenses}/${totalLicenses} licenses used)`
    };
}

/**
 * Calculate secure score metrics from Graph API data
 */
function calculateSecureScoreMetrics(secureScore: any): any {
    if (!secureScore) {
        return {
            percentage: 0,
            currentScore: 0,
            maxScore: 0,
            controlScores: [],
            summary: 'Secure score data unavailable - requires SecurityEvents.Read.All permission'
        };
    }

    const currentScore = secureScore.currentScore || 0;
    const maxScore = secureScore.maxScore || 100;
    const percentage = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0;

    // Process control scores if available
    const controlScores = (secureScore.controlScores || []).map((control: any) => ({
        controlName: control.controlName || 'Unknown Control',
        category: control.controlCategory || 'General',
        implementationStatus: control.description || 'Not Available',
        score: control.score || 0,
        maxScore: control.maxScore || 100
    }));

    return {
        percentage,
        currentScore,
        maxScore,
        controlScores,
        summary: `${percentage}% secure score (${currentScore}/${maxScore} points)`
    };
}

/**
 * Calculate overall assessment score
 */
function calculateOverallScore(licenseMetrics: any, secureScoreMetrics: any): number {
    // Weight: 40% license efficiency, 60% security posture
    const licenseWeight = 0.4;
    const securityWeight = 0.6;

    const licenseScore = licenseMetrics.utilizationRate || 0;
    const securityScore = secureScoreMetrics.percentage || 0;

    return Math.round((licenseScore * licenseWeight) + (securityScore * securityWeight));
}

/**
 * Generate assessment recommendations
 */
function generateRecommendations(licenseMetrics: any, secureScoreMetrics: any, secureScore: any): string[] {
    const recommendations: string[] = [];

    // License recommendations
    if (licenseMetrics.utilizationRate < 70) {
        recommendations.push('Review and reallocate unused licenses to optimize costs');
    }
    if (licenseMetrics.utilizationRate > 95) {
        recommendations.push('Consider purchasing additional licenses to avoid capacity issues');
    }

    // Security recommendations
    if (secureScoreMetrics.percentage < 70) {
        recommendations.push('Implement basic security controls to improve secure score');
    }
    
    if (!secureScore) {
        recommendations.push('Complete admin consent to enable detailed security assessment');
        recommendations.push('Grant SecurityEvents.Read.All permission for comprehensive security metrics');
    }

    // Add specific control recommendations if available
    if (secureScore && secureScore.controlScores) {
        const lowScoreControls = secureScore.controlScores
            .filter((control: any) => (control.score || 0) < 50)
            .slice(0, 3); // Top 3 priority items

        lowScoreControls.forEach((control: any) => {
            recommendations.push(`Improve "${control.controlName}" security control implementation`);
        });
    }

    // Always include these basic recommendations
    if (recommendations.length === 0) {
        recommendations.push('Regular security assessment monitoring recommended');
        recommendations.push('Review Microsoft 365 security center for latest recommendations');
    }

    return recommendations;
}
