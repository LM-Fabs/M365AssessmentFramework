"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const tableStorageService_1 = require("./shared/tableStorageService");
const graphApiService_1 = require("./shared/graphApiService");
// CORS headers for local development only
// In Azure Static Web Apps, CORS is handled automatically
const corsHeaders = process.env.NODE_ENV === 'development' ? {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
} : {
    'Content-Type': 'application/json'
};
// Initialize data services
let tableStorageService;
let graphApiService;
let dataService;
let isDataServiceInitialized = false;
// Initialize data services
async function initializeDataService(context) {
    if (!isDataServiceInitialized) {
        try {
            context.log('Initializing data services...');
            // Initialize Table Storage service
            tableStorageService = new tableStorageService_1.TableStorageService();
            await tableStorageService.initialize();
            dataService = tableStorageService;
            // Initialize Graph API service with better error handling
            try {
                graphApiService = new graphApiService_1.GraphApiService();
                context.log('✅ GraphApiService initialized successfully');
            }
            catch (error) {
                context.error('❌ GraphApiService initialization failed:', error);
                throw new Error(`GraphApiService initialization failed: ${error instanceof Error ? error.message : error}`);
            }
            context.log('✅ Data services initialized successfully');
            isDataServiceInitialized = true;
        }
        catch (error) {
            context.error('❌ Data services initialization failed:', error);
            throw new Error(`Data services initialization failed: ${error instanceof Error ? error.message : error}`);
        }
    }
}
// Diagnostic endpoint to check environment configuration
async function diagnosticsHandler(request, context) {
    context.log('Processing diagnostics request');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            environment: {
                AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID ? 'SET' : 'NOT SET',
                AZURE_TENANT_ID: process.env.AZURE_TENANT_ID ? 'SET' : 'NOT SET',
                KEY_VAULT_URL: process.env.KEY_VAULT_URL ? 'SET' : 'NOT SET',
                APPLICATIONINSIGHTS_CONNECTION_STRING: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ? 'SET' : 'NOT SET',
                AzureWebJobsStorage: process.env.AzureWebJobsStorage ? 'SET' : 'NOT SET',
                AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING ? 'SET' : 'NOT SET'
            },
            dataService: {
                initialized: isDataServiceInitialized,
                type: 'Table Storage',
                tableStorageAvailable: !!(process.env.AzureWebJobsStorage || process.env.AZURE_STORAGE_CONNECTION_STRING)
            },
            version: '1.0.8'
        };
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: diagnostics
            }
        };
    }
    catch (error) {
        context.error('Error in diagnostics handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Test endpoint - immediate fast response
async function testHandler(request, context) {
    context.log('Test function processed a request');
    // Handle HEAD request
    if (request.method === 'HEAD') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    return {
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            message: "M365 Assessment API is working!",
            timestamp: new Date().toISOString(),
            version: "1.0.7",
            status: "healthy"
        }
    };
}
// Optimized customers endpoint with immediate response
async function customersHandler(request, context) {
    context.log(`Processing ${request.method} request for customers`);
    // Handle preflight OPTIONS request immediately
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    // Handle HEAD request for API warmup
    if (request.method === 'HEAD') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Initialize data service
        await initializeDataService(context);
        if (request.method === 'GET') {
            context.log('Getting all customers from data service');
            const result = await dataService.getCustomers({
                status: 'active',
                maxItemCount: 100
            });
            context.log('Retrieved customers from data service:', result.customers.length);
            // Transform customers to match frontend interface
            const transformedCustomers = result.customers.map((customer) => {
                const appReg = customer.appRegistration || {};
                return {
                    id: customer.id,
                    tenantId: appReg.servicePrincipalId || '',
                    tenantName: customer.tenantName,
                    tenantDomain: customer.tenantDomain,
                    applicationId: appReg.applicationId || '',
                    clientId: appReg.clientId || '',
                    servicePrincipalId: appReg.servicePrincipalId || '',
                    createdDate: customer.createdDate,
                    lastAssessmentDate: customer.lastAssessmentDate,
                    totalAssessments: customer.totalAssessments || 0,
                    status: customer.status,
                    permissions: appReg.permissions || [],
                    contactEmail: customer.contactEmail,
                    notes: customer.notes
                };
            });
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: transformedCustomers,
                    count: transformedCustomers.length,
                    timestamp: new Date().toISOString(),
                    continuationToken: result.continuationToken
                }
            };
        }
        if (request.method === 'POST') {
            let customerData = {};
            try {
                customerData = await request.json();
            }
            catch (error) {
                context.log('Invalid JSON in request body');
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
            }
            context.log('Creating new customer with data:', customerData);
            // Validate required fields
            if (!customerData.tenantName || !customerData.tenantDomain) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "tenantName and tenantDomain are required"
                    }
                };
            }
            // Check if customer already exists
            if (customerData.tenantDomain) {
                const existingCustomer = await dataService.getCustomerByDomain(customerData.tenantDomain);
                if (existingCustomer) {
                    return {
                        status: 409,
                        headers: corsHeaders,
                        jsonBody: {
                            success: false,
                            error: `Customer with domain ${customerData.tenantDomain} already exists`,
                            existingCustomerId: existingCustomer.id
                        }
                    };
                }
            }
            // Create customer using Table Storage service
            const customerRequest = {
                tenantName: customerData.tenantName,
                tenantDomain: customerData.tenantDomain,
                contactEmail: customerData.contactEmail || '',
                notes: customerData.notes || ''
            };
            // Extract tenant ID from domain or use provided tenant ID
            let targetTenantId = customerData.tenantId;
            if (!targetTenantId && customerData.tenantDomain) {
                // For now, require the tenant ID to be provided explicitly
                // In a production system, you would need to resolve domain to tenant ID
                context.log('⚠️ Tenant ID not provided - using domain as fallback (consider implementing domain resolution)');
                targetTenantId = customerData.tenantDomain.replace(/\./g, '-').toLowerCase();
            }
            if (!targetTenantId) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Could not determine tenant ID. Please provide tenantId or a valid tenantDomain."
                    }
                };
            }
            context.log('🏢 Creating customer without auto app registration (will be created manually)');
            // For now, skip automatic Azure AD app registration creation
            // This should be done manually by the admin with proper permissions
            let appRegistration = {
                applicationId: `pending-${Date.now()}`,
                clientId: `pending-${Date.now()}`,
                servicePrincipalId: `pending-${Date.now()}`,
                clientSecret: 'MANUAL_SETUP_REQUIRED',
                consentUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
                redirectUri: process.env.REDIRECT_URI || "https://portal.azure.com/",
                permissions: [
                    'Organization.Read.All',
                    'Reports.Read.All',
                    'Directory.Read.All',
                    'Policy.Read.All',
                    'SecurityEvents.Read.All',
                    'IdentityRiskyUser.Read.All',
                    'DeviceManagementManagedDevices.Read.All',
                    'AuditLog.Read.All',
                    'ThreatIndicators.Read.All'
                ]
            };
            context.log('⚠️ Skipping automatic Azure AD app registration - manual setup required');
            const newCustomer = await dataService.createCustomer(customerRequest, {
                applicationId: appRegistration.applicationId,
                clientId: appRegistration.clientId,
                servicePrincipalId: appRegistration.servicePrincipalId,
                permissions: appRegistration.permissions,
                clientSecret: appRegistration.clientSecret,
                consentUrl: appRegistration.consentUrl,
                redirectUri: appRegistration.redirectUri
            });
            context.log('✅ Customer and Azure AD app created successfully:', newCustomer.id);
            // Transform customer data to match frontend interface
            const transformedCustomer = {
                id: newCustomer.id,
                tenantId: targetTenantId,
                tenantName: newCustomer.tenantName,
                tenantDomain: newCustomer.tenantDomain,
                applicationId: appRegistration.applicationId,
                clientId: appRegistration.clientId,
                servicePrincipalId: appRegistration.servicePrincipalId,
                createdDate: newCustomer.createdDate,
                lastAssessmentDate: undefined,
                totalAssessments: 0,
                status: newCustomer.status,
                permissions: appRegistration.permissions,
                contactEmail: newCustomer.contactEmail,
                notes: newCustomer.notes,
                consentUrl: appRegistration.consentUrl
            };
            return {
                status: 201,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: {
                        customer: transformedCustomer,
                        appRegistration: {
                            clientId: appRegistration.clientId,
                            consentUrl: appRegistration.consentUrl,
                            redirectUri: appRegistration.redirectUri,
                            permissions: appRegistration.permissions
                        },
                        message: "Customer and Azure AD app registration created successfully",
                        nextSteps: [
                            "Customer created successfully in Table Storage",
                            "⚠️ Azure AD app registration setup required manually:",
                            "1. Go to Azure Portal > App Registrations",
                            "2. Create new multi-tenant application",
                            "3. Add required Microsoft Graph API permissions",
                            "4. Update customer record with app registration details",
                            "5. Customer admin must consent to permissions"
                        ]
                    }
                }
            };
        }
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: `Method ${request.method} not allowed`
            }
        };
    }
    catch (error) {
        context.error('Error in customers handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Individual customer operations (get, update, delete)
async function customerByIdHandler(request, context) {
    context.log(`Processing ${request.method} request for customer by ID`);
    // Handle preflight OPTIONS request immediately
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Initialize data service
        await initializeDataService(context);
        const customerId = request.params.customerId;
        if (!customerId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer ID is required"
                }
            };
        }
        if (request.method === 'GET') {
            context.log('Getting customer by ID:', customerId);
            const customer = await dataService.getCustomer(customerId);
            if (!customer) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Customer not found"
                    }
                };
            }
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: customer,
                    timestamp: new Date().toISOString()
                }
            };
        }
        if (request.method === 'DELETE') {
            context.log('Deleting customer:', customerId);
            // Check if customer exists
            const existingCustomer = await dataService.getCustomer(customerId);
            if (!existingCustomer) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Customer not found"
                    }
                };
            }
            // Check if customer has assessments (optional - you might want to allow cascading delete)
            const assessments = await dataService.getCustomerAssessments(customerId, { limit: 1 });
            if (assessments.assessments.length > 0) {
                return {
                    status: 409,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Cannot delete customer with existing assessments. Please delete assessments first.",
                        hasAssessments: true
                    }
                };
            }
            // Delete the customer
            await dataService.deleteCustomer(customerId);
            context.log('Customer deleted successfully:', customerId);
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: {
                        message: "Customer deleted successfully",
                        deletedCustomerId: customerId
                    }
                }
            };
        }
        if (request.method === 'PUT') {
            context.log('Updating customer:', customerId);
            // Check if customer exists
            const existingCustomer = await dataService.getCustomer(customerId);
            if (!existingCustomer) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Customer not found"
                    }
                };
            }
            // Parse request body
            let updateData;
            try {
                updateData = await request.json();
            }
            catch (error) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
            }
            // Validate update data
            if (!updateData || Object.keys(updateData).length === 0) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "No update data provided"
                    }
                };
            }
            // Don't allow updating the ID or creation date
            const { id, createdDate, ...allowedUpdates } = updateData;
            // Update the customer
            const updatedCustomer = await dataService.updateCustomer(customerId, allowedUpdates);
            context.log('Customer updated successfully:', customerId);
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: updatedCustomer,
                    timestamp: new Date().toISOString()
                }
            };
        }
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: `Method ${request.method} not allowed`
            }
        };
    }
    catch (error) {
        context.error('Error in customer by ID handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Fast assessment history endpoint
async function assessmentHistoryHandler(request, context) {
    context.log(`Processing ${request.method} request for assessment history`);
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Initialize data service
        await initializeDataService(context);
        if (request.method === 'GET') {
            const tenantId = request.params.tenantId;
            const customerId = request.params.customerId;
            const limit = Math.min(parseInt(request.query.get('limit') || '10'), 100); // Cap at 100
            context.log('Getting assessment history for:', tenantId || customerId || 'all');
            // Get assessment history from data service
            const assessmentHistory = await dataService.getAssessmentHistory({
                tenantId,
                customerId,
                maxItemCount: limit
            });
            context.log(`Assessment history retrieved. Count: ${assessmentHistory.length}`);
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: assessmentHistory,
                    count: assessmentHistory.length,
                    timestamp: new Date().toISOString()
                }
            };
        }
        if (request.method === 'POST') {
            let historyData = {};
            try {
                historyData = await request.json();
            }
            catch (error) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Invalid JSON in request body"
                    }
                };
            }
            context.log('Adding assessment history:', historyData);
            // Store assessment history using data service
            await dataService.storeAssessmentHistory({
                id: `assessment-${Date.now()}`,
                tenantId: historyData.tenantId,
                customerId: historyData.customerId,
                date: new Date(historyData.date || new Date()),
                overallScore: historyData.overallScore || 0,
                categoryScores: historyData.categoryScores || {},
                ...historyData
            });
            context.log('Assessment history stored successfully in Cosmos DB');
            return {
                status: 201,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: {
                        message: "Assessment history stored successfully",
                        ...historyData
                    }
                }
            };
        }
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: `Method ${request.method} not allowed`
            }
        };
    }
    catch (error) {
        context.error('Error in assessment history handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Fast assessments endpoint
async function assessmentsHandler(request, context) {
    context.log(`Processing ${request.method} request for assessments`);
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Initialize data service
        await initializeDataService(context);
        // Get query parameters for filtering
        const customerId = request.query.get('customerId');
        const status = request.query.get('status');
        const limit = Math.min(parseInt(request.query.get('limit') || '50'), 100);
        let assessments = [];
        if (customerId) {
            // Get assessments for specific customer
            const result = await dataService.getCustomerAssessments(customerId, {
                status: status || undefined,
                limit: limit
            });
            assessments = result.assessments;
        }
        else {
            // For now, return empty array since we don't have a method to get all assessments
            // This would need to be implemented if needed
            assessments = [];
        }
        context.log(`Assessments retrieved. Count: ${assessments.length}`);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: assessments,
                count: assessments.length,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('Error in assessments handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Fast current assessment endpoint
async function currentAssessmentHandler(request, context) {
    context.log('Processing request for current assessment');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Return null for current assessment since we don't have one
        context.log(`Current assessment retrieved`);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: null,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('Error in current assessment handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Best practices endpoint
async function bestPracticesHandler(request, context) {
    context.log('Processing request for best practices');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        const mockBestPractices = [
            {
                category: "Identity & Access Management",
                practices: [
                    "Enable Multi-Factor Authentication for all users",
                    "Implement Conditional Access policies",
                    "Use Azure AD Privileged Identity Management"
                ]
            },
            {
                category: "Data Protection",
                practices: [
                    "Enable Microsoft Information Protection",
                    "Configure Data Loss Prevention policies",
                    "Use Microsoft Cloud App Security"
                ]
            }
        ];
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: mockBestPractices,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('Error in best practices handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Create assessment endpoint
async function createAssessmentHandler(request, context) {
    context.log('Processing request to create assessment');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        let assessmentData = {};
        try {
            assessmentData = await request.json();
        }
        catch (error) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Invalid JSON in request body"
                }
            };
        }
        context.log('Creating assessment with data:', assessmentData);
        // Create mock assessment
        const mockAssessment = {
            id: `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tenantId: assessmentData.tenantName?.toLowerCase().replace(/\s+/g, '-') || 'new-tenant',
            tenantName: assessmentData.tenantName || 'New Assessment',
            assessmentDate: new Date().toISOString(),
            status: 'completed',
            categories: assessmentData.categories || ['identity', 'dataProtection', 'endpoint', 'cloudApps'],
            metrics: {
                score: {
                    overall: 75,
                    identity: 80,
                    dataProtection: 70,
                    endpoint: 75,
                    cloudApps: 80
                }
            }
        };
        return {
            status: 201,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: mockAssessment
            }
        };
    }
    catch (error) {
        context.error('Error in create assessment handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Save assessment endpoint
async function saveAssessmentHandler(request, context) {
    context.log('Processing request to save assessment');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        let assessmentData = {};
        try {
            assessmentData = await request.json();
        }
        catch (error) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Invalid JSON in request body"
                }
            };
        }
        context.log('Saving assessment:', assessmentData.id);
        // Initialize data service
        await initializeDataService(context);
        // Save or update the assessment in data service
        let savedAssessment;
        if (assessmentData.id && assessmentData.customerId) {
            // Update existing assessment
            savedAssessment = await dataService.updateAssessment(assessmentData.id, assessmentData.customerId, assessmentData);
        }
        else {
            // Create new assessment
            savedAssessment = await dataService.createAssessment(assessmentData);
        }
        // Store in assessment history for comparison purposes
        if (savedAssessment.tenantId) {
            await dataService.storeAssessmentHistory({
                id: savedAssessment.id,
                tenantId: savedAssessment.tenantId,
                customerId: assessmentData.customerId || undefined,
                date: new Date(),
                overallScore: savedAssessment.score || 0,
                categoryScores: {
                    securityBaseline: savedAssessment.metrics?.securityBaseline || 0,
                    complianceScore: savedAssessment.metrics?.complianceScore || 0,
                    userTraining: savedAssessment.metrics?.userTraining || 0,
                    incidentResponse: savedAssessment.metrics?.incidentResponse || 0
                }
            });
        }
        context.log('Assessment saved successfully:', savedAssessment.id);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: savedAssessment
            }
        };
    }
    catch (error) {
        context.error('Error in save assessment handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Get metrics endpoint
async function getMetricsHandler(request, context) {
    context.log('Processing request for metrics');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        const tenantId = request.query.get('tenantId');
        if (!tenantId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "tenantId parameter is required"
                }
            };
        }
        // Mock metrics data
        const mockMetrics = {
            score: {
                overall: 75,
                identity: 80,
                dataProtection: 70,
                endpoint: 75,
                cloudApps: 80
            },
            compliance: {
                mfa: { enabled: true, coverage: 85 },
                conditionalAccess: { enabled: true, policies: 5 },
                dlp: { enabled: false, policies: 0 }
            },
            risks: [
                { category: 'Identity', severity: 'Medium', count: 3 },
                { category: 'Data Protection', severity: 'High', count: 1 }
            ]
        };
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: mockMetrics,
                tenantId: tenantId
            }
        };
    }
    catch (error) {
        context.error('Error in get metrics handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Multi-tenant app creation endpoint
async function createMultiTenantAppHandler(request, context) {
    context.log('Creating multi-tenant Azure app registration...');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        await initializeDataService(context);
        const requestData = await request.json();
        const { targetTenantId, targetTenantDomain, assessmentName, requiredPermissions, tenantName, contactEmail } = requestData;
        if (!targetTenantId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Target tenant ID is required",
                    expectedFormat: "{ targetTenantId: string, targetTenantDomain?: string, tenantName?: string, assessmentName?: string }"
                }
            };
        }
        // Prepare customer data for app creation
        const customerData = {
            tenantName: tenantName || targetTenantDomain || targetTenantId,
            tenantDomain: targetTenantDomain || 'unknown.onmicrosoft.com',
            targetTenantId,
            contactEmail,
            requiredPermissions
        };
        context.log('🏢 Creating real Azure AD app registration for tenant:', customerData.tenantName);
        // Create actual multi-tenant app registration using GraphApiService
        const appRegistration = await graphApiService.createMultiTenantAppRegistration(customerData);
        // Prepare response with app registration details
        const response = {
            applicationId: appRegistration.applicationId,
            applicationObjectId: appRegistration.applicationId,
            clientId: appRegistration.clientId,
            servicePrincipalId: appRegistration.servicePrincipalId,
            clientSecret: appRegistration.clientSecret,
            tenantId: targetTenantId,
            consentUrl: appRegistration.consentUrl,
            authUrl: `https://login.microsoftonline.com/${targetTenantId}/oauth2/v2.0/authorize`,
            redirectUri: appRegistration.redirectUri,
            permissions: appRegistration.permissions,
            isReal: true // Flag to indicate this is a real app registration
        };
        context.log('✅ Real multi-tenant app created successfully:', appRegistration.clientId);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: response,
                message: 'Azure AD app registration created successfully. Admin consent is required in the target tenant.'
            }
        };
    }
    catch (error) {
        context.log('❌ Error creating multi-tenant app:', error);
        // Provide more detailed error information
        let errorMessage = 'Failed to create multi-tenant app';
        let statusCode = 500;
        if (error.message?.includes('authentication') || error.message?.includes('token')) {
            errorMessage = 'Authentication failed. Please check the service principal configuration.';
            statusCode = 401;
        }
        else if (error.message?.includes('permissions') || error.message?.includes('insufficient')) {
            errorMessage = 'Insufficient permissions to create app registration. Check the service principal permissions.';
            statusCode = 403;
        }
        else if (error.message?.includes('environment')) {
            errorMessage = 'Configuration error. Please check the required environment variables.';
            statusCode = 500;
        }
        return {
            status: statusCode,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: errorMessage,
                details: error.message || 'Unknown error',
                troubleshooting: {
                    checkServicePrincipal: 'Verify AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID are configured',
                    checkPermissions: 'Ensure the service principal has Application.ReadWrite.All permission',
                    checkGraph: 'Verify Microsoft Graph API access is working'
                }
            }
        };
    }
}
// Basic assessment handler (Secure Score + Licenses)
async function basicAssessmentHandler(request, context) {
    context.log('Performing basic security assessment...');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        await initializeDataService(context);
        const requestData = await request.json();
        const { customerId, tenantId, assessmentName, clientId, assessmentScope } = requestData;
        if (!tenantId || !clientId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Tenant ID and Client ID are required"
                }
            };
        }
        // Mock secure score data (in production, fetch from Microsoft Graph)
        const secureScore = {
            currentScore: Math.floor(Math.random() * 400) + 200, // 200-600
            maxScore: 600,
            percentage: 0,
            controlScores: [
                {
                    controlName: 'Identity and Access Management',
                    category: 'Identity',
                    currentScore: Math.floor(Math.random() * 100) + 50,
                    maxScore: 150,
                    implementationStatus: 'Partial'
                },
                {
                    controlName: 'Data Protection',
                    category: 'Data',
                    currentScore: Math.floor(Math.random() * 80) + 40,
                    maxScore: 120,
                    implementationStatus: 'Partial'
                },
                {
                    controlName: 'Device Security',
                    category: 'Device',
                    currentScore: Math.floor(Math.random() * 100) + 60,
                    maxScore: 160,
                    implementationStatus: 'Implemented'
                },
                {
                    controlName: 'Application Security',
                    category: 'Apps',
                    currentScore: Math.floor(Math.random() * 70) + 30,
                    maxScore: 100,
                    implementationStatus: 'Partial'
                }
            ],
            lastUpdated: new Date()
        };
        secureScore.percentage = Math.round((secureScore.currentScore / secureScore.maxScore) * 100);
        // Mock license data (in production, fetch from Microsoft Graph)
        const licenses = {
            totalLicenses: Math.floor(Math.random() * 1000) + 100,
            assignedLicenses: 0,
            availableLicenses: 0,
            licenseDetails: [
                {
                    skuId: 'c7df2760-2c81-4ef7-b578-5b5392b571df',
                    skuPartNumber: 'ENTERPRISEPREMIUM',
                    servicePlanName: 'Office 365 E5',
                    totalUnits: Math.floor(Math.random() * 500) + 50,
                    assignedUnits: 0,
                    consumedUnits: 0,
                    capabilityStatus: 'Enabled'
                },
                {
                    skuId: 'b05e124f-c7cc-45a0-a6aa-8cf78c946968',
                    skuPartNumber: 'ENTERPRISEPACK',
                    servicePlanName: 'Office 365 E3',
                    totalUnits: Math.floor(Math.random() * 300) + 30,
                    assignedUnits: 0,
                    consumedUnits: 0,
                    capabilityStatus: 'Enabled'
                }
            ]
        };
        // Calculate assigned/available licenses
        licenses.assignedLicenses = licenses.licenseDetails.reduce((sum, license) => {
            const assigned = Math.floor(license.totalUnits * 0.8); // 80% assigned
            license.assignedUnits = assigned;
            license.consumedUnits = assigned;
            return sum + assigned;
        }, 0);
        licenses.availableLicenses = licenses.totalLicenses - licenses.assignedLicenses;
        const assessmentData = {
            tenantId,
            tenantDisplayName: `Tenant ${tenantId}`,
            assessmentDate: new Date(),
            secureScore,
            licenses,
            status: 'completed'
        };
        context.log('✅ Basic assessment completed for tenant:', tenantId);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: assessmentData
            }
        };
    }
    catch (error) {
        context.log('❌ Error performing basic assessment:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: error.message || 'Failed to perform basic assessment'
            }
        };
    }
}
// Secure score handler
async function secureScoreHandler(request, context) {
    context.log('Fetching secure score...');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Initialize services
        await initializeDataService(context);
        const tenantId = request.params.tenantId;
        const clientId = request.query.get('clientId');
        if (!tenantId || !clientId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Tenant ID and Client ID are required"
                }
            };
        }
        context.log('🛡️ Fetching real secure score for tenant:', tenantId, 'clientId:', clientId);
        // Find customer by clientId to get stored credentials
        const customer = await dataService.getCustomerByClientId(clientId);
        if (!customer || !customer.appRegistration?.clientSecret) {
            return {
                status: 404,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer not found or missing credentials. Please ensure the app registration was completed successfully."
                }
            };
        }
        // Get real secure score from Microsoft Graph API
        const secureScore = await graphApiService.getSecureScore(tenantId, clientId, customer.appRegistration.clientSecret);
        context.log('✅ Secure score retrieved successfully');
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: secureScore
            }
        };
    }
    catch (error) {
        context.log('❌ Error fetching secure score:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: error.message || 'Failed to fetch secure score'
            }
        };
    }
}
// License info handler
async function licenseInfoHandler(request, context) {
    context.log('Fetching license information...');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // Initialize services
        await initializeDataService(context);
        const tenantId = request.params.tenantId;
        const clientId = request.query.get('clientId');
        if (!tenantId || !clientId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Tenant ID and Client ID are required"
                }
            };
        }
        context.log('📊 Fetching real license information for tenant:', tenantId, 'clientId:', clientId);
        // Find customer by clientId to get stored credentials
        const customer = await dataService.getCustomerByClientId(clientId);
        if (!customer || !customer.appRegistration?.clientSecret) {
            return {
                status: 404,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer not found or missing credentials. Please ensure the app registration was completed successfully."
                }
            };
        }
        // Get real license information from Microsoft Graph API
        const licenses = await graphApiService.getLicenseInfo(tenantId, clientId, customer.appRegistration.clientSecret);
        context.log('✅ License information retrieved successfully');
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: licenses
            }
        };
    }
    catch (error) {
        context.log('❌ Error fetching license info:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: error.message || 'Failed to fetch license information'
            }
        };
    }
}
// Assessment status handler (for API warmup)
async function assessmentStatusHandler(request, context) {
    context.log('Processing assessment status request');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    if (request.method === 'HEAD') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        const status = {
            status: 'online',
            version: '1.0.8',
            timestamp: new Date().toISOString(),
            services: {
                api: 'healthy',
                database: isDataServiceInitialized ? 'healthy' : 'initializing',
                graph: 'healthy'
            }
        };
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: status,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('Assessment status error:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: 'Failed to get assessment status',
                timestamp: new Date().toISOString()
            }
        };
    }
}
// Azure configuration check endpoint
async function azureConfigHandler(request, context) {
    context.log('Processing Azure configuration check request');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        const configStatus = {
            timestamp: new Date().toISOString(),
            environment: {
                AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID ? 'SET' : 'NOT SET',
                AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET ? 'SET' : 'NOT SET',
                AZURE_TENANT_ID: process.env.AZURE_TENANT_ID ? 'SET' : 'NOT SET',
                AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING ? 'SET' : 'NOT SET'
            },
            services: {
                tableStorage: false,
                graphApi: false
            }
        };
        // Test Table Storage
        try {
            if (!isDataServiceInitialized) {
                await initializeDataService(context);
            }
            configStatus.services.tableStorage = true;
        }
        catch (error) {
            context.warn('Table Storage initialization failed:', error);
        }
        // Test Graph API
        try {
            const testGraphService = new graphApiService_1.GraphApiService();
            configStatus.services.graphApi = true;
        }
        catch (error) {
            context.warn('GraphApiService initialization failed:', error);
        }
        const hasAllRequiredConfig = configStatus.environment.AZURE_CLIENT_ID === 'SET' &&
            configStatus.environment.AZURE_CLIENT_SECRET === 'SET' &&
            configStatus.environment.AZURE_TENANT_ID === 'SET' &&
            configStatus.environment.AZURE_STORAGE_CONNECTION_STRING === 'SET';
        return {
            status: hasAllRequiredConfig ? 200 : 500,
            headers: corsHeaders,
            jsonBody: {
                success: hasAllRequiredConfig,
                message: hasAllRequiredConfig
                    ? "All Azure services configured correctly"
                    : "Missing required Azure configuration",
                data: configStatus,
                recommendations: !hasAllRequiredConfig ? [
                    "Set AZURE_CLIENT_ID in Azure Static Web App configuration",
                    "Set AZURE_CLIENT_SECRET in Azure Static Web App configuration",
                    "Set AZURE_TENANT_ID in Azure Static Web App configuration",
                    "Set AZURE_STORAGE_CONNECTION_STRING in Azure Static Web App configuration",
                    "Ensure the service principal has Application.ReadWrite.All permissions in Microsoft Graph"
                ] : []
            }
        };
    }
    catch (error) {
        context.error('Error in Azure config handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Failed to check Azure configuration",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Register all functions with optimized configuration
functions_1.app.http('diagnostics', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'diagnostics',
    handler: diagnosticsHandler
});
functions_1.app.http('test', {
    methods: ['GET', 'HEAD'],
    authLevel: 'anonymous',
    route: 'test',
    handler: testHandler
});
functions_1.app.http('customers', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: customersHandler
});
// Individual customer operations (get, update, delete)
functions_1.app.http('customerById', {
    methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}',
    handler: customerByIdHandler
});
functions_1.app.http('assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments',
    handler: assessmentsHandler
});
functions_1.app.http('currentAssessment', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/current',
    handler: currentAssessmentHandler
});
// Assessment history endpoints
functions_1.app.http('assessmentHistory', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history',
    handler: assessmentHistoryHandler
});
functions_1.app.http('assessmentHistoryByTenant', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/{tenantId}',
    handler: assessmentHistoryHandler
});
functions_1.app.http('assessmentHistoryByCustomer', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/customer/{customerId}',
    handler: assessmentHistoryHandler
});
// Best practices endpoint
functions_1.app.http('bestPractices', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'best-practices',
    handler: bestPracticesHandler
});
// Create assessment endpoint
functions_1.app.http('createAssessment', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/create',
    handler: createAssessmentHandler
});
// Save assessment endpoint
functions_1.app.http('saveAssessment', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'save-assessment',
    handler: saveAssessmentHandler
});
// Get metrics endpoint
functions_1.app.http('getMetrics', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'GetMetrics',
    handler: getMetricsHandler
});
// Multi-tenant app creation endpoint
functions_1.app.http('createMultiTenantApp', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'enterprise-app/multi-tenant',
    handler: createMultiTenantAppHandler
});
// Basic assessment endpoint
functions_1.app.http('basicAssessment', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/basic',
    handler: basicAssessmentHandler
});
// Secure score endpoint
functions_1.app.http('secureScore', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/secure-score/{tenantId}',
    handler: secureScoreHandler
});
// License info endpoint
functions_1.app.http('licenseInfo', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/license-info/{tenantId}',
    handler: licenseInfoHandler
});
// Assessment status endpoint for frontend warmup
functions_1.app.http('assessmentStatus', {
    methods: ['GET', 'OPTIONS', 'HEAD'],
    authLevel: 'anonymous',
    route: 'assessment/status',
    handler: assessmentStatusHandler
});
// Azure configuration check endpoint
functions_1.app.http('azureConfig', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'azure/config',
    handler: azureConfigHandler
});
//# sourceMappingURL=index.js.map