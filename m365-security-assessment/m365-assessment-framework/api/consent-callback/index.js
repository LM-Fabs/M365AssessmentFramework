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
            const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consent Error</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d9534f; }
    </style>
</head>
<body>
    <h1 class="error">Consent Error</h1>
    <p>There was an error processing your admin consent: ${error_description || error}</p>
    <p>Please try again or contact support.</p>
    <script>
        setTimeout(() => window.close(), 5000);
    </script>
</body>
</html>`;
            
            context.res = {
                status: 400,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: errorHtml
            };
            return;
        }

        // Check if admin consent was granted
        if (admin_consent !== 'True') {
            context.log.warn('Admin consent not granted:', admin_consent);
            const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consent Not Granted</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .warning { color: #f0ad4e; }
    </style>
</head>
<body>
    <h1 class="warning">Admin Consent Required</h1>
    <p>Admin consent was not granted. The M365 Assessment Framework requires admin consent to access your tenant data.</p>
    <p>Please try the consent process again.</p>
    <script>
        setTimeout(() => window.close(), 5000);
    </script>
</body>
</html>`;
            
            context.res = {
                status: 400,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: errorHtml
            };
            return;
        }

        // Validate required parameters
        if (!tenant) {
            context.log.error('Missing tenant ID in callback');
            const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invalid Callback</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d9534f; }
    </style>
</head>
<body>
    <h1 class="error">Invalid Callback</h1>
    <p>Missing required information in consent callback.</p>
    <p>Please contact support.</p>
    <script>
        setTimeout(() => window.close(), 5000);
    </script>
</body>
</html>`;
            
            context.res = {
                status: 400,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: errorHtml
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
            const successHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consent Successful</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0; padding: 20px; min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
        }
        .container { 
            background: white; border-radius: 10px; padding: 40px; 
            max-width: 600px; text-align: center; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .success { color: #28a745; font-size: 4rem; margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 20px; }
        .details { 
            background: #f8f9fa; border-radius: 5px; padding: 20px; 
            margin: 20px 0; text-align: left; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success">✅</div>
        <h1>Admin Consent Granted Successfully!</h1>
        <p>The M365 Assessment Framework has been successfully registered in your tenant.</p>
        
        <div class="details">
            <h3>Details:</h3>
            <p><strong>Customer:</strong> ${customer?.name || 'Unknown'}</p>
            <p><strong>Tenant ID:</strong> ${tenant}</p>
            <p><strong>Enterprise App ID:</strong> ${enterpriseApp.appId}</p>
            <p><strong>Status:</strong> Active and ready for assessments</p>
        </div>
        
        <p>You can now close this window and return to the M365 Assessment Framework.</p>
        
        <script>
            // Auto-close after 5 seconds
            setTimeout(() => window.close(), 5000);
            
            // Send message to parent window
            if (window.opener) {
                window.opener.postMessage({
                    type: 'CONSENT_SUCCESS',
                    data: {
                        customerId: '${customerData?.customerId || ''}',
                        customerName: '${customer?.name || ''}',
                        enterpriseAppId: '${enterpriseApp.appId}',
                        tenantId: '${tenant}'
                    }
                }, '*');
            }
        </script>
    </div>
</body>
</html>`;

            context.res = {
                status: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: successHtml
            };

        } catch (error) {
            context.log.error('Failed to create enterprise application:', error);
            
            const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enterprise App Creation Failed</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d9534f; }
    </style>
</head>
<body>
    <h1 class="error">Setup Incomplete</h1>
    <p>Consent was granted successfully, but there was an issue creating the enterprise application.</p>
    <p>Error: ${error.message}</p>
    <p>Please contact support to complete the setup.</p>
    <script>
        setTimeout(() => window.close(), 7000);
    </script>
</body>
</html>`;
            
            context.res = {
                status: 500,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: errorHtml
            };
        }

    } catch (error) {
        context.log.error('Consent callback error:', error);
        
        const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Processing Error</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d9534f; }
    </style>
</head>
<body>
    <h1 class="error">Processing Error</h1>
    <p>There was an error processing your consent callback.</p>
    <p>Error: ${error.message}</p>
    <p>Please try again or contact support.</p>
    <script>
        setTimeout(() => window.close(), 7000);
    </script>
</body>
</html>`;
        
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: errorHtml
        };
    }
};
