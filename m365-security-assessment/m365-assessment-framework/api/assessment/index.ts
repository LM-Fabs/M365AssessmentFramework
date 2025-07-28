import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders } from "../shared/utils";

// Azure Functions v4 - Individual Assessment endpoint (by ID)
app.http('assessment', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/{assessmentId}',
    handler: assessmentHandler
});

async function assessmentHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('📊 Assessment API called (individual assessment by ID)');

    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        const assessmentId = request.params.assessmentId;
        context.log(`🎯 Assessment ID: ${assessmentId}`);

        if (!assessmentId) {
            return {
                status: 400,
                headers: corsHeaders,
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
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: false,
                error: 'Method not allowed',
                message: 'Only GET requests are supported for this endpoint' 
            })
        };

    } catch (error: any) {
        context.log('❌ Assessment API error:', error);
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: false,
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
}

async function getAssessmentById(assessmentId: string, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`📖 Getting assessment by ID: ${assessmentId}`);
    
    try {
        // TODO: Implement actual retrieval from storage/database
        // For now, return a mock assessment to prevent blocking the UI
        
        // Check if it looks like a valid assessment ID
        if (!assessmentId || assessmentId.length < 10) {
            return {
                status: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Assessment not found',
                    message: `Assessment with ID '${assessmentId}' does not exist`
                })
            };
        }

        // Create a mock assessment structure
        const mockAssessment = {
            id: assessmentId,
            tenantId: "mock-tenant-id",
            customerName: "Mock Customer",
            assessmentDate: new Date().toISOString(),
            status: "completed",
            metrics: {
                score: {
                    overall: 75,
                    license: 80,
                    secureScore: 70
                },
                details: {
                    license: {
                        totalLicenses: 100,
                        assignedLicenses: 85,
                        utilizationRate: 85
                    },
                    secureScore: {
                        currentScore: 350,
                        maxScore: 500,
                        percentage: 70
                    }
                }
            },
            categories: ["license", "secureScore"],
            results: {
                license: {
                    score: 80,
                    recommendations: [
                        "Optimize unused licenses",
                        "Review license assignments"
                    ]
                },
                secureScore: {
                    score: 70,
                    recommendations: [
                        "Enable MFA for all users",
                        "Configure conditional access policies"
                    ]
                }
            }
        };
        
        context.log(`✅ Returning mock assessment for ID: ${assessmentId}`);
        
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: mockAssessment,
                message: 'Assessment retrieved successfully (mock data)',
                note: 'This is mock data - implement actual storage retrieval'
            })
        };

    } catch (error: any) {
        context.log('❌ Error retrieving assessment:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to retrieve assessment',
                message: error.message
            })
        };
    }
}
