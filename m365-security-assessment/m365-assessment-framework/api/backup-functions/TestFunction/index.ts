import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export const testFunctionHandler = app.http('testFunction', {
    methods: ['GET'],
    authLevel: 'anonymous', // Make it anonymous for easy testing
    route: 'test',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
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