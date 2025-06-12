"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
// Main customers endpoint - handles both GET (list) and POST (create)
async function customers(request, context) {
    context.log(`Processing ${request.method} request for customers`);
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
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
            const customerData = await request.json();
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
                        customer: newCustomer
                    }
                })
            };
        }
        catch (error) {
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
// Register the customers function
functions_1.app.http('customers', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: customers
});
// Simple assessments endpoint
async function assessments(request, context) {
    context.log(`Processing ${request.method} request for assessments`);
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
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
            status: "completed"
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
// Register the assessments function
functions_1.app.http('assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments',
    handler: assessments
});
//# sourceMappingURL=working-functions.js.map