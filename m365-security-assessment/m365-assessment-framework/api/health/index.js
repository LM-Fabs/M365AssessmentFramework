const { app } = require('@azure/functions');
const { postgresqlService } = require('../shared/postgresqlService');

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Health check function processed a request');
        
        try {
            // Test PostgreSQL connection
            const dbHealth = await postgresqlService.testConnection();
            
            // Get database stats
            const stats = await postgresqlService.getDatabaseStats();
            
            return { 
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    status: "healthy",
                    database: {
                        type: "PostgreSQL",
                        connected: dbHealth.connected,
                        host: dbHealth.host,
                        database: dbHealth.database,
                        version: dbHealth.version,
                        tables: stats.tables,
                        totalRecords: stats.totalRecords
                    },
                    timestamp: new Date().toISOString(),
                    version: "1.0.0"
                }
            };
        } catch (error) {
            context.log('Health check failed:', error);
            
            return { 
                status: 500,
                headers: corsHeaders,
                jsonBody: {
                    status: "unhealthy",
                    database: {
                        type: "PostgreSQL",
                        connected: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    },
                    timestamp: new Date().toISOString(),
                    version: "1.0.0"
                }
            };
        }
    }
});
