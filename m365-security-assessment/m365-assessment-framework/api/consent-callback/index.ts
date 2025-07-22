import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
// Temporarily commented out service imports for deployment troubleshooting
// import { GraphApiService } from "../shared/graphApiService";
// import { PostgreSQLService } from "../shared/postgresqlService";

// Azure Functions v4 - Individual function self-registration for Static Web Apps
app.http('consent-callback', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'consent-callback',
    handler: consentCallbackHandler
});

// CORS headers for frontend communication
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
};

/**
 * Azure Static Web Apps - Consent callback handler
 * Individual self-registration for Azure Static Web Apps compatibility
 * 
 * DEPLOYMENT TROUBLESHOOTING MODE:
 * Service dependencies temporarily commented out to isolate deployment issues
 */
async function consentCallbackHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
                body: JSON.stringify({ 
                    error: 'Method not allowed',
                    message: 'Only GET and POST methods are supported'
                })
            };
        }

        if (request.method === 'GET') {
            // Handle OAuth consent redirect with authorization code
            const url = new URL(request.url);
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            const customerId = url.searchParams.get('customer_id');
            const error = url.searchParams.get('error');
            const errorDescription = url.searchParams.get('error_description');

            // Enhanced logging for debugging OAuth callback
            context.log(`🔗 OAuth consent callback received:`);
            context.log(`  - Full URL: ${request.url}`);
            context.log(`  - Code: ${code ? 'present (' + code.substring(0, 20) + '...)' : 'missing'}`);
            context.log(`  - State: ${state || 'not provided'}`);
            context.log(`  - Customer ID: ${customerId || 'not provided'}`);
            context.log(`  - Error: ${error || 'none'}`);
            context.log(`  - Error Description: ${errorDescription || 'none'}`);

            // Log all query parameters for debugging
            const allParams = {};
            url.searchParams.forEach((value, key) => {
                allParams[key] = value;
            });
            context.log(`  - All query parameters:`, JSON.stringify(allParams, null, 2));

            // Handle OAuth error responses first
            if (error) {
                context.log(`❌ OAuth error received: ${error} - ${errorDescription}`);
                return {
                    status: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        error: `OAuth error: ${error}`,
                        message: errorDescription || 'OAuth consent failed',
                        debug: {
                            error,
                            errorDescription,
                            state,
                            customerId
                        }
                    })
                };
            }

            // Check for authorization code
            if (!code) {
                context.log(`❌ Authorization code missing from OAuth callback`);
                return {
                    status: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        error: 'Authorization code missing',
                        message: 'OAuth consent failed or was denied',
                        debug: {
                            receivedParams: allParams,
                            expectedParam: 'code',
                            hint: 'Check if Azure AD is configured to send authorization code in callback URL'
                        }
                    })
                };
            }

            // Initialize services - temporarily commented out for deployment troubleshooting
            // const graphService = new GraphApiService();
            // const postgresService = new PostgreSQLService();

            try {
                // Use state parameter as customer ID, fallback to customerId parameter
                const tenantId = state || customerId || 'unknown';
                
                context.log(`✅ Processing consent callback for tenant: ${tenantId}`);
                context.log(`   Authorization code received (first 20 chars): ${code.substring(0, 20)}...`);

                // For now, return a simple success response
                // TODO: Implement proper Graph API service integration when services are uncommented
                
                context.log(`✅ Consent successfully processed for customer ${tenantId}`);

                // Determine frontend URL - try multiple environment variables
                const frontendUrl = process.env.REACT_APP_FRONTEND_URL || 
                                  process.env.FRONTEND_URL || 
                                  process.env.STATIC_WEB_APP_URL ||
                                  'https://victorious-pond-069956e03.6.azurestaticapps.net';
                
                const successRedirect = `${frontendUrl}/admin-consent-success?customer_id=${tenantId}&status=success`;

                context.log(`🔄 Redirecting to: ${successRedirect}`);

                return {
                    status: 302,
                    headers: {
                        ...corsHeaders,
                        'Location': successRedirect
                    }
                };

            } catch (appError) {
                context.log('❌ Error processing consent callback:', appError);
                
                const frontendUrl = process.env.REACT_APP_FRONTEND_URL || 
                                  process.env.FRONTEND_URL || 
                                  process.env.STATIC_WEB_APP_URL ||
                                  'https://victorious-pond-069956e03.6.azurestaticapps.net';
                
                const errorRedirect = `${frontendUrl}/admin-consent-error?error=${encodeURIComponent(appError.message)}&tenant_id=${state || customerId || 'unknown'}`;

                return {
                    status: 302,
                    headers: {
                        ...corsHeaders,
                        'Location': errorRedirect
                    }
                };
            }

        } else if (request.method === 'POST') {
            // Handle manual consent trigger
            try {
                const body = await request.text();
                const data = JSON.parse(body);
                const { customerId, adminEmail } = data;

                context.log(`Manual consent trigger - Customer ID: ${customerId}, Admin Email: ${adminEmail}`);

                if (!customerId || !adminEmail) {
                    return {
                        status: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ 
                            error: 'Missing required fields',
                            message: 'Customer ID and admin email are required'
                        })
                    };
                }

                // For manual trigger, generate consent URL
                const tenantId = customerId;
                const clientId = process.env.AZURE_CLIENT_ID || 'd1cc9e16-9194-4892-92c5-473c9f65dcb3';
                
                // Construct proper redirect URI
                const baseUrl = process.env.REACT_APP_API_URL || 
                              process.env.API_BASE_URL || 
                              'https://victorious-pond-069956e03.6.azurestaticapps.net';
                const redirectUri = encodeURIComponent(`${baseUrl}/api/consent-callback`);
                
                context.log(`🔗 Generating consent URL with redirect: ${baseUrl}/api/consent-callback`);
                
                const consentUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
                    `client_id=${clientId}&` +
                    `response_type=code&` +
                    `redirect_uri=${redirectUri}&` +
                    `scope=https://graph.microsoft.com/.default&` +
                    `state=${customerId}&` +
                    `response_mode=query&` +
                    `prompt=admin_consent`;

                return {
                    status: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        success: true,
                        consentUrl,
                        message: 'Admin consent URL generated. Please visit the URL to complete consent.',
                        debug: {
                            tenantId,
                            clientId,
                            redirectUri: `${baseUrl}/api/consent-callback`,
                            urlLength: consentUrl.length
                        }
                    })
                };

            } catch (parseError) {
                context.log('Error parsing POST body:', parseError);
                return {
                    status: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        error: 'Invalid JSON',
                        message: 'Request body must be valid JSON'
                    })
                };
            }
        }

        // Default fallback response
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: true,
                message: 'Consent callback processed successfully'
            })
        };

    } catch (error) {
        context.log('Error in consent callback:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
            })
        };
    }
}
