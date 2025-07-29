"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
const postgresqlService_1 = require("../shared/postgresqlService");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('fix-triggers', {
    methods: ['POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'fix-triggers',
    handler: fixTriggersHandler
});
/**
 * Azure Functions v4 - Fix Database Triggers endpoint
 * Individual self-registration for Azure Static Web Apps compatibility
 * This recreates the triggers to fix the updated_at issue
 */
async function fixTriggersHandler(request, context) {
    context.log(`🔧 Fix Triggers function called - ${request.method} ${request.url}`);
    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        // Force direct access to the pool
        const service = postgresqlService_1.postgresqlService;
        await service.initialize();
        const client = await service.pool.connect();
        try {
            console.log('🔧 Dropping and recreating triggers...');
            // Drop the existing trigger and function
            await client.query(`
                DROP TRIGGER IF EXISTS update_assessments_updated_at ON assessments;
                DROP FUNCTION IF EXISTS update_updated_at_column();
            `);
            // Recreate the function and trigger
            await client.query(`
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
                
                CREATE TRIGGER update_assessments_updated_at
                    BEFORE UPDATE ON assessments
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
            `);
            console.log('✅ Triggers recreated successfully');
            // Test a simple INSERT to see if it works now
            let testResult = null;
            let testError = null;
            try {
                const testUuid = crypto.randomUUID();
                const customerId = "a24fa553-add5-4f70-bc24-410bb900d6c8";
                const tenantId = "test-tenant";
                await client.query(`
                    INSERT INTO assessments (id, customer_id, tenant_id, date, status, score, metrics, recommendations, created_at, updated_at)
                    VALUES ($1, $2, $3, NOW(), 'in_progress', 0, '{}', '{}', NOW(), NOW());
                `, [testUuid, customerId, tenantId]);
                testResult = "INSERT successful!";
                // Clean up test record
                await client.query(`DELETE FROM assessments WHERE id = $1;`, [testUuid]);
            }
            catch (insertError) {
                testError = insertError instanceof Error ? insertError.message : String(insertError);
            }
            return {
                status: 200,
                headers: utils_1.corsHeaders,
                jsonBody: {
                    success: true,
                    message: "Triggers recreated successfully",
                    testResult,
                    testError,
                    timestamp: new Date().toISOString()
                }
            };
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        context.error('❌ Fix Triggers function error:', error);
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