"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyVaultService = exports.graphApiService = exports.dataService = exports.initializeDataService = exports.corsHeaders = void 0;
// v3 compatible imports
const postgresqlService_1 = require("../shared/postgresqlService");
const graphApiService_1 = require("../shared/graphApiService");
const keyVaultService_1 = require("../shared/keyVaultService");
// CORS headers optimized for better performance
exports.corsHeaders = process.env.NODE_ENV === 'development' ? {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Warmup, Cache-Control',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60, s-maxage=60' // Cache responses for 1 minute
} : {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Warmup, Cache-Control',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60, s-maxage=60' // Cache responses for 1 minute
};
// Initialize data services with connection pooling
let postgresqlService;
let graphApiService = null;
exports.graphApiService = graphApiService;
let keyVaultService = null;
exports.keyVaultService = keyVaultService;
let dataService;
exports.dataService = dataService;
let isDataServiceInitialized = false;
let initializationPromise = null;
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
            // Check if PostgreSQL is configured
            const hasPostgresConfig = process.env.POSTGRES_HOST && process.env.POSTGRES_DATABASE;
            if (!hasPostgresConfig) {
                throw new Error('PostgreSQL configuration missing: POSTGRES_HOST and/or POSTGRES_DATABASE not set.');
            }
            try {
                // Initialize PostgreSQL service
                context.log('🐘 Attempting to initialize PostgreSQL service...');
                postgresqlService = new postgresqlService_1.PostgreSQLService();
                await postgresqlService.initialize();
                exports.dataService = dataService = postgresqlService;
                context.log('✅ PostgreSQL service initialized successfully - unlimited data storage enabled!');
            }
            catch (error) {
                context.error('❌ PostgreSQL initialization failed:', error);
                throw new Error('PostgreSQL initialization failed: ' + (error instanceof Error ? error.message : error));
            }
            // Initialize Graph API service with better error handling
            try {
                exports.graphApiService = graphApiService = new graphApiService_1.GraphApiService();
                context.log('✅ GraphApiService initialized successfully');
            }
            catch (error) {
                context.error('⚠️ GraphApiService initialization failed:', error);
                // Continue without GraphAPI service - app registration features will be limited
            }
            // Initialize Key Vault service if configured
            if (process.env.KEY_VAULT_URL) {
                try {
                    exports.keyVaultService = keyVaultService = await (0, keyVaultService_1.getKeyVaultService)();
                    context.log('✅ KeyVaultService initialized successfully');
                }
                catch (error) {
                    context.error('⚠️ KeyVaultService initialization failed:', error);
                    // Continue without Key Vault - some features may be limited
                }
            }
            else {
                context.log('ℹ️ KEY_VAULT_URL not configured - Key Vault features disabled');
            }
            const endTime = Date.now();
            context.log(`🚀 Data services initialization completed in ${endTime - startTime}ms`);
            isDataServiceInitialized = true;
        }
        catch (error) {
            context.error('❌ Data service initialization failed:', error);
            // Reset promise to allow retry
            initializationPromise = null;
            throw error;
        }
    })();
    return initializationPromise;
}
exports.initializeDataService = initializeDataService;
//# sourceMappingURL=utils.js.map