"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
const postgresqlService_1 = require("../shared/postgresqlService");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('database-schema', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'database-schema',
    handler: databaseSchemaHandler
});
/**
 * Azure Functions v4 - Database Schema Check endpoint
 * Individual self-registration for Azure Static Web Apps compatibility
 */
async function databaseSchemaHandler(request, context) {
    context.log(`🔍 Database Schema function called - ${request.method} ${request.url}`);
    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        // Get assessments table schema
        const schemaResult = await postgresqlService_1.postgresqlService.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'assessments' 
            ORDER BY ordinal_position;
        `);
        // Get table triggers
        const triggersResult = await postgresqlService_1.postgresqlService.query(`
            SELECT trigger_name, trigger_schema, event_manipulation, action_statement
            FROM information_schema.triggers 
            WHERE event_object_table = 'assessments';
        `);
        // Try a minimal test insert to see exact error
        let testInsertError = null;
        try {
            await postgresqlService_1.postgresqlService.query(`
                INSERT INTO assessments (id, customer_id, tenant_id, date, status, score, metrics, recommendations, created_at, updated_at)
                VALUES ('test-id', 1, 'test-tenant', NOW(), 'in_progress', 0, '{}', '{}', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;
            `);
            // Clean up test record
            await postgresqlService_1.postgresqlService.query(`DELETE FROM assessments WHERE id = 'test-id';`);
        }
        catch (insertError) {
            testInsertError = insertError instanceof Error ? insertError.message : String(insertError);
        }
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            jsonBody: {
                success: true,
                data: {
                    schema: schemaResult.rows,
                    triggers: triggersResult.rows,
                    testInsertError,
                    timestamp: new Date().toISOString()
                }
            }
        };
    }
    catch (error) {
        context.error('❌ Database Schema function error:', error);
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