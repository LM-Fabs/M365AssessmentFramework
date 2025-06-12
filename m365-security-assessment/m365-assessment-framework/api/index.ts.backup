import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

// Test endpoint
async function testHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Test function processed a request');
    
    return { 
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            message: "M365 Assessment API is working!",
            timestamp: new Date().toISOString(),
            version: "1.0.0"
        }
    };
}

// Customers endpoint - handles both GET (list) and POST (create)
async function customersHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Processing ${request.method} request for customers`);

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    if (request.method === 'GET') {
        // Return mock customers for now to get frontend working
        const mockCustomers = [
            {
                id: "customer-1",
                tenantId: "tenant-123",
                tenantName: "Contoso Corp",
                tenantDomain: "contoso.onmicrosoft.com",
                applicationId: "app-123",
                clientId: "client-123", 
                servicePrincipalId: "sp-123",
                createdDate: new Date().toISOString(),
                totalAssessments: 5,
                status: "active",
                permissions: ["Directory.Read.All", "SecurityEvents.Read.All"],
                contactEmail: "admin@contoso.com"
            },
            {
                id: "customer-2",
                tenantId: "tenant-456",
                tenantName: "Fabrikam Inc",
                tenantDomain: "fabrikam.onmicrosoft.com",
                applicationId: "app-456",
                clientId: "client-456",
                servicePrincipalId: "sp-456",
                createdDate: new Date().toISOString(),
                totalAssessments: 3,
                status: "active",
                permissions: ["Directory.Read.All", "SecurityEvents.Read.All"],
                contactEmail: "admin@fabrikam.com"
            }
        ];

        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: mockCustomers,
                count: mockCustomers.length
            })
        };
    }

    if (request.method === 'POST') {
        try {
            const customerData = await request.json() as any;
            
            // Create mock customer with provided data
            const newCustomer = {
                id: `customer-${Date.now()}`,
                tenantId: `${customerData.tenantName?.toLowerCase().replace(/\s+/g, '-')}-tenant`,
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
                    }
                })
            };
        } catch (error) {
            return {
                status: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: "Invalid request data"
                })
            };
        }
    }

    return {
        status: 405,
        headers: corsHeaders,
        body: JSON.stringify({
            success: false,
            error: `Method ${request.method} not allowed`
        })
    };
}

// Assessments endpoint
async function assessmentsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

// Current assessment endpoint
async function currentAssessmentHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

// Register all functions
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