const { app } = require('@azure/functions');

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

app.http('assessment-current', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing request for current assessment');

        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        // Return mock current assessment
        const currentAssessment = {
            id: `assessment-${Date.now()}`,
            tenantId: "current-tenant",
            assessmentDate: new Date().toISOString(),
            overallScore: 78,
            status: "in-progress",
            metrics: {
                secureScore: 78,
                mfaAdoption: 88,
                conditionalAccessPolicies: 15,
                riskLevel: "medium",
                criticalIssues: 3,
                recommendations: 12
            },
            lastUpdated: new Date().toISOString()
        };

        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: currentAssessment
            })
        };
    }
});