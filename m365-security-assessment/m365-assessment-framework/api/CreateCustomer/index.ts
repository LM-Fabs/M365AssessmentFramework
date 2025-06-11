import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getCosmosDbService } from "../shared/cosmosDbService";
import { getGraphApiService } from "../shared/graphApiService";
import { getKeyVaultService } from "../shared/keyVaultService";
import { CreateCustomerRequest, Customer } from "../shared/types";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('CreateCustomer function processed a request.');

    try {
        // Validate request method
        if (req.method !== 'POST') {
            context.res = {
                status: 405,
                body: { error: 'Method not allowed. Use POST.' }
            };
            return;
        }

        // Validate request body
        const customerData: CreateCustomerRequest = req.body;
        if (!customerData || !customerData.tenantName || !customerData.tenantDomain) {
            context.res = {
                status: 400,
                body: { 
                    error: 'Invalid request body. Required fields: tenantName, tenantDomain' 
                }
            };
            return;
        }

        // Validate email format if provided
        if (customerData.contactEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(customerData.contactEmail)) {
                context.res = {
                    status: 400,
                    body: { error: 'Invalid email format' }
                };
                return;
            }
        }

        // Validate tenant domain format
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(customerData.tenantDomain)) {
            context.res = {
                status: 400,
                body: { error: 'Invalid tenant domain format' }
            };
            return;
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
            context.res = {
                status: 409,
                body: { 
                    error: `Customer with domain ${customerData.tenantDomain} already exists`,
                    existingCustomerId: existingCustomer.id
                }
            };
            return;
        }

        // Create Azure AD app registration for this customer
        context.log('Creating Azure AD app registration...');
        const appRegistration = await graphApiService.createAppRegistration({
            displayName: `M365 Assessment - ${customerData.tenantName}`,
            description: `Enterprise application for M365 security assessment of ${customerData.tenantName}`,
            requiredPermissions: [
                // Microsoft Graph permissions for security assessment
                'Directory.Read.All',
                'Policy.Read.All',
                'SecurityEvents.Read.All',
                'IdentityRiskEvent.Read.All',
                'SecurityActions.Read.All',
                'ThreatIntelligence.Read.All',
                'User.Read.All',
                'Group.Read.All',
                'Application.Read.All',
                'DeviceManagementConfiguration.Read.All',
                'DeviceManagementManagedDevices.Read.All'
            ]
        });

        context.log(`App registration created with Application ID: ${appRegistration.applicationId}`);

        // Generate and store client secret securely in Key Vault
        context.log('Generating client secret...');
        const clientSecret = await graphApiService.generateClientSecret(appRegistration.applicationId);
        
        // Store the client secret in Key Vault
        const secretName = `customer-${Date.now()}-secret`;
        await keyVaultService.setClientSecret(secretName, clientSecret.value);

        // Create customer record in Cosmos DB
        context.log('Creating customer record in Cosmos DB...');
        const customer = await cosmosDbService.createCustomer(customerData, {
            applicationId: appRegistration.applicationId,
            clientId: appRegistration.clientId,
            servicePrincipalId: appRegistration.servicePrincipalId,
            permissions: appRegistration.permissions
        });

        // Store the secret reference in the customer record
        await cosmosDbService.updateCustomer(customer.id, customer.tenantDomain, {
            clientSecretKeyVaultName: secretName,
            clientSecretExpiryDate: clientSecret.expiryDate
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

        context.res = {
            status: 201,
            body: {
                message: 'Customer created successfully',
                customer: responseData,
                setupInstructions: {
                    applicationId: appRegistration.applicationId,
                    clientId: appRegistration.clientId,
                    requiredPermissions: appRegistration.permissions,
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
        context.log.error('Error creating customer:', error);

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('already exists')) {
                context.res = {
                    status: 409,
                    body: { error: error.message }
                };
            } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
                context.res = {
                    status: 401,
                    body: { error: 'Authentication failed. Please check your credentials.' }
                };
            } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
                context.res = {
                    status: 403,
                    body: { error: 'Insufficient permissions to create enterprise application.' }
                };
            } else {
                context.res = {
                    status: 500,
                    body: { 
                        error: 'Internal server error while creating customer',
                        details: process.env.NODE_ENV === 'development' ? error.message : undefined
                    }
                };
            }
        } else {
            context.res = {
                status: 500,
                body: { error: 'An unexpected error occurred' }
            };
        }
    }
};

export default httpTrigger;