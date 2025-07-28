import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";
import { Customer } from "../shared/types";

// Azure Functions v4 - Individual function self-registration for Static Web Apps
app.http('customers', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: customersHandler
});

/**
 * Azure Functions v4 - Customers endpoint
 * Individual self-registration for Azure Static Web Apps compatibility
 */
async function customersHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Processing ${request.method} request for customers`);

    try {
        // Handle preflight OPTIONS request immediately
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        // Handle HEAD request for API warmup
        if (request.method === 'HEAD') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        // Initialize data service with better error handling
        try {
            await initializeDataService(context);
        } catch (initError) {
            context.error('Data service initialization failed:', initError);
            
            // Return helpful error information for database connectivity issues
            return {
                status: 503, // Service Unavailable
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Database service unavailable",
                    details: initError instanceof Error ? initError.message : "Unknown database error",
                    helpfulInfo: {
                        message: "This is likely a database connectivity issue. Check environment variables.",
                        requiredVars: ["POSTGRES_HOST", "POSTGRES_DATABASE", "POSTGRES_USER", "POSTGRES_PASSWORD"],
                        hasPostgresHost: !!process.env.POSTGRES_HOST,
                        hasPostgresDatabase: !!process.env.POSTGRES_DATABASE,
                        hasPostgresUser: !!process.env.POSTGRES_USER,
                        hasPostgresPassword: !!process.env.POSTGRES_PASSWORD
                    }
                }
            };
        }

        if (request.method === 'GET') {
            context.log('Getting all customers from data service');
            
            const result = await dataService.getCustomers({
                status: 'active',
                limit: 100
            });
            
            context.log('Retrieved customers from data service:', result.customers.length);
            
            // Transform customers to match frontend interface
            const transformedCustomers = result.customers.map((customer: any) => {
                const appReg = customer.appRegistration || {};
                return {
                    id: customer.id,
                    tenantId: customer.tenantId || '',
                    tenantName: customer.tenantName,
                    tenantDomain: customer.tenantDomain,
                    applicationId: appReg.applicationId || '',
                    clientId: appReg.clientId || '',
                    servicePrincipalId: appReg.servicePrincipalId || '',
                    createdDate: customer.createdDate,
                    lastAssessmentDate: customer.lastAssessmentDate,
                    totalAssessments: customer.totalAssessments || 0,
                    status: customer.status as 'active' | 'inactive' | 'pending',
                    permissions: appReg.permissions || [],
                    contactEmail: customer.contactEmail,
                    notes: customer.notes
                };
            });
            
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: transformedCustomers,
                    count: transformedCustomers.length,
                    timestamp: new Date().toISOString(),
                    continuationToken: 'continuationToken' in result ? result.continuationToken : undefined
                }
            };
        }

        if (request.method === 'POST') {
            let customerData: any = {};
            
            try {
                const body = await request.text();
                customerData = JSON.parse(body);
            } catch (error) {
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

            // Validate required fields
            if (!customerData.tenantName || !customerData.tenantDomain) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "tenantName and tenantDomain are required"
                    }
                };
            }

            // Check if customer already exists
            if (customerData.tenantDomain) {
                const existingCustomer = await dataService.getCustomerByDomain(customerData.tenantDomain);
                if (existingCustomer) {
                    return {
                        status: 409,
                        headers: corsHeaders,
                        jsonBody: {
                            success: false,
                            error: `Customer with domain ${customerData.tenantDomain} already exists`,
                            existingCustomerId: existingCustomer.id
                        }
                    };
                }
            }

            // Extract tenant ID from domain or use provided tenant ID
            let targetTenantId = customerData.tenantId;
            
            if (!targetTenantId && customerData.tenantDomain) {
                context.log('⚠️ Tenant ID not provided - using domain as tenant identifier');
                targetTenantId = customerData.tenantDomain.toLowerCase();
            }

            if (!targetTenantId) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Could not determine tenant ID. Please provide tenantId or a valid tenantDomain."
                    }
                };
            }

            // Create customer using PostgreSQL service
            const customerRequest = {
                tenantName: customerData.tenantName,
                tenantDomain: customerData.tenantDomain,
                tenantId: targetTenantId,
                contactEmail: customerData.contactEmail || '',
                notes: customerData.notes || '',
                skipAutoAppRegistration: customerData.skipAutoAppRegistration || false
            };

            const result = await dataService.createCustomer(customerRequest, {});
            
            // Transform customer response
            const appReg = (result as any).appRegistration || {};
            
            const transformedCustomer = {
                id: result.id,
                tenantId: result.tenantId,
                tenantName: result.tenantName,
                tenantDomain: result.tenantDomain,
                applicationId: appReg.applicationId || '',
                clientId: appReg.clientId || '',
                servicePrincipalId: appReg.servicePrincipalId || '',
                createdDate: result.createdDate,
                lastAssessmentDate: result.lastAssessmentDate,
                totalAssessments: result.totalAssessments || 0,
                status: result.status as 'active' | 'inactive' | 'pending',
                permissions: appReg.permissions || [],
                contactEmail: result.contactEmail,
                notes: result.notes
            };

            return {
                status: 201,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: {
                        customer: transformedCustomer
                    },
                    message: 'Customer created successfully'
                }
            };
        }

        if (request.method === 'DELETE') {
            context.log('Deleting customer');
            
            // Get customer ID from query parameters
            const customerId = request.query.get('id');
            
            if (!customerId) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Customer ID is required",
                        message: "Please provide customer ID in the 'id' query parameter"
                    }
                };
            }

            context.log(`Deleting customer with ID: ${customerId}`);

            try {
                // Check if customer exists first
                const existingCustomer = await dataService.getCustomer(customerId);
                
                if (!existingCustomer) {
                    return {
                        status: 404,
                        headers: corsHeaders,
                        jsonBody: {
                            success: false,
                            error: 'Customer not found',
                            message: `Customer with ID '${customerId}' does not exist`
                        }
                    };
                }

                // Delete customer from PostgreSQL
                await dataService.deleteCustomer(customerId);

                context.log(`✅ Deleted customer: ${customerId}`);
                
                return {
                    status: 200,
                    headers: corsHeaders,
                    jsonBody: {
                        success: true,
                        message: 'Customer deleted successfully',
                        deletedCustomerId: customerId
                    }
                };

            } catch (deleteError) {
                context.error('Error deleting customer:', deleteError);
                
                return {
                    status: 500,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: 'Failed to delete customer',
                        message: deleteError instanceof Error ? deleteError.message : "Unknown error"
                    }
                };
            }
        }

        // Method not allowed
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Method not allowed"
            }
        };

    } catch (error) {
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
