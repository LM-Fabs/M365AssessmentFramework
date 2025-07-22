"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('assessments', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'assessments',
    handler: assessmentsHandler
});
/**
 * Azure Functions v4 - Assessments endpoint
 * Individual self-registration for Azure Static Web Apps compatibility
 */
async function assessmentsHandler(request, context) {
    context.log('Processing assessments request');
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Warmup, Cache-Control',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60'
    };
    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }
    try {
        // For now, return a simple response until we properly migrate the full logic
        if (request.method === 'GET') {
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: [],
                    message: "Assessments endpoint working - migration in progress"
                }
            };
        }
        if (request.method === 'POST') {
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    message: "Assessment creation endpoint working - migration in progress"
                }
            };
        }
        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Method not allowed"
            }
        };
    }
    catch (error) {
        context.error('Error in assessments handler:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
//# sourceMappingURL=index.js.map