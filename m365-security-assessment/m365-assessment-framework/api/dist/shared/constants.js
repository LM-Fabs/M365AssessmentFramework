export const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-url.azurewebsites.net/api';
export const ASSESSMENT_STATUS = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
};
export const METRIC_CATEGORIES = {
    SECURITY: 'Security',
    COMPLIANCE: 'Compliance',
    PERFORMANCE: 'Performance',
};
export const RECOMMENDATION_TYPES = {
    SECURITY: 'Security Recommendation',
    COMPLIANCE: 'Compliance Recommendation',
    PERFORMANCE: 'Performance Recommendation',
};
// Add best practices data
export const BEST_PRACTICES = {
    security: [
        {
            title: 'Enable MFA',
            description: 'Enable Multi-Factor Authentication for all users',
            impact: 'high'
        },
        {
            title: 'Regular Access Reviews',
            description: 'Conduct regular access reviews of privileged accounts',
            impact: 'medium'
        }
    ],
    compliance: [
        {
            title: 'Data Classification',
            description: 'Implement data classification policies',
            impact: 'high'
        }
    ],
    performance: [
        {
            title: 'Resource Optimization',
            description: 'Optimize resource allocation and usage',
            impact: 'medium'
        }
    ]
};
export const getBestPractices = async () => {
    return BEST_PRACTICES;
};
//# sourceMappingURL=constants.js.map