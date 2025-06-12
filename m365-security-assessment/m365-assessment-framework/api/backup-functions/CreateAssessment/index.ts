import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto'; // Add proper crypto import

// Define an interface for the expected request body
interface CreateAssessmentRequest {
    tenantName: string;
    categories: string[];
    notificationEmail: string;
    scheduling?: {
        enabled: boolean;
        frequency: string;
    };
}

// Add a simple GET handler for easier testing and to verify the function is registered
export const createAssessmentTest = app.http('createAssessmentTest', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'assessment/test',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        context.log('Test endpoint accessed');
        return {
            status: 200,
            jsonBody: {
                message: "API route is accessible",
                timestamp: new Date().toISOString()
            }
        };
    }
});

export const createAssessmentHandler = app.http('createAssessment', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'assessment/create',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        context.log('CreateAssessment function processing a request');
        
        try {
            // Cast the request data to the defined interface
            const data = await request.json() as CreateAssessmentRequest;
            context.log('Creating assessment with data:', data);

            // Generate a unique ID for the new assessment using proper import
            const assessmentId = randomUUID();
            
            // TODO: Implement the actual assessment creation logic here
            // This would typically involve storing the assessment data in a database
            
            return { 
                status: 200, 
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    id: assessmentId,
                    tenantId: data.tenantName || 'default-tenant',
                    assessmentDate: new Date().toISOString(),
                    status: 'draft',
                    categories: data.categories,
                    notificationEmail: data.notificationEmail,
                    scheduling: data.scheduling
                }
            };
        } catch (error) {
            context.error('Error creating assessment:', error);
            return {
                status: 500,
                jsonBody: {
                    message: "Error creating assessment",
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
});