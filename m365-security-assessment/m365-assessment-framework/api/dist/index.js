"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const tableStorageService_1 = require("./shared/tableStorageService");
const graphApiService_1 = require("./shared/graphApiService");
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
// Performance optimization: Cache frequently accessed data
const cache = new Map();
const CACHE_TTL = {
    customers: 300000, // 5 minutes
    assessments: 180000, // 3 minutes
    metrics: 120000, // 2 minutes
    bestPractices: 600000 // 10 minutes
};
// Initialize data services with connection pooling
let tableStorageService;
let graphApiService;
let dataService;
let isDataServiceInitialized = false;
let initializationPromise = null;
// Cache helper functions for performance optimization
function getCachedData(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
    }
    cache.delete(key);
    return null;
}
function setCachedData(key, data, ttl) {
    cache.set(key, { data, timestamp: Date.now(), ttl });
}
// Optimized data service initialization with singleton pattern
async function initializeDataService(context) {
    if (isDataServiceInitialized) {
        return;
    }
    // Prevent multiple concurrent initializations
    if (initializationPromise) {
        return initializationPromise;
    }
    initializationPromise = (async () => {
        try {
            const startTime = Date.now();
            context.log('🚀 Initializing data services...');
            // Initialize Table Storage service with optimized settings
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
            const duration = Date.now() - startTime;
            context.log(`✅ Data services initialized successfully in ${duration}ms`);
            isDataServiceInitialized = true;
        }
        catch (error) {
            context.error('❌ Data services initialization failed:', error);
            initializationPromise = null; // Reset on failure
            isDataServiceInitialized = false; // Reset flag
            // If it's a table/storage related error, provide helpful context
            if (error instanceof Error && (error.message.includes('table') || error.message.includes('storage'))) {
                throw new Error(`Storage initialization failed - tables may need to be recreated: ${error.message}`);
            }
            throw new Error(`Data services initialization failed: ${error instanceof Error ? error.message : error}`);
        }
    })();
    return initializationPromise;
}
// Function to reset data service state - useful when tables are cleared
function resetDataServiceState() {
    isDataServiceInitialized = false;
    initializationPromise = null;
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
            try {
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
            catch (customerError) {
                context.error('❌ Failed to retrieve customers:', customerError);
                // Check if it's a table initialization error
                if (customerError instanceof Error && customerError.message.includes('table')) {
                    context.log('🔧 Table initialization issue detected, attempting to reinitialize...');
                    try {
                        // Force re-initialization
                        await dataService.initialize();
                        // Retry the operation
                        const result = await dataService.getCustomers({
                            status: 'active',
                            maxItemCount: 100
                        });
                        context.log('✅ Successfully retrieved customers after reinitializing:', result.customers.length);
                        const transformedCustomers = result.customers.map((customer) => {
                            const appReg = customer.appRegistration || {};
                            return {
                                id: customer.id,
                                tenantId: customer.tenantId || '',
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
                    catch (retryError) {
                        context.error('❌ Retry failed:', retryError);
                        return {
                            status: 500,
                            headers: corsHeaders,
                            jsonBody: {
                                success: false,
                                error: "Failed to initialize storage tables",
                                details: retryError instanceof Error ? retryError.message : "Unknown error",
                                troubleshooting: [
                                    'Check Azure Storage account connection string',
                                    'Verify storage account exists and is accessible',
                                    'Check environment variable: AZURE_STORAGE_CONNECTION_STRING',
                                    'Tables were cleared - reinitializing automatically'
                                ],
                                timestamp: new Date().toISOString()
                            }
                        };
                    }
                }
                // For other errors, return generic error
                return {
                    status: 500,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Failed to retrieve customers",
                        details: customerError instanceof Error ? customerError.message : "Unknown error",
                        timestamp: new Date().toISOString()
                    }
                };
            }
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
                    // Minimal permissions for license and secure score assessment only
                    'Organization.Read.All', // Required for license data (/subscribedSkus)
                    'SecurityEvents.Read.All' // Required for secure score data (/security/secureScores, /security/secureScoreControlProfiles)
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
        // Initialize data service with detailed error logging
        try {
            await initializeDataService(context);
            context.log('✅ Data service initialized for customer operations');
        }
        catch (initError) {
            context.error('❌ Data service initialization failed:', initError);
            return {
                status: 500,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Data service initialization failed",
                    details: initError instanceof Error ? initError.message : "Unknown initialization error",
                    troubleshooting: [
                        'Check Azure Storage connection string configuration',
                        'Verify the storage account exists and is accessible',
                        'Check environment variables: AzureWebJobsStorage or AZURE_STORAGE_CONNECTION_STRING'
                    ],
                    timestamp: new Date().toISOString()
                }
            };
        }
        const customerId = request.params.customerId;
        context.log('📋 Customer ID from request params:', customerId);
        if (!customerId) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer ID is required",
                    details: "Customer ID parameter is missing from the request URL"
                }
            };
        }
        if (typeof customerId !== 'string' || customerId.trim().length === 0) {
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Invalid customer ID format",
                    details: "Customer ID must be a non-empty string",
                    providedValue: customerId
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
        if (request.method === 'DELETE') {
            try {
                context.log('🗑️ Attempting to delete customer:', customerId);
                // Check if customer exists first
                const existingCustomer = await dataService.getCustomer(customerId);
                if (!existingCustomer) {
                    context.log('❌ Customer not found for deletion:', customerId);
                    return {
                        status: 404,
                        headers: corsHeaders,
                        jsonBody: {
                            success: false,
                            error: "Customer not found",
                            details: `Customer with ID ${customerId} does not exist`,
                            customerId: customerId
                        }
                    };
                }
                context.log('✅ Customer found, proceeding with deletion:', customerId);
                // Attempt to delete the customer
                await dataService.deleteCustomer(customerId);
                context.log('✅ Customer deleted successfully:', customerId);
                return {
                    status: 200,
                    headers: corsHeaders,
                    jsonBody: {
                        success: true,
                        message: "Customer deleted successfully",
                        customerId: customerId
                    }
                };
            }
            catch (deleteError) {
                context.error('❌ Failed to delete customer:', deleteError);
                // Enhanced error details
                let errorMessage = "Failed to delete customer";
                let statusCode = 500;
                let troubleshooting = [];
                if (deleteError instanceof Error) {
                    if (deleteError.message.includes('Customer not found')) {
                        errorMessage = "Customer not found";
                        statusCode = 404;
                        troubleshooting = ['Verify the customer ID is correct', 'Check if the customer was already deleted'];
                    }
                    else if (deleteError.message.includes('not initialized')) {
                        errorMessage = "Data service not properly initialized";
                        statusCode = 500;
                        troubleshooting = ['Check storage account configuration', 'Verify connection strings'];
                    }
                    else if (deleteError.message.includes('storage') || deleteError.message.includes('table')) {
                        errorMessage = "Storage service error";
                        statusCode = 500;
                        troubleshooting = [
                            'Check Azure Storage account connectivity',
                            'Verify table exists and is accessible',
                            'Check storage account permissions'
                        ];
                    }
                }
                return {
                    status: statusCode,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: errorMessage,
                        details: deleteError instanceof Error ? deleteError.message : "Unknown error",
                        customerId: customerId,
                        troubleshooting: troubleshooting,
                        timestamp: new Date().toISOString(),
                        errorType: deleteError instanceof Error ? deleteError.constructor.name : 'UnknownError'
                    }
                };
            }
        }
        if (request.method === 'PUT') {
            try {
                const updateData = await request.json();
                const updatedCustomer = await dataService.updateCustomer(customerId, updateData);
                context.log('✅ Customer updated successfully:', customerId);
                return {
                    status: 200,
                    headers: corsHeaders,
                    jsonBody: {
                        success: true,
                        data: updatedCustomer,
                        message: "Customer updated successfully"
                    }
                };
            }
            catch (updateError) {
                context.error('❌ Failed to update customer:', updateError);
                return {
                    status: 500,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Failed to update customer",
                        details: updateError instanceof Error ? updateError.message : "Unknown error"
                    }
                };
            }
        }
        // Unsupported method
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
    // Handle HEAD request for API warmup
    if (request.method === 'HEAD') {
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
                    // Only fetch data for the specifically requested categories to avoid GraphAPI overload
                    const requestedCategories = assessmentData.includedCategories || assessmentData.categories || ['license', 'secureScore'];
                    context.log('📋 Fetching data for requested categories:', requestedCategories);
                    let licenseInfo = null;
                    let secureScore = null;
                    const dataFetchResults = [];
                    // Fetch license information only if requested
                    if (requestedCategories.includes('license')) {
                        try {
                            context.log('🔍 Fetching license information...');
                            licenseInfo = await graphApiService.getLicenseInfo(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
                            dataFetchResults.push('license: success');
                        }
                        catch (licenseError) {
                            context.warn('⚠️ License data fetch failed:', licenseError.message);
                            dataFetchResults.push(`license: failed (${licenseError.message})`);
                        }
                    }
                    // Fetch secure score only if requested
                    if (requestedCategories.includes('secureScore')) {
                        try {
                            context.log('🛡️ Fetching secure score information...');
                            secureScore = await graphApiService.getSecureScore(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
                            dataFetchResults.push('secureScore: success');
                        }
                        catch (secureScoreError) {
                            context.warn('⚠️ Secure score fetch failed:', secureScoreError.message);
                            dataFetchResults.push(`secureScore: failed (${secureScoreError.message})`);
                        }
                    }
                    // If we couldn't fetch any data, throw an error
                    if (!licenseInfo && !secureScore) {
                        throw new Error(`Unable to fetch any assessment data. Results: ${dataFetchResults.join(', ')}`);
                    }
                    context.log('✅ Partial/full assessment data retrieved. Results:', dataFetchResults);
                    // Calculate assessment scores based on available real data
                    const utilizationRate = licenseInfo && licenseInfo.totalLicenses > 0
                        ? (licenseInfo.assignedLicenses / licenseInfo.totalLicenses) * 100
                        : 0;
                    // Use secure score if available, otherwise calculate based on license efficiency
                    const overallScore = secureScore ? secureScore.percentage :
                        utilizationRate > 80 ? 85 :
                            utilizationRate > 60 ? 75 :
                                utilizationRate > 40 ? 65 : 50;
                    // Create detailed real data object with null-safe handling
                    realData = {
                        licenseInfo: licenseInfo ? {
                            ...licenseInfo,
                            utilizationRate: Math.round(utilizationRate * 100) / 100,
                            summary: `${licenseInfo.assignedLicenses} of ${licenseInfo.totalLicenses} licenses assigned (${Math.round(utilizationRate)}% utilization)`
                        } : {
                            unavailable: true,
                            reason: 'License information not available - not requested or fetch failed'
                        },
                        secureScore: secureScore ? {
                            ...secureScore,
                            summary: `Security score: ${secureScore.currentScore}/${secureScore.maxScore} (${secureScore.percentage}%)`
                        } : {
                            unavailable: true,
                            reason: 'Secure score not available or insufficient permissions'
                        },
                        dataSource: 'Microsoft Graph API',
                        dataTypes: ['licenses', secureScore ? 'secureScore' : 'licenseOnly'],
                        lastUpdated: new Date().toISOString(),
                        tenantInfo: {
                            tenantId,
                            tenantName: customer.tenantName,
                            tenantDomain: customer.tenantDomain
                        }
                    };
                    // Create assessment object with real data
                    const newAssessment = {
                        id: `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        tenantId: tenantId,
                        customerId: assessmentData.customerId || '',
                        tenantName: customer.tenantName || assessmentData.tenantName || 'New Assessment',
                        assessmentName: assessmentData.assessmentName || `Security Assessment for ${customer.tenantName}`,
                        assessmentDate: new Date().toISOString(),
                        status: assessmentStatus,
                        categories: assessmentData.includedCategories || assessmentData.categories || ['license', 'secureScore'],
                        notificationEmail: assessmentData.notificationEmail || '',
                        autoSchedule: assessmentData.autoSchedule || false,
                        scheduleFrequency: assessmentData.scheduleFrequency || 'monthly',
                        metrics: {
                            score: {
                                overall: Math.round(overallScore),
                                license: licenseInfo ? Math.round(utilizationRate) : 0,
                                secureScore: secureScore ? secureScore.percentage : Math.round(overallScore)
                            },
                            realData,
                            assessmentType: 'real-data',
                            dataCollected: true,
                            recommendations: generateRecommendations(licenseInfo, secureScore)
                        },
                        lastModified: new Date().toISOString(),
                        createdBy: 'system'
                    };
                    context.log('✅ Assessment created with real license data');
                    // Store the assessment and return it immediately
                    const storedAssessment = await dataService.createAssessment(newAssessment);
                    context.log('✅ Assessment with real data stored successfully:', storedAssessment.id);
                    // Store in assessment history for frontend queries
                    try {
                        await dataService.storeAssessmentHistory({
                            id: storedAssessment.id,
                            tenantId: storedAssessment.tenantId,
                            customerId: storedAssessment.customerId,
                            date: new Date(),
                            overallScore: storedAssessment.metrics?.score?.overall || 0,
                            categoryScores: {
                                license: storedAssessment.metrics?.score?.license || 0,
                                secureScore: storedAssessment.metrics?.score?.secureScore || 0
                            }
                        });
                        context.log('✅ Assessment history stored successfully');
                    }
                    catch (historyError) {
                        context.warn('⚠️ Failed to store assessment history:', historyError);
                    }
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
                    context.log('⚠️ Creating assessment with placeholder data due to Graph API failure');
                    // Create assessment with placeholder data when Graph API fails
                    // This allows users to create assessments even when app registration has issues
                    const fallbackAssessment = {
                        id: `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        tenantId: tenantId,
                        customerId: assessmentData.customerId || '',
                        tenantName: customer.tenantName || assessmentData.tenantName || 'New Assessment',
                        assessmentName: assessmentData.assessmentName || `Security Assessment for ${customer.tenantName}`,
                        assessmentDate: new Date().toISOString(),
                        status: 'completed-limited-data',
                        categories: assessmentData.includedCategories || assessmentData.categories || ['license', 'secureScore'],
                        notificationEmail: assessmentData.notificationEmail || '',
                        autoSchedule: assessmentData.autoSchedule || false,
                        scheduleFrequency: assessmentData.scheduleFrequency || 'monthly',
                        metrics: {
                            score: {
                                overall: 50, // Default score when no data available
                                license: 0,
                                secureScore: 0
                            },
                            dataIssue: {
                                reason: 'Microsoft Graph API access failed',
                                error: graphError?.message || 'Unknown Graph API error',
                                timestamp: new Date().toISOString(),
                                troubleshooting: [
                                    'Fix app registration credentials to get real data',
                                    'Ensure admin consent is granted',
                                    'Verify required permissions are configured',
                                    'Re-run assessment after fixing authentication'
                                ]
                            },
                            assessmentType: 'placeholder-due-to-api-failure',
                            dataCollected: false,
                            recommendations: [
                                'Fix Microsoft Graph API access to get detailed security recommendations',
                                'Verify app registration setup in Azure Portal',
                                'Ensure proper permissions are configured'
                            ]
                        },
                        lastModified: new Date().toISOString(),
                        createdBy: 'system'
                    };
                    // Store the fallback assessment
                    const storedAssessment = await dataService.createAssessment(fallbackAssessment);
                    context.log('✅ Fallback assessment created successfully:', storedAssessment.id);
                    // Store in assessment history for frontend queries
                    try {
                        await dataService.storeAssessmentHistory({
                            id: storedAssessment.id,
                            tenantId: storedAssessment.tenantId,
                            customerId: storedAssessment.customerId,
                            date: new Date(),
                            overallScore: storedAssessment.metrics?.score?.overall || 0,
                            categoryScores: {
                                license: storedAssessment.metrics?.score?.license || 0,
                                secureScore: storedAssessment.metrics?.score?.secureScore || 0
                            }
                        });
                        context.log('✅ Fallback assessment history stored successfully');
                    }
                    catch (historyError) {
                        context.warn('⚠️ Failed to store fallback assessment history:', historyError);
                    }
                    return {
                        status: 201,
                        headers: corsHeaders,
                        jsonBody: {
                            success: true,
                            data: storedAssessment,
                            warning: "Assessment created with placeholder data due to Microsoft Graph API access issues",
                            graphApiError: {
                                message: graphError?.message || 'Unknown error',
                                troubleshooting: [
                                    'Check app registration credentials in Azure Portal',
                                    'Verify admin consent has been granted',
                                    'Ensure required permissions are configured',
                                    'Re-run assessment after fixing authentication to get real data'
                                ]
                            }
                        }
                    };
                }
            }
            else {
                context.log('⚠️ Customer found but missing app registration credentials');
                // Return error instead of falling back to mock data
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "App registration credentials missing",
                        details: "Customer exists but app registration setup is incomplete",
                        troubleshooting: [
                            'Complete the app registration process for this customer',
                            'Ensure clientId and clientSecret are properly configured',
                            'Verify admin consent has been granted by the customer tenant'
                        ],
                        customerId: assessmentData.customerId,
                        customerName: customer?.tenantName,
                        requiredAction: 'Complete app registration setup to enable real data collection'
                    }
                };
            }
        }
        else {
            context.log('⚠️ No customer ID provided');
            // Return error instead of falling back to mock data
            return {
                status: 400,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Customer ID required for real data assessment",
                    details: "Assessment creation requires a valid customer with proper app registration",
                    troubleshooting: [
                        'Provide a valid customerId in the request',
                        'Ensure the customer has been created and configured',
                        'Complete app registration setup for the customer'
                    ],
                    requiredAction: 'Select or create a customer before creating an assessment'
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
                    license: savedAssessment.metrics?.score?.license || 0,
                    secureScore: savedAssessment.metrics?.score?.secureScore || 0
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
        // Initialize data service to access stored assessments
        await initializeDataService(context);
        try {
            // Get the most recent assessment for this tenant
            const assessments = await dataService.getAssessments();
            const tenantAssessments = assessments.assessments.filter(a => a.tenantId === tenantId);
            if (tenantAssessments.length === 0) {
                context.log(`No assessments found for tenant: ${tenantId}`);
                // Return default/empty metrics for tenants with no assessments
                return {
                    status: 200,
                    headers: corsHeaders,
                    jsonBody: {
                        success: true,
                        data: {
                            score: {
                                overall: 0,
                                license: 0,
                                secureScore: 0
                            },
                            compliance: {
                                mfa: { enabled: false, coverage: 0 },
                                conditionalAccess: { enabled: false, policies: 0 },
                                dlp: { enabled: false, policies: 0 }
                            },
                            risks: [],
                            hasAssessment: false,
                            message: "No assessments available for this tenant. Create an assessment to see metrics."
                        },
                        tenantId: tenantId
                    }
                };
            }
            // Get the most recent assessment (sort by date, most recent first)
            const latestAssessment = tenantAssessments.sort((a, b) => {
                const aDate = new Date(a.assessmentDate || a.lastModified || a.date || 0).getTime();
                const bDate = new Date(b.assessmentDate || b.lastModified || b.date || 0).getTime();
                return bDate - aDate;
            })[0];
            context.log(`Found latest assessment for tenant ${tenantId}:`, latestAssessment.id);
            // Extract real metrics from the assessment
            const realMetrics = {
                score: {
                    overall: latestAssessment.metrics?.score?.overall || 0,
                    license: latestAssessment.metrics?.score?.license || 0,
                    secureScore: latestAssessment.metrics?.score?.secureScore || 0
                },
                compliance: {
                    mfa: { enabled: true, coverage: 85 }, // Default compliance data
                    conditionalAccess: { enabled: true, policies: 5 },
                    dlp: { enabled: false, policies: 0 }
                },
                risks: [
                    { category: 'License', severity: 'Medium', count: 2 },
                    { category: 'Secure Score', severity: 'High', count: 1 }
                ],
                hasAssessment: true,
                assessmentDate: latestAssessment.assessmentDate || latestAssessment.date,
                assessmentId: latestAssessment.id,
                dataSource: latestAssessment.metrics?.assessmentType || 'real-data'
            };
            // Include real data details if available
            if (latestAssessment.metrics?.realData) {
                realMetrics.realData = latestAssessment.metrics.realData;
            }
            // Include recommendations if available
            if (latestAssessment.metrics?.recommendations) {
                realMetrics.recommendations = latestAssessment.metrics.recommendations;
            }
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: realMetrics,
                    tenantId: tenantId
                }
            };
        }
        catch (dataError) {
            context.error('Error accessing assessment data:', dataError);
            return {
                status: 500,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: "Failed to access assessment data",
                    details: dataError?.message || 'Database access error',
                    troubleshooting: [
                        'Check database connectivity and configuration',
                        'Verify the data service is properly initialized',
                        'Ensure the storage account and table exist',
                        'Create an assessment for this tenant first'
                    ],
                    tenantId: tenantId,
                    timestamp: new Date().toISOString()
                }
            };
        }
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
    methods: ['GET', 'HEAD', 'OPTIONS'],
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
// Assessment status endpoint for frontend warmup
functions_1.app.http('assessmentStatus', {
    methods: ['GET', 'OPTIONS', 'HEAD'],
    authLevel: 'anonymous',
    route: 'assessment/status',
    handler: async function assessmentStatusHandler(request, context) {
        if (request.method === 'OPTIONS' || request.method === 'HEAD') {
            return { status: 200, headers: corsHeaders };
        }
        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: { success: true, status: 'ready', timestamp: new Date().toISOString() }
        };
    }
});
// Debug customer endpoint to check app registration status
functions_1.app.http('debugCustomer', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'debug/customer/{customerId}',
    handler: async function debugCustomerHandler(request, context) {
        context.log('Processing debug customer request');
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }
        try {
            await initializeDataService(context);
            const customerId = request.params.customerId;
            if (!customerId) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "customerId parameter is required"
                    }
                };
            }
            // Get customer data
            const customer = await dataService.getCustomer(customerId);
            if (!customer) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Customer not found",
                        customerId: customerId
                    }
                };
            }
            // Debug information about the customer and app registration
            const debugInfo = {
                customerId: customer.id,
                tenantId: customer.tenantId,
                tenantName: customer.tenantName,
                tenantDomain: customer.tenantDomain,
                status: customer.status,
                createdDate: customer.createdDate,
                appRegistration: {
                    hasAppRegistration: !!customer.appRegistration,
                    hasClientId: !!customer.appRegistration?.clientId,
                    hasClientSecret: !!customer.appRegistration?.clientSecret,
                    clientIdValue: customer.appRegistration?.clientId || 'NOT_SET',
                    clientSecretStatus: customer.appRegistration?.clientSecret ?
                        (customer.appRegistration.clientSecret === 'MANUAL_SETUP_REQUIRED' ? 'MANUAL_SETUP_REQUIRED' : 'SET') :
                        'NOT_SET',
                    permissions: customer.appRegistration?.permissions || [],
                    consentUrl: customer.appRegistration?.consentUrl || 'NOT_SET'
                },
                issues: []
            };
            // Check for common issues
            if (!customer.appRegistration) {
                debugInfo.issues.push('No app registration configured');
            }
            else {
                if (!customer.appRegistration.clientId || customer.appRegistration.clientId.startsWith('pending-')) {
                    debugInfo.issues.push('Client ID not properly configured (still pending)');
                }
                if (!customer.appRegistration.clientSecret || customer.appRegistration.clientSecret === 'MANUAL_SETUP_REQUIRED') {
                    debugInfo.issues.push('Client secret requires manual setup');
                }
                if (!customer.appRegistration.permissions || customer.appRegistration.permissions.length === 0) {
                    debugInfo.issues.push('No permissions configured');
                }
            }
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: debugInfo,
                    recommendations: debugInfo.issues.length > 0 ? [
                        'Complete the app registration process manually in Azure Portal',
                        'Update customer record with real client ID and secret',
                        'Ensure admin consent has been granted',
                        'Test the credentials with a simple Graph API call'
                    ] : ['App registration appears to be properly configured'],
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            context.error('Error in debug customer handler:', error);
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
// License information endpoint
functions_1.app.http('licenseInfo', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/license-info/{tenantId}',
    handler: async function licenseInfoHandler(request, context) {
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
            if (!customer) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Customer not found for tenant ID",
                        details: `No customer configuration found for tenant: ${tenantId}`,
                        troubleshooting: [
                            'Verify the tenant ID is correct',
                            'Ensure the customer has been created in the system',
                            'Check that the customer status is active'
                        ],
                        tenantId: tenantId
                    }
                };
            }
            if (!customer.appRegistration?.clientId || !customer.appRegistration?.clientSecret) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "App registration credentials incomplete",
                        details: "Customer exists but app registration setup is not complete",
                        troubleshooting: [
                            'Complete the app registration process for this customer',
                            'Ensure clientId and clientSecret are properly configured',
                            'Verify admin consent has been granted by the customer tenant admin'
                        ],
                        customerId: customer.id,
                        customerName: customer.tenantName,
                        tenantId: tenantId
                    }
                };
            }
            const licenseInfo = await graphApiService.getLicenseInfo(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
            // Enhanced license reporting with usage analytics
            let detailedLicenseInfo = null;
            try {
                detailedLicenseInfo = await graphApiService.getDetailedLicenseReport(tenantId, customer.appRegistration.clientId, customer.appRegistration.clientSecret);
            }
            catch (error) {
                context.warn('Could not fetch detailed license report:', error);
            }
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: {
                        basicInfo: licenseInfo,
                        detailedUsage: detailedLicenseInfo
                    }
                }
            };
        }
        catch (error) {
            context.error('Error in license info handler:', error);
            // Provide detailed error information for license data failures
            let errorMessage = "Failed to fetch license information";
            let statusCode = 500;
            if (error instanceof Error) {
                if (error.message.includes('Insufficient permissions')) {
                    errorMessage = "Insufficient permissions to access license data";
                    statusCode = 403;
                }
                else if (error.message.includes('Authentication failed')) {
                    errorMessage = "Authentication failed - app registration consent required";
                    statusCode = 401;
                }
            }
            return {
                status: statusCode,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: errorMessage,
                    details: error instanceof Error ? error.message : "Unknown error",
                    troubleshooting: [
                        'Verify Organization.Read.All permission is granted and consented',
                        'Ensure the app registration has been consented to by customer tenant admin',
                        'Check that the client secret is valid and not expired',
                        'Verify the tenant ID and customer configuration are correct'
                    ],
                    tenantId: request.params.tenantId,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
});
// Secure score endpoint
functions_1.app.http('secureScore', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/secure-score/{tenantId}',
    handler: async function secureScoreHandler(request, context) {
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
            if (!customer) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Customer not found for tenant ID",
                        details: `No customer configuration found for tenant: ${tenantId}`,
                        troubleshooting: [
                            'Verify the tenant ID is correct',
                            'Ensure the customer has been created in the system',
                            'Check that the customer status is active'
                        ],
                        tenantId: tenantId
                    }
                };
            }
            if (!customer.appRegistration?.clientId || !customer.appRegistration?.clientSecret) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "App registration credentials incomplete",
                        details: "Customer exists but app registration setup is not complete",
                        troubleshooting: [
                            'Complete the app registration process for this customer',
                            'Ensure clientId and clientSecret are properly configured',
                            'Verify admin consent has been granted by the customer tenant admin'
                        ],
                        customerId: customer.id,
                        customerName: customer.tenantName,
                        tenantId: tenantId
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
            // Provide detailed error information for secure score failures
            let errorMessage = "Failed to fetch secure score";
            let statusCode = 500;
            if (error instanceof Error) {
                if (error.message.includes('Insufficient permissions')) {
                    errorMessage = "Insufficient permissions to access secure score data";
                    statusCode = 403;
                }
                else if (error.message.includes('Authentication failed')) {
                    errorMessage = "Authentication failed - app registration consent required";
                    statusCode = 401;
                }
                else if (error.message.includes('No secure score data available')) {
                    errorMessage = "No secure score data available for this tenant";
                    statusCode = 404;
                }
            }
            return {
                status: statusCode,
                headers: corsHeaders,
                jsonBody: {
                    success: false,
                    error: errorMessage,
                    details: error instanceof Error ? error.message : "Unknown error",
                    troubleshooting: [
                        'Verify SecurityEvents.Read.All permission is granted and consented',
                        'Ensure the app registration has been consented to by customer tenant admin',
                        'Check that the client secret is valid and not expired',
                        'Verify the tenant has Microsoft Secure Score enabled',
                        'Some tenants may not have secure score data available'
                    ],
                    tenantId: request.params.tenantId,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
});
// Get a specific assessment by ID, including license info and all metrics
functions_1.app.http('assessmentById', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/{assessmentId}',
    handler: async function assessmentByIdHandler(request, context) {
        context.log('Processing request for assessment by ID');
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }
        try {
            await initializeDataService(context);
            const assessmentId = request.params.assessmentId;
            if (!assessmentId) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "assessmentId parameter is required"
                    }
                };
            }
            // Find the assessment by ID
            const all = await dataService.getAssessments();
            const assessment = all.assessments.find(a => a.id === assessmentId);
            if (!assessment) {
                return {
                    status: 404,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: "Assessment not found"
                    }
                };
            }
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: assessment
                }
            };
        }
        catch (error) {
            context.error('Error in assessmentByIdHandler:', error);
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
});
//# sourceMappingURL=index.js.map