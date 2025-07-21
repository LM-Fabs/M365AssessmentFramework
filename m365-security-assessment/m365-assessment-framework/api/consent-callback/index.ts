import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
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
export async function consentCallbackHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🔗 Consent callback received');

    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        if (request.method !== 'GET' && request.method !== 'POST') {
            return {
                status: 405,
                headers: corsHeaders,
                jsonBody: { error: 'Method not allowed' }
            };
        }

        // Extract parameters from query string (GET) or body (POST)
        let params: any = {};
        
        if (request.method === 'GET') {
            // Parse query parameters - get values from URLSearchParams
            const url = new URL(request.url);
            params = {
                code: url.searchParams.get('code'),
                state: url.searchParams.get('state'),
                tenant: url.searchParams.get('tenant'),
                admin_consent: url.searchParams.get('admin_consent'),
                error: url.searchParams.get('error'),
                error_description: url.searchParams.get('error_description')
            };
        } else if (request.method === 'POST') {
            // Parse POST body
            try {
                const body = await request.text();
                params = body ? JSON.parse(body) : {};
            } catch (e) {
                context.log('Failed to parse POST body as JSON');
                params = {};
            }
        }

        context.log('📋 Consent callback parameters:', JSON.stringify(params, null, 2));

        // Check for consent errors
        if (params.error) {
            context.log('❌ Consent error:', params.error, params.error_description);
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: 'Consent denied or failed',
                    details: {
                        error: params.error,
                        description: params.error_description
                    }
                }
            };
        }

        // Validate required parameters
        if (!params.code && !params.admin_consent) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: 'Missing required consent parameters'
                }
            };
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
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: 'Missing customer information in consent callback'
                }
            };
        }

        // Initialize services
        const dataService = new PostgreSQLService();
        const graphApiService = new GraphApiService();

        // Get customer information
        const customer = await dataService.getCustomer(customerId);
        if (!customer) {
            return {
                status: 404,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: 'Customer not found'
                }
            };
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

            // Return success HTML response
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
            setTimeout(() => { window.close(); }, 5000);
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

            return {
                status: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: successHtml
            };

        } catch (enterpriseAppError: any) {
            context.log('❌ Failed to create enterprise app:', enterpriseAppError);
            
            return {
                status: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: `<html><body><h1>Consent Granted - Setup Issue</h1><p>Consent was successful but enterprise app setup failed: ${enterpriseAppError.message}</p></body></html>`
            };
        }

    } catch (error: any) {
        context.log('❌ Consent callback error:', error);
        
        return {
            status: 500,
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: `<html><body><h1>Consent Error</h1><p>Error processing consent: ${error.message}</p></body></html>`
        };
    }
}

export default consentCallbackHandler;
