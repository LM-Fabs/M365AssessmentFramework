"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
// Register all Azure Functions for Azure Functions v4 runtime
// Test and Diagnostics Functions
functions_1.app.http('test-simple', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test-simple',
    handler: require('./test-simple/index').default
});
functions_1.app.http('hello', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'hello',
    handler: require('./hello/index').default
});
functions_1.app.http('diagnostics', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'diagnostics',
    handler: require('./diagnostics/index').default
});
// Customer Management Functions
functions_1.app.http('customers', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{*route?}',
    handler: require('./customers/index').default
});
functions_1.app.http('customerById', {
    methods: ['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}',
    handler: require('./customerById/index').default
});
// Assessment Functions  
functions_1.app.http('assessments', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments/{*route?}',
    handler: require('./assessments/index').default
});
functions_1.app.http('currentAssessment', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments/current/{*route?}',
    handler: require('./currentAssessment/index').default
});
functions_1.app.http('customerAssessments', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}/assessments/{*route?}',
    handler: require('./customerAssessments/index').default
});
functions_1.app.http('createAssessment', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments/create/{*route?}',
    handler: require('./createAssessment/index').default
});
// Best Practices Functions
functions_1.app.http('best-practices', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'best-practices/{*route?}',
    handler: require('./best-practices/index').default
});
functions_1.app.http('bestPractices', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'bestPractices/{*route?}',
    handler: require('./bestPractices/index').default
});
// Authentication Functions
functions_1.app.http('consent-callback', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'consent-callback/{*route?}',
    handler: require('./consent-callback/index').default
});
functions_1.app.http('enterprise-app', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'enterprise-app/{*route?}',
    handler: require('./enterprise-app/index').default
});
// Legacy/Test Functions
functions_1.app.http('test-function', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test-function',
    handler: require('./test-function/index').default
});
functions_1.app.http('HttpTrigger', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'HttpTrigger',
    handler: require('./HttpTrigger/index').default
});
functions_1.app.http('test', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test/{*route?}',
    handler: require('./test/index').default
});
console.log('✅ Azure Functions v4 registration completed - All endpoints registered');
//# sourceMappingURL=index.js.map