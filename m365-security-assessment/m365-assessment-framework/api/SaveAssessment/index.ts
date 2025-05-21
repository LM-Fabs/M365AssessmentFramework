import { app } from "@azure/functions";
import { Assessment } from "../shared/types";

app.http('saveAssessment', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        const assessment = request.body as Assessment;
        context.log('SaveAssessment function processing assessment:', assessment.id);

        try {
            // TODO: Implement assessment saving logic
            return { 
                status: 200,
                body: { 
                    message: "Assessment saved successfully",
                    assessmentId: assessment.id
                }
            };
        } catch (error) {
            return {
                status: 500,
                body: "Error saving assessment."
            };
        }
    }
});