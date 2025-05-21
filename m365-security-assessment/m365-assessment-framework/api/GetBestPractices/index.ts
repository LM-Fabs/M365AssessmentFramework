import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getBestPractices } from "../shared/constants";

app.http('getBestPractices', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        context.log('GetBestPractices function processed a request.');

        try {
            const bestPractices = await getBestPractices();
            return {
                status: 200,
                jsonBody: bestPractices
            };
        } catch (error) {
            return {
                status: 500,
                jsonBody: { error: "Error retrieving best practices." }
            };
        }
    }
});