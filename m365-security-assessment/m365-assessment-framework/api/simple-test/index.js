"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('simple-test', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'simple-test',
    handler: simpleTestHandler
});
// Simple individual function for Azure Static Web Apps compatibility test
async function simpleTestHandler(request, context) {
    context.log('🧪 Simple individual function test');
    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
    }
    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
            success: true,
            message: "Individual self-registered function works!",
            timestamp: new Date().toISOString(),
            method: request.method,
            url: request.url
        }
    };
}
//# sourceMappingURL=index.js.map