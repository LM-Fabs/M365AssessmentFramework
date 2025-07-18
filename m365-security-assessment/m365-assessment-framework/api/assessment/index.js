const { SimplePostgreSQLService } = require('../shared/simplePostgresqlService');

let postgresqlService = null;

// Initialize PostgreSQL service
async function initializeService() {
    if (!postgresqlService) {
        postgresqlService = new SimplePostgreSQLService();
        await postgresqlService.initialize();
    }
}

module.exports = async function (context, req) {
    context.log('Assessment function called');
    
    const action = context.bindingData.action || '';
    
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }

    // Handle HEAD request for API warmup
    if (req.method === 'HEAD') {
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
        return;
    }

    try {
        // Initialize database connection
        await initializeService();
        
        let response;
        
        switch (action) {
            case 'current':
                // Get current assessment from database (mock for now)
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
                    
                    // Create new assessment in database
                    const newAssessment = {
                        customerId: assessmentData.customerId,
                        tenantId: assessmentData.tenantId,
                        status: 'pending',
                        metrics: {
                            assessmentName: assessmentData.assessmentName || 'New Assessment',
                            includedCategories: assessmentData.includedCategories || [],
                            notificationEmail: assessmentData.notificationEmail || '',
                            autoSchedule: assessmentData.autoSchedule || false,
                            scheduleFrequency: assessmentData.scheduleFrequency || 'monthly'
                        },
                        score: 0,
                        recommendations: []
                    };
                    
                    // Save to database
                    const createdAssessment = await postgresqlService.createAssessment(newAssessment);
                    
                    response = {
                        success: true,
                        data: {
                            assessment: {
                                id: createdAssessment.id,
                                customerId: createdAssessment.customerId,
                                tenantId: createdAssessment.tenantId,
                                assessmentName: newAssessment.metrics.assessmentName,
                                status: createdAssessment.status,
                                progress: 0,
                                includedCategories: newAssessment.metrics.includedCategories,
                                notificationEmail: newAssessment.metrics.notificationEmail,
                                autoSchedule: newAssessment.metrics.autoSchedule,
                                scheduleFrequency: newAssessment.metrics.scheduleFrequency,
                                createdAt: createdAssessment.createdAt,
                                lastModified: createdAssessment.updatedAt
                            }
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
                'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        context.log.error('Database error:', error);
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
