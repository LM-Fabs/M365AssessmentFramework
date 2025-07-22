import { app } from '@azure/functions';

// Register all Azure Functions for Azure Functions v4 runtime

// Test and Diagnostics Functions
app.http('test-simple', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test-simple',
    handler: require('./test-simple/index').default
});

app.http('hello', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'], 
    authLevel: 'anonymous',
    route: 'hello',
    handler: require('./hello/index').default
});

app.http('diagnostics', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous', 
    route: 'diagnostics',
    handler: require('./diagnostics/index').default
});

// Customer Management Functions
app.http('customers', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{*route?}',
    handler: require('./customers/index').default
});

app.http('customerById', {
    methods: ['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}',
    handler: require('./customerById/index').default
});

// Assessment Functions  
app.http('assessments', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments/{*route?}',
    handler: require('./assessments/index').default
});

app.http('currentAssessment', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments/current/{*route?}',
    handler: require('./currentAssessment/index').default
});

app.http('customerAssessments', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}/assessments/{*route?}',
    handler: require('./customerAssessments/index').default
});

app.http('createAssessment', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments/create/{*route?}',
    handler: require('./createAssessment/index').default
});

// Best Practices Functions
app.http('best-practices', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'best-practices/{*route?}',
    handler: require('./best-practices/index').default
});

app.http('bestPractices', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'bestPractices/{*route?}',
    handler: require('./bestPractices/index').default
});

// Authentication Functions
app.http('consent-callback', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'consent-callback/{*route?}',
    handler: require('./consent-callback/index').default
});

app.http('enterprise-app', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'enterprise-app/{*route?}',
    handler: require('./enterprise-app/index').default
});

// Legacy/Test Functions
app.http('test-function', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test-function',
    handler: require('./test-function/index').default
});

app.http('HttpTrigger', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'HttpTrigger',
    handler: require('./HttpTrigger/index').default
});

app.http('test', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test/{*route?}',
    handler: require('./test/index').default
});

console.log('✅ Azure Functions v4 registration completed - All endpoints registered');