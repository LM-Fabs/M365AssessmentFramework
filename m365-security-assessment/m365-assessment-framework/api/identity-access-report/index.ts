import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";
import { MultiTenantGraphService } from "../shared/multiTenantGraphService";

// Azure Functions v4 - Identity & Access Report endpoint  
app.http('identity-access-report', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}/identity-access-report',
    handler: identityAccessReportHandler
});

async function identityAccessReportHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🔐 Identity & Access Report API called');

    try {
        // Initialize data service (PostgreSQL)
        await initializeDataService(context);

        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        const customerId = request.params.customerId;
        context.log(`🎯 Customer ID: ${customerId}`);

        if (!customerId) {
            return {
                status: 400,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    success: false,
                    error: 'Bad request',
                    message: 'Customer ID is required' 
                })
            };
        }

        if (request.method === 'GET') {
            return await generateIdentityAccessReport(customerId, context);
        }

        return {
            status: 405,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: false,
                error: 'Method not allowed',
                message: 'Only GET requests are supported for this endpoint' 
            })
        };

    } catch (error: any) {
        context.log('❌ Identity & Access Report API error:', error);
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: error.message || 'An unexpected error occurred'
            })
        };
    }
}

async function generateIdentityAccessReport(customerId: string, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        context.log('🔍 Generating Identity & Access Report for customer:', customerId);

        // Get customer information from database
        const customer = await dataService.getCustomer(customerId);
        if (!customer) {
            return {
                status: 404,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    success: false,
                    error: 'Customer not found',
                    message: `Customer with ID ${customerId} was not found`
                })
            };
        }

        if (!customer.tenantId) {
            return {
                status: 400,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    success: false,
                    error: 'Missing tenant ID',
                    message: 'Customer does not have a valid tenant ID configured'
                })
            };
        }

        // Initialize Microsoft Graph service for customer tenant
        const graphService = new MultiTenantGraphService(customer.tenantId);
        
        context.log('🚀 Fetching identity & access data from Microsoft Graph API...');

        // Fetch all required data in parallel
        const [
            organization,
            userRegistrationDetails,
            authMethodPolicies,
            privilegedUsers
        ] = await Promise.all([
            fetchOrganizationInfo(graphService, context),
            fetchUserRegistrationDetails(graphService, context),
            fetchAuthenticationMethodPolicies(graphService, context),
            fetchPrivilegedUsers(graphService, context)
        ]);

        const report = {
            success: true,
            data: {
                organization,
                userRegistrationDetails,
                authMethodPolicies,
                privilegedUsers,
                generatedAt: new Date().toISOString(),
                customerId,
                tenantId: customer.tenantId
            }
        };

        context.log('✅ Identity & Access Report generated successfully');
        context.log(`📊 Users: ${userRegistrationDetails.length}, Policies: ${authMethodPolicies.length}, Privileged: ${privilegedUsers.length}`);

        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify(report)
        };

    } catch (error: any) {
        context.log('❌ Error generating Identity & Access Report:', error);
        
        // Handle specific Graph API errors
        if (error.message?.includes('App not found in customer tenant')) {
            return {
                status: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Customer consent required',
                    message: 'Customer admin needs to consent to the application first',
                    troubleshooting: [
                        'Customer admin must grant admin consent',
                        'Ensure the multi-tenant app is properly configured',
                        'Check that required permissions are granted'
                    ]
                })
            };
        }

        if (error.message?.includes('Authentication failed')) {
            return {
                status: 401,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    error: 'Authentication failed',
                    message: 'Failed to authenticate with customer tenant',
                    troubleshooting: [
                        'Verify app registration credentials',
                        'Check customer tenant admin consent',
                        'Review required API permissions'
                    ]
                })
            };
        }

        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Report generation failed',
                message: error.message || 'An unexpected error occurred',
                troubleshooting: [
                    'Check customer tenant configuration',
                    'Verify required permissions are granted',
                    'Review app registration settings'
                ]
            })
        };
    }
}

async function fetchOrganizationInfo(graphService: MultiTenantGraphService, context: InvocationContext): Promise<any> {
    try {
        context.log('🏢 Fetching organization information...');
        const org = await graphService.getOrganization();
        return {
            displayName: org?.displayName || 'Organization',
            id: org?.id || '',
            tenantType: org?.tenantType || 'unknown'
        };
    } catch (error: any) {
        context.log('⚠️ Error fetching organization info:', error.message);
        return {
            displayName: 'Organization',
            id: '',
            tenantType: 'unknown',
            error: error.message
        };
    }
}

async function fetchUserRegistrationDetails(graphService: MultiTenantGraphService, context: InvocationContext): Promise<any[]> {
    try {
        context.log('👥 Fetching user registration details...');
        
        // Get user registration details from Microsoft Graph
        const userRegistrations = await graphService.getUserRegistrationDetails();
        
        context.log(`✅ Retrieved ${userRegistrations.length} user registration records`);
        return userRegistrations;
        
    } catch (error: any) {
        context.log('⚠️ Error fetching user registration details:', error.message);
        return [];
    }
}

async function fetchAuthenticationMethodPolicies(graphService: MultiTenantGraphService, context: InvocationContext): Promise<any[]> {
    try {
        context.log('🔐 Fetching authentication method policies...');
        
        const policies = await graphService.getAuthenticationMethodPolicies();
        
        context.log(`✅ Retrieved ${policies.length} authentication method policies`);
        return policies;
        
    } catch (error: any) {
        context.log('⚠️ Error fetching authentication method policies:', error.message);
        return [];
    }
}

async function fetchPrivilegedUsers(graphService: MultiTenantGraphService, context: InvocationContext): Promise<string[]> {
    try {
        context.log('👑 Fetching privileged users...');
        
        const privilegedUsers = await graphService.getPrivilegedUsers();
        
        context.log(`✅ Retrieved ${privilegedUsers.length} privileged users`);
        return privilegedUsers;
        
    } catch (error: any) {
        context.log('⚠️ Error fetching privileged users:', error.message);
        return [];
    }
}
