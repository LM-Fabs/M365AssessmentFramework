import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getCosmosDbService } from "../shared/cosmosDbService";
import { getGraphApiService } from "../shared/graphApiService";
import { getKeyVaultService } from "../shared/keyVaultService";
import { CreateCustomerRequest, Customer } from "../shared/types";

export async function createCustomer(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('CreateCustomer function processed a request.');

    try {
        // Validate request method
        if (request.method !== 'POST') {
            return {
                status: 405,
                jsonBody: { error: 'Method not allowed. Use POST.' }
            };
        }

        // Validate request body
        const customerData: CreateCustomerRequest = await request.json() as CreateCustomerRequest;
        if (!customerData || !customerData.tenantName || !customerData.tenantDomain) {
            return {
                status: 400,
                jsonBody: { 
                    error: 'Invalid request body. Required fields: tenantName, tenantDomain' 
                }
            };
        }

        // Validate email format if provided
        if (customerData.contactEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(customerData.contactEmail)) {
                return {
                    status: 400,
                    jsonBody: { error: 'Invalid email format' }
                };
            }
        }

        // Validate tenant domain format
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(customerData.tenantDomain)) {
            return {
                status: 400,
                jsonBody: { error: 'Invalid tenant domain format' }
            };
        }

        // Initialize services
        const cosmosDbService = getCosmosDbService();
        const graphApiService = getGraphApiService();
        const keyVaultService = getKeyVaultService();

        // Initialize Cosmos DB if not already done
        await cosmosDbService.initialize();

        context.log(`Creating customer for tenant: ${customerData.tenantName} (${customerData.tenantDomain})`);

        // Check if customer already exists
        const existingCustomer = await cosmosDbService.getCustomerByDomain(customerData.tenantDomain);
        if (existingCustomer && existingCustomer.status !== 'deleted') {
            return {
                status: 409,
                jsonBody: { 
                    error: `Customer with domain ${customerData.tenantDomain} already exists`,
                    existingCustomerId: existingCustomer.id
                }
            };
        }

        // Create Azure AD app registration for this customer
        context.log('Creating Azure AD app registration...');
        const appRegistration = await graphApiService.createAppRegistration({
            tenantName: customerData.tenantName,
            tenantDomain: customerData.tenantDomain,
            contactEmail: customerData.contactEmail
        });

        context.log(`App registration created with Application ID: ${appRegistration.applicationId}`);

        // Create customer record in Cosmos DB
        context.log('Creating customer record in Cosmos DB...');
        const customer = await cosmosDbService.createCustomer(customerData, {
            applicationId: appRegistration.applicationId,
            clientId: appRegistration.clientId,
            servicePrincipalId: appRegistration.servicePrincipalId,
            permissions: []
        });

        // Store the client secret in Key Vault
        const secretName = await keyVaultService.storeClientSecret(customer.id, customerData.tenantDomain, appRegistration.clientSecret);

        // Store the secret reference in the customer record
        await cosmosDbService.updateCustomer(customer.id, customer.tenantDomain, {
            // Remove the clientSecretExpiryDate as it's not in the Customer type
        });

        context.log(`Customer created successfully with ID: ${customer.id}`);

        // Return customer info (without sensitive data)
        const responseData: Partial<Customer> = {
            id: customer.id,
            tenantName: customer.tenantName,
            tenantDomain: customer.tenantDomain,
            applicationId: customer.applicationId,
            clientId: customer.clientId,
            servicePrincipalId: customer.servicePrincipalId,
            createdDate: customer.createdDate,
            status: customer.status,
            permissions: customer.permissions,
            contactEmail: customer.contactEmail,
            notes: customer.notes,
            totalAssessments: customer.totalAssessments
        };

        return {
            status: 201,
            jsonBody: {
                message: 'Customer created successfully',
                customer: responseData,
                setupInstructions: {
                    applicationId: appRegistration.applicationId,
                    clientId: appRegistration.clientId,
                    nextSteps: [
                        'Admin consent must be granted for the enterprise application',
                        'Verify all required permissions are granted',
                        'Test the connection before running assessments'
                    ]
                }
            },
            headers: {
                'Content-Type': 'application/json'
            }
        };

    } catch (error) {
        context.error('Error creating customer:', error);

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('already exists')) {
                return {
                    status: 409,
                    jsonBody: { error: error.message }
                };
            } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
                return {
                    status: 401,
                    jsonBody: { error: 'Authentication failed. Please check your credentials.' }
                };
            } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
                return {
                    status: 403,
                    jsonBody: { error: 'Insufficient permissions to create enterprise application.' }
                };
            } else {
                return {
                    status: 500,
                    jsonBody: { 
                        error: 'Internal server error while creating customer',
                        details: process.env.NODE_ENV === 'development' ? error.message : undefined
                    }
                };
            }
        } else {
            return {
                status: 500,
                jsonBody: { error: 'An unexpected error occurred' }
            };
        }
    }
}

app.http('CreateCustomer', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'customers/create',
    handler: createCustomer
});