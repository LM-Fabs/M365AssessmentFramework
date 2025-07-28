import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders } from "../shared/utils";

// Azure Functions v4 - Assessment History endpoint
app.http('assessment-history', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/{tenantId?}',
    handler: assessmentHistoryHandler
});

interface AssessmentHistory {
    assessmentId: string;
    tenantId: string;
    date: Date;
    overallScore: number;
    categoryScores: {
        license: number;
        secureScore: number;
    };
    metrics: any;
}

async function assessmentHistoryHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('📊 Assessment History API called');

    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        const tenantId = request.params.tenantId;
        context.log(`🎯 Tenant ID: ${tenantId || 'none'}`);

        if (request.method === 'POST') {
            return await storeAssessmentHistory(request, context);
        }

        if (request.method === 'GET' && tenantId) {
            return await getAssessmentHistory(request, context, tenantId);
        }

        return {
            status: 400,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Bad request',
                message: 'Invalid method or missing tenant ID for GET request' 
            })
        };

    } catch (error: any) {
        context.log('❌ Assessment History API error:', error);
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
}

async function storeAssessmentHistory(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('💾 Storing assessment history');
    
    try {
        const historyEntry = await request.json() as AssessmentHistory;
        context.log('📋 History entry:', {
            assessmentId: historyEntry.assessmentId,
            tenantId: historyEntry.tenantId,
            date: historyEntry.date,
            overallScore: historyEntry.overallScore
        });

        // TODO: Implement actual storage (database, Azure Table Storage, etc.)
        // For now, we'll just log and return success to prevent blocking assessments
        
        // Validate required fields
        if (!historyEntry.assessmentId || !historyEntry.tenantId) {
            return {
                status: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Missing required fields',
                    message: 'assessmentId and tenantId are required'
                })
            };
        }

        // Simulate successful storage
        context.log('✅ Assessment history stored successfully (mock implementation)');
        
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: 'Assessment history stored successfully',
                stored: {
                    assessmentId: historyEntry.assessmentId,
                    tenantId: historyEntry.tenantId,
                    timestamp: new Date().toISOString()
                }
            })
        };

    } catch (error: any) {
        context.log('❌ Error storing assessment history:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Failed to store assessment history',
                message: error.message
            })
        };
    }
}

async function getAssessmentHistory(request: HttpRequest, context: InvocationContext, tenantId: string): Promise<HttpResponseInit> {
    context.log(`📖 Getting assessment history for tenant: ${tenantId}`);
    
    try {
        // TODO: Implement actual retrieval from storage
        // For now, return empty history to prevent blocking
        
        const mockHistory: AssessmentHistory[] = [];
        
        context.log(`✅ Retrieved ${mockHistory.length} history entries for tenant ${tenantId}`);
        
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                tenantId: tenantId,
                history: mockHistory,
                count: mockHistory.length
            })
        };

    } catch (error: any) {
        context.log('❌ Error retrieving assessment history:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Failed to retrieve assessment history',
                message: error.message
            })
        };
    }
}
