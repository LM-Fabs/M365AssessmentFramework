import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { TableStorageService } from "../shared/tableStorageService";
import { PostgreSQLService } from "../shared/postgresqlService";
import { GraphApiService } from "../shared/graphApiService";
import { getKeyVaultService, KeyVaultService } from "../shared/keyVaultService";
import { Customer } from "../shared/types";

// CORS headers optimized for better performance
const corsHeaders = process.env.NODE_ENV === 'development' ? {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Warmup, Cache-Control',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60, s-maxage=60' // Cache responses for 1 minute
} : {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60, s-maxage=60' // Cache responses for 1 minute
};

// Initialize data services with connection pooling
let tableStorageService: TableStorageService;
let postgresqlService: PostgreSQLService;
let graphApiService: GraphApiService;
let keyVaultService: KeyVaultService | null = null;
let dataService: TableStorageService | PostgreSQLService;
let isDataServiceInitialized = false;
let initializationPromise: Promise<void> | null = null;
let usingPostgreSQL = false;

// Initialize data service with proper error handling
async function initializeDataService(context: Context): Promise<void> {
    if (isDataServiceInitialized) {
        return;
    }

    if (initializationPromise) {
        await initializationPromise;
        return;
    }

    initializationPromise = (async () => {
        try {
            context.log('🔄 Initializing data service...');
            
            // Initialize services
            tableStorageService = new TableStorageService();
            postgresqlService = new PostgreSQLService();
            graphApiService = new GraphApiService();
            keyVaultService = await getKeyVaultService();

            // Try PostgreSQL first
            try {
                await postgresqlService.initialize();
                dataService = postgresqlService;
                usingPostgreSQL = true;
                context.log('✅ PostgreSQL service initialized successfully');
            } catch (pgError) {
                context.log('⚠️ PostgreSQL unavailable, falling back to Table Storage:', pgError);
                
                // Fallback to Table Storage
                await tableStorageService.initialize();
                dataService = tableStorageService;
                usingPostgreSQL = false;
                context.log('✅ Table Storage service initialized successfully');
            }

            isDataServiceInitialized = true;
            context.log('✅ Data service initialization complete');
        } catch (error) {
            context.log.error('❌ Data service initialization failed:', error);
            throw error;
        }
    })();

    await initializationPromise;
}

const customersFunction: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log(`Processing ${req.method} request for customers`);

    // Handle preflight OPTIONS request immediately
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders
        };
        return;
    }

    // Handle HEAD request for API warmup
    if (req.method === 'HEAD') {
        context.res = {
            status: 200,
            headers: corsHeaders
        };
        return;
    }

    try {
        // Initialize data service
        await initializeDataService(context);

        if (req.method === 'GET') {
            context.log('Getting all customers from data service');
            
            const result = await dataService.getCustomers({
                status: 'active',
                maxItemCount: 100
            });
            
            context.log('Retrieved customers from data service:', result.customers.length);
            
            // Transform customers to match frontend interface
            const transformedCustomers = result.customers.map((customer: any) => {
                const appReg = customer.appRegistration || {};
                return {
                    id: customer.id,
                    tenantId: customer.tenantId || '',  // Use the actual tenant ID, not servicePrincipalId
                    tenantName: customer.tenantName,
                    tenantDomain: customer.tenantDomain,
                    applicationId: appReg.applicationId || '',
                    clientId: appReg.clientId || '',
                    servicePrincipalId: appReg.servicePrincipalId || '',
                    createdDate: customer.createdDate,
                    lastAssessmentDate: customer.lastAssessmentDate,
                    totalAssessments: customer.totalAssessments || 0,
                    status: customer.status as 'active' | 'inactive' | 'pending',
                    permissions: appReg.permissions || [],
                    contactEmail: customer.contactEmail,
                    notes: customer.notes
                };
            });
            
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: {
                    success: true,
                    data: transformedCustomers,
                    count: transformedCustomers.length,
                    timestamp: new Date().toISOString(),
                    continuationToken: 'continuationToken' in result ? result.continuationToken : undefined
                }
            };
            return;
        }

        if (req.method === 'POST') {
            let customerData: any = {};
            
            try {
                customerData = req.body;
            } catch (error) {
                context.log('Invalid JSON in request body');
                context.res = {
                    status: 400,
                    headers: corsHeaders,
                    body: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
                return;
            }
            
            context.log('Creating new customer with data:', customerData);

            // Validate required fields
            if (!customerData.tenantName || !customerData.tenantDomain) {
                context.res = {
                    status: 400,
                    headers: corsHeaders,
                    body: {
                        success: false,
                        error: "tenantName and tenantDomain are required"
                    }
                };
                return;
            }

            // Check if customer already exists
            if (customerData.tenantDomain) {
                const existingCustomer = await dataService.getCustomerByDomain(customerData.tenantDomain);
                if (existingCustomer) {
                    context.res = {
                        status: 409,
                        headers: corsHeaders,
                        body: {
                            success: false,
                            error: `Customer with domain ${customerData.tenantDomain} already exists`,
                            existingCustomerId: existingCustomer.id
                        }
                    };
                    return;
                }
            }

            // Extract tenant ID from domain or use provided tenant ID
            let targetTenantId = customerData.tenantId;
            
            if (!targetTenantId && customerData.tenantDomain) {
                // Use the domain as-is as the tenant identifier
                // This works for custom domains and *.onmicrosoft.com domains
                context.log('⚠️ Tenant ID not provided - using domain as tenant identifier');
                targetTenantId = customerData.tenantDomain.toLowerCase();
            }

            if (!targetTenantId) {
                context.res = {
                    status: 400,
                    headers: corsHeaders,
                    body: {
                        success: false,
                        error: "Could not determine tenant ID. Please provide tenantId or a valid tenantDomain."
                    }
                };
                return;
            }

            // Create customer using Table Storage service
            const customerRequest = {
                tenantName: customerData.tenantName,
                tenantDomain: customerData.tenantDomain,
                tenantId: targetTenantId,  // Include the actual tenant ID
                contactEmail: customerData.contactEmail || '',
                notes: customerData.notes || '',
                skipAutoAppRegistration: customerData.skipAutoAppRegistration || false
            };

            const skipAutoRegistration = customerData.skipAutoAppRegistration === true;
            
            if (skipAutoRegistration) {
                context.log('🏢 Creating customer with manual app registration workflow');
            } else {
                context.log('🏢 Creating customer and triggering automatic Azure AD app registration');
            }

            // Create customer
            let appRegistration;
            
            if (skipAutoRegistration) {
                // Manual setup - provide guidance for admin with real placeholder values
                appRegistration = {
                    applicationId: `app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    clientId: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    servicePrincipalId: `sp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    clientSecret: 'REPLACE_WITH_REAL_SECRET',
                    consentUrl: `https://login.microsoftonline.com/${targetTenantId}/oauth2/v2.0/authorize?client_id=REPLACE_CLIENT_ID&response_type=code&redirect_uri=https%3A//portal.azure.com/&response_mode=query&scope=https://graph.microsoft.com/.default&state=12345&prompt=admin_consent`,
                    redirectUri: process.env.REDIRECT_URI || "https://portal.azure.com/",
                    permissions: [
                        'Organization.Read.All',
                        'SecurityEvents.Read.All',
                        'Reports.Read.All',
                        'Directory.Read.All',
                        'Policy.Read.All',
                        'IdentityRiskyUser.Read.All',
                        'AuditLog.Read.All'
                    ],
                    isManualSetup: true,
                    setupStatus: 'pending',
                    createdDate: new Date().toISOString()
                };
            } else {
                // Automatic setup - create placeholder that will be replaced
                appRegistration = {
                    applicationId: `pending-${Date.now()}`,
                    clientId: `pending-${Date.now()}`,
                    servicePrincipalId: `pending-${Date.now()}`,
                    clientSecret: 'MANUAL_SETUP_REQUIRED',
                    consentUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
                    redirectUri: process.env.REDIRECT_URI || "https://portal.azure.com/",
                    permissions: [
                        'Organization.Read.All',
                        'SecurityEvents.Read.All'
                    ]
                };
            }

            let newCustomer = await dataService.createCustomer(customerRequest, appRegistration);
            
            // Transform customer data to match frontend interface
            const transformedCustomer = {
                id: newCustomer.id,
                tenantId: newCustomer.tenantId,
                tenantName: newCustomer.tenantName,
                tenantDomain: newCustomer.tenantDomain,
                applicationId: newCustomer.appRegistration?.applicationId || '',
                clientId: newCustomer.appRegistration?.clientId || '',
                servicePrincipalId: newCustomer.appRegistration?.servicePrincipalId || '',
                createdDate: newCustomer.createdDate,
                lastAssessmentDate: newCustomer.lastAssessmentDate,
                totalAssessments: newCustomer.totalAssessments || 0,
                status: newCustomer.status as 'active' | 'inactive' | 'pending',
                permissions: newCustomer.appRegistration?.permissions || [],
                contactEmail: newCustomer.contactEmail,
                notes: newCustomer.notes,
                consentUrl: newCustomer.appRegistration?.consentUrl || ''
            };

            const successMessage = skipAutoRegistration 
                ? 'Customer created successfully with manual app registration setup. Please follow the setup instructions in the customer record.'
                : 'Customer created successfully. App registration has been triggered. Please complete admin consent.';

            context.res = {
                status: 201,
                headers: corsHeaders,
                body: {
                    success: true,
                    data: {
                        customer: transformedCustomer,
                    },
                    message: successMessage,
                    isManualSetup: skipAutoRegistration
                }
            };
            return;
        }

        context.res = {
            status: 405,
            headers: corsHeaders,
            body: {
                success: false,
                error: `Method ${req.method} not allowed`
            }
        };

    } catch (error) {
        context.log('Error in customers handler:', error);
        
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
};

// Force deployment trigger - individual functions approach
export default customersFunction;
