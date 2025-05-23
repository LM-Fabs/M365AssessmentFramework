import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export const createAssessmentHandler = app.http('createAssessment', {
    methods: ['POST'],
    authLevel: 'anonymous', // Changed from 'function' to 'anonymous' for testing
    route: 'assessment/create', // Set route to match frontend's expectation
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        context.log('CreateAssessment function processing a request');
        
        try {
            const data = await request.json();
            context.log('Creating assessment with data:', data);

            // Generate a unique ID for the new assessment
            const assessmentId = crypto.randomUUID();
            
            // TODO: Implement the actual assessment creation logic here
            // This would typically involve storing the assessment data in a database
            
            return { 
                status: 200, 
                jsonBody: {
                    id: assessmentId,
                    tenantId: data.tenantId || 'default-tenant',
                    assessmentDate: new Date().toISOString(),
                    status: 'draft',
                    // Return other necessary fields
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