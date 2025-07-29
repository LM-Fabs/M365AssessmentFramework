"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Azure Functions v4 - Assessment History endpoint
functions_1.app.http('assessment-history', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history',
    handler: assessmentHistoryHandler
});
async function assessmentHistoryHandler(request, context) {
    context.log('📊 Assessment History API called');
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
        const tenantId = request.params.tenantId || request.query.get('tenantId');
        context.log(`🎯 Tenant ID: ${tenantId || 'none'}`);
        if (request.method === 'POST') {
            return await storeAssessmentHistory(request, context);
        }
        if (request.method === 'GET' && tenantId) {
            return await getAssessmentHistory(request, context, tenantId);
        }
        if (request.method === 'GET' && !tenantId) {
            return {
                status: 400,
                headers: utils_1.corsHeaders,
                body: JSON.stringify({
                    error: 'Bad request',
                    message: 'Tenant ID is required for GET request (use ?tenantId=...)'
                })
            };
        }
        return {
            status: 400,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                error: 'Bad request',
                message: 'Invalid method or missing tenant ID for GET request'
            })
        };
    }
    catch (error) {
        context.log('❌ Assessment History API error:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
}
async function storeAssessmentHistory(request, context) {
    context.log('💾 Storing assessment history to PostgreSQL');
    try {
        const rawData = await request.json();
        context.log('📋 Raw assessment history data received:', JSON.stringify(rawData, null, 2));
        // Flexible data extraction to handle different frontend data structures
        let historyEntry;
        // Check if this is a full assessment object or already formatted history data
        if (rawData.id && rawData.customerId && rawData.score !== undefined) {
            // This appears to be a full assessment object from the assessments endpoint
            historyEntry = {
                assessmentId: rawData.id,
                tenantId: rawData.tenantId,
                date: rawData.createdAt ? new Date(rawData.createdAt) : new Date(),
                overallScore: rawData.score || 0,
                categoryScores: {
                    license: rawData.metrics?.score?.license || rawData.metrics?.license?.utilizationRate || 0,
                    secureScore: rawData.metrics?.score?.secureScore || rawData.metrics?.secureScore?.percentage || 0
                },
                metrics: rawData.metrics
            };
            context.log('✅ Converted full assessment object to history format');
        }
        else {
            // Assume it's already in the expected format
            historyEntry = rawData;
        }
        context.log('� Processed history entry:', {
            assessmentId: historyEntry.assessmentId,
            tenantId: historyEntry.tenantId,
            date: historyEntry.date,
            overallScore: historyEntry.overallScore,
            categoryScores: historyEntry.categoryScores
        });
        // Validate required fields
        if (!historyEntry.assessmentId || !historyEntry.tenantId) {
            context.log('❌ Validation failed - missing required fields');
            return {
                status: 400,
                headers: utils_1.corsHeaders,
                body: JSON.stringify({
                    error: 'Missing required fields',
                    message: 'assessmentId and tenantId are required',
                    received: {
                        assessmentId: historyEntry.assessmentId || 'missing',
                        tenantId: historyEntry.tenantId || 'missing'
                    }
                })
            };
        }
        // Try to get customer ID from the request, or look it up by tenant ID
        let customerId = historyEntry.customerId;
        if (!customerId) {
            // Try to find customer by tenant ID if not provided
            try {
                const result = await utils_1.dataService.getCustomers();
                const customer = result.customers.find(c => c.tenantId === historyEntry.tenantId);
                customerId = customer?.id || null;
                context.log(`🔍 Found customer ID: ${customerId} for tenant: ${historyEntry.tenantId}`);
            }
            catch (error) {
                context.log('⚠️ Could not look up customer ID, using null');
                customerId = null;
            }
        }
        // Store in PostgreSQL using the existing service
        await utils_1.dataService.storeAssessmentHistory({
            assessmentId: historyEntry.assessmentId,
            tenantId: historyEntry.tenantId,
            customerId: customerId || null,
            date: new Date(historyEntry.date),
            overallScore: historyEntry.overallScore,
            categoryScores: historyEntry.categoryScores
        });
        context.log('✅ Assessment history stored successfully in PostgreSQL');
        return {
            status: 200,
            headers: utils_1.corsHeaders,
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
    }
    catch (error) {
        context.log('❌ Error storing assessment history:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                error: 'Failed to store assessment history',
                message: error.message
            })
        };
    }
}
async function getAssessmentHistory(request, context, tenantId) {
    context.log(`📖 Getting assessment history for tenant: ${tenantId} from PostgreSQL`);
    try {
        // Get assessment history from PostgreSQL
        const history = await utils_1.dataService.getAssessmentHistory({ tenantId });
        context.log(`✅ Retrieved ${history.length} history entries for tenant ${tenantId}`);
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                tenantId: tenantId,
                history: history,
                count: history.length
            })
        };
    }
    catch (error) {
        context.log('❌ Error retrieving assessment history:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                error: 'Failed to retrieve assessment history',
                message: error.message
            })
        };
    }
}
//# sourceMappingURL=index.js.map