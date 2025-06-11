"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customers = customers;
const functions_1 = require("@azure/functions");
const cosmosDbService_1 = require("../shared/cosmosDbService");
const graphApiService_1 = require("../shared/graphApiService");
/**
 * Customer Management Function - Handles both GET and POST requests
 * GET: Retrieve all customers from Cosmos DB
 * POST: Create new customer with Azure AD app registration
 */
async function customers(request, context) {
    context.log(`Processing ${request.method} request for customers`);
    // CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }
        // Handle GET request - retrieve customers
        if (request.method === 'GET') {
            try {
                const cosmosService = (0, cosmosDbService_1.getCosmosDbService)();
                // Get query parameters for filtering and pagination
                const url = new URL(request.url);
                const status = url.searchParams.get('status') || undefined;
                const limit = parseInt(url.searchParams.get('limit') || '50');
                const continuationToken = url.searchParams.get('continuationToken') || undefined;
                const result = await cosmosService.getCustomers({
                    status,
                    maxItemCount: Math.min(limit, 100), // Cap at 100 for performance
                    continuationToken
                });
                context.log(`Retrieved ${result.customers.length} customers from Cosmos DB`);
                return {
                    status: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: true,
                        data: result.customers,
                        continuationToken: result.continuationToken,
                        count: result.customers.length
                    })
                };
            }
            catch (error) {
                context.error('Error retrieving customers:', error);
                return {
                    status: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        error: 'Failed to retrieve customers',
                        details: error.message
                    })
                };
            }
        }
        // Handle POST request - create new customer
        if (request.method === 'POST') {
            try {
                const requestBody = await request.text();
                if (!requestBody) {
                    return {
                        status: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            success: false,
                            error: 'Request body is required'
                        })
                    };
                }
                const customerData = JSON.parse(requestBody);
                // Validate required fields
                if (!customerData.tenantName || !customerData.tenantDomain) {
                    return {
                        status: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            success: false,
                            error: 'tenantName and tenantDomain are required'
                        })
                    };
                }
                // Validate email format if provided
                if (customerData.contactEmail && !isValidEmail(customerData.contactEmail)) {
                    return {
                        status: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            success: false,
                            error: 'Invalid email format'
                        })
                    };
                }
                context.log(`Creating customer for tenant: ${customerData.tenantName}`);
                const cosmosService = (0, cosmosDbService_1.getCosmosDbService)();
                const graphService = (0, graphApiService_1.getGraphApiService)();
                // Check if customer already exists
                const existingCustomer = await cosmosService.getCustomerByDomain(customerData.tenantDomain);
                if (existingCustomer) {
                    return {
                        status: 409,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            success: false,
                            error: `Customer with domain ${customerData.tenantDomain} already exists`
                        })
                    };
                }
                // Create Azure AD App Registration
                context.log('Creating Azure AD app registration...');
                const appRegistration = await graphService.createAppRegistration({
                    tenantName: customerData.tenantName,
                    tenantDomain: customerData.tenantDomain,
                    contactEmail: customerData.contactEmail
                });
                // Create customer in Cosmos DB with app registration details
                const newCustomer = await cosmosService.createCustomer(customerData, {
                    applicationId: appRegistration.applicationId,
                    clientId: appRegistration.clientId,
                    servicePrincipalId: appRegistration.servicePrincipalId,
                    permissions: [
                        'Directory.Read.All',
                        'SecurityEvents.Read.All',
                        'Policy.Read.All',
                        'Organization.Read.All'
                    ]
                });
                context.log(`Successfully created customer: ${newCustomer.id}`);
                // Generate admin consent URL for the customer
                const consentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${appRegistration.clientId}`;
                // Return response with customer data and next steps
                return {
                    status: 201,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: true,
                        data: {
                            customer: newCustomer,
                            appRegistration: {
                                clientId: appRegistration.clientId,
                                consentUrl: consentUrl
                            },
                            nextSteps: [
                                "Admin consent is required for the application permissions",
                                `Direct the customer admin to: ${consentUrl}`,
                                "Once consent is granted, assessments can be performed"
                            ]
                        }
                    })
                };
            }
            catch (error) {
                context.error('Error creating customer:', error);
                // Provide more specific error messages
                if (error.message.includes('already exists')) {
                    return {
                        status: 409,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            success: false,
                            error: error.message
                        })
                    };
                }
                return {
                    status: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        error: 'Failed to create customer',
                        details: error.message
                    })
                };
            }
        }
        // Method not allowed
        return {
            status: 405,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: `Method ${request.method} not allowed`
            })
        };
    }
    catch (error) {
        context.error('Unexpected error in customers function:', error);
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: error.message
            })
        };
    }
}
/**
 * Helper function to validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
// Register the function
functions_1.app.http('customers', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: customers
});
//# sourceMappingURL=index.js.map