"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Azure Functions v4 - Individual function self-registration
functions_1.app.http('test-simple', {
    methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'test-simple',
    handler: testSimpleHandler
});
/**
 * Simple test handler for Azure Functions v4
 */
async function testSimpleHandler(request, context) {
    context.log(`Processing ${request.method} request for test-simple`);
    try {
        // Handle OPTIONS request for CORS
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        // Handle GET request with environment info
        if (request.method === 'GET') {
            const response = {
                success: true,
                message: "Simple test works! Functions v4 is operational",
                method: request.method,
                url: request.url,
                timestamp: new Date().toISOString(),
                version: "v4-individual-registration"
            };
            context.log('✅ test-simple completed successfully');
            return {
                status: 200,
                headers: {
                    ...utils_1.corsHeaders,
                    'Content-Type': 'application/json'
                },
                jsonBody: response
            };
        }
        // Method not supported
        return {
            status: 405,
            headers: utils_1.corsHeaders,
            jsonBody: {
                success: false,
                error: `Method ${request.method} not supported`,
                timestamp: new Date().toISOString()
            }
        };
    }
    catch (error) {
        context.error('❌ test-simple error:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            }
        };
    }
}
//# sourceMappingURL=index.js.map