"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const utils_1 = require("../shared/utils");
/**
 * Azure Functions v4 - Simple test endpoint
 * No dependencies, should always work if Functions runtime is operational
 */
async function default_1(request, context) {
    context.log('🧪 test-simple function called');
    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        // Handle HEAD request for API warmup
        if (request.method === 'HEAD') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        const response = {
            success: true,
            message: "Simple test works! Functions v4 is operational",
            method: request.method,
            url: request.url,
            timestamp: new Date().toISOString(),
            functionVersion: process.env.FUNCTIONS_EXTENSION_VERSION || 'unknown'
        };
        context.log('✅ test-simple completed successfully');
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            jsonBody: response
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