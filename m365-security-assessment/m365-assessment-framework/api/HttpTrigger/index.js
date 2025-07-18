module.exports = async function (context, req) {
    context.log('HTTP trigger function processed a request.');

    const responseMessage = req.query.name || req.body && req.body.name || "Hello from Azure Functions!";

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
            message: responseMessage,
            timestamp: new Date().toISOString()
        })
    };
};
