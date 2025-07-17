module.exports = async function (context, req) {
    context.log('Test endpoint called via function.json approach');

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'Test endpoint working with function.json!',
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url
        })
    };
};
