"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBestPractices = exports.BEST_PRACTICES = exports.RECOMMENDATION_TYPES = exports.METRIC_CATEGORIES = exports.ASSESSMENT_STATUS = exports.API_BASE_URL = void 0;
exports.API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-url.azurewebsites.net/api';
exports.ASSESSMENT_STATUS = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
};
exports.METRIC_CATEGORIES = {
    SECURITY: 'Security',
    COMPLIANCE: 'Compliance',
    PERFORMANCE: 'Performance',
};
exports.RECOMMENDATION_TYPES = {
    SECURITY: 'Security Recommendation',
    COMPLIANCE: 'Compliance Recommendation',
    PERFORMANCE: 'Performance Recommendation',
};
// Add best practices data
exports.BEST_PRACTICES = {
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
const getBestPractices = async () => {
    return exports.BEST_PRACTICES;
};
exports.getBestPractices = getBestPractices;
//# sourceMappingURL=constants.js.map