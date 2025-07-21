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
 * Azure Static Web Apps - Consent callback handler
 * Uses Azure Functions v4 types with default export pattern for SWA compatibility
 */
export default async function (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

            context.log(`OAuth consent received - Code: ${code ? 'present' : 'missing'}, State: ${state}, Customer ID: ${customerId}`);

            if (!code) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        error: 'Authorization code missing',
                        message: 'OAuth consent failed or was denied'
                    })
                };
            }

            // Initialize services
            const graphService = new GraphApiService();
            const postgresService = new PostgreSQLService();

            try {
                // Use state parameter as customer ID, fallback to customerId parameter
                const tenantId = state || customerId;
                
                context.log(`✅ Processing consent callback for tenant: ${tenantId}`);

                // For now, return a simple success response
                // TODO: Implement proper Graph API service integration
                
                context.log(`✅ Consent processed for customer ${tenantId}`);

                // Return success response with redirect to frontend
                const frontendUrl = process.env.REACT_APP_FRONTEND_URL || '';
                const successRedirect = `${frontendUrl}/admin-consent-success?customer_id=${tenantId}&code=${code}`;

                return {
                    status: 302,
                    headers: {
                        ...corsHeaders,
                        'Location': successRedirect
                    }
                };

            } catch (appError) {
                context.log('Error processing consent callback:', appError);
                
                const frontendUrl = process.env.REACT_APP_FRONTEND_URL || '';
                const errorRedirect = `${frontendUrl}/admin-consent-error?error=${encodeURIComponent(appError.message)}`;

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
                const redirectUri = encodeURIComponent(`${process.env.REACT_APP_API_URL || ''}/api/consent-callback`);
                
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
                        message: 'Admin consent URL generated. Please visit the URL to complete consent.'
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
