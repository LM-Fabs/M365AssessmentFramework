import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Assessment } from '../shared/types.js';

export const saveAssessmentHandler = app.http('saveAssessment', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        try {
            const assessment = await request.json() as Assessment;
            context.log('SaveAssessment function processing assessment:', assessment.id);

            // TODO: Implement assessment saving logic
            return { 
                status: 200,
                jsonBody: { 
                    message: "Assessment saved successfully",
                    assessmentId: assessment.id
                }
            };
        } catch (error) {
            return {
                status: 500,
                jsonBody: "Error saving assessment."
            };
        }
    }
});