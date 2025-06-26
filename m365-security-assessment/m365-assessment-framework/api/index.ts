import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

// In-memory storage for demo purposes (replace with real database in production)
let customers: any[] = [];
let assessmentHistory: any[] = [];

// Optimized function initialization
const initializeData = () => {
    if (customers.length === 0) {
        console.log('Initializing in-memory data store...');
    }
};

// Test endpoint - fast response for health checks
async function testHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Test function processed a request');
    
    return { 
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            message: "M365 Assessment API is working!",
            timestamp: new Date().toISOString(),
            version: "1.0.4",
            status: "healthy"
        }
    };
}

// Optimized customers endpoint - fast response
async function customersHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const startTime = Date.now();
    context.log(`Processing ${request.method} request for customers`);

    // Handle preflight OPTIONS request immediately
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Initialize data if needed
        initializeData();

        if (request.method === 'GET') {
            context.log('Returning customers from in-memory storage:', customers.length);
            
            const responseTime = Date.now() - startTime;
            context.log(`GET /customers completed in ${responseTime}ms`);
            
            return {
                status: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    data: customers,
                    count: customers.length,
                    responseTime: `${responseTime}ms`
                })
            };
        }

        if (request.method === 'POST') {
            const customerData = await request.json() as any;
            context.log('Creating new customer with data:', customerData);
            
            // Create new customer with provided data
            const newCustomer = {
                id: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                tenantId: `${customerData.tenantName?.toLowerCase().replace(/\s+/g, '-')}-tenant-${Date.now()}`,
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
            
            const responseTime = Date.now() - startTime;
            context.log(`Customer created and added to storage in ${responseTime}ms. Total customers:`, customers.length);

            return {
                status: 201,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    data: {
                        customer: newCustomer,
                        nextSteps: [
                            "Customer created successfully",
                            "App registration would be created in production",
                            "Admin consent would be required"
                        ]
                    },
                    responseTime: `${responseTime}ms`
                })
            };
        }

        return {
            status: 405,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: `Method ${request.method} not allowed`
            })
        };

    } catch (error) {
        const responseTime = Date.now() - startTime;
        context.error('Error in customers handler:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: "Internal server error",
                responseTime: `${responseTime}ms`
            })
        };
    }
}

// Fast assessment history endpoint
async function assessmentHistoryHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const startTime = Date.now();
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
            const limit = parseInt(request.query.get('limit') || '10');

            context.log('Getting assessment history for:', tenantId || customerId);

            // Filter assessments by tenantId or customerId
            let filteredHistory = assessmentHistory;
            if (tenantId) {
                filteredHistory = assessmentHistory.filter(h => h.tenantId === tenantId);
            } else if (customerId) {
                filteredHistory = assessmentHistory.filter(h => h.customerId === customerId);
            }

            // Sort by date (most recent first) and limit
            const sortedHistory = filteredHistory
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, limit);

            const responseTime = Date.now() - startTime;
            context.log(`Assessment history retrieved in ${responseTime}ms`);

            return {
                status: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    data: sortedHistory,
                    count: sortedHistory.length,
                    responseTime: `${responseTime}ms`
                })
            };
        }

        if (request.method === 'POST') {
            const historyData = await request.json() as any;
            context.log('Adding assessment history:', historyData);

            const historyEntry = {
                id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                ...historyData,
                date: new Date(historyData.date).toISOString()
            };

            assessmentHistory.push(historyEntry);
            
            const responseTime = Date.now() - startTime;
            context.log(`Assessment history added in ${responseTime}ms. Total entries:`, assessmentHistory.length);

            return {
                status: 201,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: true,
                    data: historyEntry,
                    responseTime: `${responseTime}ms`
                })
            };
        }

        return {
            status: 405,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: `Method ${request.method} not allowed`
            })
        };

    } catch (error) {
        const responseTime = Date.now() - startTime;
        context.error('Error in assessment history handler:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: "Internal server error",
                responseTime: `${responseTime}ms`
            })
        };
    }
}

// Fast assessments endpoint
async function assessmentsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const startTime = Date.now();
    context.log(`Processing ${request.method} request for assessments`);

    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Return empty assessments array since we're using in-memory storage
        const mockAssessments: any[] = [];

        const responseTime = Date.now() - startTime;
        context.log(`Assessments retrieved in ${responseTime}ms`);

        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: mockAssessments,
                count: mockAssessments.length,
                responseTime: `${responseTime}ms`
            })
        };

    } catch (error) {
        const responseTime = Date.now() - startTime;
        context.error('Error in assessments handler:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: "Internal server error",
                responseTime: `${responseTime}ms`
            })
        };
    }
}

// Fast current assessment endpoint
async function currentAssessmentHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const startTime = Date.now();
    context.log('Processing request for current assessment');

    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Return null for current assessment since we don't have one
        const responseTime = Date.now() - startTime;
        context.log(`Current assessment retrieved in ${responseTime}ms`);

        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: null,
                responseTime: `${responseTime}ms`
            })

        };

    } catch (error) {
        const responseTime = Date.now() - startTime;
        context.error('Error in current assessment handler:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: "Internal server error",
                responseTime: `${responseTime}ms`
            })
        };
    }
}

// Register all functions with optimized configuration
app.http('test', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'test',
    handler: testHandler
});

app.http('customers', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: customersHandler
});

app.http('assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments',
    handler: assessmentsHandler
});

app.http('currentAssessment', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/current',
    handler: currentAssessmentHandler
});

// Assessment history endpoints
app.http('assessmentHistory', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history',
    handler: assessmentHistoryHandler
});

app.http('assessmentHistoryByTenant', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/{tenantId}',
    handler: assessmentHistoryHandler
});

app.http('assessmentHistoryByCustomer', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/customer/{customerId}',
    handler: assessmentHistoryHandler
});

// Initialize on startup
console.log('Azure Functions API initialized successfully');