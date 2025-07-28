import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";

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
    metrics?: any;
}

async function assessmentHistoryHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('📊 Assessment History API called');

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
    context.log('💾 Storing assessment history to PostgreSQL');
    
    try {
        const historyEntry = await request.json() as AssessmentHistory;
        context.log('📋 History entry:', {
            assessmentId: historyEntry.assessmentId,
            tenantId: historyEntry.tenantId,
            date: historyEntry.date,
            overallScore: historyEntry.overallScore
        });

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

        // Store in PostgreSQL using the existing service
        await dataService.storeAssessmentHistory({
            assessmentId: historyEntry.assessmentId,
            tenantId: historyEntry.tenantId,
            customerId: '', // Will be populated by the service if needed
            date: new Date(historyEntry.date),
            overallScore: historyEntry.overallScore,
            categoryScores: historyEntry.categoryScores
        });
        
        context.log('✅ Assessment history stored successfully in PostgreSQL');
        
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
    context.log(`📖 Getting assessment history for tenant: ${tenantId} from PostgreSQL`);
    
    try {
        // Get assessment history from PostgreSQL
        const history = await dataService.getAssessmentHistory({ tenantId });
        
        context.log(`✅ Retrieved ${history.length} history entries for tenant ${tenantId}`);
        
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                tenantId: tenantId,
                history: history,
                count: history.length
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
