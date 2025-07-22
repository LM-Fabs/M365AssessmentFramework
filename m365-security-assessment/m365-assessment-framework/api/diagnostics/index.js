"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const utils_1 = require("../shared/utils");
// Azure Functions v4 - Individual function self-registration for Static Web Apps
functions_1.app.http('diagnostics', {
    methods: ['GET', 'HEAD', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'diagnostics',
    handler: diagnosticsHandler
});
/**
 * Azure Functions v4 - Diagnostics endpoint
 * Individual self-registration for Azure Static Web Apps compatibility
 */
async function diagnosticsHandler(request, context) {
    context.log(`🔍 Diagnostics function called - ${request.method} ${request.url}`);
    try {
        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: utils_1.corsHeaders
            };
        }
        const diagnostics = {
            status: "Functions v4 Runtime Active",
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'unknown',
            functionVersion: process.env.FUNCTIONS_EXTENSION_VERSION || 'unknown',
            workerRuntime: process.env.FUNCTIONS_WORKER_RUNTIME || 'unknown',
            azureEnvironment: process.env.AZURE_FUNCTIONS_ENVIRONMENT || 'unknown',
            // Check environment variables (without exposing secrets)
            environmentChecks: {
                hasPostgresHost: !!process.env.POSTGRES_HOST,
                hasPostgresDatabase: !!process.env.POSTGRES_DATABASE,
                hasPostgresUser: !!process.env.POSTGRES_USER,
                hasPostgresPassword: !!process.env.POSTGRES_PASSWORD,
                hasAzureClientId: !!process.env.AZURE_CLIENT_ID,
                hasAzureClientSecret: !!process.env.AZURE_CLIENT_SECRET,
                hasAzureTenantId: !!process.env.AZURE_TENANT_ID,
                postgresHost: process.env.POSTGRES_HOST || 'NOT_SET',
                postgresDatabase: process.env.POSTGRES_DATABASE || 'NOT_SET',
                postgresUser: process.env.POSTGRES_USER || 'NOT_SET'
            },
            // Test basic functionality
            requestInfo: {
                method: request.method,
                url: request.url,
                headers: Object.fromEntries(request.headers.entries())
            },
            // Runtime information
            runtimeInfo: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage()
            }
        };
        context.log('✅ Diagnostics completed successfully');
        return {
            status: 200,
            headers: utils_1.corsHeaders,
            jsonBody: {
                success: true,
                data: diagnostics,
                message: "Functions v4 runtime is working correctly"
            }
        };
    }
    catch (error) {
        context.error('❌ Diagnostics function error:', error);
        return {
            status: 500,
            headers: utils_1.corsHeaders,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: new Date().toISOString()
            }
        };
    }
}
//# sourceMappingURL=index.js.map