import { app } from '@azure/functions';

// Progressive Azure Functions v4 registration for Azure Static Web Apps
// Starting with essential functions only

// Test function - keep this working
app.http('test', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test',
    handler: require('./test-simple/index').default
});

// Core customer and assessment functions
app.http('customers', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{*route?}',
    handler: require('./customers/index').default
});

app.http('assessments', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments/{*route?}',
    handler: require('./assessments/index').default
});

// Diagnostics for troubleshooting
app.http('diagnostics', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous', 
    route: 'diagnostics',
    handler: require('./diagnostics/index').default
});

console.log('✅ Progressive Azure Functions v4 registration completed - 4 core functions');
