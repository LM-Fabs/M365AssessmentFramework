"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const constants_1 = require("../shared/constants");
functions_1.app.http('getBestPractices', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('GetBestPractices function processed a request.');
        try {
            const bestPractices = await (0, constants_1.getBestPractices)();
            return {
                status: 200,
                jsonBody: bestPractices
            };
        }
        catch (error) {
            return {
                status: 500,
                jsonBody: { error: "Error retrieving best practices." }
            };
        }
    }
});
//# sourceMappingURL=index.js.map