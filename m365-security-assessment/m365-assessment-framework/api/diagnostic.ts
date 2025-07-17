import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { GraphApiService } from './shared/graphApiService';

/**
 * Diagnostic endpoint to help troubleshoot app registration issues
 */
async function diagnosticHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('🔍 Diagnostic endpoint called');

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        const diagnostic = {
            timestamp: new Date().toISOString(),
            environment: {
                nodeEnv: process.env.NODE_ENV,
                isProduction: process.env.NODE_ENV === 'production'
            },
            azureCredentials: {
                hasAzureClientId: !!process.env.AZURE_CLIENT_ID,
                hasAzureClientSecret: !!process.env.AZURE_CLIENT_SECRET,
                hasAzureTenantId: !!process.env.AZURE_TENANT_ID,
                clientIdLength: process.env.AZURE_CLIENT_ID?.length || 0,
                clientSecretLength: process.env.AZURE_CLIENT_SECRET?.length || 0,
                tenantIdLength: process.env.AZURE_TENANT_ID?.length || 0,
                clientIdFormat: process.env.AZURE_CLIENT_ID ? 'UUID-like' : 'missing',
                clientSecretFormat: process.env.AZURE_CLIENT_SECRET ? 
                    (process.env.AZURE_CLIENT_SECRET.startsWith('~') ? 'valid-format' : 'invalid-format') : 'missing'
            },
            otherSettings: {
                hasKeyVaultUrl: !!process.env.KEY_VAULT_URL,
                hasStorageConnection: !!process.env.AzureWebJobsStorage,
                hasPostgresHost: !!process.env.POSTGRES_HOST,
                hasPostgresDatabase: !!process.env.POSTGRES_DATABASE
            },
            graphApiService: {
                canInitialize: false,
                initializationError: null as string | null
            }
        };

        // Test GraphApiService initialization
        try {
            new GraphApiService();
            diagnostic.graphApiService.canInitialize = true;
            context.log('✅ GraphApiService can be initialized');
        } catch (error) {
            diagnostic.graphApiService.canInitialize = false;
            diagnostic.graphApiService.initializationError = error instanceof Error ? error.message : 'Unknown error';
            context.log('❌ GraphApiService initialization failed:', error);
        }

        return {
            status: 200,
            headers: corsHeaders,
            jsonBody: {
                success: true,
                diagnostic: diagnostic,
                recommendations: [
                    diagnostic.azureCredentials.hasAzureClientId ? null : 'Configure AZURE_CLIENT_ID in Azure Static Web App settings',
                    diagnostic.azureCredentials.hasAzureClientSecret ? null : 'Configure AZURE_CLIENT_SECRET in Azure Static Web App settings',
                    diagnostic.azureCredentials.hasAzureTenantId ? null : 'Configure AZURE_TENANT_ID in Azure Static Web App settings',
                    diagnostic.azureCredentials.clientSecretFormat === 'invalid-format' ? 'Client secret should start with ~ (use secret VALUE not ID)' : null,
                    diagnostic.graphApiService.canInitialize ? null : 'GraphApiService initialization failed - check credentials',
                ].filter(Boolean)
            }
        };
    } catch (error) {
        context.error('❌ Diagnostic endpoint failed:', error);
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: 'Diagnostic failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
}

// Register the diagnostic endpoint
app.http('diagnostic', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: diagnosticHandler
});
