"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
functions_1.app.http('getAssessment', {
    methods: ['GET'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('GetAssessment function processed a request.');
        try {
            const tenantId = request.params.tenantId;
            const assessmentId = request.params.assessmentId;
            if (!tenantId || !assessmentId) {
                return {
                    status: 400,
                    jsonBody: { error: "Tenant ID and Assessment ID are required" }
                };
            }
            // Your assessment retrieval logic here
            const assessment = {
                id: assessmentId,
                tenantId: tenantId,
                date: new Date().toISOString()
            };
            return {
                status: 200,
                jsonBody: assessment
            };
        }
        catch (error) {
            return {
                status: 500,
                jsonBody: { error: error.message || "Error retrieving assessment" }
            };
        }
    }
});
//# sourceMappingURL=index.js.map