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
                
            case 'create':
                if (req.method === 'POST') {
                    const assessmentData = req.body;
                    
                    // Create new assessment
                    const newAssessment = {
                        id: Date.now().toString(),
                        customerId: assessmentData.customerId,
                        tenantId: assessmentData.tenantId,
                        assessmentName: assessmentData.assessmentName || 'New Assessment',
                        status: 'created',
                        progress: 0,
                        includedCategories: assessmentData.includedCategories || [],
                        notificationEmail: assessmentData.notificationEmail || '',
                        autoSchedule: assessmentData.autoSchedule || false,
                        scheduleFrequency: assessmentData.scheduleFrequency || 'monthly',
                        createdAt: new Date().toISOString(),
                        lastModified: new Date().toISOString()
                    };
                    
                    response = {
                        success: true,
                        data: {
                            assessment: newAssessment
                        }
                    };
                } else {
                    response = {
                        success: false,
                        error: 'POST method required for creating assessments'
                    };
                }
                break;
                
            default:
                response = {
                    success: false,
                    error: 'Unknown assessment action',
                    availableActions: ['current', 'status', 'create']
                };
                break;
        }

        context.res = {
            status: response.success ? (action === 'create' && req.method === 'POST' ? 201 : 200) : 404,
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
