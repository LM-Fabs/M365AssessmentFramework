"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const httpTrigger = async function (context, req) {
    context.log('🧪 Test endpoint called');
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: corsHeaders
        };
        return;
    }
    context.res = {
        status: 200,
        headers: corsHeaders,
        body: {
            success: true,
            message: 'API is working! 🚀',
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url
        }
    };
};
exports.default = httpTrigger;
//# sourceMappingURL=index.js.map