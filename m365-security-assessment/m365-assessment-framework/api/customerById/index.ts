import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";

// Azure Functions v4 - Individual function self-registration for Static Web Apps
app.http('customerById', {
    methods: ['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{id}',
    handler: customerByIdHandler
});

/**
 * Azure Functions v4 - Customer by ID endpoint
 * Individual self-registration for Azure Static Web Apps compatibility
 */
async function customerByIdHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Processing ${request.method} request for customer by ID`);

    try {
        // Handle preflight OPTIONS request immediately
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        // Initialize data service
        await initializeDataService(context);

        // Get customer ID from URL parameters
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const customerId = pathSegments[pathSegments.length - 1];

        if (!customerId || customerId === 'customerById') {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "customerId parameter is required"
                }
            };
        }

        if (request.method === 'GET') {
            const customer = await dataService.getCustomer(customerId);
            
            if (!customer) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Customer not found"
                    }
                };
            }

            // Transform customer to match frontend interface
            const appReg = (customer as any).appRegistration || {};
            const transformedCustomer = {
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

            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: transformedCustomer
            };
        }

        if (request.method === 'PUT') {
            let updateData: any = {};
            
            try {
                const body = await request.text();
                updateData = JSON.parse(body);
            } catch (error) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
            }

            const updatedCustomer = await dataService.updateCustomer(customerId, updateData);
            
            // Transform customer to match frontend interface
            const appReg = (updatedCustomer as any).appRegistration || {};
            const transformedCustomer = {
                id: updatedCustomer.id,
                tenantId: updatedCustomer.tenantId || '',
                tenantName: updatedCustomer.tenantName,
                tenantDomain: updatedCustomer.tenantDomain,
                applicationId: appReg.applicationId || '',
                clientId: appReg.clientId || '',
                servicePrincipalId: appReg.servicePrincipalId || '',
                createdDate: updatedCustomer.createdDate,
                lastAssessmentDate: updatedCustomer.lastAssessmentDate,
                totalAssessments: updatedCustomer.totalAssessments || 0,
                status: updatedCustomer.status as 'active' | 'inactive' | 'pending',
                permissions: appReg.permissions || [],
                contactEmail: updatedCustomer.contactEmail,
                notes: updatedCustomer.notes
            };

            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: transformedCustomer
                }
            };
        }

        if (request.method === 'DELETE') {
            await dataService.deleteCustomer(customerId);
            
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    message: "Customer deleted successfully"
                }
            };
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
        context.error('Error in customer by ID handler:', error);
        
        if (error instanceof Error && error.message.includes('not found')) {
            return {
                status: 404,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer not found"
                }
            };
        }
        
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
