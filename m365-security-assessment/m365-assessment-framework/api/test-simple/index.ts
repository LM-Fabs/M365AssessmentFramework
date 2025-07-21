import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export default async function (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
