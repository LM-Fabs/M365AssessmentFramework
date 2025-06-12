"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFunctionHandler = void 0;
const functions_1 = require("@azure/functions");
exports.testFunctionHandler = functions_1.app.http('testFunction', {
    methods: ['GET'],
    authLevel: 'anonymous', // Make it anonymous for easy testing
    route: 'test',
    handler: async (request, context) => {
        context.log('Test function processed a request');
        return {
            status: 200,
            jsonBody: {
                message: "API is working!",
                timestamp: new Date().toISOString()
            }
        };
    }
});
//# sourceMappingURL=index.js.map