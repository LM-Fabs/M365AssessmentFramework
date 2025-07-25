"use strict";
// Minimal test for Azure Static Web Apps compatibility
// This will be registered as the main entry point temporarily
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
// Register just one simple test function to isolate the issue
functions_1.app.http('test', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test',
    handler: async (request, context) => {
        context.log('🧪 Minimal test function called');
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
                message: "Minimal Azure Functions v4 test successful!",
                timestamp: new Date().toISOString(),
                method: request.method,
                url: request.url,
                deployment: "Azure Static Web Apps"
            }
        };
    }
});
console.log('✅ Minimal Azure Functions v4 test registration completed');
//# sourceMappingURL=index-minimal.js.map