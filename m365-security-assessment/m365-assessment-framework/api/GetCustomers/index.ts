import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Customer } from "../shared/types";

// Azure Function to get all customers
// Uses Azure Cosmos DB to store customer data securely
// Implements proper error handling and logging
export async function getCustomers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('GetCustomers function triggered');

    try {
        // Set CORS headers for frontend communication
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
        if (request.method !== 'GET') {
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

        // For now, return mock data until Cosmos DB is set up
        // In production, this would query Azure Cosmos DB
        const mockCustomers: Customer[] = [
            {
                id: 'customer-1',
                tenantId: 'contoso-tenant-id-12345',
                tenantName: 'Contoso Corporation',
                tenantDomain: 'contoso.onmicrosoft.com',
                applicationId: 'app-contoso-67890',
                clientId: 'client-contoso-11111',
                servicePrincipalId: 'sp-contoso-22222',
                createdDate: new Date('2024-01-15T10:00:00Z'),
                lastAssessmentDate: new Date('2024-12-01T14:30:00Z'),
                totalAssessments: 5,
                status: 'active',
                permissions: ['Directory.Read.All', 'SecurityEvents.Read.All', 'Policy.Read.All'],
                contactEmail: 'admin@contoso.com',
                notes: 'Large enterprise customer with comprehensive security requirements'
            },
            {
                id: 'customer-2',
                tenantId: 'fabrikam-tenant-id-54321',
                tenantName: 'Fabrikam Inc',
                tenantDomain: 'fabrikam.onmicrosoft.com',
                applicationId: 'app-fabrikam-09876',
                clientId: 'client-fabrikam-33333',
                servicePrincipalId: 'sp-fabrikam-44444',
                createdDate: new Date('2024-02-10T09:15:00Z'),
                lastAssessmentDate: new Date('2024-11-20T16:45:00Z'),
                totalAssessments: 3,
                status: 'active',
                permissions: ['Directory.Read.All', 'SecurityEvents.Read.All'],
                contactEmail: 'it@fabrikam.com',
                notes: 'Medium-sized business with regular security assessments'
            },
            {
                id: 'customer-3',
                tenantId: 'adventure-tenant-id-98765',
                tenantName: 'Adventure Works',
                tenantDomain: 'adventureworks.onmicrosoft.com',
                applicationId: 'app-adventure-56789',
                clientId: 'client-adventure-55555',
                servicePrincipalId: 'sp-adventure-66666',
                createdDate: new Date('2024-03-05T11:20:00Z'),
                lastAssessmentDate: undefined,
                totalAssessments: 1,
                status: 'active',
                permissions: ['Directory.Read.All', 'SecurityEvents.Read.All'],
                contactEmail: 'security@adventureworks.com',
                notes: 'New customer, recently onboarded'
            }
        ];

        context.log(`Returning ${mockCustomers.length} customers`);

        return {
            status: 200,
            headers,
            body: JSON.stringify(mockCustomers)
        };

    } catch (error) {
        context.error('Error in GetCustomers function:', error);
        
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'An error occurred while fetching customers'
            })
        };
    }
}

app.http('getCustomers', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: getCustomers
});