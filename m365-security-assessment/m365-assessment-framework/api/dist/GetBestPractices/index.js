"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBestPracticesHandler = void 0;
const functions_1 = require("@azure/functions");
const constants_js_1 = require("../shared/constants.js");
exports.getBestPracticesHandler = functions_1.app.http('getBestPractices', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'best-practices',
    handler: async (request, context) => {
        context.log('GetBestPractices function processed a request.');
        try {
            const bestPractices = await (0, constants_js_1.getBestPractices)();
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