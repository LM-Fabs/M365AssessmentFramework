module.exports = async function (context, req) {
    context.log('Assessment function called');
    
    const action = context.bindingData.action || '';
    
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }

    try {
        let response;
        
        switch (action) {
            case 'current':
                response = {
                    success: true,
                    data: {
                        id: 'assessment-1',
                        status: 'not_started',
                        progress: 0,
                        currentStep: null,
                        lastModified: new Date().toISOString(),
                        customerId: null
                    }
                };
                break;
                
            case 'status':
                response = {
                    success: true,
                    data: {
                        status: 'ready',
                        version: '1.0.4',
                        environment: 'production',
                        apiHealth: 'healthy',
                        lastCheck: new Date().toISOString()
                    }
                };
                break;
                
            default:
                response = {
                    success: false,
                    error: 'Unknown assessment action',
                    availableActions: ['current', 'status']
                };
                break;
        }

        context.res = {
            status: response.success ? 200 : 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: false,
                error: error.message,
                message: 'Failed to process assessment request'
            })
        };
    }
};
