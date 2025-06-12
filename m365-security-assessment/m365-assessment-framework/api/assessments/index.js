const { app } = require('@azure/functions');

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

app.http('assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Processing ${request.method} request for assessments`);

        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        // Return mock assessment data
        const mockAssessments = [
            {
                id: "assessment-1",
                tenantId: "tenant-123",
                assessmentDate: new Date().toISOString(),
                overallScore: 75,
                status: "completed",
                metrics: {
                    secureScore: 75,
                    mfaAdoption: 85,
                    conditionalAccessPolicies: 12,
                    riskLevel: "medium"
                }
            },
            {
                id: "assessment-2", 
                tenantId: "tenant-456",
                assessmentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                overallScore: 82,
                status: "completed",
                metrics: {
                    secureScore: 82,
                    mfaAdoption: 92,
                    conditionalAccessPolicies: 18,
                    riskLevel: "low"
                }
            }
        ];

        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: mockAssessments,
                count: mockAssessments.length
            })
        };
    }
});