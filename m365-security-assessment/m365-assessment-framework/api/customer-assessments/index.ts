import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, initializeDataService, dataService } from "../shared/utils";

// Azure Functions v4 - Customer Assessments endpoint
app.http('customer-assessments', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'customers/{customerId}/assessments',
    handler: customerAssessmentsHandler
});

async function customerAssessmentsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('📊 Customer Assessments API called');

    try {
        // Initialize data service (PostgreSQL)
        await initializeDataService(context);

        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders
            };
        }

        const customerId = request.params.customerId;
        context.log(`🎯 Customer ID: ${customerId}`);

        if (!customerId) {
            return {
                status: 400,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    success: false,
                    error: 'Bad request',
                    message: 'Customer ID is required' 
                })
            };
        }

        if (request.method === 'GET') {
            return await getCustomerAssessments(customerId, context);
        }

        if (request.method === 'POST') {
            return await createCustomerAssessment(request, customerId, context);
        }

        return {
            status: 405,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: false,
                error: 'Method not allowed',
                message: 'Only GET and POST requests are supported for this endpoint' 
            })
        };

    } catch (error: any) {
        context.log('❌ Customer Assessments API error:', error);
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: false,
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
}

async function getCustomerAssessments(customerId: string, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`📖 Getting assessments for customer: ${customerId} from PostgreSQL`);
    
    try {
        // Get customer assessments from PostgreSQL
        const result = await dataService.getCustomerAssessments(customerId);
        
        context.log(`✅ Retrieved ${result.assessments.length} assessments for customer ${customerId}`);
        
        return {
            status: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: {
                    customerId: customerId,
                    assessments: result.assessments,
                    count: result.assessments.length
                },
                message: 'Customer assessments retrieved successfully'
            })
        };

    } catch (error: any) {
        context.log('❌ Error retrieving customer assessments:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to retrieve customer assessments',
                message: error.message
            })
        };
    }
}

async function createCustomerAssessment(request: HttpRequest, customerId: string, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`📝 Creating assessment for customer: ${customerId}`);
    
    try {
        const assessmentData = await request.json() as any;
        
        // Ensure customer ID matches the route parameter
        assessmentData.customerId = customerId;
        
        context.log('📋 Assessment data:', {
            customerId: assessmentData.customerId,
            tenantId: assessmentData.tenantId,
            assessmentName: assessmentData.assessmentName,
            categories: assessmentData.includedCategories
        });

        // Create assessment in PostgreSQL
        const assessment = await dataService.createAssessment(assessmentData);
        
        context.log(`✅ Created assessment: ${assessment.id} for customer ${customerId}`);
        
        return {
            status: 201,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                data: assessment,
                message: 'Assessment created successfully'
            })
        };

    } catch (error: any) {
        context.log('❌ Error creating customer assessment:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Failed to create assessment',
                message: error.message
            })
        };
    }
}
