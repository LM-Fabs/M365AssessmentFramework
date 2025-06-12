const { app } = require('@azure/functions');

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

app.http('test', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Test function processed a request');
        
        return { 
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                message: "M365 Assessment API is working!",
                timestamp: new Date().toISOString(),
                version: "1.0.0"
            }
        };
    }
});