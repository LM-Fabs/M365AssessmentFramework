module.exports = async function (context, req) {
    context.log('Test function called');

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'API is working!',
            timestamp: new Date().toISOString(),
            success: true
        })
    };
};
