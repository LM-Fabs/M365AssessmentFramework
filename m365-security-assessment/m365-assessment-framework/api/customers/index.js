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
        // Simple mock data for now - you can integrate your actual data service later
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
            body: JSON.stringify(customers)
        };
    } catch (error) {
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: error.message,
                message: 'Failed to retrieve customers'
            })
        };
    }
};
