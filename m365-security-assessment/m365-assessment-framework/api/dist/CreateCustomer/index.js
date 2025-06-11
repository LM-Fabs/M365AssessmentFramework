"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomer = void 0;
const functions_1 = require("@azure/functions");
// Azure Function to create new customers with Azure AD app registration
// Integrates with Microsoft Graph API for app registration creation
// Uses Azure Key Vault for secure credential storage
async function createCustomer(request, context) {
    context.log('CreateCustomer function triggered');
    try {
        // Set CORS headers for frontend communication
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers
            };
        }
        // Validate HTTP method
        if (request.method !== 'POST') {
            return {
                status: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }
        // TODO: Implement authentication/authorization check
        // const user = await validateUserToken(request.headers.get('authorization'));
        // if (!user) {
        //     return { status: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        // }
        // Validate request body
        const customerData = await request.json();
        if (!customerData || !customerData.tenantName || !customerData.tenantDomain) {
            return {
                status: 400,
                headers,
                body: JSON.stringify({
                    error: 'Bad request',
                    message: 'tenantName and tenantDomain are required'
                })
            };
        }
        // Validate tenant domain format
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.onmicrosoft\.com$/;
        if (!domainRegex.test(customerData.tenantDomain)) {
            return {
                status: 400,
                headers,
                body: JSON.stringify({
                    error: 'Invalid domain format',
                    message: 'Tenant domain must be in format: example.onmicrosoft.com'
                })
            };
        }
        context.log(`Creating customer: ${customerData.tenantName} (${customerData.tenantDomain})`);
        // TODO: Check if customer already exists in Cosmos DB
        // const existingCustomer = await checkCustomerExists(customerData.tenantDomain);
        // if (existingCustomer) {
        //     return {
        //         status: 409,
        //         headers,
        //         body: JSON.stringify({ error: 'Customer already exists' })
        //     };
        // }
        // TODO: Create Azure AD App Registration using Microsoft Graph API
        // This would involve:
        // 1. Creating the app registration
        // 2. Setting required API permissions (Directory.Read.All, SecurityEvents.Read.All)
        // 3. Creating a service principal
        // 4. Generating client secret and storing in Key Vault
        // 5. Setting up proper redirect URIs
        // For now, simulate the app registration creation
        const appRegistrationId = `app-${customerData.tenantName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        const clientId = `client-${Date.now()}`;
        const servicePrincipalId = `sp-${Date.now()}`;
        // Create the customer object
        const newCustomer = {
            id: `customer-${Date.now()}`,
            tenantId: `${customerData.tenantName.toLowerCase().replace(/\s+/g, '-')}-tenant`,
            tenantName: customerData.tenantName,
            tenantDomain: customerData.tenantDomain,
            applicationId: appRegistrationId,
            clientId: clientId,
            servicePrincipalId: servicePrincipalId,
            createdDate: new Date(),
            lastAssessmentDate: undefined,
            totalAssessments: 0,
            status: 'active',
            permissions: [
                'Directory.Read.All',
                'SecurityEvents.Read.All',
                'Policy.Read.All',
                'Organization.Read.All'
            ],
            contactEmail: customerData.contactEmail,
            notes: customerData.notes
        };
        // TODO: Save customer to Azure Cosmos DB
        // await cosmosClient.database('m365assessment').container('customers').items.create(newCustomer);
        // TODO: Store app registration secrets in Azure Key Vault
        // await keyVaultClient.setSecret(`customer-${newCustomer.id}-client-secret`, clientSecret);
        context.log(`Successfully created customer: ${newCustomer.id}`);
        // Return the created customer (without sensitive data)
        return {
            status: 201,
            headers,
            body: JSON.stringify(newCustomer)
        };
    }
    catch (error) {
        context.error('Error in CreateCustomer function:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while creating the customer'
            })
        };
    }
}
exports.createCustomer = createCustomer;
functions_1.app.http('createCustomer', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: createCustomer
});
//# sourceMappingURL=index.js.map