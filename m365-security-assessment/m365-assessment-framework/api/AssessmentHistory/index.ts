import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosClient } from '@azure/cosmos';

interface AssessmentHistory {
  id?: string;
  assessmentId: string;
  tenantId: string;
  date: string;
  overallScore: number;
  categoryScores: {
    identity: number;
    dataProtection: number;
    endpoint: number;
    cloudApps: number;
  };
  metrics: any;
}

// Initialize Cosmos DB client with secure connection
const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_DB_ENDPOINT || '',
  key: process.env.COSMOS_DB_KEY || '',
  connectionPolicy: {
    enableEndpointDiscovery: false
  }
});

const database = cosmosClient.database(process.env.COSMOS_DB_DATABASE || 'M365Assessment');
const container = database.container('AssessmentHistory');

export const assessmentHistoryHandler = app.http('assessmentHistory', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'assessment-history/{tenantId?}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('Assessment History function processing request');
    
    try {
      const method = request.method.toUpperCase();
      const tenantId = request.params.tenantId;

      // Set CORS headers for all responses
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
      };

      // Handle preflight requests
      if (method === 'OPTIONS') {
        return {
          status: 200,
          headers: corsHeaders
        };
      }

      switch (method) {
        case 'POST':
          return await handleStoreHistory(request, context, corsHeaders);
        
        case 'GET':
          if (!tenantId) {
            return {
              status: 400,
              headers: corsHeaders,
              jsonBody: { error: 'Tenant ID is required for GET requests' }
            };
          }
          return await handleGetHistory(request, context, tenantId, corsHeaders);
        
        case 'DELETE':
          if (!tenantId) {
            return {
              status: 400,
              headers: corsHeaders,
              jsonBody: { error: 'Tenant ID is required for DELETE requests' }
            };
          }
          return await handleCleanupHistory(request, context, tenantId, corsHeaders);
        
        default:
          return {
            status: 405,
            headers: corsHeaders,
            jsonBody: { error: 'Method not allowed' }
          };
      }

    } catch (error: any) {
      context.error('Error in assessment history function:', error);
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          error: 'Internal server error',
          details: error.message
        }
      };
    }
  }
});

async function handleStoreHistory(
  request: HttpRequest, 
  context: InvocationContext, 
  corsHeaders: Record<string, string>
): Promise<HttpResponseInit> {
  try {
    const requestData = await request.json() as AssessmentHistory;
    
    // Validate required fields
    if (!requestData.assessmentId || !requestData.tenantId) {
      return {
        status: 400,
        headers: corsHeaders,
        jsonBody: { error: 'assessmentId and tenantId are required' }
      };
    }

    // Create document with partition key and unique ID
    const historyDocument = {
      id: `${requestData.tenantId}-${requestData.assessmentId}-${Date.now()}`,
      ...requestData,
      partitionKey: requestData.tenantId,
      createdAt: new Date().toISOString()
    };

    // Store in Cosmos DB with retry logic
    const { resource } = await container.items.create(historyDocument);
    
    context.log(`Assessment history stored for tenant ${requestData.tenantId}`);
    
    return {
      status: 201,
      headers: corsHeaders,
      jsonBody: { 
        success: true, 
        id: resource?.id,
        message: 'Assessment history stored successfully' 
      }
    };

  } catch (error: any) {
    context.error('Error storing assessment history:', error);
    
    if (error.code === 409) {
      return {
        status: 409,
        headers: corsHeaders,
        jsonBody: { error: 'Assessment history already exists' }
      };
    }

    throw error;
  }
}

async function handleGetHistory(
  request: HttpRequest,
  context: InvocationContext,
  tenantId: string,
  corsHeaders: Record<string, string>
): Promise<HttpResponseInit> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const maxLimit = Math.min(limit, 50); // Cap at 50 to prevent large queries

    // Query assessment history for the tenant, ordered by date descending
    const querySpec = {
      query: `
        SELECT * FROM c 
        WHERE c.tenantId = @tenantId 
        ORDER BY c.date DESC
        OFFSET 0 LIMIT @limit
      `,
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@limit', value: maxLimit }
      ]
    };

    const { resources } = await container.items.query(querySpec, {
      partitionKey: tenantId
    }).fetchAll();

    context.log(`Retrieved ${resources.length} assessment history records for tenant ${tenantId}`);

    return {
      status: 200,
      headers: corsHeaders,
      jsonBody: resources.map((item: any) => ({
        assessmentId: item.assessmentId,
        tenantId: item.tenantId,
        date: item.date,
        overallScore: item.overallScore,
        categoryScores: item.categoryScores,
        metrics: item.metrics
      }))
    };

  } catch (error: any) {
    context.error('Error retrieving assessment history:', error);
    
    if (error.code === 404) {
      return {
        status: 404,
        headers: corsHeaders,
        jsonBody: { error: 'No assessment history found for this tenant' }
      };
    }

    throw error;
  }
}

async function handleCleanupHistory(
  request: HttpRequest,
  context: InvocationContext,
  tenantId: string,
  corsHeaders: Record<string, string>
): Promise<HttpResponseInit> {
  try {
    const requestData = await request.json() as { cutoffDate: string };
    
    if (!requestData.cutoffDate) {
      return {
        status: 400,
        headers: corsHeaders,
        jsonBody: { error: 'cutoffDate is required for cleanup' }
      };
    }

    // Query old records
    const querySpec = {
      query: `
        SELECT c.id FROM c 
        WHERE c.tenantId = @tenantId 
        AND c.date < @cutoffDate
      `,
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@cutoffDate', value: requestData.cutoffDate }
      ]
    };

    const { resources } = await container.items.query(querySpec, {
      partitionKey: tenantId
    }).fetchAll();

    // Delete old records in batches
    let deletedCount = 0;
    for (const item of resources) {
      try {
        await container.item(item.id, tenantId).delete();
        deletedCount++;
      } catch (deleteError: any) {
        context.warn(`Failed to delete item ${item.id}:`, deleteError);
      }
    }

    context.log(`Cleaned up ${deletedCount} old assessment history records for tenant ${tenantId}`);

    return {
      status: 200,
      headers: corsHeaders,
      jsonBody: { 
        success: true, 
        deletedCount,
        message: `Cleaned up ${deletedCount} old assessment records` 
      }
    };

  } catch (error: any) {
    context.error('Error cleaning up assessment history:', error);
    throw error;
  }
}