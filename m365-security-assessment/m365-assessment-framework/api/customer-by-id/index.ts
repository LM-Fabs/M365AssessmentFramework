import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";

// Azure Functions v4 - Individual Customer endpoint (by ID)
app.http('customer-by-id', {
    methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}',
    handler: customerByIdHandler
});

async function customerByIdHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('👤 Customer By ID API called');

    try {
        // Initialize data service (PostgreSQL)
        await initializeDataService(context);

        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        const customerId = request.params.customerId;
        context.log(`🎯 Customer ID: ${customerId}`);

        if (!customerId) {
            return {
                status: 400,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    success: false,
                    error: 'Bad request',
                    message: 'Customer ID is required' 
                })
            };
        }

        if (request.method === 'GET') {
            return await getCustomerById(customerId, context);
        }

        if (request.method === 'PUT') {
            return await updateCustomer(request, customerId, context);
        }

        if (request.method === 'DELETE') {
            return await deleteCustomer(customerId, context);
        }

        return {
            status: 405,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: false,
                error: 'Method not allowed',
                message: 'Only GET, PUT, and DELETE requests are supported for this endpoint' 
            })
        };

    } catch (error: any) {
        context.log('❌ Customer By ID API error:', error);
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: false,
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
}

async function getCustomerById(customerId: string, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`📖 Getting customer by ID: ${customerId} from PostgreSQL`);
    
    try {
        // Get customer from PostgreSQL
        const customer = await dataService.getCustomer(customerId);
        
        if (!customer) {
            return {
                status: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Customer not found',
                    message: `Customer with ID '${customerId}' does not exist`
                })
            };
        }

        context.log(`✅ Retrieved customer: ${customerId}`);
        
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: customer,
                message: 'Customer retrieved successfully'
            })
        };

    } catch (error: any) {
        context.log('❌ Error retrieving customer:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to retrieve customer',
                message: error.message
            })
        };
    }
}

async function updateCustomer(request: HttpRequest, customerId: string, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`📝 Updating customer: ${customerId}`);
    
    try {
        const customerData = await request.json() as any;
        
        // Ensure customer ID matches the route parameter
        customerData.id = customerId;
        
        context.log('📋 Customer update data received');

        // Update customer in PostgreSQL
        const updatedCustomer = await dataService.updateCustomer(customerId, customerData);
        
        context.log(`✅ Updated customer: ${customerId}`);
        
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: updatedCustomer,
                message: 'Customer updated successfully'
            })
        };

    } catch (error: any) {
        context.log('❌ Error updating customer:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to update customer',
                message: error.message
            })
        };
    }
}

async function deleteCustomer(customerId: string, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`🗑️ Deleting customer: ${customerId} from PostgreSQL`);
    
    try {
        // Check if customer exists first
        const existingCustomer = await dataService.getCustomer(customerId);
        
        if (!existingCustomer) {
            return {
                status: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Customer not found',
                    message: `Customer with ID '${customerId}' does not exist`
                })
            };
        }

        // Delete customer from PostgreSQL
        await dataService.deleteCustomer(customerId);

        context.log(`✅ Deleted customer: ${customerId}`);
        
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: 'Customer deleted successfully',
                deletedCustomerId: customerId
            })
        };

    } catch (error: any) {
        context.log('❌ Error deleting customer:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to delete customer',
                message: error.message
            })
        };
    }
}
