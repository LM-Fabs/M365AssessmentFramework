// Azure Functions v3 compatible entry point for Azure Static Web Apps
// This file exports individual functions for v3 compatibility

const { PostgreSQLService } = require('./shared/postgresqlService');
const { GraphApiService } = require('./shared/graphApiService');
const { getKeyVaultService } = require('./shared/keyVaultService');
const { randomUUID } = require('crypto');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Warmup, Cache-Control',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
};

// Shared service instances
let postgresqlService;
let graphApiService = null;
let keyVaultService = null;
let isDataServiceInitialized = false;

// Initialize services
async function initializeServices() {
    if (!isDataServiceInitialized) {
        try {
            postgresqlService = new PostgreSQLService();
            await postgresqlService.initialize();
            keyVaultService = await getKeyVaultService();
            isDataServiceInitialized = true;
        } catch (error) {
            console.error('Failed to initialize services:', error);
            throw error;
        }
    }
}

// Test function
module.exports.test = async function (context, req) {
    context.log('HTTP trigger function processed a request.');

    context.res = {
        status: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            message: 'M365 Assessment API is running!',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        })
    };
};

// Diagnostics function
module.exports.diagnostics = async function (context, req) {
    context.log('Diagnostics function called');

    try {
        await initializeServices();
        
        const diagnostics = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: postgresqlService ? 'connected' : 'disconnected',
                keyVault: keyVaultService ? 'connected' : 'disconnected'
            }
        };

        context.res = {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify(diagnostics)
        };
    } catch (error) {
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

// Customers function
module.exports.customers = async function (context, req) {
    try {
        await initializeServices();

        if (req.method === 'OPTIONS') {
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: ''
            };
            return;
        }

        const customers = await postgresqlService.getCustomers();
        
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify(customers)
        };
    } catch (error) {
        context.res = {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// You would need to add more functions for each endpoint...
// This is a simplified version to get Azure SWA working
