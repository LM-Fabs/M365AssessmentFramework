import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosDbService } from "./shared/cosmosDbService";

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

// Initialize Cosmos DB service
let cosmosDbService: CosmosDbService;
let isCosmosInitialized = false;

// Initialize Cosmos DB service
async function initializeCosmosDb(context: InvocationContext): Promise<void> {
    if (!isCosmosInitialized) {
        try {
            context.log('Initializing Cosmos DB service...');
            cosmosDbService = new CosmosDbService();
            await cosmosDbService.initialize();
            isCosmosInitialized = true;
            context.log('Cosmos DB service initialized successfully');
        } catch (error) {
            context.log('Failed to initialize Cosmos DB service:', error);
            throw error;
        }
    }
}

// Test endpoint - immediate fast response
async function testHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Test function processed a request');
    
    return { 
        status: 200,
        headers: corsHeaders,
        jsonBody: {
            message: "M365 Assessment API is working!",
            timestamp: new Date().toISOString(),
            version: "1.0.5",
            status: "healthy"
        }
    };
}

// Optimized customers endpoint with immediate response
async function customersHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Processing ${request.method} request for customers`);

    // Handle preflight OPTIONS request immediately
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Initialize Cosmos DB if needed
        await initializeCosmosDb(context);

        if (request.method === 'GET') {
            context.log('Getting all customers from Cosmos DB');
            
            const result = await cosmosDbService.getCustomers({
                status: 'active',
                maxItemCount: 100
            });
            
            context.log('Retrieved customers from Cosmos DB:', result.customers.length);
            
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: result.customers,
                    count: result.customers.length,
                    timestamp: new Date().toISOString(),
                    continuationToken: result.continuationToken
                }
            };
        }

        if (request.method === 'POST') {
            let customerData: any = {};
            
            try {
                customerData = await request.json();
            } catch (error) {
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

            // Check if customer already exists
            if (customerData.tenantDomain) {
                const existingCustomer = await cosmosDbService.getCustomerByDomain(customerData.tenantDomain);
                if (existingCustomer) {
                    return {
                        status: 409,
                        headers: corsHeaders,
                        jsonBody: {
                            success: false,
                            error: `Customer with domain ${customerData.tenantDomain} already exists`
                        }
                    };
                }
            }

            // Create customer using Cosmos DB service
            const customerRequest = {
                tenantName: customerData.tenantName || "New Customer",
                tenantDomain: customerData.tenantDomain || `${customerData.tenantName?.toLowerCase().replace(/\s+/g, '-') || 'customer'}.onmicrosoft.com`,
                contactEmail: customerData.contactEmail,
                notes: customerData.notes
            };

            const appRegistration = {
                applicationId: `app-${Date.now()}`,
                clientId: `client-${Date.now()}`,
                servicePrincipalId: `sp-${Date.now()}`,
                permissions: ["Directory.Read.All", "SecurityEvents.Read.All"]
            };

            const newCustomer = await cosmosDbService.createCustomer(customerRequest, appRegistration);
            
            context.log('Customer created successfully:', newCustomer.id);

            return {
                status: 201,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: {
                        customer: newCustomer,
                        nextSteps: [
                            "Customer created successfully",
                            "App registration would be created in production",
                            "Admin consent would be required"
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

    } catch (error) {
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

// Fast assessment history endpoint
async function assessmentHistoryHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Processing ${request.method} request for assessment history`);

    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Initialize Cosmos DB if needed
        await initializeCosmosDb(context);

        if (request.method === 'GET') {
            const tenantId = request.params.tenantId;
            const customerId = request.params.customerId;
            const limit = Math.min(parseInt(request.query.get('limit') || '10'), 100); // Cap at 100

            context.log('Getting assessment history for:', tenantId || customerId || 'all');

            // Get assessment history from Cosmos DB
            const assessmentHistory = await cosmosDbService.getAssessmentHistory({
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
            let historyData: any = {};
            
            try {
                historyData = await request.json();
            } catch (error) {
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

            // Store assessment history using Cosmos DB
            await cosmosDbService.storeAssessmentHistory({
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

    } catch (error) {
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
async function assessmentsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Processing ${request.method} request for assessments`);

    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        // Initialize Cosmos DB if needed
        await initializeCosmosDb(context);

        // Get query parameters for filtering
        const customerId = request.query.get('customerId');
        const status = request.query.get('status');
        const limit = Math.min(parseInt(request.query.get('limit') || '50'), 100);

        let assessments: any[] = [];

        if (customerId) {
            // Get assessments for specific customer
            const result = await cosmosDbService.getCustomerAssessments(customerId, {
                status: status || undefined,
                limit: limit
            });
            assessments = result.assessments;
        } else {
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

    } catch (error) {
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
async function currentAssessmentHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    } catch (error) {
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
async function bestPracticesHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    } catch (error) {
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
async function createAssessmentHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Processing request to create assessment');

    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        let assessmentData: any = {};
        
        try {
            assessmentData = await request.json();
        } catch (error) {
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
    } catch (error) {
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
async function saveAssessmentHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Processing request to save assessment');

    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        let assessmentData: any = {};
        
        try {
            assessmentData = await request.json();
        } catch (error) {
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

        // Initialize Cosmos DB if needed
        await initializeCosmosDb(context);

        // Save or update the assessment in Cosmos DB
        let savedAssessment;
        if (assessmentData.id && assessmentData.customerId) {
            // Update existing assessment
            savedAssessment = await cosmosDbService.updateAssessment(
                assessmentData.id, 
                assessmentData.customerId, 
                assessmentData
            );
        } else {
            // Create new assessment
            savedAssessment = await cosmosDbService.createAssessment(assessmentData);
        }

        // Store in assessment history for comparison purposes
        if (savedAssessment.tenantId) {
            await cosmosDbService.storeAssessmentHistory({
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
    } catch (error) {
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
async function getMetricsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    } catch (error) {
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

// Register all functions with optimized configuration
app.http('test', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'test',
    handler: testHandler
});

app.http('customers', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers',
    handler: customersHandler
});

app.http('assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments',
    handler: assessmentsHandler
});

app.http('currentAssessment', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/current',
    handler: currentAssessmentHandler
});

// Assessment history endpoints
app.http('assessmentHistory', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history',
    handler: assessmentHistoryHandler
});

app.http('assessmentHistoryByTenant', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/{tenantId}',
    handler: assessmentHistoryHandler
});

app.http('assessmentHistoryByCustomer', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment-history/customer/{customerId}',
    handler: assessmentHistoryHandler
});

// Best practices endpoint
app.http('bestPractices', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'best-practices',
    handler: bestPracticesHandler
});

// Create assessment endpoint
app.http('createAssessment', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessment/create',
    handler: createAssessmentHandler
});

// Save assessment endpoint
app.http('saveAssessment', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'save-assessment',
    handler: saveAssessmentHandler
});

// Get metrics endpoint
app.http('getMetrics', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'GetMetrics',
    handler: getMetricsHandler
});

// Initialize on startup
console.log('Azure Functions API initialized successfully - Version 1.0.5');