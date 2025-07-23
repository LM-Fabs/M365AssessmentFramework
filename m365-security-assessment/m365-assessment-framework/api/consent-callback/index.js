"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
// Service imports - now enabled for full OAuth functionality
const graphApiService_1 = require("../shared/graphApiService");
const postgresqlService_1 = require("../shared/postgresqlService");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('consent-callback', {
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
 * FULL OAUTH INTEGRATION MODE:
 * Creates app registrations and updates database after successful consent
 */
async function consentCallbackHandler(request, context) {
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
            // Handle OAuth consent redirect - supports both authorization code and admin consent flows
            const url = new URL(request.url);
            const code = url.searchParams.get('code');
            const adminConsent = url.searchParams.get('admin_consent');
            const tenant = url.searchParams.get('tenant');
            const state = url.searchParams.get('state');
            const customerId = url.searchParams.get('customer_id');
            const error = url.searchParams.get('error');
            const errorDescription = url.searchParams.get('error_description');
            // Enhanced logging for debugging OAuth callback
            context.log(`🔗 OAuth consent callback received:`);
            context.log(`  - Full URL: ${request.url}`);
            context.log(`  - Code: ${code ? 'present (' + code.substring(0, 20) + '...)' : 'missing'}`);
            context.log(`  - Admin Consent: ${adminConsent || 'not provided'}`);
            context.log(`  - Tenant: ${tenant || 'not provided'}`);
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
                            customerId,
                            tenant
                        }
                    })
                };
            }
            // Check for successful admin consent OR authorization code OR initial setup request
            const hasAdminConsent = adminConsent && adminConsent.toLowerCase() === 'true';
            const hasAuthCode = code && code.length > 0;
            const isInitialSetupRequest = !hasAdminConsent && !hasAuthCode && (tenant || customerId); // Has customer info but no OAuth response
            if (!hasAdminConsent && !hasAuthCode && !isInitialSetupRequest) {
                context.log(`❌ Neither admin consent, authorization code, nor valid setup request received`);
                return {
                    status: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: 'Authorization missing',
                        message: 'Neither admin consent, authorization code, nor customer setup info was received',
                        debug: {
                            receivedParams: allParams,
                            expectedParams: ['admin_consent=True', 'OR', 'code=...', 'OR', 'tenant/customer_id for setup'],
                            hint: 'Check OAuth flow type and Azure AD app registration configuration',
                            flowType: hasAdminConsent ? 'admin-consent' : (hasAuthCode ? 'auth-code' : (isInitialSetupRequest ? 'initial-setup' : 'unknown'))
                        }
                    })
                };
            }
            try {
                // Parse state parameter if it's JSON-encoded
                let parsedState = null;
                let tenantId = tenant; // Use tenant parameter first
                if (state) {
                    try {
                        // URL decode the state parameter
                        const decodedState = decodeURIComponent(state);
                        parsedState = JSON.parse(decodedState);
                        tenantId = parsedState.customerId || parsedState.customerTenant || tenantId;
                    }
                    catch (stateParseError) {
                        context.log(`⚠️ Could not parse state as JSON, using as plain text: ${state}`);
                        tenantId = state || tenantId;
                    }
                }
                // Fallback to customerId parameter
                tenantId = tenantId || customerId || 'unknown';
                context.log(`✅ Processing consent callback for tenant: ${tenantId}`);
                if (hasAdminConsent) {
                    context.log(`   ✅ Admin consent granted successfully`);
                    context.log(`   Flow type: Admin Consent`);
                }
                else if (hasAuthCode) {
                    context.log(`   ✅ Authorization code received (first 20 chars): ${code.substring(0, 20)}...`);
                    context.log(`   Flow type: Authorization Code`);
                }
                // 🔄 CORRECT WORKFLOW: Check if this is initial setup or consent confirmation
                // 
                // PHASE 1: Initial setup request - create app registration first
                // PHASE 2: Consent confirmation - user granted consent to the new app
                const isInitialSetup = !hasAdminConsent && !hasAuthCode && (tenant || customerId); // Has customer info but no OAuth response
                const isConsentConfirmation = hasAdminConsent || hasAuthCode; // OAuth response received
                context.log(`🔍 Flow detection:`);
                context.log(`   - Initial Setup: ${isInitialSetup}`);
                context.log(`   - Consent Confirmation: ${isConsentConfirmation}`);
                context.log(`   - Has Admin Consent: ${hasAdminConsent}`);
                context.log(`   - Has Auth Code: ${hasAuthCode}`);
                // Initialize services for app registration creation
                context.log(`🚀 PRODUCTION MODE: Processing customer app registration workflow`);
                const graphService = new graphApiService_1.GraphApiService();
                const postgresService = new postgresqlService_1.PostgreSQLService();
                try {
                    // DEBUG: Log all the identifiers we have
                    context.log(`🔍 Looking up customer with these identifiers:`);
                    context.log(`   - tenant parameter: ${tenant}`);
                    context.log(`   - tenantId variable: ${tenantId}`);
                    context.log(`   - customerId parameter: ${customerId}`);
                    // The tenant parameter in consent callback is actually the customer ID (primary key)
                    // Try to get customer by ID first, then by tenant ID if that fails
                    let customer = null;
                    try {
                        // Try by customer ID first (primary key) - this is what we get from the consent URL
                        customer = await postgresService.getCustomer(tenantId);
                        if (customer) {
                            context.log(`✅ Found customer by ID: ${customer.tenantName} (${customer.tenantDomain})`);
                        }
                    }
                    catch (idError) {
                        context.log(`⚠️ Could not find customer by ID: ${idError.message}`);
                    }
                    if (!customer) {
                        try {
                            // Try by tenant ID (the Microsoft tenant identifier)
                            customer = await postgresService.getCustomerByTenantId(tenantId);
                            if (customer) {
                                context.log(`✅ Found customer by tenant ID: ${customer.tenantName} (${customer.tenantDomain})`);
                            }
                        }
                        catch (tenantError) {
                            context.log(`⚠️ Could not find customer by tenant ID: ${tenantError.message}`);
                        }
                    }
                    if (!customer) {
                        context.log(`❌ Customer not found with any identifier: ${tenantId}`);
                        throw new Error(`Customer not found for any identifier: ${tenantId}`);
                    }
                    // PHASE 1: If no app registration exists, create it first and redirect to consent
                    if (!customer.appRegistration?.clientId || !customer.appRegistration?.applicationId) {
                        context.log(`🚀 PHASE 1: Creating new app registration for customer: ${customer.tenantName}`);
                        try {
                            // Create app registration using Graph API
                            const appRegistration = await graphService.createMultiTenantAppRegistration({
                                tenantName: customer.tenantName || 'Unknown',
                                tenantDomain: customer.tenantDomain || 'unknown.onmicrosoft.com',
                                targetTenantId: customer.tenantId,
                                contactEmail: customer.contactEmail,
                                requiredPermissions: [
                                    'Organization.Read.All',
                                    'Directory.Read.All',
                                    'AuditLog.Read.All',
                                    'SecurityEvents.Read.All'
                                ]
                            });
                            context.log(`✅ App registration created successfully:`);
                            context.log(`   - Application ID: ${appRegistration.applicationId}`);
                            context.log(`   - Client ID: ${appRegistration.clientId}`);
                            context.log(`   - Service Principal ID: ${appRegistration.servicePrincipalId}`);
                            // Update customer record with app registration details
                            await postgresService.updateCustomer(customer.id, {
                                appRegistration: {
                                    applicationId: appRegistration.applicationId,
                                    clientId: appRegistration.clientId,
                                    servicePrincipalId: appRegistration.servicePrincipalId,
                                    permissions: [
                                        'Organization.Read.All',
                                        'Directory.Read.All',
                                        'AuditLog.Read.All',
                                        'SecurityEvents.Read.All'
                                    ],
                                    consentUrl: appRegistration.consentUrl,
                                    redirectUri: appRegistration.redirectUri,
                                    isReal: true,
                                    setupStatus: 'awaiting-consent',
                                    createdDate: new Date().toISOString()
                                },
                                status: 'active'
                            });
                            context.log(`✅ Customer record updated with app registration details`);
                            // Now redirect to ADMIN CONSENT URL for the NEWLY CREATED app
                            // Use the dedicated admin consent endpoint, not OAuth2 authorize
                            const baseUrl = process.env.REACT_APP_API_URL ||
                                process.env.API_BASE_URL ||
                                'https://victorious-pond-069956e03.6.azurestaticapps.net';
                            const consentRedirectUri = `${baseUrl}/api/consent-callback`;
                            // ✅ FIX: Use the dedicated admin consent endpoint
                            const newAppConsentUrl = `https://login.microsoftonline.com/common/adminconsent?` +
                                `client_id=${appRegistration.clientId}&` +
                                `redirect_uri=${encodeURIComponent(consentRedirectUri)}&` +
                                `state=${encodeURIComponent(JSON.stringify({ customerId: customer.id, phase: 'consent-confirmation' }))}`;
                            context.log(`🔄 PHASE 1 Complete: Redirecting to ADMIN CONSENT URL for NEW app:`);
                            context.log(`   - New App Client ID: ${appRegistration.clientId}`);
                            context.log(`   - Customer Tenant ID: ${customer.tenantId}`);
                            context.log(`   - Admin Consent URL: ${newAppConsentUrl}`);
                            return {
                                status: 302,
                                headers: {
                                    ...corsHeaders,
                                    'Location': newAppConsentUrl
                                }
                            };
                        }
                        catch (appCreationError) {
                            context.log(`❌ Failed to create app registration:`, appCreationError);
                            // If app registration creation fails, redirect to error page
                            const frontendUrl = process.env.REACT_APP_FRONTEND_URL ||
                                process.env.FRONTEND_URL ||
                                process.env.STATIC_WEB_APP_URL ||
                                'https://victorious-pond-069956e03.6.azurestaticapps.net';
                            const errorRedirect = `${frontendUrl}/admin-consent-error?error=${encodeURIComponent('Failed to create app registration: ' + appCreationError.message)}&customer_id=${customer.id}`;
                            return {
                                status: 302,
                                headers: {
                                    ...corsHeaders,
                                    'Location': errorRedirect
                                }
                            };
                        }
                    }
                    else {
                        // PHASE 2: App registration exists, this should be consent confirmation
                        context.log(`ℹ️ PHASE 2: App registration exists, processing consent confirmation`);
                        context.log(`   - Existing Client ID: ${customer.appRegistration.clientId}`);
                        if (isConsentConfirmation) {
                            // Update customer record to mark consent as completed
                            await postgresService.updateCustomer(customer.id, {
                                appRegistration: {
                                    ...customer.appRegistration,
                                    setupStatus: 'completed',
                                    consentGrantedDate: new Date().toISOString()
                                },
                                lastAssessmentDate: new Date(),
                                status: 'active'
                            });
                            context.log(`✅ PHASE 2 Complete: Consent confirmed and customer record updated`);
                            // Return success page for admin consent confirmation
                            if (hasAdminConsent) {
                                context.log(`✅ Admin consent confirmed for tenant: ${tenant}`);
                                // Determine frontend URL for redirect to success page
                                const frontendUrl = process.env.REACT_APP_FRONTEND_URL ||
                                    process.env.FRONTEND_URL ||
                                    process.env.STATIC_WEB_APP_URL ||
                                    'https://victorious-pond-069956e03.6.azurestaticapps.net';
                                const successRedirect = `${frontendUrl}/admin-consent-success?customer_id=${customer.id}&status=success&consent_type=admin&tenant=${tenant || ''}&timestamp=${Date.now()}`;
                                context.log(`🔄 PHASE 2 Complete: Redirecting to success page: ${successRedirect}`);
                                return {
                                    status: 302,
                                    headers: {
                                        ...corsHeaders,
                                        'Location': successRedirect
                                    }
                                };
                            }
                        }
                        else {
                            context.log(`✅ App registration exists but no consent confirmation received`);
                        }
                    }
                    context.log(`✅ Consent and app registration process completed successfully for ${customer.tenantName}`);
                }
                catch (serviceError) {
                    context.log(`❌ Error during app registration workflow:`, serviceError);
                    throw serviceError; // Re-throw to be handled by outer catch block
                }
                context.log(`✅ Consent successfully processed for customer ${tenantId}`);
                // Determine frontend URL - try multiple environment variables
                const frontendUrl = process.env.REACT_APP_FRONTEND_URL ||
                    process.env.FRONTEND_URL ||
                    process.env.STATIC_WEB_APP_URL ||
                    'https://victorious-pond-069956e03.6.azurestaticapps.net';
                const successRedirect = `${frontendUrl}/admin-consent-success?customer_id=${tenantId}&status=success&consent_type=${hasAdminConsent ? 'admin' : 'auth_code'}&tenant=${tenant || ''}&timestamp=${Date.now()}`;
                context.log(`🔄 Redirecting to: ${successRedirect}`);
                return {
                    status: 302,
                    headers: {
                        ...corsHeaders,
                        'Location': successRedirect
                    }
                };
            }
            catch (appError) {
                context.log('❌ Error processing consent callback:', appError);
                // Parse tenant ID from available sources
                let tenantId = tenant;
                if (state) {
                    try {
                        const decodedState = decodeURIComponent(state);
                        const parsedState = JSON.parse(decodedState);
                        tenantId = parsedState.customerId || parsedState.customerTenant || tenantId;
                    }
                    catch {
                        tenantId = state || tenantId;
                    }
                }
                tenantId = tenantId || customerId || 'unknown';
                const frontendUrl = process.env.REACT_APP_FRONTEND_URL ||
                    process.env.FRONTEND_URL ||
                    process.env.STATIC_WEB_APP_URL ||
                    'https://victorious-pond-069956e03.6.azurestaticapps.net';
                const errorRedirect = `${frontendUrl}/admin-consent-error?error=${encodeURIComponent(appError.message)}&tenant_id=${tenantId}`;
                return {
                    status: 302,
                    headers: {
                        ...corsHeaders,
                        'Location': errorRedirect
                    }
                };
            }
        }
        else if (request.method === 'POST') {
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
            }
            catch (parseError) {
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
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map