"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Azure Functions v4 - Individual Customer endpoint (by ID)
functions_1.app.http('customer-by-id', {
    methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}',
    handler: customerByIdHandler
});
async function customerByIdHandler(request, context) {
    context.log('👤 Customer By ID API called');
    try {
        // Initialize data service (PostgreSQL)
        await (0, utils_1.initializeDataService)(context);
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        const customerId = request.params.customerId;
        context.log(`🎯 Customer ID: ${customerId}`);
        if (!customerId) {
            return {
                status: 400,
                headers: utils_1.corsHeaders,
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
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Method not allowed',
                message: 'Only GET, PUT, and DELETE requests are supported for this endpoint'
            })
        };
    }
    catch (error) {
        context.log('❌ Customer By ID API error:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: error.message
            })
        };
    }
}
async function getCustomerById(customerId, context) {
    context.log(`📖 Getting customer by ID: ${customerId} from PostgreSQL`);
    try {
        // Get customer from PostgreSQL
        const customer = await utils_1.dataService.getCustomer(customerId);
        if (!customer) {
            return {
                status: 404,
                headers: utils_1.corsHeaders,
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
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                data: customer,
                message: 'Customer retrieved successfully'
            })
        };
    }
    catch (error) {
        context.log('❌ Error retrieving customer:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to retrieve customer',
                message: error.message
            })
        };
    }
}
async function updateCustomer(request, customerId, context) {
    context.log(`📝 Updating customer: ${customerId}`);
    try {
        const customerData = await request.json();
        // Ensure customer ID matches the route parameter
        customerData.id = customerId;
        context.log('📋 Customer update data received');
        // Update customer in PostgreSQL
        const updatedCustomer = await utils_1.dataService.updateCustomer(customerId, customerData);
        context.log(`✅ Updated customer: ${customerId}`);
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                data: updatedCustomer,
                message: 'Customer updated successfully'
            })
        };
    }
    catch (error) {
        context.log('❌ Error updating customer:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to update customer',
                message: error.message
            })
        };
    }
}
async function deleteCustomer(customerId, context) {
    context.log(`🗑️ Deleting customer: ${customerId} from PostgreSQL`);
    try {
        // Check if customer exists first
        const existingCustomer = await utils_1.dataService.getCustomer(customerId);
        if (!existingCustomer) {
            return {
                status: 404,
                headers: utils_1.corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Customer not found',
                    message: `Customer with ID '${customerId}' does not exist`
                })
            };
        }
        // Delete customer from PostgreSQL
        await utils_1.dataService.deleteCustomer(customerId);
        context.log(`✅ Deleted customer: ${customerId}`);
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: true,
                message: 'Customer deleted successfully',
                deletedCustomerId: customerId
            })
        };
    }
    catch (error) {
        context.log('❌ Error deleting customer:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to delete customer',
                message: error.message
            })
        };
    }
}
//# sourceMappingURL=index.js.map