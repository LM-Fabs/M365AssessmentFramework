"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
// Simple individual function for Azure Static Web Apps compatibility test
async function default_1(request, context) {
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
            message: "Individual function works!",
            timestamp: new Date().toISOString(),
            method: request.method,
            url: request.url
        }
    };
}
//# sourceMappingURL=index.js.map