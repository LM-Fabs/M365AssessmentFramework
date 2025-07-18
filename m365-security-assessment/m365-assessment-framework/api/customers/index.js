const { SimplePostgreSQLService } = require('../shared/simplePostgresqlService');

let postgresqlService = null;

// Initialize PostgreSQL service
async function initializeService() {
    if (!postgresqlService) {
        postgresqlService = new SimplePostgreSQLService();
        await postgresqlService.initialize();
    }
}

module.exports = async function (context, req) {
    context.log('Customers function called');

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }

    try {
        // Initialize database connection
        await initializeService();

        if (req.method === 'GET') {
            // Get customers from database
            const customers = await postgresqlService.getCustomers();

            context.res = {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    success: true,
                    data: customers
                })
            };
        } else if (req.method === 'POST') {
            // Create customer in database
            const customerData = req.body;
            
            // Map frontend fields to backend format
            const newCustomer = {
                tenantName: customerData.tenantName || customerData.name || 'New Customer',
                tenantId: customerData.tenantId || 'new-tenant',
                tenantDomain: customerData.tenantDomain || customerData.domain || 'newcustomer.com',
                contactEmail: customerData.contactEmail || '',
                notes: customerData.notes || ''
            };

            // Save to database
            const createdCustomer = await postgresqlService.createCustomer(newCustomer);

            context.res = {
                status: 201,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    success: true,
                    data: {
                        customer: createdCustomer
                    }
                })
            };
        } else if (req.method === 'DELETE') {
            // Extract customer ID from query parameter
            // URL format: /api/customers?id={id}
            const customerId = req.query.id;
            
            if (!customerId) {
                context.res = {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'Customer ID is required as query parameter (?id=...)'
                    })
                };
                return;
            }

            // Delete customer from database
            const result = await postgresqlService.deleteCustomer(customerId);

            context.res = {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    success: true,
                    data: result
                })
            };
        } else {
            context.res = {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: false,
                    error: 'Method not allowed'
                })
            };
        }
    } catch (error) {
        context.log.error('Database error:', error);
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: false,
                error: error.message,
                message: 'Failed to process customer request'
            })
        };
    }
};
