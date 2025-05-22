import { app } from '@azure/functions';
import { getBestPractices } from '../shared/constants.js';
export const getBestPracticesHandler = app.http('getBestPractices', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('GetBestPractices function processed a request.');
        try {
            const bestPractices = await getBestPractices();
            return {
                status: 200,
                jsonBody: bestPractices
            };
        }
        catch (error) {
            return {
                status: 500,
                jsonBody: "Error retrieving best practices."
            };
        }
    }
});
//# sourceMappingURL=index.js.map