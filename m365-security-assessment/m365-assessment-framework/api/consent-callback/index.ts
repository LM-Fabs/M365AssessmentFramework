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
export async function consentCallback(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
            // Parse query parameters using URLSearchParams from request.url
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

        context.log('📋 Parameters received:', JSON.stringify(params, null, 2));

        // Check for consent error
        if (params.error) {
            context.log('❌ Consent error:', params.error);
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: { 
                    error: 'Consent was denied or failed',
                    details: params.error_description || params.error 
                }
            };
        }

        // Validate required parameters
        if (!params.admin_consent && !params.code) {
            context.log('❌ Missing required consent parameters');
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: { 
                    error: 'Missing required consent parameters',
                    details: 'Either admin_consent or authorization code must be present'
                }
            };
        }

        // Extract customer identifier from state parameter
        if (!params.state) {
            context.log('❌ Missing state parameter');
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: { 
                    error: 'Missing state parameter',
                    details: 'State parameter is required to identify the customer'
                }
            };
        }

        // Parse state parameter (format: "customer:{customerId}")
        const stateMatch = params.state.match(/^customer:(.+)$/);
        if (!stateMatch) {
            context.log('❌ Invalid state parameter format:', params.state);
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: { 
                    error: 'Invalid state parameter format',
                    details: 'State must be in format: customer:{customerId}'
                }
            };
        }

        const customerId = stateMatch[1];
        context.log('👤 Processing consent for customer:', customerId);

        // Validate customer exists in database
        const dbService = new PostgreSQLService();
        try {
            // Check if customer exists
            const customer = await dbService.getCustomer(customerId);
            if (!customer) {
                context.log('❌ Customer not found:', customerId);
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: { 
                        error: 'Customer not found',
                        details: `Customer with ID ${customerId} does not exist`
                    }
                };
            }

            context.log('✅ Customer found:', customer.tenantName);

            // Extract tenant ID from parameters
            const tenantId = params.tenant;
            if (!tenantId) {
                context.log('❌ Missing tenant ID');
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: { 
                        error: 'Missing tenant ID',
                        details: 'Tenant ID is required for app registration'
                    }
                };
            }

            context.log('🏢 Processing for tenant:', tenantId);

            // Create Graph API service instance
            const graphService = new GraphApiService();

            // Create enterprise application registration for this customer
            context.log('🚀 Creating enterprise application registration...');
            
            const appRegistration = await graphService.createEnterpriseApplication({
                displayName: `M365 Security Assessment - ${customer.tenantName}`,
                tenantId: tenantId,
                clientId: process.env.AZURE_CLIENT_ID || '',
                customerData: {
                    customerId: customerId,
                    tenantName: customer.tenantName,
                    tenantDomain: customer.tenantDomain,
                    contactEmail: customer.contactEmail
                }
            });

            context.log('✅ Enterprise application created:', appRegistration.appId);

            // Update customer with application registration data
            await dbService.updateCustomer(customerId, {
                appRegistration: {
                    applicationId: appRegistration.appId,
                    clientId: appRegistration.appId,
                    servicePrincipalId: appRegistration.objectId,
                    permissions: [],
                    consentUrl: undefined,
                    redirectUri: `${process.env.API_URL || 'https://localhost:7071'}/api/consent-callback`,
                    isReal: true,
                    isManualSetup: false,
                    setupStatus: 'completed',
                    createdDate: new Date().toISOString()
                },
                status: 'active'
            });

            context.log('💾 Application registration saved to database');
            context.log('🎉 Consent callback processing completed successfully');

            // Return success response with HTML page
            const successHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>M365 Assessment - Consent Successful</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 40px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .success-icon {
            font-size: 60px;
            color: #28a745;
            margin-bottom: 20px;
        }
        h1 { 
            color: #333; 
            margin-bottom: 20px;
            font-size: 28px;
        }
        p { 
            color: #666; 
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: left;
        }
        .detail-item {
            margin-bottom: 10px;
        }
        .detail-label {
            font-weight: bold;
            color: #333;
        }
        .detail-value {
            color: #666;
            font-family: monospace;
        }
        .close-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 20px;
        }
        .close-btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>Consent Granted Successfully!</h1>
        <p>Thank you for granting permission to access your Microsoft 365 environment for security assessment.</p>
        
        <div class="details">
            <div class="detail-item">
                <span class="detail-label">Customer:</span>
                <span class="detail-value">${customer.tenantName}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Tenant ID:</span>
                <span class="detail-value">${tenantId}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Application ID:</span>
                <span class="detail-value">${appRegistration.appId}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value">Registration Complete</span>
            </div>
        </div>
        
        <p><strong>Next Steps:</strong></p>
        <p>Your enterprise application has been successfully registered. You can now proceed with the M365 Security Assessment. The assessment team will be in touch shortly.</p>
        
        <button class="close-btn" onclick="window.close()">Close Window</button>
    </div>
    
    <script>
        // Auto-close after 30 seconds
        setTimeout(() => {
            window.close();
        }, 30000);
    </script>
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

        } catch (dbError: any) {
            context.log('❌ Database error:', dbError);
            return {
                status: 500,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: `
<!DOCTYPE html>
<html>
<head>
    <title>M365 Assessment - Error</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
        .error { color: #dc3545; background: #f8d7da; padding: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="error">
        <h1>❌ Database Error</h1>
        <p>There was an error processing your consent. Please try again later or contact support.</p>
        <p><strong>Error:</strong> ${dbError?.message || 'Unknown database error'}</p>
    </div>
</body>
</html>`
            };
        }

    } catch (error: any) {
        context.log('❌ Unexpected error in consent callback:', error);
        
        return {
            status: 500,
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: `
<!DOCTYPE html>
<html>
<head>
    <title>M365 Assessment - Error</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
        .error { color: #dc3545; background: #f8d7da; padding: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="error">
        <h1>❌ Unexpected Error</h1>
        <p>An unexpected error occurred while processing your consent. Please try again later or contact support.</p>
        <p><strong>Error:</strong> ${error?.message || 'Unknown error'}</p>
        <button onclick="window.close()">Close Window</button>
    </div>
</body>
</html>`
        };
    }
}
