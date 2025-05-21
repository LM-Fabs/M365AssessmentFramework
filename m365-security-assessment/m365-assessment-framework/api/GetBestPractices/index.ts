import { app } from "@azure/functions";
import { getBestPractices } from "../shared/constants";

app.http('getBestPractices', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('GetBestPractices function processed a request.');

        try {
            const bestPractices = await getBestPractices();
            return { 
                status: 200, 
                body: bestPractices 
            };
        } catch (error) {
            return {
                status: 500,
                body: "Error retrieving best practices."
            };
        }
    }
});