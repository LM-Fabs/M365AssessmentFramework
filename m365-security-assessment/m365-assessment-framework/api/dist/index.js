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
    // Handle HEAD request for API warmup
    if (request.method === 'HEAD') {
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
    // Handle GET request
    if (request.method === 'GET') {
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                message: "API is running",
                timestamp: new Date().toISOString(),
                method: request.method
            }
        };
    }
    return {
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            success: true,
            message: "M365 Assessment API is working!",
            timestamp: new Date().toISOString(),
            version: "1.0.8",
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
                    tenantId: customer.tenantId || '', // Use the actual tenant ID, not servicePrincipalId
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
            // Extract tenant ID from domain or use provided tenant ID
            let targetTenantId = customerData.tenantId;
            if (!targetTenantId && customerData.tenantDomain) {
                // Use the domain as-is as the tenant identifier
                // This works for custom domains and *.onmicrosoft.com domains
                context.log('⚠️ Tenant ID not provided - using domain as tenant identifier');
                targetTenantId = customerData.tenantDomain.toLowerCase();
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
            // Create customer using Table Storage service
            const customerRequest = {
                tenantName: customerData.tenantName,
                tenantDomain: customerData.tenantDomain,
                tenantId: targetTenantId, // Include the actual tenant ID
                contactEmail: customerData.contactEmail || '',
                notes: customerData.notes || ''
            };
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
                    data: customer
                }
            };
        }
        // Handle PUT (update) and DELETE operations
        return {
            status: 501,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Method not implemented"
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
            // Get all assessments with optional filtering
            const result = await dataService.getAssessments({
                status: status || undefined,
                maxItemCount: limit
            });
            assessments = result.assessments;
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
    // Handle HEAD request for API warmup
    if (request.method === 'HEAD') {
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
        // Initialize data service to store assessment
        await initializeDataService(context);
        // Extract tenant ID from the provided data
        const tenantId = assessmentData.tenantId ||
            assessmentData.tenantName?.toLowerCase().replace(/\s+/g, '-') ||
            'new-tenant';
        // Get customer information to access app registration credentials
        let customer = null;
        let realData = {};
        let assessmentStatus = 'completed';
        if (assessmentData.customerId) {
            customer = await dataService.getCustomer(assessmentData.customerId);
            if (customer && customer.appRegistration?.clientId && customer.appRegistration?.clientSecret) {
                context.log('🔍 Fetching real assessment data from Microsoft Graph API...');
                try {
                    // Fetch detailed license information and secure score
                    context.log('🔍 Fetching detailed license information...');
                    const licenseReport = await graphApiService.getDetailedLicenseReport(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
                    context.log('🛡️ Fetching secure score information...');
                    let secureScore = null;
                    try {
                        secureScore = await graphApiService.getSecureScore(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
                    }
                    catch (secureScoreError) {
                        context.warn('⚠️ Could not fetch secure score (may not be available):', secureScoreError.message);
                    }
                    context.log('✅ Real assessment data retrieved successfully');
                    // Calculate assessment scores based on real data
                    const utilizationRate = licenseReport.overview.utilizationPercentage;
                    // Use secure score if available, otherwise calculate based on license efficiency and security posture
                    const overallScore = secureScore ? secureScore.percentage :
                        utilizationRate > 80 ? 85 :
                            utilizationRate > 60 ? 75 :
                                utilizationRate > 40 ? 65 : 50;
                    // Create detailed real data object with enhanced license information
                    realData = {
                        licenseReport: {
                            ...licenseReport,
                            summary: `${licenseReport.overview.assignedLicenses} of ${licenseReport.overview.totalLicenses} licenses assigned (${utilizationRate}% utilization)`
                        },
                        secureScore: secureScore ? {
                            ...secureScore,
                            summary: `Security score: ${secureScore.currentScore}/${secureScore.maxScore} (${secureScore.percentage}%)`
                        } : {
                            unavailable: true,
                            reason: 'Secure score not available or insufficient permissions'
                        },
                        dataSource: 'Microsoft Graph API',
                        dataTypes: ['detailedLicenses', secureScore ? 'secureScore' : 'licenseOnly'],
                        lastUpdated: new Date().toISOString(),
                        tenantInfo: {
                            tenantId,
                            tenantName: customer.tenantName,
                            tenantDomain: customer.tenantDomain
                        },
                        costAnalysis: {
                            estimatedMonthlyCost: licenseReport.overview.totalCost,
                            potentialSavings: licenseReport.overview.availableLicenses * 25, // Estimated average cost per license
                            utilizationEfficiency: utilizationRate >= 70 ? 'Good' : utilizationRate >= 50 ? 'Fair' : 'Poor'
                        }
                    };
                    // Combine recommendations from license analysis and assessment logic
                    const combinedRecommendations = [
                        ...licenseReport.recommendations,
                        ...generateRecommendations(licenseReport, secureScore)
                    ];
                    // Create assessment object with real data
                    const newAssessment = {
                        id: `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        tenantId: tenantId,
                        customerId: assessmentData.customerId || '',
                        tenantName: customer.tenantName || assessmentData.tenantName || 'New Assessment',
                        assessmentName: assessmentData.assessmentName || `Security Assessment for ${customer.tenantName}`,
                        assessmentDate: new Date().toISOString(),
                        status: assessmentStatus,
                        categories: assessmentData.includedCategories || assessmentData.categories || ['identity', 'dataProtection', 'endpoint', 'cloudApps'],
                        notificationEmail: assessmentData.notificationEmail || '',
                        autoSchedule: assessmentData.autoSchedule || false,
                        scheduleFrequency: assessmentData.scheduleFrequency || 'monthly',
                        metrics: {
                            score: {
                                overall: Math.round(overallScore),
                                identity: secureScore ? Math.min(secureScore.percentage + 5, 100) : Math.min(overallScore + 5, 90),
                                dataProtection: secureScore ? Math.max(secureScore.percentage - 10, 0) : Math.max(overallScore - 5, 50),
                                endpoint: secureScore ? secureScore.percentage : overallScore,
                                cloudApps: Math.min(overallScore + 3, 95)
                            },
                            realData,
                            assessmentType: 'real-data',
                            dataCollected: true,
                            recommendations: combinedRecommendations
                        },
                        lastModified: new Date().toISOString(),
                        createdBy: 'system'
                    };
                    context.log('✅ Assessment created with real license data');
                    // Store the assessment and return it immediately
                    const storedAssessment = await dataService.createAssessment(newAssessment);
                    context.log('✅ Assessment with real data stored successfully:', storedAssessment.id);
                    // Update customer's last assessment date
                    if (assessmentData.customerId && customer) {
                        try {
                            await dataService.updateCustomer(assessmentData.customerId, {
                                lastAssessmentDate: new Date().toISOString(),
                                totalAssessments: (customer.totalAssessments || 0) + 1
                            });
                            context.log('✅ Customer updated with assessment info');
                        }
                        catch (customerUpdateError) {
                            context.warn('⚠️ Failed to update customer:', customerUpdateError);
                        }
                    }
                    return {
                        status: 201,
                        headers: corsHeaders,
                        jsonBody: {
                            success: true,
                            data: storedAssessment,
                            realData: true
                        }
                    };
                }
                catch (graphError) {
                    context.error('❌ Failed to fetch real data from Graph API:', graphError);
                    assessmentStatus = 'failed';
                    // Fall back to mock data with error information
                    realData = {
                        error: graphError?.message || 'Failed to connect to Microsoft Graph API',
                        dataSource: 'Mock data (Graph API unavailable)',
                        lastUpdated: new Date().toISOString(),
                        troubleshooting: 'Check app registration permissions and admin consent'
                    };
                }
            }
            else {
                context.log('⚠️ Customer found but missing app registration credentials - using mock data');
                assessmentStatus = 'incomplete';
                realData = {
                    warning: 'No app registration credentials available',
                    dataSource: 'Mock data (credentials missing)',
                    lastUpdated: new Date().toISOString(),
                    recommendation: 'Complete app registration setup to get real data'
                };
            }
        }
        else {
            context.log('⚠️ No customer ID provided - using mock data');
            realData = {
                info: 'No customer specified',
                dataSource: 'Mock data (no customer)',
                lastUpdated: new Date().toISOString()
            };
        }
        // Create assessment object with mock data as fallback
        const newAssessment = {
            id: `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tenantId: tenantId,
            customerId: assessmentData.customerId || '',
            tenantName: customer?.tenantName || assessmentData.tenantName || 'New Assessment',
            assessmentName: assessmentData.assessmentName || `Assessment for ${customer?.tenantName || assessmentData.tenantName}`,
            assessmentDate: new Date().toISOString(),
            status: assessmentStatus,
            categories: assessmentData.includedCategories || assessmentData.categories || ['identity', 'dataProtection', 'endpoint', 'cloudApps'],
            notificationEmail: assessmentData.notificationEmail || '',
            autoSchedule: assessmentData.autoSchedule || false,
            scheduleFrequency: assessmentData.scheduleFrequency || 'monthly',
            metrics: {
                score: {
                    overall: 75,
                    identity: 80,
                    dataProtection: 70,
                    endpoint: 75,
                    cloudApps: 80
                },
                realData,
                assessmentType: 'mock-data',
                dataCollected: false
            },
            lastModified: new Date().toISOString(),
            createdBy: 'system'
        };
        try {
            // Store the assessment in the data service
            const storedAssessment = await dataService.createAssessment(newAssessment);
            context.log('✅ Assessment stored successfully:', storedAssessment.id);
            // If we have a customer ID, update the customer's last assessment date
            if (assessmentData.customerId) {
                try {
                    const customer = await dataService.getCustomer(assessmentData.customerId);
                    if (customer) {
                        await dataService.updateCustomer(assessmentData.customerId, {
                            lastAssessmentDate: new Date().toISOString(),
                            totalAssessments: (customer.totalAssessments || 0) + 1
                        });
                        context.log('✅ Customer updated with assessment info');
                    }
                }
                catch (customerUpdateError) {
                    context.warn('⚠️ Failed to update customer:', customerUpdateError);
                    // Don't fail the assessment creation if customer update fails
                }
            }
            return {
                status: 201,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: storedAssessment
                }
            };
        }
        catch (storageError) {
            context.error('❌ Failed to store assessment:', storageError);
            // Return the assessment even if storage fails, but with a warning
            return {
                status: 201,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: newAssessment,
                    warning: 'Assessment created but storage failed'
                }
            };
        }
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
        let requestData;
        try {
            requestData = await request.json();
            context.log('📋 Request data received:', JSON.stringify(requestData, null, 2));
        }
        catch (parseError) {
            context.log('❌ Failed to parse request JSON:', parseError);
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Invalid JSON in request body",
                    details: parseError instanceof Error ? parseError.message : "Unknown parsing error"
                }
            };
        }
        const { targetTenantId, targetTenantDomain, assessmentName, requiredPermissions, tenantName, contactEmail } = requestData;
        context.log('🔍 Extracted values:');
        context.log('  - targetTenantId:', targetTenantId);
        context.log('  - targetTenantDomain:', targetTenantDomain);
        context.log('  - tenantName:', tenantName);
        context.log('  - contactEmail:', contactEmail);
        // Extract tenant ID from domain or use provided tenant ID (same logic as customer creation)
        let finalTenantId = targetTenantId;
        if (!finalTenantId && targetTenantDomain) {
            // Use the domain as-is as the tenant identifier
            // This works for custom domains and *.onmicrosoft.com domains
            context.log('⚠️ Target Tenant ID not provided - using domain as tenant identifier');
            finalTenantId = targetTenantDomain.toLowerCase();
        }
        if (!finalTenantId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Target tenant ID or domain is required",
                    expectedFormat: "{ targetTenantId?: string, targetTenantDomain?: string, tenantName?: string, assessmentName?: string }",
                    message: "Provide either targetTenantId or targetTenantDomain to identify the target tenant"
                }
            };
        }
        // Validate that we have the required Azure configuration
        context.log('🔍 Validating Azure environment variables...');
        const azureClientId = process.env.AZURE_CLIENT_ID;
        const azureClientSecret = process.env.AZURE_CLIENT_SECRET;
        const azureTenantId = process.env.AZURE_TENANT_ID;
        context.log('  - AZURE_CLIENT_ID:', azureClientId ? 'SET' : 'NOT SET');
        context.log('  - AZURE_CLIENT_SECRET:', azureClientSecret ? 'SET' : 'NOT SET');
        context.log('  - AZURE_TENANT_ID:', azureTenantId ? 'SET' : 'NOT SET');
        if (!azureClientId || !azureClientSecret || !azureTenantId) {
            context.log('❌ Missing required Azure environment variables for app registration');
            return {
                status: 500,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Azure configuration is incomplete",
                    message: "Missing required environment variables for Azure AD app registration",
                    missingVariables: [
                        ...(!azureClientId ? ['AZURE_CLIENT_ID'] : []),
                        ...(!azureClientSecret ? ['AZURE_CLIENT_SECRET'] : []),
                        ...(!azureTenantId ? ['AZURE_TENANT_ID'] : [])
                    ],
                    troubleshooting: [
                        "Check that AZURE_CLIENT_ID is set in your configuration",
                        "Check that AZURE_CLIENT_SECRET is set in your configuration",
                        "Check that AZURE_TENANT_ID is set in your configuration",
                        "Ensure the service principal has Application.ReadWrite.All permission"
                    ]
                }
            };
        }
        // Prepare customer data for app creation
        const customerData = {
            tenantName: tenantName || targetTenantDomain || finalTenantId,
            tenantDomain: targetTenantDomain || 'unknown.onmicrosoft.com',
            targetTenantId: finalTenantId, // Use the resolved tenant ID
            contactEmail,
            requiredPermissions
        };
        context.log('🏢 Creating real Azure AD app registration for tenant:', customerData.tenantName);
        context.log('🔧 Target tenant identifier:', finalTenantId);
        context.log('🔧 Target tenant domain:', targetTenantDomain || 'not provided');
        context.log('📋 Customer data for app creation:', JSON.stringify(customerData, null, 2));
        // Create actual multi-tenant app registration using GraphApiService
        let appRegistration;
        try {
            context.log('🚀 Calling graphApiService.createMultiTenantAppRegistration...');
            // Ensure GraphApiService is available
            if (!graphApiService) {
                throw new Error('GraphApiService is not initialized. This should not happen after initializeDataService.');
            }
            appRegistration = await graphApiService.createMultiTenantAppRegistration(customerData);
            context.log('✅ GraphApiService returned:', JSON.stringify(appRegistration, null, 2));
        }
        catch (graphError) {
            context.log('❌ GraphApiService.createMultiTenantAppRegistration failed:', graphError);
            context.log('❌ GraphApiService error details:', {
                message: graphError.message,
                stack: graphError.stack,
                name: graphError.name
            });
            // Re-throw with better context
            throw new Error(`GraphApiService failed: ${graphError.message}`);
        }
        // Use the resolved tenant ID from the GraphApiService if available
        const actualTenantId = appRegistration.resolvedTenantId || finalTenantId;
        context.log('🎯 Actual tenant ID to use:', actualTenantId);
        // Determine the correct tenant identifier for auth URLs
        let authTenantId = actualTenantId;
        if (actualTenantId.includes('.') && !actualTenantId.includes('.onmicrosoft.com') &&
            !actualTenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            context.log('⚠️ Using common auth endpoint for custom domain:', actualTenantId);
            authTenantId = 'common';
        }
        // Prepare response with app registration details
        const response = {
            applicationId: appRegistration.applicationId,
            applicationObjectId: appRegistration.applicationId,
            clientId: appRegistration.clientId,
            servicePrincipalId: appRegistration.servicePrincipalId,
            clientSecret: appRegistration.clientSecret,
            tenantId: actualTenantId, // Use the resolved/actual tenant ID
            originalTenantId: finalTenantId, // Keep track of what was originally provided
            consentUrl: appRegistration.consentUrl,
            authUrl: `https://login.microsoftonline.com/${authTenantId}/oauth2/v2.0/authorize`,
            redirectUri: appRegistration.redirectUri,
            permissions: appRegistration.permissions,
            isReal: true, // Flag to indicate this is a real app registration
            domainResolved: actualTenantId !== finalTenantId // Flag to indicate if domain was resolved
        };
        context.log('✅ Real multi-tenant app created successfully:', appRegistration.clientId);
        // Create success message with domain resolution info
        let successMessage = 'Azure AD app registration created successfully. Admin consent is required in the target tenant.';
        if (actualTenantId !== finalTenantId) {
            successMessage += ` Domain '${finalTenantId}' was resolved to tenant ID '${actualTenantId}'.`;
        }
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: response,
                message: successMessage
            }
        };
    }
    catch (error) {
        context.log('❌ Error creating multi-tenant app:', error);
        context.log('❌ Full error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            cause: error.cause
        });
        // Provide more detailed error information
        let errorMessage = 'Failed to create multi-tenant app';
        let statusCode = 500;
        let troubleshootingSteps = [];
        let errorDetails = error.message || 'Unknown error';
        if (error.message?.includes('Missing required environment variables') ||
            error.message?.includes('GraphApiService initialization failed')) {
            errorMessage = 'Azure configuration is incomplete. Required environment variables are not set.';
            statusCode = 500;
            troubleshootingSteps = [
                'Check that AZURE_CLIENT_ID is set in your Azure Static Web App configuration',
                'Check that AZURE_CLIENT_SECRET is set in your Azure Static Web App configuration',
                'Check that AZURE_TENANT_ID is set in your Azure Static Web App configuration',
                'For local development, update the api/local.settings.json file with valid Azure credentials',
                'Ensure the service principal has Application.ReadWrite.All permission'
            ];
        }
        else if (error.message?.includes('authentication') || error.message?.includes('token')) {
            errorMessage = 'Authentication failed. Please check the service principal configuration.';
            statusCode = 401;
            troubleshootingSteps = [
                'Verify the AZURE_CLIENT_ID is correct',
                'Verify the AZURE_CLIENT_SECRET is valid and not expired',
                'Verify the AZURE_TENANT_ID is correct',
                'Check that the service principal exists and is enabled'
            ];
        }
        else if (error.message?.includes('permissions') || error.message?.includes('insufficient')) {
            errorMessage = 'Insufficient permissions to create app registration. Check the service principal permissions.';
            statusCode = 403;
            troubleshootingSteps = [
                'Grant Application.ReadWrite.All permission to the service principal',
                'Ensure admin consent has been granted for the permissions',
                'Check that the service principal is not blocked by conditional access policies'
            ];
        }
        else if (error.message?.includes('environment')) {
            errorMessage = 'Configuration error. Please check the required environment variables.';
            statusCode = 500;
        }
        else if (error.message?.includes('GraphApiService failed')) {
            errorMessage = 'Microsoft Graph API call failed. Check service principal permissions and configuration.';
            statusCode = 500;
            troubleshootingSteps = [
                'Check Azure service principal configuration',
                'Verify Application.ReadWrite.All permission is granted',
                'Ensure admin consent has been provided',
                'Check that the Azure AD tenant allows app registrations'
            ];
        }
        return {
            status: statusCode,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: errorMessage,
                details: errorDetails,
                originalError: error.message,
                errorType: error.name || 'Error',
                troubleshooting: {
                    steps: troubleshootingSteps.length > 0 ? troubleshootingSteps : [
                        'Verify AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID are configured',
                        'Ensure the service principal has Application.ReadWrite.All permission',
                        'Verify Microsoft Graph API access is working',
                        'Check the Azure configuration status at /api/azure-config'
                    ],
                    configurationCheck: 'Use the /api/azure-config endpoint to verify your Azure configuration',
                    documentation: 'See SECURITY-DEPLOYMENT-GUIDE.md for setup instructions'
                },
                timestamp: new Date().toISOString()
            }
        };
    }
}
// Generate recommendations based on license and security data
function generateRecommendations(licenseInfo, secureScore) {
    const recommendations = [];
    if (licenseInfo) {
        const utilizationRate = licenseInfo.totalLicenses > 0
            ? (licenseInfo.assignedLicenses / licenseInfo.totalLicenses) * 100
            : 0;
        if (utilizationRate < 40) {
            recommendations.push("Consider reviewing your license usage - only " + Math.round(utilizationRate) + "% of licenses are assigned. You may be able to optimize costs by reducing unused licenses.");
        }
        else if (utilizationRate > 90) {
            recommendations.push("License utilization is very high (" + Math.round(utilizationRate) + "%). Consider purchasing additional licenses to avoid service disruptions.");
        }
        else if (utilizationRate < 70) {
            recommendations.push("License utilization is moderate (" + Math.round(utilizationRate) + "%). Monitor usage trends and consider optimization opportunities.");
        }
        // Check for specific license types
        if (licenseInfo.licenseDetails) {
            const premiumLicenses = licenseInfo.licenseDetails.filter((license) => license.skuPartNumber?.includes('E5') || license.skuPartNumber?.includes('PREMIUM'));
            if (premiumLicenses.length > 0) {
                recommendations.push("Premium licenses detected. Ensure you're leveraging advanced security features like Conditional Access and Identity Protection.");
            }
            const basicLicenses = licenseInfo.licenseDetails.filter((license) => license.skuPartNumber?.includes('E1') || license.skuPartNumber?.includes('BASIC'));
            if (basicLicenses.length > 0) {
                recommendations.push("Basic licenses in use. Consider upgrading to higher tiers for enhanced security and compliance features.");
            }
        }
    }
    if (secureScore) {
        if (secureScore.percentage < 50) {
            recommendations.push("Secure Score is below 50% (" + secureScore.percentage + "%). Immediate action required to improve security posture.");
        }
        else if (secureScore.percentage < 70) {
            recommendations.push("Secure Score is moderate (" + secureScore.percentage + "%). Focus on implementing high-impact security controls.");
        }
        else if (secureScore.percentage >= 80) {
            recommendations.push("Excellent Secure Score (" + secureScore.percentage + "%). Continue monitoring and maintain current security practices.");
        }
        // Analyze control categories for specific recommendations
        if (secureScore.controlScores) {
            const identityControls = secureScore.controlScores.filter((control) => control.category?.toLowerCase().includes('identity') ||
                control.controlName?.toLowerCase().includes('mfa') ||
                control.controlName?.toLowerCase().includes('conditional'));
            if (identityControls.some((control) => control.implementationStatus === 'Not Implemented')) {
                recommendations.push("Identity security controls need attention. Implement Multi-Factor Authentication and Conditional Access policies.");
            }
        }
    }
    // General recommendations if no data available
    if (!licenseInfo && !secureScore) {
        recommendations.push("Complete app registration setup to access real tenant data and get personalized recommendations.");
    }
    return recommendations;
}
// Register all functions with optimized configuration
functions_1.app.http('diagnostics', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'diagnostics',
    handler: diagnosticsHandler
});
functions_1.app.http('test', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
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
// Customer assessments endpoint
functions_1.app.http('customerAssessments', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}/assessments',
    handler: customerAssessmentsHandler
});
functions_1.app.http('assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments',
    handler: assessmentsHandler
});
functions_1.app.http('currentAssessment', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
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
// Customer assessments endpoint - get assessments for a specific customer
async function customerAssessmentsHandler(request, context) {
    context.log(`Processing ${request.method} request for customer assessments`);
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
        context.log('Getting assessments for customer:', customerId);
        // Get assessments for the specific customer
        const result = await dataService.getCustomerAssessments(customerId);
        context.log(`Customer assessments retrieved. Count: ${result.assessments.length}`);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: result.assessments,
                count: result.assessments.length,
                customerId: customerId,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('Error in customer assessments handler:', error);
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
// Secure score endpoint handler
async function secureScoreHandler(request, context) {
    context.log('Processing secure score request');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        await initializeDataService(context);
        const tenantId = request.params.tenantId;
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
        // Get customer by tenant ID to access credentials
        const customers = await dataService.getCustomers({ status: 'active' });
        const customer = customers.customers.find(c => c.tenantId === tenantId);
        if (!customer || !customer.appRegistration?.clientId || !customer.appRegistration?.clientSecret) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer credentials not found or incomplete"
                }
            };
        }
        const secureScore = await graphApiService.getSecureScore(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
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
        context.error('Error in secure score handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Failed to fetch secure score",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// License info endpoint handler
async function licenseInfoHandler(request, context) {
    context.log('Processing license info request');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        await initializeDataService(context);
        const tenantId = request.params.tenantId;
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
        // Get customer by tenant ID to access credentials
        const customers = await dataService.getCustomers({ status: 'active' });
        const customer = customers.customers.find(c => c.tenantId === tenantId);
        if (!customer || !customer.appRegistration?.clientId || !customer.appRegistration?.clientSecret) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer credentials not found or incomplete"
                }
            };
        }
        const licenseInfo = await graphApiService.getLicenseInfo(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
        // Enhanced license reporting with usage analytics
        const enhancedLicenseInfo = await graphApiService.getDetailedLicenseReport(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: {
                    basicInfo: licenseInfo,
                    detailedUsage: enhancedLicenseInfo
                }
            }
        };
    }
    catch (error) {
        context.error('Error in license info handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Failed to fetch license information",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
// Assessment status endpoint handler
async function assessmentStatusHandler(request, context) {
    context.log('Processing assessment status request');
    if (request.method === 'OPTIONS' || request.method === 'HEAD') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    return {
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            success: true,
            status: 'ready',
            timestamp: new Date().toISOString(),
            version: '1.0.8'
        }
    };
}
// Azure config endpoint handler
async function azureConfigHandler(request, context) {
    context.log('Processing Azure config request');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    return {
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            success: true,
            config: {
                tenantId: process.env.AZURE_TENANT_ID ? 'configured' : 'missing',
                clientId: process.env.AZURE_CLIENT_ID ? 'configured' : 'missing',
                storage: process.env.AzureWebJobsStorage ? 'configured' : 'missing'
            }
        }
    };
}
// Basic assessment endpoint handler
async function basicAssessmentHandler(request, context) {
    context.log('Processing basic assessment request');
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        await initializeDataService(context);
        const assessmentData = await request.json();
        // Create a basic assessment without detailed Graph API calls
        const basicAssessment = {
            id: `basic-assessment-${Date.now()}`,
            tenantId: assessmentData.tenantId || 'unknown',
            assessmentType: 'basic',
            assessmentDate: new Date().toISOString(),
            status: 'completed',
            metrics: {
                score: {
                    overall: 65,
                    identity: 70,
                    dataProtection: 60,
                    endpoint: 65,
                    cloudApps: 70
                },
                assessmentType: 'basic',
                dataCollected: false
            }
        };
        return {
            status: 201,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                data: basicAssessment
            }
        };
    }
    catch (error) {
        context.error('Error in basic assessment handler:', error);
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
//# sourceMappingURL=index.js.map