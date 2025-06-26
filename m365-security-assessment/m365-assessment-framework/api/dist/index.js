"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};
// In-memory storage for demo purposes (replace with real database in production)
let customers = [];
let assessmentHistory = [];
// Optimized function initialization with immediate response
const initializeData = () => {
    if (customers.length === 0) {
        console.log('Initializing in-memory data store...');
    }
};
// Test endpoint - immediate fast response
async function testHandler(request, context) {
    context.log('Test function processed a request');
    return {
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            message: "M365 Assessment API is working!",
            timestamp: new Date().toISOString(),
            version: "1.0.5",
            status: "healthy"
        }
    };
}
// Optimized customers endpoint with immediate response
async function customersHandler(request, context) {
    context.log(`Processing ${request.method} request for customers`);
    // Handle preflight OPTIONS request immediately
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Initialize data if needed (synchronous operation)
        initializeData();
        if (request.method === 'GET') {
            context.log('Returning customers from in-memory storage:', customers.length);
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: customers,
                    count: customers.length,
                    timestamp: new Date().toISOString()
                }
            };
        }
        if (request.method === 'POST') {
            let customerData = {};
            try {
                customerData = await request.json();
            }
            catch (error) {
                context.log('Invalid JSON in request body');
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
            }
            context.log('Creating new customer with data:', customerData);
            // Create new customer with provided data
            const newCustomer = {
                id: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                tenantId: `${customerData.tenantName?.toLowerCase().replace(/\s+/g, '-') || 'customer'}-tenant-${Date.now()}`,
                tenantName: customerData.tenantName || "New Customer",
                tenantDomain: customerData.tenantDomain || "example.onmicrosoft.com",
                applicationId: `app-${Date.now()}`,
                clientId: `client-${Date.now()}`,
                servicePrincipalId: `sp-${Date.now()}`,
                createdDate: new Date().toISOString(),
                totalAssessments: 0,
                status: "active",
                permissions: ["Directory.Read.All", "SecurityEvents.Read.All"],
                contactEmail: customerData.contactEmail,
                notes: customerData.notes
            };
            // Add to in-memory storage
            customers.push(newCustomer);
            context.log(`Customer created and added to storage. Total customers:`, customers.length);
            return {
                status: 201,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: {
                        customer: newCustomer,
                        nextSteps: [
                            "Customer created successfully",
                            "App registration would be created in production",
                            "Admin consent would be required"
                        ]
                    }
                }
            };
        }
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: `Method ${request.method} not allowed`
            }
        };
    }
    catch (error) {
        context.error('Error in customers handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Fast assessment history endpoint
async function assessmentHistoryHandler(request, context) {
    context.log(`Processing ${request.method} request for assessment history`);
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        if (request.method === 'GET') {
            const tenantId = request.params.tenantId;
            const customerId = request.params.customerId;
            const limit = Math.min(parseInt(request.query.get('limit') || '10'), 100); // Cap at 100
            context.log('Getting assessment history for:', tenantId || customerId || 'all');
            // Filter assessments by tenantId or customerId
            let filteredHistory = assessmentHistory;
            if (tenantId) {
                filteredHistory = assessmentHistory.filter(h => h.tenantId === tenantId);
            }
            else if (customerId) {
                filteredHistory = assessmentHistory.filter(h => h.customerId === customerId);
            }
            // Sort by date (most recent first) and limit
            const sortedHistory = filteredHistory
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, limit);
            context.log(`Assessment history retrieved. Count: ${sortedHistory.length}`);
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: sortedHistory,
                    count: sortedHistory.length,
                    timestamp: new Date().toISOString()
                }
            };
        }
        if (request.method === 'POST') {
            let historyData = {};
            try {
                historyData = await request.json();
            }
            catch (error) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
            }
            context.log('Adding assessment history:', historyData);
            const historyEntry = {
                id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                ...historyData,
                date: new Date(historyData.date || new Date()).toISOString()
            };
            assessmentHistory.push(historyEntry);
            context.log(`Assessment history added. Total entries:`, assessmentHistory.length);
            return {
                status: 201,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: historyEntry
                }
            };
        }
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: `Method ${request.method} not allowed`
            }
        };
    }
    catch (error) {
        context.error('Error in assessment history handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Fast assessments endpoint
async function assessmentsHandler(request, context) {
    context.log(`Processing ${request.method} request for assessments`);
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Return empty assessments array since we're using in-memory storage
        const mockAssessments = [];
        context.log(`Assessments retrieved. Count: ${mockAssessments.length}`);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: mockAssessments,
                count: mockAssessments.length,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('Error in assessments handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Fast current assessment endpoint
async function currentAssessmentHandler(request, context) {
    context.log('Processing request for current assessment');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Return null for current assessment since we don't have one
        context.log(`Current assessment retrieved`);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: null,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('Error in current assessment handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Best practices endpoint
async function bestPracticesHandler(request, context) {
    context.log('Processing request for best practices');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        const mockBestPractices = [
            {
                category: "Identity & Access Management",
                practices: [
                    "Enable Multi-Factor Authentication for all users",
                    "Implement Conditional Access policies",
                    "Use Azure AD Privileged Identity Management"
                ]
            },
            {
                category: "Data Protection",
                practices: [
                    "Enable Microsoft Information Protection",
                    "Configure Data Loss Prevention policies",
                    "Use Microsoft Cloud App Security"
                ]
            }
        ];
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: mockBestPractices,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('Error in best practices handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Create assessment endpoint
async function createAssessmentHandler(request, context) {
    context.log('Processing request to create assessment');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        let assessmentData = {};
        try {
            assessmentData = await request.json();
        }
        catch (error) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Invalid JSON in request body"
                }
            };
        }
        context.log('Creating assessment with data:', assessmentData);
        // Create mock assessment
        const mockAssessment = {
            id: `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tenantId: assessmentData.tenantName?.toLowerCase().replace(/\s+/g, '-') || 'new-tenant',
            tenantName: assessmentData.tenantName || 'New Assessment',
            assessmentDate: new Date().toISOString(),
            status: 'completed',
            categories: assessmentData.categories || ['identity', 'dataProtection', 'endpoint', 'cloudApps'],
            metrics: {
                score: {
                    overall: 75,
                    identity: 80,
                    dataProtection: 70,
                    endpoint: 75,
                    cloudApps: 80
                }
            }
        };
        return {
            status: 201,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: mockAssessment
            }
        };
    }
    catch (error) {
        context.error('Error in create assessment handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Save assessment endpoint
async function saveAssessmentHandler(request, context) {
    context.log('Processing request to save assessment');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        let assessmentData = {};
        try {
            assessmentData = await request.json();
        }
        catch (error) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Invalid JSON in request body"
                }
            };
        }
        context.log('Saving assessment:', assessmentData.id);
        // Return the saved assessment
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: assessmentData
            }
        };
    }
    catch (error) {
        context.error('Error in save assessment handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Get metrics endpoint
async function getMetricsHandler(request, context) {
    context.log('Processing request for metrics');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        const tenantId = request.query.get('tenantId');
        if (!tenantId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "tenantId parameter is required"
                }
            };
        }
        // Mock metrics data
        const mockMetrics = {
            score: {
                overall: 75,
                identity: 80,
                dataProtection: 70,
                endpoint: 75,
                cloudApps: 80
            },
            compliance: {
                mfa: { enabled: true, coverage: 85 },
                conditionalAccess: { enabled: true, policies: 5 },
                dlp: { enabled: false, policies: 0 }
            },
            risks: [
                { category: 'Identity', severity: 'Medium', count: 3 },
                { category: 'Data Protection', severity: 'High', count: 1 }
            ]
        };
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: mockMetrics,
                tenantId: tenantId
            }
        };
    }
    catch (error) {
        context.error('Error in get metrics handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Register all functions with optimized configuration
functions_1.app.http('test', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'test',
    handler: testHandler
});
functions_1.app.http('customers', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: customersHandler
});
functions_1.app.http('assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments',
    handler: assessmentsHandler
});
functions_1.app.http('currentAssessment', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/current',
    handler: currentAssessmentHandler
});
// Assessment history endpoints
functions_1.app.http('assessmentHistory', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history',
    handler: assessmentHistoryHandler
});
functions_1.app.http('assessmentHistoryByTenant', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/{tenantId}',
    handler: assessmentHistoryHandler
});
functions_1.app.http('assessmentHistoryByCustomer', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/customer/{customerId}',
    handler: assessmentHistoryHandler
});
// Best practices endpoint
functions_1.app.http('bestPractices', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'best-practices',
    handler: bestPracticesHandler
});
// Create assessment endpoint
functions_1.app.http('createAssessment', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/create',
    handler: createAssessmentHandler
});
// Save assessment endpoint
functions_1.app.http('saveAssessment', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'save-assessment',
    handler: saveAssessmentHandler
});
// Get metrics endpoint
functions_1.app.http('getMetrics', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'GetMetrics',
    handler: getMetricsHandler
});
// Initialize on startup
console.log('Azure Functions API initialized successfully - Version 1.0.5');
//# sourceMappingURL=index.js.map