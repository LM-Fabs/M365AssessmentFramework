import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { GraphApiService } from "../shared/graphApiService";
import { PostgreSQLService } from "../shared/postgresqlService";

// CORS headers for frontend communication
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
};

/**
 * Handles OAuth consent callback and creates enterprise app registration
 * This endpoint is called after customer admin grants consent
 */
const consentCallbackHandler: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('🔗 Consent callback received');

    try {
        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            context.res = {
                status: 200,
                headers: corsHeaders
            };
            return;
        }

        if (req.method !== 'GET' && req.method !== 'POST') {
            context.res = {
                status: 405,
                headers: corsHeaders,
                body: { error: 'Method not allowed' }
            };
            return;
        }

        // Extract parameters from query string (GET) or body (POST)
        let params: any = {};
        
        if (req.method === 'GET') {
            // Parse query parameters
            params = {
                code: req.query.code,
                state: req.query.state,
                tenant: req.query.tenant,
                admin_consent: req.query.admin_consent,
                error: req.query.error,
                error_description: req.query.error_description
            };
        } else if (req.method === 'POST') {
            // Parse POST body
            if (req.body) {
                try {
                    params = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                } catch (e) {
                    context.log('Failed to parse POST body as JSON');
                    params = req.body;
                }
            }
        }

        context.log('📋 Consent callback parameters:', JSON.stringify(params, null, 2));

        // Check for consent errors
        if (params.error) {
            context.log('❌ Consent error:', params.error, params.error_description);
            context.res = {
                status: 400,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Consent denied or failed',
                    details: {
                        error: params.error,
                        description: params.error_description
                    },
                    redirectUrl: `/consent-result?status=error&message=${encodeURIComponent(params.error_description || 'Consent was denied')}`
                }
            };
            return;
        }

        // Validate required parameters
        if (!params.code && !params.admin_consent) {
            context.res = {
                status: 400,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Missing required consent parameters',
                    redirectUrl: '/consent-result?status=error&message=Invalid+consent+callback'
                }
            };
            return;
        }

        // Extract state parameter for customer identification
        let stateData: any = null;
        if (params.state) {
            try {
                stateData = JSON.parse(decodeURIComponent(params.state));
            } catch (e) {
                context.log('Failed to parse state parameter:', e);
            }
        }

        const customerId = stateData?.customerId;
        const clientId = stateData?.clientId;
        const tenantId = params.tenant || stateData?.tenantId;

        context.log('🏢 Processing consent for:', {
            customerId,
            clientId,
            tenantId,
            admin_consent: params.admin_consent
        });

        if (!customerId || !tenantId) {
            context.res = {
                status: 400,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Missing customer information in consent callback',
                    redirectUrl: '/consent-result?status=error&message=Invalid+consent+state'
                }
            };
            return;
        }

        // Initialize services
        const dataService = new PostgreSQLService();
        const graphApiService = new GraphApiService();

        // Get customer information
        const customer = await dataService.getCustomer(customerId);
        if (!customer) {
            context.res = {
                status: 404,
                headers: corsHeaders,
                body: {
                    success: false,
                    error: 'Customer not found',
                    redirectUrl: '/consent-result?status=error&message=Customer+not+found'
                }
            };
            return;
        }

        // Create enterprise application in customer tenant
        context.log('🚀 Creating enterprise app registration in customer tenant...');
        
        try {
            const enterpriseApp = await graphApiService.createEnterpriseApplication({
                tenantId: tenantId,
                clientId: clientId || process.env.AZURE_CLIENT_ID || 'd1cc9e16-9194-4892-92c5-473c9f65dcb3',
                displayName: `M365 Assessment Framework - ${customer.tenantName}`,
                customerData: {
                    customerId: customer.id,
                    tenantName: customer.tenantName,
                    tenantDomain: customer.tenantDomain,
                    contactEmail: customer.contactEmail
                }
            });

            context.log('✅ Enterprise app created successfully:', enterpriseApp.id);

            // Update customer record with enterprise app information
            const existingAppReg = customer.appRegistration || {};
            await dataService.updateCustomer(customerId, {
                appRegistration: {
                    ...existingAppReg,
                    servicePrincipalId: enterpriseApp.id,
                    applicationId: enterpriseApp.id,
                    clientId: clientId || process.env.AZURE_CLIENT_ID || 'd1cc9e16-9194-4892-92c5-473c9f65dcb3',
                    isReal: true,
                    setupStatus: 'completed',
                    createdDate: new Date().toISOString(),
                    permissions: ['User.Read.All', 'Directory.Read.All', 'Reports.Read.All']
                }
            });

            context.log('✅ Customer record updated with enterprise app details');

            // Create success page HTML response
            const successHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consent Successful - M365 Assessment Framework</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .success-icon {
            color: #28a745;
            font-size: 4rem;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        .details {
            background: #f8f9fa;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .btn {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            margin: 10px;
            cursor: pointer;
        }
        .btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>Admin Consent Granted Successfully!</h1>
        <p>The M365 Assessment Framework has been successfully registered in your tenant.</p>
        
        <div class="details">
            <h3>Details:</h3>
            <p><strong>Customer:</strong> ${customer.tenantName}</p>
            <p><strong>Tenant ID:</strong> ${tenantId}</p>
            <p><strong>Enterprise App ID:</strong> ${enterpriseApp.id}</p>
            <p><strong>Status:</strong> Active and ready for assessments</p>
        </div>
        
        <p>You can now close this window and return to the M365 Assessment Framework to run security assessments.</p>
        
        <script>
            // Auto-close after 5 seconds
            setTimeout(() => {
                window.close();
            }, 5000);
            
            // Also try to send message to parent window
            if (window.opener) {
                window.opener.postMessage({
                    type: 'CONSENT_SUCCESS',
                    data: {
                        customerId: '${customerId}',
                        customerName: '${customer.tenantName}',
                        enterpriseAppId: '${enterpriseApp.id}',
                        tenantId: '${tenantId}'
                    }
                }, '*');
            }
        </script>
    </div>
</body>
</html>`;

            // Return success HTML response
            context.res = {
                status: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: successHtml
            };

        } catch (enterpriseAppError: any) {
            context.log('❌ Failed to create enterprise app:', enterpriseAppError);
            
            // Update customer with consent granted but enterprise app creation failed
            try {
                const existingAppReg = customer.appRegistration;
                await dataService.updateCustomer(customerId, {
                    appRegistration: {
                        applicationId: existingAppReg?.applicationId || 'pending',
                        servicePrincipalId: existingAppReg?.servicePrincipalId || 'pending',
                        permissions: existingAppReg?.permissions || ['User.Read.All', 'Directory.Read.All', 'Reports.Read.All'],
                        clientId: clientId || process.env.AZURE_CLIENT_ID || 'd1cc9e16-9194-4892-92c5-473c9f65dcb3',
                        setupStatus: 'consent_granted_app_failed',
                        error: enterpriseAppError.message,
                        errorTimestamp: new Date().toISOString(),
                        isReal: false,
                        ...(existingAppReg || {})
                    }
                });
            } catch (updateError) {
                context.log('❌ Failed to update customer record:', updateError);
            }

            // Create error page HTML response
            const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consent Partial Success - M365 Assessment Framework</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .warning-icon {
            color: #ffc107;
            font-size: 4rem;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        .details {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .btn {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            margin: 10px;
            cursor: pointer;
        }
        .btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="warning-icon">⚠️</div>
        <h1>Consent Granted - App Setup Needs Attention</h1>
        <p>Your admin consent was successful, but there was an issue setting up the enterprise application.</p>
        
        <div class="details">
            <h3>Status:</h3>
            <p><strong>Customer:</strong> ${customer.tenantName}</p>
            <p><strong>Tenant ID:</strong> ${tenantId}</p>
            <p><strong>Consent Status:</strong> ✅ Granted</p>
            <p><strong>Enterprise App:</strong> ⚠️ Setup failed</p>
            <p><strong>Error:</strong> ${enterpriseAppError.message}</p>
        </div>
        
        <p>Please contact support to complete the enterprise app setup.</p>
        
        <script>
            // Auto-close after 7 seconds
            setTimeout(() => {
                window.close();
            }, 7000);
            
            // Send message to parent window
            if (window.opener) {
                window.opener.postMessage({
                    type: 'CONSENT_PARTIAL',
                    data: {
                        customerId: '${customerId}',
                        customerName: '${customer.tenantName}',
                        tenantId: '${tenantId}',
                        error: '${enterpriseAppError.message}'
                    }
                }, '*');
            }
        </script>
    </div>
</body>
</html>`;

            context.res = {
                status: 200, // Still return 200 since consent was successful
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: errorHtml
            };
        }

    } catch (error: any) {
        context.log('❌ Consent callback error:', error);
        
        // Create error page HTML response
        const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consent Error - M365 Assessment Framework</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .error-icon {
            color: #dc3545;
            font-size: 4rem;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        .details {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .btn {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            margin: 10px;
            cursor: pointer;
        }
        .btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>Consent Processing Error</h1>
        <p>There was an error processing your admin consent.</p>
        
        <div class="details">
            <h3>Error Details:</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
        
        <p>Please try the consent process again or contact support if the issue persists.</p>
        
        <script>
            // Auto-close after 7 seconds
            setTimeout(() => {
                window.close();
            }, 7000);
            
            // Send message to parent window
            if (window.opener) {
                window.opener.postMessage({
                    type: 'CONSENT_ERROR',
                    data: {
                        error: '${error.message}'
                    }
                }, '*');
            }
        </script>
    </div>
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

export default consentCallbackHandler;
