"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpTrigger1 = void 0;
const functions_1 = require("@azure/functions");
async function httpTrigger1(request, context) {
    context.log(`Http function processed request for url "${request.url}"`);
    const name = request.query.get('name') || await request.text() || 'world';
    return { body: `Hello, ${name}!` };
}
exports.httpTrigger1 = httpTrigger1;
functions_1.app.http('httpTrigger1', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: httpTrigger1
});
//# sourceMappingURL=test.js.map