"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = hello;
async function hello(request, context) {
    context.log('Simple hello function triggered');
    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        jsonBody: {
            message: "Hello from Azure Functions v4!",
            timestamp: new Date().toISOString(),
            success: true
        }
    };
}
//# sourceMappingURL=index.js.map