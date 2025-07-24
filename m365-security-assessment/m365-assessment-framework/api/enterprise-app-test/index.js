"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
// Simple test function to verify function discovery works
functions_1.app.http('enterprise-app-test', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'enterprise-app-test',
    handler: enterpriseAppTestHandler
});
async function enterpriseAppTestHandler(request, context) {
    context.log('🧪 Enterprise App Test function called');
    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({
            message: 'Enterprise App Test function is working!',
            timestamp: new Date().toISOString()
        })
    };
}
//# sourceMappingURL=index.js.map