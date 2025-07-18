module.exports = async function (context, req) {
    context.log('Customers function called');

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }

    try {
        if (req.method === 'GET') {
            // Get customers
            const customers = [
                {
                    id: '1',
                    name: 'Sample Customer 1',
                    tenantId: 'tenant-1',
                    domain: 'customer1.com'
                },
                {
                    id: '2', 
                    name: 'Sample Customer 2',
                    tenantId: 'tenant-2',
                    domain: 'customer2.com'
                }
            ];

            context.res = {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    success: true,
                    data: customers
                })
            };
        } else if (req.method === 'POST') {
            // Create customer
            const customerData = req.body;
            
            // Map frontend fields to backend format
            const newCustomer = {
                id: Date.now().toString(),
                name: customerData.tenantName || customerData.name || 'New Customer',
                tenantId: customerData.tenantId || 'new-tenant',
                domain: customerData.tenantDomain || customerData.domain || 'newcustomer.com',
                contactEmail: customerData.contactEmail || '',
                notes: customerData.notes || '',
                createdAt: new Date().toISOString()
            };

            context.res = {
                status: 201,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    success: true,
                    data: {
                        customer: newCustomer
                    }
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
