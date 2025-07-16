"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const httpTrigger = async function (context, req) {
    context.log('HTTP trigger function processed a request.');
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }
    // Set CORS headers and return response
    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: {
            success: true,
            message: "Traditional function.json test endpoint is working!",
            timestamp: new Date().toISOString(),
            method: req.method,
            query: req.query,
            environment: process.env.NODE_ENV || 'production'
        }
    };
};
exports.default = httpTrigger;
//# sourceMappingURL=index.js.map