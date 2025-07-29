import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

/**
 * Troubleshoot existing database triggers and schema
 */
export async function troubleshootDatabase(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        context.log('🔍 Troubleshooting PostgreSQL triggers and schema...');
        
        // Import dynamically to avoid initialization issues
        const { PostgreSQLService } = await import("../shared/postgresqlService");
        const dbService = new PostgreSQLService();
        
        // Get connection info
        await dbService.initialize();
        const pool = (dbService as any).pool;
        
        if (!pool) {
            throw new Error('Database connection not available');
        }
        
        const client = await pool.connect();
        
        try {
            const results: any = {};
            
            // 1. Check for existing triggers on assessments table
            const triggerQuery = `
                SELECT 
                    trigger_name,
                    event_manipulation,
                    action_timing,
                    action_statement,
                    trigger_schema,
                    table_name
                FROM information_schema.triggers 
                WHERE table_name = 'assessments'
                ORDER BY trigger_name;
            `;
            const triggers = await client.query(triggerQuery);
            results.triggers = triggers.rows;
            
            // 2. Check for existing functions
            const functionsQuery = `
                SELECT 
                    proname as function_name,
                    pg_get_functiondef(oid) as function_definition
                FROM pg_proc 
                WHERE proname LIKE '%update%' OR proname LIKE '%trigger%'
                ORDER BY proname;
            `;
            const functions = await client.query(functionsQuery);
            results.functions = functions.rows;
            
            // 3. Check assessments table schema
            const schemaQuery = `
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_name = 'assessments'
                ORDER BY ordinal_position;
            `;
            const schema = await client.query(schemaQuery);
            results.schema = schema.rows;
            
            // 4. Test a simple insert to see what happens
            const testId = 'test-' + Date.now();
            const testQuery = `
                INSERT INTO assessments (
                    id, customer_id, tenant_id, date, status, score, 
                    metrics, recommendations, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id, created_at, updated_at;
            `;
            
            const now = new Date();
            const testResult = await client.query(testQuery, [
                testId,
                '00000000-0000-0000-0000-000000000000', // dummy customer_id
                'test-tenant',
                now,
                'draft',
                0,
                '{}',
                '[]',
                now,
                now
            ]);
            
            results.testInsert = {
                success: true,
                result: testResult.rows[0]
            };
            
            // Clean up test record
            await client.query('DELETE FROM assessments WHERE id = $1', [testId]);
            
            // 5. Clean up any remaining triggers
            await client.query(`
                DROP TRIGGER IF EXISTS update_assessments_updated_at ON assessments;
                DROP TRIGGER IF EXISTS update_assessments_timestamp ON assessments;
                DROP TRIGGER IF EXISTS update_updated_at_trigger ON assessments;
                DROP TRIGGER IF EXISTS assessments_update_trigger ON assessments;
                DROP TRIGGER IF EXISTS tr_assessments_updated_at ON assessments;
                
                DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
                DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
                DROP FUNCTION IF EXISTS update_timestamp() CASCADE;
                DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
            `);
            
            results.cleanupCompleted = true;
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Database troubleshooting completed successfully',
                    data: results
                }
            };
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        context.error('❌ Error during database troubleshooting:', error);
        
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                details: error instanceof Error ? error.stack : undefined
            }
        };
    }
}

app.http('troubleshootDatabase', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: troubleshootDatabase
});
