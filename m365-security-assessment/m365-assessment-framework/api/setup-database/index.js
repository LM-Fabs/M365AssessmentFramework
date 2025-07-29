"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
const postgresqlService_1 = require("../shared/postgresqlService");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('setup-database', {
    methods: ['POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'setup-database',
    handler: setupDatabaseHandler
});
/**
 * Azure Functions v4 - One-time Database Setup endpoint
 * Individual self-registration for Azure Static Web Apps compatibility
 * This should only be called once to initialize the database schema
 */
async function setupDatabaseHandler(request, context) {
    context.log(`🔧 Setup Database function called - ${request.method} ${request.url}`);
    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        // Force schema creation by temporarily accessing private method
        const service = postgresqlService_1.postgresqlService;
        // Initialize connection pool
        await service.initializePoolAsync();
        // Get a client and force schema creation
        const client = await service.pool.connect();
        try {
            console.log('🔧 Running one-time database schema setup...');
            // Force schema creation
            await service.createTables(client);
            console.log('✅ Database schema setup completed successfully');
            // Test the schema by querying tables
            const tablesResult = await client.query(`
                SELECT table_name, column_name, data_type
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name IN ('customers', 'assessments', 'assessment_history')
                ORDER BY table_name, ordinal_position;
            `);
            return {
                status: 200,
                headers: utils_1.corsHeaders,
                jsonBody: {
                    success: true,
                    message: "Database schema setup completed successfully",
                    tables: tablesResult.rows,
                    timestamp: new Date().toISOString()
                }
            };
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        context.error('❌ Setup Database function error:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: new Date().toISOString()
            }
        };
    }
}
//# sourceMappingURL=index.js.map