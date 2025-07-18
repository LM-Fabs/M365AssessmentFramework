module.exports = async function (context, req) {
    context.log('Best practices function called');

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }

    try {
        const bestPractices = {
            success: true,
            data: {
                categories: [
                    {
                        id: 'security',
                        name: 'Security Best Practices',
                        practices: [
                            {
                                id: 'mfa',
                                title: 'Multi-Factor Authentication',
                                description: 'Enable MFA for all users',
                                priority: 'high',
                                status: 'recommended'
                            },
                            {
                                id: 'conditional-access',
                                title: 'Conditional Access Policies',
                                description: 'Implement conditional access policies',
                                priority: 'high',
                                status: 'recommended'
                            }
                        ]
                    },
                    {
                        id: 'compliance',
                        name: 'Compliance Best Practices',
                        practices: [
                            {
                                id: 'dlp',
                                title: 'Data Loss Prevention',
                                description: 'Configure DLP policies',
                                priority: 'medium',
                                status: 'recommended'
                            }
                        ]
                    }
                ],
                lastUpdated: new Date().toISOString(),
                version: '1.0.4'
            }
        };

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(bestPractices)
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
                message: 'Failed to retrieve best practices'
            })
        };
    }
};
