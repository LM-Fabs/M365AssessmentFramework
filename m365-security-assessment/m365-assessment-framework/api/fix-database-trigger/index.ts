import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders } from "../shared/utils";
import { postgresqlService } from "../shared/postgresqlService";

// Azure Functions v4 - Individual function self-registration for Static Web Apps
app.http('fix-database-trigger', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'fix-database-trigger',
    handler: fixDatabaseTriggerHandler
});

/**
 * Azure Functions v4 - Database Trigger Fix endpoint
 * Removes problematic triggers that are causing assessment creation to fail
 */
async function fixDatabaseTriggerHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`🔧 Database Trigger Fix function called - ${request.method} ${request.url}`);

    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        context.log('🧹 Cleaning up problematic database triggers...');

        // First, check what triggers exist
        const beforeCleanup = await postgresqlService.query(`
            SELECT trigger_name, trigger_schema, event_manipulation, action_statement
            FROM information_schema.triggers 
            WHERE event_object_table = 'assessments';
        `);

        context.log(`Found ${beforeCleanup.rows.length} triggers before cleanup:`, beforeCleanup.rows);

        // Check what functions exist
        const functionsQuery = await postgresqlService.query(`
            SELECT routine_name, routine_type 
            FROM information_schema.routines 
            WHERE routine_name LIKE '%updated_at%' 
            AND routine_schema = 'public';
        `);
        context.log('Found functions with updated_at:', functionsQuery.rows);

        // Drop all triggers first (order matters)
        const triggerDropCommands = [
            'DROP TRIGGER IF EXISTS update_assessments_updated_at ON assessments;',
            'DROP TRIGGER IF EXISTS update_assessments_timestamp ON assessments;',
            'DROP TRIGGER IF EXISTS update_updated_at_trigger ON assessments;',
            'DROP TRIGGER IF EXISTS assessments_update_trigger ON assessments;',
            'DROP TRIGGER IF EXISTS tr_assessments_updated_at ON assessments;'
        ];

        for (const command of triggerDropCommands) {
            try {
                await postgresqlService.query(command);
                context.log(`✅ Executed: ${command}`);
            } catch (error) {
                context.log(`⚠️ Failed: ${command} - ${error}`);
            }
        }

        // Now try to drop functions with CASCADE
        const functionDropCommands = [
            'DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;',
            'DROP FUNCTION IF EXISTS update_updated_at() CASCADE;',
            'DROP FUNCTION IF EXISTS update_timestamp() CASCADE;',
            'DROP FUNCTION IF EXISTS set_updated_at() CASCADE;'
        ];

        for (const command of functionDropCommands) {
            try {
                await postgresqlService.query(command);
                context.log(`✅ Executed: ${command}`);
            } catch (error) {
                context.log(`⚠️ Failed: ${command} - ${error}`);
            }
        }

        // Check what triggers exist after cleanup
        const afterCleanup = await postgresqlService.query(`
            SELECT trigger_name, trigger_schema, event_manipulation, action_statement
            FROM information_schema.triggers 
            WHERE event_object_table = 'assessments';
        `);

        context.log(`Found ${afterCleanup.rows.length} triggers after cleanup:`, afterCleanup.rows);

        // Test assessment creation to verify the fix
        let testResult = 'not_attempted';
        try {
            const testAssessmentId = `test-${Date.now()}`;
            await postgresqlService.query(`
                INSERT INTO assessments (
                    id, customer_id, tenant_id, date, status, score, metrics, recommendations, created_at, updated_at
                ) VALUES ($1, $2, $3, NOW(), 'completed', 0, '{}', '[]', NOW(), NOW())
            `, [testAssessmentId, 'da0d28e8-e7ca-4133-bfa8-f193bb26664d', '70adb6e8-c6f7-4f25-a75f-9bca098db644']);
            
            // Clean up test record
            await postgresqlService.query(`DELETE FROM assessments WHERE id = $1`, [testAssessmentId]);
            testResult = 'success';
            context.log('✅ Test assessment creation succeeded');
        } catch (testError) {
            testResult = testError instanceof Error ? testError.message : String(testError);
            context.log('❌ Test assessment creation failed:', testResult);
        }

        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                message: 'Database trigger cleanup completed',
                data: {
                    triggersBeforeCleanup: beforeCleanup.rows,
                    triggersAfterCleanup: afterCleanup.rows,
                    testAssessmentCreation: testResult,
                    timestamp: new Date().toISOString()
                }
            }
        };

    } catch (error) {
        context.error('❌ Database Trigger Fix function error:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: new Date().toISOString()
            }
        };
    }
}
