const { app } = require('@azure/functions');

// Simple test function for Azure Static Web Apps
app.http('simple-test', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Simple test function called');
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Simple test function is working!',
                timestamp: new Date().toISOString(),
                method: request.method,
                url: request.url
            })
        };
    }
});
