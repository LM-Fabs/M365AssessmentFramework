const { GraphApiService } = require('../shared/graphApiService');
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
    context.log('🔗 Consent callback received');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        };
        return;
    }

    try {
        // Extract query parameters from the callback URL
        const { admin_consent, tenant, state, error, error_description } = req.query;

        context.log('Consent callback parameters:', {
            admin_consent,
            tenant,
            state,
            error: error || 'none'
        });

        // Check if there was an error in the consent process
        if (error) {
            context.log.error('Consent error:', error, error_description);
            context.res = {
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: {
                    success: false,
                    error: 'Consent denied or failed',
                    details: error_description || error
                }
            };
            return;
        }

        // Check if admin consent was granted
        if (admin_consent !== 'True') {
            context.log.warn('Admin consent not granted:', admin_consent);
            context.res = {
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: {
                    success: false,
                    error: 'Admin consent was not granted'
                }
            };
            return;
        }

        // Validate required parameters
        if (!tenant) {
            context.log.error('Missing tenant ID in callback');
            context.res = {
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: {
                    success: false,
                    error: 'Missing tenant ID'
                }
            };
            return;
        }

        // Parse state parameter to get customer information
        let customerData = null;
        if (state) {
            try {
                customerData = JSON.parse(decodeURIComponent(state));
                context.log('Customer data from state:', customerData);
            } catch (error) {
                context.log.warn('Could not parse state parameter:', error);
            }
        }

        // Initialize PostgreSQL service
        await initializeService();

        // Get customer information from database if we have it
        let customer = null;
        if (customerData?.customerId) {
            try {
                customer = await postgresqlService.getCustomer(customerData.customerId);
                context.log('Found customer in database:', customer?.name);
            } catch (error) {
                context.log.warn('Could not retrieve customer from database:', error);
            }
        }

        try {
            // Initialize Graph API service
            const graphService = new GraphApiService();

            // Create enterprise application registration
            const enterpriseApp = await graphService.createEnterpriseApplication(
                tenant,
                customer?.name || `Customer-${tenant.substring(0, 8)}`
            );

            context.log('✅ Enterprise application created:', enterpriseApp.appId);

            // Update customer record with new app registration if we have customer data
            if (customer && enterpriseApp.appId) {
                try {
                    await postgresqlService.updateCustomerAppRegistration(
                        customer.id,
                        enterpriseApp.appId,
                        tenant
                    );
                    context.log('Updated customer with app registration');
                } catch (error) {
                    context.log.warn('Could not update customer record:', error);
                    // Don't fail the whole process if this fails
                }
            }

            // Return success response
            context.res = {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: {
                    success: true,
                    message: 'Enterprise application created successfully',
                    enterpriseApp: {
                        appId: enterpriseApp.appId,
                        displayName: enterpriseApp.displayName,
                        tenantId: tenant
                    },
                    customer: customer ? {
                        id: customer.id,
                        name: customer.name
                    } : null
                }
            };

        } catch (error) {
            context.log.error('Failed to create enterprise application:', error);
            context.res = {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: {
                    success: false,
                    error: 'Failed to create enterprise application',
                    details: error.message
                }
            };
        }

    } catch (error) {
        context.log.error('Consent callback error:', error);
        context.res = {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: {
                success: false,
                error: 'Internal server error',
                details: error.message
            }
        };
    }
};
