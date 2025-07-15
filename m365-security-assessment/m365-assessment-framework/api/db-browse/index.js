const { app } = require('@azure/functions');
const { postgresqlService } = require('../shared/postgresqlService');

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

app.http('db-browse', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Database browse function processed a request');
        
        try {
            const url = new URL(request.url);
            const table = url.searchParams.get('table');
            const limit = parseInt(url.searchParams.get('limit') || '10');
            
            if (!table) {
                // Return list of tables
                const stats = await postgresqlService.getDatabaseStats();
                
                return { 
                    status: 200,
                    headers: corsHeaders,
                    jsonBody: {
                        tables: stats.tables,
                        usage: "Use ?table=tablename&limit=10 to browse table data",
                        availableTables: [
                            "customers",
                            "assessments", 
                            "assessment_history"
                        ]
                    }
                };
            }
            
            // Browse specific table
            const data = await postgresqlService.browseTable(table, limit);
            
            return { 
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    table: table,
                    count: data.length,
                    data: data
                }
            };
            
        } catch (error) {
            context.log('Database browse failed:', error);
            
            return { 
                status: 500,
                headers: corsHeaders,
                jsonBody: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    }
});
