"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
async function default_1(request, context) {
    context.log('test-simple function called');
    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        jsonBody: {
            message: "Simple test works!",
            method: request.method,
            url: request.url
        }
    };
}
//# sourceMappingURL=index.js.map