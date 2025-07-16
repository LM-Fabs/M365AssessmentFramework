import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
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

// Performance optimization: Cache frequently accessed data
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = {
    customers: 300000, // 5 minutes
    assessments: 180000, // 3 minutes
    metrics: 120000, // 2 minutes
    bestPractices: 600000 // 10 minutes
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

// Cache helper functions for performance optimization
function getCachedData(key: string): any | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
    }
    cache.delete(key);
    return null;
}

function setCachedData(key: string, data: any, ttl: number): void {
    cache.set(key, { data, timestamp: Date.now(), ttl });
}

// Optimized data service initialization with singleton pattern
async function initializeDataService(context: InvocationContext): Promise<void> {
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
            
            // Check if PostgreSQL is configured
            const hasPostgresConfig = process.env.POSTGRES_HOST && process.env.POSTGRES_DATABASE;
            
            if (hasPostgresConfig) {
                try {
                    // Initialize PostgreSQL service
                    context.log('🐘 Attempting to initialize PostgreSQL service...');
                    postgresqlService = new PostgreSQLService();
                    await postgresqlService.initialize();
                    dataService = postgresqlService;
                    usingPostgreSQL = true;
                    context.log('✅ PostgreSQL service initialized successfully - unlimited data storage enabled!');
                } catch (error) {
                    context.warn('⚠️ PostgreSQL initialization failed, falling back to Table Storage:', error);
                    // Fall back to Table Storage
                    tableStorageService = new TableStorageService();
                    await tableStorageService.initialize();
                    dataService = tableStorageService;
                    usingPostgreSQL = false;
                    context.log('✅ Table Storage service initialized as fallback');
                }
            } else {
                // Use Table Storage when PostgreSQL is not configured
                context.log('📊 Using Table Storage service (PostgreSQL not configured)');
                tableStorageService = new TableStorageService();
                await tableStorageService.initialize();
                dataService = tableStorageService;
                usingPostgreSQL = false;
            }
            
            // Initialize Graph API service with better error handling
            try {
                graphApiService = new GraphApiService();
                context.log('✅ Graph API service initialized');
            } catch (error) {
                context.warn('⚠️ Graph API service initialization failed:', error);
                throw error;
            }
            
            // Initialize Key Vault service (optional but recommended)
            try {
                keyVaultService = await getKeyVaultService();
                context.log('✅ Key Vault service initialized');
            } catch (error) {
                context.warn('⚠️ Key Vault service initialization failed:', error);
                // Continue without Key Vault - it's optional
            }
            
            isDataServiceInitialized = true;
            const initTime = Date.now() - startTime;
            context.log(`✅ Data services initialized in ${initTime}ms using ${usingPostgreSQL ? 'PostgreSQL' : 'Table Storage'}`);
        } catch (error) {
            context.error('❌ Failed to initialize data services:', error);
            throw error;
        }
    })();
    
    return initializationPromise;
}

// Main customers handler
async function customersHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const startTime = Date.now();
    
    try {
        await initializeDataService(context);
        
        // Handle OPTIONS request for CORS
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }
        
        if (request.method === 'GET') {
            // Get all customers with caching
            const cacheKey = 'customers_all';
            const cachedCustomers = getCachedData(cacheKey);
            
            if (cachedCustomers) {
                context.log('📋 Returning cached customers data');
                return {
                    status: 200,
                    headers: corsHeaders,
                    jsonBody: cachedCustomers
                };
            }
            
            context.log('📋 Fetching customers from database...');
            const result = await dataService.getCustomers();
            
            // Transform customers for frontend compatibility
            const transformedCustomers = result.customers.map((customer: Customer) => ({
                id: customer.id,
                tenantId: customer.tenantId,
                tenantName: customer.tenantName,
                tenantDomain: customer.tenantDomain,
                applicationId: customer.applicationId,
                clientId: customer.clientId,
                servicePrincipalId: customer.servicePrincipalId,
                createdDate: customer.createdDate,
                lastAssessmentDate: customer.lastAssessmentDate,
                totalAssessments: customer.totalAssessments || 0,
                status: customer.status || 'active',
                permissions: customer.permissions || [],
                contactEmail: customer.contactEmail,
                notes: customer.notes
            }));
            
            const response = {
                success: true,
                data: transformedCustomers,
                count: transformedCustomers.length,
                timestamp: new Date().toISOString(),
                continuationToken: 'continuationToken' in result ? result.continuationToken : undefined
            };
            
            // Cache the result
            setCachedData(cacheKey, response, CACHE_TTL.customers);
            
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: response
            };
        }

        if (request.method === 'POST') {
            let customerData: any = {};
            
            try {
                customerData = await request.json();
            } catch (error) {
                context.error('❌ Invalid JSON in request body:', error);
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: 'Invalid JSON in request body'
                    }
                };
            }
            
            context.log('📝 Creating new customer:', customerData);
            
            // Validate required fields
            if (!customerData.tenantName || !customerData.tenantDomain) {
                return {
                    status: 400,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: 'Missing required fields: tenantName and tenantDomain'
                    }
                };
            }
            
            try {
                const newCustomer = await dataService.createCustomer(customerData);
                
                // Clear customers cache
                cache.delete('customers_all');
                
                context.log('✅ Customer created successfully:', newCustomer.id);
                
                return {
                    status: 201,
                    headers: corsHeaders,
                    jsonBody: {
                        success: true,
                        data: newCustomer,
                        timestamp: new Date().toISOString()
                    }
                };
            } catch (error) {
                context.error('❌ Failed to create customer:', error);
                return {
                    status: 500,
                    headers: corsHeaders,
                    jsonBody: {
                        success: false,
                        error: 'Failed to create customer',
                        details: error instanceof Error ? error.message : 'Unknown error'
                    }
                };
            }
        }
        
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: 'Method not allowed'
            }
        };
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        context.error(`❌ Error in customers handler (${processingTime}ms):`, error);
        
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            }
        };
    }
}

export default customersHandler;
