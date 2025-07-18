import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { GraphApiService } from "./shared/graphApiService";
import { PostgreSQLService } from "./shared/postgresqlService";

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
async function handleConsentCallback(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
            // Parse query parameters
            params = {
                code: request.query.get('code'),
                state: request.query.get('state'),
                tenant: request.query.get('tenant'),
                admin_consent: request.query.get('admin_consent'),
                error: request.query.get('error'),
                error_description: request.query.get('error_description')
            };
        } else if (request.method === 'POST') {
            // Parse POST body
            const body = await request.text();
            if (body) {
                try {
                    params = JSON.parse(body);
                } catch (e) {
                    context.log('Failed to parse POST body as JSON, treating as form data');
                    // Handle form-encoded data if needed
                    const formData = new URLSearchParams(body);
                    params = Object.fromEntries(formData.entries());
                }
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
                    },
                    redirectUrl: `/consent-result?status=error&message=${encodeURIComponent(params.error_description || 'Consent was denied')}`
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
                    error: 'Missing required consent parameters',
                    redirectUrl: '/consent-result?status=error&message=Invalid+consent+callback'
                }
            };
        }

        // Extract state parameter for customer identification
        const stateData = params.state ? JSON.parse(decodeURIComponent(params.state)) : null;
        const customerId = stateData?.customerId;
        const clientId = stateData?.clientId;
        const tenantId = params.tenant || stateData?.tenantId;

        context.log('🏢 Processing consent for:', {
            customerId,
            clientId,
            tenantId,
            admin_consent: params.admin_consent
        });

        if (!customerId || !clientId || !tenantId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: 'Missing customer information in consent callback',
                    redirectUrl: '/consent-result?status=error&message=Invalid+consent+state'
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
                    error: 'Customer not found',
                    redirectUrl: '/consent-result?status=error&message=Customer+not+found'
                }
            };
        }

        // Create enterprise application in customer tenant
        context.log('🚀 Creating enterprise app registration in customer tenant...');
        
        try {
            const enterpriseApp = await graphApiService.createEnterpriseApplication({
                tenantId: tenantId,
                clientId: clientId,
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
            await dataService.updateCustomer(customerId, {
                enterpriseAppId: enterpriseApp.id,
                enterpriseAppObjectId: enterpriseApp.objectId,
                consentGranted: true,
                consentGrantedAt: new Date(),
                lastConsentUpdate: new Date()
            });

            context.log('✅ Customer record updated with enterprise app details');

            // Return success response with redirect
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    message: 'Enterprise app registration created successfully',
                    data: {
                        enterpriseAppId: enterpriseApp.id,
                        customerName: customer.tenantName,
                        consentGranted: true
                    },
                    redirectUrl: `/consent-result?status=success&customer=${encodeURIComponent(customer.tenantName)}&appId=${enterpriseApp.id}`
                }
            };

        } catch (enterpriseAppError: any) {
            context.log('❌ Failed to create enterprise app:', enterpriseAppError);
            
            // Update customer with consent granted but enterprise app creation failed
            await dataService.updateCustomer(customerId, {
                consentGranted: true,
                consentGrantedAt: new Date(),
                lastConsentUpdate: new Date(),
                enterpriseAppCreationError: enterpriseAppError.message
            });

            return {
                status: 500,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: 'Failed to create enterprise app registration',
                    details: enterpriseAppError.message,
                    consentGranted: true, // Consent was successful, but app creation failed
                    redirectUrl: `/consent-result?status=partial&message=Consent+granted+but+app+creation+failed&customer=${encodeURIComponent(customer.tenantName)}`
                }
            };
        }

    } catch (error: any) {
        context.log('❌ Consent callback error:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: 'Internal server error during consent processing',
                details: error.message,
                redirectUrl: '/consent-result?status=error&message=Internal+server+error'
            }
        };
    }
}

// Register the function
app.http('consent-callback', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'consent-callback',
    handler: handleConsentCallback
});
